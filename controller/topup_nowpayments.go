package controller

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
)

const (
	nowPaymentsApiBase         = "https://api.nowpayments.io/v1"
	nowPaymentsSandboxApiBase  = "https://api-sandbox.nowpayments.io/v1"
	nowPaymentsSignatureHeader = "x-nowpayments-sig"
	nowPaymentsPriceCurrency   = "usd"
)

type NowPaymentsPayRequest struct {
	Amount      int64  `json:"amount"`
	PayCurrency string `json:"pay_currency"`
}

// nowPaymentsPaymentRequest 对应 POST /v1/payment。
// 相比托管发票（POST /v1/invoice），这里可以显式指定 pay_amount，稳定币才能按 1 枚 = 1 USD 收款；
// 发票接口没有该字段，币量只能由 NOWPayments 按行情折算，用户会看到 19.93711671 这种数字。
type nowPaymentsPaymentRequest struct {
	PriceAmount      json.Number `json:"price_amount"`
	PriceCurrency    string      `json:"price_currency"`
	PayAmount        json.Number `json:"pay_amount"`
	PayCurrency      string      `json:"pay_currency"`
	OrderId          string      `json:"order_id"`
	OrderDescription string      `json:"order_description"`
	IpnCallbackUrl   string      `json:"ipn_callback_url"`
	IsFixedRate      bool        `json:"is_fixed_rate"`
	IsFeePaidByUser  bool        `json:"is_fee_paid_by_user"`
}

type nowPaymentsPaymentResponse struct {
	PaymentId     json.Number `json:"payment_id"`
	PaymentStatus string      `json:"payment_status"`
	PayAddress    string      `json:"pay_address"`
	PayAmount     json.Number `json:"pay_amount"`
	PayCurrency   string      `json:"pay_currency"`
	PayinExtraId  string      `json:"payin_extra_id"`
	Network       string      `json:"network"`
	ValidUntil    string      `json:"valid_until"`
	Code          string      `json:"code"`
	Message       string      `json:"message"`
}

type nowPaymentsMinAmountResponse struct {
	CurrencyFrom   string      `json:"currency_from"`
	MinAmount      json.Number `json:"min_amount"`
	FiatEquivalent json.Number `json:"fiat_equivalent"`
	Code           string      `json:"code"`
	Message        string      `json:"message"`
}

// nowPaymentsIpn 是 IPN 回调体，字段与「查询支付状态」响应一致。
// 数值字段用 json.Number：NOWPayments 对同一字段时而发数字时而发字符串，null 则保持为空。
type nowPaymentsIpn struct {
	PaymentId          json.Number `json:"payment_id"`
	ParentPaymentId    json.Number `json:"parent_payment_id"`
	InvoiceId          json.Number `json:"invoice_id"`
	PaymentStatus      string      `json:"payment_status"`
	PriceAmount        json.Number `json:"price_amount"`
	PriceCurrency      string      `json:"price_currency"`
	PayAmount          json.Number `json:"pay_amount"`
	ActuallyPaid       json.Number `json:"actually_paid"`
	ActuallyPaidAtFiat json.Number `json:"actually_paid_at_fiat"`
	PayCurrency        string      `json:"pay_currency"`
	OrderId            string      `json:"order_id"`
	OutcomeAmount      json.Number `json:"outcome_amount"`
	OutcomeCurrency    string      `json:"outcome_currency"`
}

func getNowPaymentsApiBase() string {
	if setting.NowPaymentsSandbox {
		return nowPaymentsSandboxApiBase
	}
	return nowPaymentsApiBase
}

// getNowPaymentsPayMoney 把用户输入的充值数量换算成 NOWPayments 上以 USD 计价的应付金额。
func getNowPaymentsPayMoney(amount float64, group string) float64 {
	originalAmount := amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = amount / common.QuotaPerUnit
	}
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(originalAmount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}
	return amount * setting.NowPaymentsUnitPrice * topupGroupRatio * discount
}

