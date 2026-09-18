package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const nowPaymentsTestSecret = "ipn-secret-for-test"

// 文档示例形态的 IPN：key 未排序、带空白、含 null、嵌套 fee 对象、数字混用整数/小数
const nowPaymentsDocIpnBody = `{
  "payment_id": 123456789,
  "parent_payment_id": null,
  "invoice_id": null,
  "payment_status": "finished",
  "pay_address": "address",
  "payin_extra_id": null,
  "price_amount": 10,
  "price_currency": "usd",
  "pay_amount": 15,
  "actually_paid": 15,
  "actually_paid_at_fiat": 0,
  "pay_currency": "trx",
  "order_id": "NOWPAY-42-1-abc",
  "order_description": "Recharge 10 credits",
  "purchase_id": "123456789",
  "outcome_amount": 14.8106,
  "outcome_currency": "trx",
  "payment_extra_ids": null,
  "fee": {"currency": "btc", "depositFee": 0.09853637216235617, "withdrawalFee": 0, "serviceFee": 0}
}`

// 预期签名由 Python json.dumps(sort_keys=True, separators=(',',':')) + hmac.sha512 独立算出
func TestVerifyNowPaymentsSignature(t *testing.T) {
	const docSignature = "c3f28ffddea33a5ae56576341ac5f56742580c4356eaf0225e56d793948925490f4443e58c3addde167546bd8da051f3dd4ea5ba0d96bbdcc97b529539112f91"
	arrayBody := bytes.Replace([]byte(nowPaymentsDocIpnBody), []byte(`"payment_extra_ids": null`), []byte(`"payment_extra_ids": [5513339153, 5513339154]`), 1)
	htmlBody := bytes.Replace([]byte(nowPaymentsDocIpnBody), []byte(`"order_description": "Recharge 10 credits"`), []byte(`"order_description": "a<b>&c \"q\" / é"`), 1)

	testCases := []struct {
		name      string
		body      []byte
		signature string
		secret    string
		want      bool
	}{
		{name: "doc example canonical form", body: []byte(nowPaymentsDocIpnBody), signature: docSignature, secret: nowPaymentsTestSecret, want: true},
		{name: "uppercase hex accepted", body: []byte(nowPaymentsDocIpnBody), signature: strings.ToUpper(docSignature), secret: nowPaymentsTestSecret, want: true},
		{name: "array kept as array (PHP/Python form)", body: arrayBody, signature: "409a1a9c5ac226dcea81dd383813a2423b66fb470a972b7b4d7cad95eb54a0dd1cdfb1c9cd90d9448a88832cacd9e5829aa2c668efe0691798be678c479bbb36", secret: nowPaymentsTestSecret, want: true},
		{name: "array as indexed object (Node sortObject form)", body: arrayBody, signature: "a04183e1d87a86de51e4d91c914af918632e645e1414a3b2aae8a0ed9409bf64be6206750d4439c64e659f75abb4190ebba3d11f01f14a914ab69e10652d1d59", secret: nowPaymentsTestSecret, want: true},
		{name: "html characters not escaped", body: htmlBody, signature: "6d7eb80665f92a530d9387b50dd16ce5341d92bc8fd3744d5c482bf5df05f7fc042945f3cb437c66f31500dde3e7f246619dbc62843c59404b099fe6f42f1e13", secret: nowPaymentsTestSecret, want: true},
		{name: "wrong secret", body: []byte(nowPaymentsDocIpnBody), signature: docSignature, secret: "other-secret", want: false},
		{name: "tampered body", body: bytes.Replace([]byte(nowPaymentsDocIpnBody), []byte(`"price_amount": 10`), []byte(`"price_amount": 100`), 1), signature: docSignature, secret: nowPaymentsTestSecret, want: false},
		{name: "missing signature", body: []byte(nowPaymentsDocIpnBody), signature: "", secret: nowPaymentsTestSecret, want: false},
		{name: "empty secret", body: []byte(nowPaymentsDocIpnBody), signature: docSignature, secret: "", want: false},
		{name: "invalid json", body: []byte(`not json`), signature: docSignature, secret: nowPaymentsTestSecret, want: false},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, verifyNowPaymentsSignature(tc.body, tc.signature, tc.secret))
		})
	}
}

func setupNowPaymentsWebhookTest(t *testing.T) {
	t.Helper()
	confirmPaymentComplianceForTest(t)

	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldQuotaPerUnit := common.QuotaPerUnit
	oldRedisEnabled := common.RedisEnabled
	oldEnabled, oldApiKey, oldSecret := setting.NowPaymentsEnabled, setting.NowPaymentsApiKey, setting.NowPaymentsIpnSecret

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}, &model.Log{}))

	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.QuotaPerUnit = 500000
	setting.NowPaymentsEnabled = true
	setting.NowPaymentsApiKey = "test-api-key"
	setting.NowPaymentsIpnSecret = nowPaymentsTestSecret
	gin.SetMode(gin.TestMode)

	t.Cleanup(func() {
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.QuotaPerUnit = oldQuotaPerUnit
		common.RedisEnabled = oldRedisEnabled
		setting.NowPaymentsEnabled, setting.NowPaymentsApiKey, setting.NowPaymentsIpnSecret = oldEnabled, oldApiKey, oldSecret
		require.NoError(t, sqlDB.Close())
	})
}

