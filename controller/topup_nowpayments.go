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
	"strconv"
	"strings"
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
	Amount int64 `json:"amount"`
}

type nowPaymentsInvoiceRequest struct {
	PriceAmount      json.Number `json:"price_amount"`
	PriceCurrency    string      `json:"price_currency"`
	PayCurrency      string      `json:"pay_currency,omitempty"`
	OrderId          string      `json:"order_id"`
	OrderDescription string      `json:"order_description"`
	IpnCallbackUrl   string      `json:"ipn_callback_url"`
	SuccessUrl       string      `json:"success_url"`
	CancelUrl        string      `json:"cancel_url"`
	PartiallyPaidUrl string      `json:"partially_paid_url"`
	IsFixedRate      bool        `json:"is_fixed_rate"`
	IsFeePaidByUser  bool        `json:"is_fee_paid_by_user"`
}

type nowPaymentsInvoiceResponse struct {
	Id         string `json:"id"`
	OrderId    string `json:"order_id"`
	InvoiceUrl string `json:"invoice_url"`
	Code       string `json:"code"`
	Message    string `json:"message"`
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

// RequestNowPaymentsPay 创建本地订单并在 NOWPayments 创建托管发票，返回收银台链接
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
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("NOWPayments 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	invoiceUrl, err := createNowPaymentsInvoice(c.Request.Context(), tradeNo, req.Amount, payMoney)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("NOWPayments 创建发票失败 user_id=%d trade_no=%s money=%.2f error=%q", id, tradeNo, payMoney, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("NOWPayments 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f pay_currency=%q fixed_rate=%t fee_paid_by_user=%t", id, tradeNo, req.Amount, payMoney, setting.NowPaymentsPayCurrency, setting.NowPaymentsFixedRate, setting.NowPaymentsFeePaidByUser))

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"invoice_url": invoiceUrl,
			"order_id":    tradeNo,
		},
	})
}

// createNowPaymentsInvoice 调用 POST /v1/invoice，返回托管收银台链接
func createNowPaymentsInvoice(ctx context.Context, tradeNo string, amount int64, payMoney float64) (string, error) {
	returnUrl := paymentReturnPath("/wallet?show_history=true")
	requestData := nowPaymentsInvoiceRequest{
		PriceAmount:      json.Number(strconv.FormatFloat(payMoney, 'f', 2, 64)),
		PriceCurrency:    nowPaymentsPriceCurrency,
		PayCurrency:      strings.ToLower(strings.TrimSpace(setting.NowPaymentsPayCurrency)),
		OrderId:          tradeNo,
		OrderDescription: fmt.Sprintf("Recharge %d credits", amount),
		IpnCallbackUrl:   service.GetCallbackAddress() + "/api/nowpayments/webhook",
		SuccessUrl:       returnUrl,
		CancelUrl:        returnUrl,
		PartiallyPaidUrl: returnUrl,
		IsFixedRate:      setting.NowPaymentsFixedRate,
		IsFeePaidByUser:  setting.NowPaymentsFeePaidByUser,
	}
	jsonData, err := common.Marshal(requestData)
	if err != nil {
		return "", fmt.Errorf("序列化请求数据失败: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, getNowPaymentsApiBase()+"/invoice", bytes.NewReader(jsonData))
	if err != nil {
		return "", fmt.Errorf("创建HTTP请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", setting.NowPaymentsApiKey)

	resp, err := service.GetHttpClient().Do(req)
	if err != nil {
		return "", fmt.Errorf("发送HTTP请求失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应失败: %w", err)
	}
	var invoice nowPaymentsInvoiceResponse
	if err := common.Unmarshal(respBody, &invoice); err != nil {
		return "", fmt.Errorf("解析响应失败 status=%d body=%q: %w", resp.StatusCode, string(respBody), err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("NOWPayments 返回错误 status=%d code=%s message=%q", resp.StatusCode, invoice.Code, invoice.Message)
	}
	if invoice.InvoiceUrl == "" {
		return "", fmt.Errorf("响应缺少 invoice_url body=%q", string(respBody))
	}
	return invoice.InvoiceUrl, nil
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