func RequestNowPaymentsAmount(c *gin.Context) {
	var req NowPaymentsPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	minTopup := int64(setting.NowPaymentsMinTopUp)
	if req.Amount < minTopup {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", minTopup)})
		return
	}
	id := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}

	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	payMoney := getNowPaymentsPayMoney(float64(req.Amount), group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

// RequestNowPaymentsPay 创建本地订单并在 NOWPayments 直接生成收款地址，返回本地订单号供收款页使用
func RequestNowPaymentsPay(c *gin.Context) {
	if !isNowPaymentsTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "NOWPayments 支付未启用"})
		return
	}

	var req NowPaymentsPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	minTopup := int64(setting.NowPaymentsMinTopUp)
	if req.Amount < minTopup {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", minTopup)})
		return
	}
	payCurrency := strings.ToLower(strings.TrimSpace(req.PayCurrency))
	if !setting.IsNowPaymentsPayCurrencyAllowed(payCurrency) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的收款币种"})
		return
	}
	id := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}

	group, _ := model.GetUserGroup(id, true)
	payMoney := getNowPaymentsPayMoney(float64(req.Amount), group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	// 各链最低支付额差异很大，低于门槛的支付上游会直接拒绝或无法结算，先拦下来给出明确提示。
	// 查询本身失败不阻断支付：门槛由 NOWPayments 侧再兜一次。
	if minAmount, _, err := getNowPaymentsMinAmount(c.Request.Context(), payCurrency); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("NOWPayments 最低支付额查询失败，跳过本地校验 user_id=%d pay_currency=%s error=%q", id, payCurrency, err.Error()))
	} else if payMoney < minAmount {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("该链最低充值 %s %s，请提高金额或更换链", strconv.FormatFloat(minAmount, 'f', -1, 64), strings.ToUpper(payCurrency))})
		return
	}

	tradeNo := fmt.Sprintf("NOWPAY-%d-%d-%s", id, time.Now().UnixMilli(), randstr.String(6))

	// Token 模式下归一化 Amount（存等价美元数量，避免 RechargeNowPayments 双重放大）
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = int64(float64(req.Amount) / common.QuotaPerUnit)
		if amount < 1 {
			amount = 1
		}
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodNowPayments,
		PaymentProvider: model.PaymentProviderNowPayments,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
		CryptoCurrency:  payCurrency,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("NOWPayments 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	payment, err := createNowPaymentsPayment(c.Request.Context(), tradeNo, req.Amount, payMoney, payCurrency)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("NOWPayments 创建支付失败 user_id=%d trade_no=%s money=%.2f pay_currency=%s error=%q", id, tradeNo, payMoney, payCurrency, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	// 上游可能因四舍五入或最小精度回一个与请求略有出入的 pay_amount，以它返回的为准展示给用户。
	payAmount, err := payment.PayAmount.Float64()
	if err != nil || payAmount <= 0 {
		payAmount = payMoney
	} else {
		// 原串留给收款页生成带金额的二维码：经 float64 再回到字符串会丢精度。
		topUp.CryptoAmountText = payment.PayAmount.String()
	}
	topUp.CryptoPaymentId = payment.PaymentId.String()
	topUp.CryptoAmount = payAmount
	topUp.CryptoAddress = payment.PayAddress
	topUp.CryptoNetwork = payment.Network
	topUp.CryptoExtraId = payment.PayinExtraId
	// 合约与精度决定收款页能否生成带金额的二维码。建单响应不带这两项，要另查币种元数据；查不到就留空，前端退回纯地址二维码。
	if info, ok := getNowPaymentsCurrencyInfo(c.Request.Context(), payCurrency); ok {
		topUp.CryptoContract = info.SmartContract
		if precision, precisionErr := info.NetworkPrecision.Int64(); precisionErr == nil && precision > 0 {
			topUp.CryptoDecimals = int(precision)
		} else if info.SmartContract != "" {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("NOWPayments 币种元数据缺少有效 network_precision，收款页不提供带金额二维码 trade_no=%s pay_currency=%s network_precision=%q", tradeNo, payCurrency, info.NetworkPrecision))
		}
	}
	if validUntil, parseErr := time.Parse(time.RFC3339, payment.ValidUntil); parseErr == nil {
		topUp.CryptoExpiresAt = validUntil.Unix()
	}
	if err := topUp.Update(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("NOWPayments 保存收款信息失败 user_id=%d trade_no=%s payment_id=%s error=%q", id, tradeNo, topUp.CryptoPaymentId, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("NOWPayments 充值订单创建成功 user_id=%d trade_no=%s payment_id=%s amount=%d money=%.2f pay_amount=%s pay_currency=%s network=%s smart_contract=%s network_precision=%d fixed_rate=%t fee_paid_by_user=%t", id, tradeNo, topUp.CryptoPaymentId, req.Amount, payMoney, payment.PayAmount, payCurrency, payment.Network, topUp.CryptoContract, topUp.CryptoDecimals, setting.NowPaymentsFixedRate, setting.NowPaymentsFeePaidByUser))

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    gin.H{"trade_no": tradeNo},
	})
}