func insertNowPaymentsTestOrder(t *testing.T, tradeNo string, userId int, money float64) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.TopUp{
		UserId:          userId,
		Amount:          10,
		Money:           money,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodNowPayments,
		PaymentProvider: model.PaymentProviderNowPayments,
		CreateTime:      common.GetTimestamp(),
		Status:          common.TopUpStatusPending,
	}).Error)
}

func postNowPaymentsIpn(t *testing.T, payload map[string]any, secret string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := common.MarshalNoHTMLEscape(payload)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/nowpayments/webhook", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Request.Header.Set(nowPaymentsSignatureHeader, nowPaymentsSignature(body, secret))
	NowPaymentsWebhook(ctx)
	return recorder
}

func nowPaymentsIpnPayload(tradeNo string, status string, priceAmount float64) map[string]any {
	return map[string]any{
		"payment_id":        123456789,
		"parent_payment_id": nil,
		"payment_status":    status,
		"price_amount":      priceAmount,
		"price_currency":    "usd",
		"pay_amount":        15,
		"actually_paid":     15,
		"pay_currency":      "trx",
		"order_id":          tradeNo,
		"outcome_amount":    14.8106,
		"outcome_currency":  "trx",
	}
}

func userQuotaForNowPaymentsTest(t *testing.T, userId int) int {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Select("quota").Where("id = ?", userId).First(&user).Error)
	return user.Quota
}

func topUpStatusForNowPaymentsTest(t *testing.T, tradeNo string) string {
	t.Helper()
	topUp := model.GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, topUp)
	return topUp.Status
}

func TestNowPaymentsWebhookCreditsOnlyFinishedFullPayments(t *testing.T) {
	setupNowPaymentsWebhookTest(t)
	const userId = 42
	require.NoError(t, model.DB.Create(&model.User{Id: userId, Username: "nowpayments_user", Status: common.UserStatusEnabled, Quota: 0}).Error)
	insertNowPaymentsTestOrder(t, "NOWPAY-42-1", userId, 10)
	insertNowPaymentsTestOrder(t, "NOWPAY-42-2", userId, 10)
	insertNowPaymentsTestOrder(t, "NOWPAY-42-3", userId, 10)

	t.Run("bad signature is rejected before touching the order", func(t *testing.T) {
		recorder := postNowPaymentsIpn(t, nowPaymentsIpnPayload("NOWPAY-42-1", "finished", 10), "wrong-secret")
		assert.Equal(t, http.StatusUnauthorized, recorder.Code)
		assert.Equal(t, common.TopUpStatusPending, topUpStatusForNowPaymentsTest(t, "NOWPAY-42-1"))
		assert.Equal(t, 0, userQuotaForNowPaymentsTest(t, userId))
	})

	t.Run("intermediate status leaves order pending", func(t *testing.T) {
		recorder := postNowPaymentsIpn(t, nowPaymentsIpnPayload("NOWPAY-42-1", "confirming", 10), nowPaymentsTestSecret)
		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, common.TopUpStatusPending, topUpStatusForNowPaymentsTest(t, "NOWPAY-42-1"))
		assert.Equal(t, 0, userQuotaForNowPaymentsTest(t, userId))
	})

	t.Run("partially paid leaves order pending", func(t *testing.T) {
		recorder := postNowPaymentsIpn(t, nowPaymentsIpnPayload("NOWPAY-42-1", "partially_paid", 10), nowPaymentsTestSecret)
		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, common.TopUpStatusPending, topUpStatusForNowPaymentsTest(t, "NOWPAY-42-1"))
		assert.Equal(t, 0, userQuotaForNowPaymentsTest(t, userId))
	})

	t.Run("finished with mismatched price is not credited", func(t *testing.T) {
		recorder := postNowPaymentsIpn(t, nowPaymentsIpnPayload("NOWPAY-42-1", "finished", 9), nowPaymentsTestSecret)
		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, common.TopUpStatusPending, topUpStatusForNowPaymentsTest(t, "NOWPAY-42-1"))
		assert.Equal(t, 0, userQuotaForNowPaymentsTest(t, userId))
	})

	t.Run("finished re-deposit is not credited", func(t *testing.T) {
		payload := nowPaymentsIpnPayload("NOWPAY-42-1", "finished", 10)
		payload["parent_payment_id"] = 987654321
		recorder := postNowPaymentsIpn(t, payload, nowPaymentsTestSecret)
		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, common.TopUpStatusPending, topUpStatusForNowPaymentsTest(t, "NOWPAY-42-1"))
		assert.Equal(t, 0, userQuotaForNowPaymentsTest(t, userId))
	})

	t.Run("finished full payment credits exactly once", func(t *testing.T) {
		recorder := postNowPaymentsIpn(t, nowPaymentsIpnPayload("NOWPAY-42-1", "finished", 10), nowPaymentsTestSecret)
		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, "OK", recorder.Body.String())
		assert.Equal(t, common.TopUpStatusSuccess, topUpStatusForNowPaymentsTest(t, "NOWPAY-42-1"))
		assert.Equal(t, 10*500000, userQuotaForNowPaymentsTest(t, userId))

		replay := postNowPaymentsIpn(t, nowPaymentsIpnPayload("NOWPAY-42-1", "finished", 10), nowPaymentsTestSecret)
		assert.Equal(t, http.StatusOK, replay.Code)
		assert.Equal(t, 10*500000, userQuotaForNowPaymentsTest(t, userId))
	})

	t.Run("expired marks pending order expired", func(t *testing.T) {
		recorder := postNowPaymentsIpn(t, nowPaymentsIpnPayload("NOWPAY-42-2", "expired", 10), nowPaymentsTestSecret)
		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, common.TopUpStatusExpired, topUpStatusForNowPaymentsTest(t, "NOWPAY-42-2"))

		late := postNowPaymentsIpn(t, nowPaymentsIpnPayload("NOWPAY-42-2", "finished", 10), nowPaymentsTestSecret)
		assert.Equal(t, http.StatusOK, late.Code)
		assert.Equal(t, common.TopUpStatusExpired, topUpStatusForNowPaymentsTest(t, "NOWPAY-42-2"))
		assert.Equal(t, 10*500000, userQuotaForNowPaymentsTest(t, userId))
	})

	t.Run("failed marks pending order failed", func(t *testing.T) {
		recorder := postNowPaymentsIpn(t, nowPaymentsIpnPayload("NOWPAY-42-3", "failed", 10), nowPaymentsTestSecret)
		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, common.TopUpStatusFailed, topUpStatusForNowPaymentsTest(t, "NOWPAY-42-3"))
	})

	t.Run("unknown order id is acknowledged without side effects", func(t *testing.T) {
		recorder := postNowPaymentsIpn(t, nowPaymentsIpnPayload("NOWPAY-99-9", "finished", 10), nowPaymentsTestSecret)
		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, 10*500000, userQuotaForNowPaymentsTest(t, userId))
	})
}

