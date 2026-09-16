package setting

import "strings"

var (
	NowPaymentsEnabled   bool
	NowPaymentsApiKey    string
	NowPaymentsIpnSecret string
	NowPaymentsSandbox   bool
	NowPaymentsUnitPrice float64 = 1.0
	NowPaymentsMinTopUp  int     = 1
	// 固定汇率/用户承担手续费依赖账号开通（GET /currencies?fixed_rate=true 为空即不可用），默认走标准流程
	NowPaymentsFeePaidByUser bool
	NowPaymentsFixedRate     bool
	// NowPaymentsPayCurrencies 是收款币种白名单，逗号分隔的 NOWPayments ticker。
	// 必须与账号后台 coins settings 里实际勾选的币种一致，未勾选的 ticker 创建支付会被拒。
	// 默认值对应已启用的 USDT/USDC 十条链；稳定币按 1 枚 = 1 USD 计价，见 createNowPaymentsPayment。
	NowPaymentsPayCurrencies = "usdterc20,usdtbsc,usdtarb,usdtmatic,usdtton,usdc,usdcbsc,usdcarb,usdcmatic,usdcalgo"
)

// GetNowPaymentsPayCurrencies 返回去空、去重、小写化后的收款币种白名单。
func GetNowPaymentsPayCurrencies() []string {
	seen := make(map[string]bool)
	currencies := make([]string, 0, 8)
	for _, item := range strings.Split(NowPaymentsPayCurrencies, ",") {
		ticker := strings.ToLower(strings.TrimSpace(item))
		if ticker == "" || seen[ticker] {
			continue
		}
		seen[ticker] = true
		currencies = append(currencies, ticker)
	}
	return currencies
}

// IsNowPaymentsPayCurrencyAllowed 判断用户选择的收款币种是否在白名单内。
func IsNowPaymentsPayCurrencyAllowed(ticker string) bool {
	ticker = strings.ToLower(strings.TrimSpace(ticker))
	if ticker == "" {
		return false
	}
	for _, allowed := range GetNowPaymentsPayCurrencies() {
		if allowed == ticker {
			return true
		}
	}
	return false
}
