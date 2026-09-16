package setting

var (
	NowPaymentsEnabled       bool
	NowPaymentsApiKey        string
	NowPaymentsIpnSecret     string
	NowPaymentsSandbox       bool
	NowPaymentsUnitPrice     float64 = 1.0
	NowPaymentsMinTopUp      int     = 1
	// 固定汇率/用户承担手续费依赖账号开通（GET /currencies?fixed_rate=true 为空即不可用），默认走标准流程
	NowPaymentsFeePaidByUser bool
	NowPaymentsFixedRate     bool
	NowPaymentsPayCurrency   string  = "usdttrc20" // 发票页预选币种，空则由用户自选
)