// full-currencies 的 network_precision 实测是字符串（"18"），文档形态是数字；非 EVM 币种的 smart_contract 为 null。
// 任一形态都不能让解析失败；精度缺失按"未知"处理，由收款页退回纯地址二维码。同条目里的 precision 是展示位数，不能拿来当 decimals。
func TestNowPaymentsCurrencyInfoParsing(t *testing.T) {
	testCases := []struct {
		name         string
		body         string
		wantContract string
		wantDecimals int64
		precisionOk  bool
	}{
		{name: "string precision as the API actually sends it", body: `{"currencies":[{"code":"USDTBSC","network":"bsc","smart_contract":"0x55d398326f99059ff775485246999027b3197955","network_precision":"18","precision":8}]}`, wantContract: "0x55d398326f99059ff775485246999027b3197955", wantDecimals: 18, precisionOk: true},
		{name: "numeric precision", body: `{"currencies":[{"code":"USDTERC20","network":"eth","smart_contract":"0xdAC17F958D2ee523a2206206994597C13D831ec7","network_precision":6}]}`, wantContract: "0xdAC17F958D2ee523a2206206994597C13D831ec7", wantDecimals: 6, precisionOk: true},
		{name: "null contract on a non-EVM chain", body: `{"currencies":[{"code":"USDCALGO","network":"algo","smart_contract":null,"network_precision":"6","precision":8}]}`, wantContract: "", wantDecimals: 6, precisionOk: true},
		{name: "missing precision", body: `{"currencies":[{"code":"XYZ","network":"xyz"}]}`, precisionOk: false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var result nowPaymentsFullCurrenciesResponse
			require.NoError(t, common.Unmarshal([]byte(tc.body), &result))
			require.Len(t, result.Currencies, 1)
			info := result.Currencies[0]
			assert.Equal(t, tc.wantContract, info.SmartContract)

			decimals, err := info.NetworkPrecision.Int64()
			if !tc.precisionOk {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.wantDecimals, decimals)
		})
	}
}

func TestNowPaymentsWebhookRejectedWhenDisabled(t *testing.T) {
	setupNowPaymentsWebhookTest(t)
	setting.NowPaymentsEnabled = false

	recorder := postNowPaymentsIpn(t, nowPaymentsIpnPayload("NOWPAY-42-1", "finished", 10), nowPaymentsTestSecret)
	assert.Equal(t, http.StatusForbidden, recorder.Code)
}