// GetNowPaymentsCurrencies 返回收款币种白名单及各自的最低支付额，供前端在确认弹窗里选链。
// 低于门槛的链仍然返回，由前端置灰并展示门槛，比直接隐藏更容易让用户明白为什么不能选。
func GetNowPaymentsCurrencies(c *gin.Context) {
	if !isNowPaymentsTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "NOWPayments 支付未启用"})
		return
	}

	amount, _ := strconv.ParseInt(c.Query("amount"), 10, 64)
	payMoney := 0.0
	if amount > 0 {
		group, _ := model.GetUserGroup(c.GetInt("id"), true)
		payMoney = getNowPaymentsPayMoney(float64(amount), group)
	}

	currencies := make([]gin.H, 0, 8)
	for _, ticker := range setting.GetNowPaymentsPayCurrencies() {
		entry := gin.H{"ticker": ticker, "available": true}
		minAmount, minAmountUsd, err := getNowPaymentsMinAmount(c.Request.Context(), ticker)
		if err != nil {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("NOWPayments 最低支付额查询失败 pay_currency=%s error=%q", ticker, err.Error()))
		} else {
			entry["min_amount"] = minAmount
			entry["min_amount_usd"] = minAmountUsd
			if payMoney > 0 && payMoney < minAmount {
				entry["available"] = false
			}
		}
		currencies = append(currencies, entry)
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "data": currencies})
}

// GetNowPaymentsPayment 返回收款页所需的地址与订单状态，供用户轮询。
func GetNowPaymentsPayment(c *gin.Context) {
	tradeNo := c.Param("trade_no")
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.UserId != c.GetInt("id") ||
		topUp.PaymentProvider != model.PaymentProviderNowPayments {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "订单不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"trade_no":     topUp.TradeNo,
			"payment_id":   topUp.CryptoPaymentId,
			"status":       topUp.Status,
			"topup_amount": topUp.Amount,
			"money":        topUp.Money,
			"pay_currency": topUp.CryptoCurrency,
			"pay_amount":   topUp.CryptoAmount,
			"pay_address":  topUp.CryptoAddress,
			"network":      topUp.CryptoNetwork,
			"extra_id":     topUp.CryptoExtraId,
			"expires_at":   topUp.CryptoExpiresAt,
			"create_time":  topUp.CreateTime,
			// 三者齐全前端才会生成带金额的二维码，任一为空退回纯地址二维码。
			"contract":        topUp.CryptoContract,
			"decimals":        topUp.CryptoDecimals,
			"pay_amount_text": topUp.CryptoAmountText,
		},
	})
}

// callNowPaymentsApi 发一次带鉴权的上游请求并把响应解到 out。body 为 nil 时发 GET。
func callNowPaymentsApi(ctx context.Context, path string, body any, out any) error {
	method := http.MethodGet
	var payload io.Reader
	if body != nil {
		method = http.MethodPost
		jsonData, err := common.Marshal(body)
		if err != nil {
			return fmt.Errorf("序列化请求数据失败: %w", err)
		}
		payload = bytes.NewReader(jsonData)
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, method, getNowPaymentsApiBase()+path, payload)
	if err != nil {
		return fmt.Errorf("创建HTTP请求失败: %w", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("x-api-key", setting.NowPaymentsApiKey)

	resp, err := service.GetHttpClient().Do(req)
	if err != nil {
		return fmt.Errorf("发送HTTP请求失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("读取响应失败: %w", err)
	}
	if err := common.Unmarshal(respBody, out); err != nil {
		return fmt.Errorf("解析响应失败 status=%d body=%q: %w", resp.StatusCode, string(respBody), err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("NOWPayments 返回错误 status=%d body=%q", resp.StatusCode, string(respBody))
	}
	return nil
}

// getNowPaymentsMinAmount 查询某收款币种的最低支付额，并返回其美元等值。
// 各链网络费差异极大（以太坊主网门槛远高于 BSC/TON），所以门槛必须实时取而不是写死。
func getNowPaymentsMinAmount(ctx context.Context, ticker string) (minAmount float64, fiatEquivalent float64, err error) {
	path := fmt.Sprintf("/min-amount?currency_from=%s&fiat_equivalent=%s&is_fixed_rate=%t&is_fee_paid_by_user=%t",
		url.QueryEscape(ticker), nowPaymentsPriceCurrency, setting.NowPaymentsFixedRate, setting.NowPaymentsFeePaidByUser)

	var result nowPaymentsMinAmountResponse
	if err := callNowPaymentsApi(ctx, path, nil, &result); err != nil {
		return 0, 0, err
	}
	minAmount, err = result.MinAmount.Float64()
	if err != nil {
		return 0, 0, fmt.Errorf("解析 min_amount 失败: %w", err)
	}
	// fiat_equivalent 是可选字段，缺失时对稳定币退回币量本身（1 枚 = 1 USD）。
	fiatEquivalent, fiatErr := result.FiatEquivalent.Float64()
	if fiatErr != nil || fiatEquivalent <= 0 {
		fiatEquivalent = minAmount
	}
	return minAmount, fiatEquivalent, nil
}

// nowPaymentsCurrencyInfo 是 GET /v1/full-currencies 里一条币种的元数据。建单与状态查询响应都不带合约与精度，只有这个接口有。
// network_precision 是链上 decimals（时数字时字符串）；precision 只是展示位数（BSC 的 USDT 为 8），不能用于换算。
type nowPaymentsCurrencyInfo struct {
	Code             string      `json:"code"`
	Network          string      `json:"network"`
	SmartContract    string      `json:"smart_contract"`
	NetworkPrecision json.Number `json:"network_precision"`
}

type nowPaymentsFullCurrenciesResponse struct {
	Currencies []nowPaymentsCurrencyInfo `json:"currencies"`
}

// 币种元数据几乎不变，进程内缓存一份；只在建单时查，不进收款页轮询路径。
var nowPaymentsCurrencyCache struct {
	sync.Mutex
	fetchedAt time.Time
	byTicker  map[string]nowPaymentsCurrencyInfo
}

const nowPaymentsCurrencyCacheTTL = 6 * time.Hour

// getNowPaymentsCurrencyInfo 返回 ticker 对应的合约与精度；拉取失败或未收录返回 false，由收款页退回纯地址二维码。
func getNowPaymentsCurrencyInfo(ctx context.Context, ticker string) (nowPaymentsCurrencyInfo, bool) {
	nowPaymentsCurrencyCache.Lock()
	defer nowPaymentsCurrencyCache.Unlock()

	if nowPaymentsCurrencyCache.byTicker == nil || time.Since(nowPaymentsCurrencyCache.fetchedAt) > nowPaymentsCurrencyCacheTTL {
		var result nowPaymentsFullCurrenciesResponse
		err := callNowPaymentsApi(ctx, "/full-currencies", nil, &result)
		if err == nil && len(result.Currencies) == 0 {
			err = errors.New("响应里没有 currencies")
		}
		if err != nil {
			// 过期的旧缓存若还在就继续用，比没有强。
			logger.LogWarn(ctx, fmt.Sprintf("NOWPayments 币种元数据拉取失败 error=%q", err.Error()))
		} else {
			byTicker := make(map[string]nowPaymentsCurrencyInfo, len(result.Currencies))
			for _, info := range result.Currencies {
				byTicker[strings.ToLower(info.Code)] = info
			}
			nowPaymentsCurrencyCache.byTicker = byTicker
			nowPaymentsCurrencyCache.fetchedAt = time.Now()
		}
	}
	info, ok := nowPaymentsCurrencyCache.byTicker[ticker]
	return info, ok
}

// createNowPaymentsPayment 调用 POST /v1/payment 直接生成收款地址。
// payMoney 同时作为 price_amount(USD) 与 pay_amount(稳定币)，即 1 枚稳定币按 1 USD 收取；
// IPN 仍以 price_amount + price_currency=usd 入账，汇率波动不影响到账额度。
func createNowPaymentsPayment(ctx context.Context, tradeNo string, amount int64, payMoney float64, payCurrency string) (*nowPaymentsPaymentResponse, error) {
	moneyText := json.Number(strconv.FormatFloat(payMoney, 'f', 2, 64))
	requestData := nowPaymentsPaymentRequest{
		PriceAmount:      moneyText,
		PriceCurrency:    nowPaymentsPriceCurrency,
		PayAmount:        moneyText,
		PayCurrency:      payCurrency,
		OrderId:          tradeNo,
		OrderDescription: fmt.Sprintf("Recharge %d credits", amount),
		IpnCallbackUrl:   service.GetCallbackAddress() + "/api/nowpayments/webhook",
		IsFixedRate:      setting.NowPaymentsFixedRate,
		IsFeePaidByUser:  setting.NowPaymentsFeePaidByUser,
	}

	var payment nowPaymentsPaymentResponse
	if err := callNowPaymentsApi(ctx, "/payment", requestData, &payment); err != nil {
		return nil, err
	}
	if payment.PayAddress == "" {
		return nil, fmt.Errorf("响应缺少 pay_address code=%s message=%q", payment.Code, payment.Message)
	}
	return &payment, nil
}

func nowPaymentsSignature(payload []byte, secret string) string {
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

// nowPaymentsArraysToObjects 复现官方 Node 示例 sortObject 的副作用：数组被当作对象递归，变成 {"0":..,"1":..}
func nowPaymentsArraysToObjects(v any) any {
	switch t := v.(type) {
	case map[string]any:
		out := make(map[string]any, len(t))
		for k, item := range t {
			out[k] = nowPaymentsArraysToObjects(item)
		}
		return out
	case []any:
		out := make(map[string]any, len(t))
		for i, item := range t {
			out[strconv.Itoa(i)] = nowPaymentsArraysToObjects(item)
		}
		return out
	default:
		return v
	}
}

// verifyNowPaymentsSignature 按 NOWPayments 规则验签：body 按 key 递归排序后紧凑序列化，HMAC-SHA512 hex。
// 官方 Node 示例会把数组转成索引对象，PHP/Python 示例保留数组，两种形态任一匹配即通过（都由我方密钥签出）。
func verifyNowPaymentsSignature(body []byte, signature string, secret string) bool {
	if strings.TrimSpace(secret) == "" || strings.TrimSpace(signature) == "" {
		return false
	}
	var params map[string]any
	if err := common.UnmarshalUseNumber(body, &params); err != nil {
		return false
	}
	received := []byte(strings.ToLower(strings.TrimSpace(signature)))

	canonical, err := common.MarshalNoHTMLEscape(params)
	if err != nil {
		return false
	}
	if hmac.Equal(received, []byte(nowPaymentsSignature(canonical, secret))) {
		return true
	}

	indexed, err := common.MarshalNoHTMLEscape(nowPaymentsArraysToObjects(params))
	if err != nil {
		return false
	}
	return hmac.Equal(received, []byte(nowPaymentsSignature(indexed, secret)))
}

// NowPaymentsWebhook 处理 IPN 回调。只有 finished 入账；partially_paid 与重复入金保持待支付，交由人工补单。
func NowPaymentsWebhook(c *gin.Context) {
	if !isNowPaymentsWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("NOWPayments webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("NOWPayments webhook 读取请求体失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	signature := c.GetHeader(nowPaymentsSignatureHeader)
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("NOWPayments webhook 收到请求 path=%q client_ip=%s signature=%q body=%q", c.Request.RequestURI, c.ClientIP(), signature, string(bodyBytes)))

	if !verifyNowPaymentsSignature(bodyBytes, signature, setting.NowPaymentsIpnSecret) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("NOWPayments webhook 验签失败 path=%q client_ip=%s signature=%q body=%q", c.Request.RequestURI, c.ClientIP(), signature, string(bodyBytes)))
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	var ipn nowPaymentsIpn
	if err := common.Unmarshal(bodyBytes, &ipn); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("NOWPayments webhook 解析失败 path=%q client_ip=%s error=%q body=%q", c.Request.RequestURI, c.ClientIP(), err.Error(), string(bodyBytes)))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	tradeNo := strings.TrimSpace(ipn.OrderId)
	if tradeNo == "" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("NOWPayments webhook 忽略无 order_id 的通知 payment_id=%s payment_status=%s", ipn.PaymentId, ipn.PaymentStatus))
		c.String(http.StatusOK, "OK")
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("NOWPayments webhook 验签成功 trade_no=%s payment_id=%s payment_status=%s client_ip=%s", tradeNo, ipn.PaymentId, ipn.PaymentStatus, c.ClientIP()))

	switch ipn.PaymentStatus {
	case "finished":
		if ipn.ParentPaymentId != "" {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("NOWPayments 重复入金，不自动入账，需人工核实后补单 trade_no=%s payment_id=%s parent_payment_id=%s price_amount=%s actually_paid=%s pay_currency=%s outcome_amount=%s outcome_currency=%s", tradeNo, ipn.PaymentId, ipn.ParentPaymentId, ipn.PriceAmount, ipn.ActuallyPaid, ipn.PayCurrency, ipn.OutcomeAmount, ipn.OutcomeCurrency))
			c.String(http.StatusOK, "OK")
			return
		}
		priceAmount, parseErr := ipn.PriceAmount.Float64()
		if parseErr != nil || !strings.EqualFold(ipn.PriceCurrency, nowPaymentsPriceCurrency) {
			logger.LogError(c.Request.Context(), fmt.Sprintf("NOWPayments 计价信息异常，不自动入账 trade_no=%s payment_id=%s price_amount=%s price_currency=%s", tradeNo, ipn.PaymentId, ipn.PriceAmount, ipn.PriceCurrency))
			c.String(http.StatusOK, "OK")
			return
		}

		LockOrder(tradeNo)
		defer UnlockOrder(tradeNo)

		if err := model.RechargeNowPayments(tradeNo, priceAmount, c.ClientIP()); err != nil {
			if errors.Is(err, model.ErrTopUpNotFound) || errors.Is(err, model.ErrPaymentMethodMismatch) ||
				errors.Is(err, model.ErrTopUpStatusInvalid) || errors.Is(err, model.ErrInvalidTopUpQuota) ||
				errors.Is(err, model.ErrTopUpMoneyMismatch) {
				// 订单层面的永久性问题，返回 200 避免 NOWPayments 无意义重试，留待人工处理
				logger.LogError(c.Request.Context(), fmt.Sprintf("NOWPayments 订单不可入账 trade_no=%s payment_id=%s price_amount=%s error=%q", tradeNo, ipn.PaymentId, ipn.PriceAmount, err.Error()))
				c.String(http.StatusOK, "OK")
				return
			}
			logger.LogError(c.Request.Context(), fmt.Sprintf("NOWPayments 充值处理失败 trade_no=%s payment_id=%s client_ip=%s error=%q", tradeNo, ipn.PaymentId, c.ClientIP(), err.Error()))
			c.String(http.StatusInternalServerError, "retry")
			return
		}

		logger.LogInfo(c.Request.Context(), fmt.Sprintf("NOWPayments 充值成功 trade_no=%s payment_id=%s actually_paid=%s pay_currency=%s outcome_amount=%s outcome_currency=%s client_ip=%s", tradeNo, ipn.PaymentId, ipn.ActuallyPaid, ipn.PayCurrency, ipn.OutcomeAmount, ipn.OutcomeCurrency, c.ClientIP()))
		c.String(http.StatusOK, "OK")

	case "partially_paid":
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("NOWPayments 少付，订单保持待支付，需人工核实后补单 trade_no=%s payment_id=%s price_amount=%s pay_amount=%s actually_paid=%s actually_paid_at_fiat=%s pay_currency=%s outcome_amount=%s outcome_currency=%s", tradeNo, ipn.PaymentId, ipn.PriceAmount, ipn.PayAmount, ipn.ActuallyPaid, ipn.ActuallyPaidAtFiat, ipn.PayCurrency, ipn.OutcomeAmount, ipn.OutcomeCurrency))
		c.String(http.StatusOK, "OK")

	case "failed", "refunded", "expired":
		targetStatus := common.TopUpStatusFailed
		if ipn.PaymentStatus == "expired" {
			targetStatus = common.TopUpStatusExpired
		}
		if err := model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderNowPayments, targetStatus); err != nil &&
			!errors.Is(err, model.ErrTopUpNotFound) &&
			!errors.Is(err, model.ErrTopUpStatusInvalid) {
			logger.LogError(c.Request.Context(), fmt.Sprintf("NOWPayments 标记订单状态失败 trade_no=%s payment_status=%s error=%q", tradeNo, ipn.PaymentStatus, err.Error()))
		}
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("NOWPayments 订单终态非成功 trade_no=%s payment_id=%s payment_status=%s", tradeNo, ipn.PaymentId, ipn.PaymentStatus))
		c.String(http.StatusOK, "OK")

	default:
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("NOWPayments 中间状态，忽略 trade_no=%s payment_id=%s payment_status=%s", tradeNo, ipn.PaymentId, ipn.PaymentStatus))
		c.String(http.StatusOK, "OK")
	}
}
