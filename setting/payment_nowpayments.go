package setting

var (
	NowPaymentsEnabled       bool
	NowPaymentsApiKey        string
	NowPaymentsIpnSecret     string
	NowPaymentsSandbox       bool
	NowPaymentsUnitPrice     float64 = 1.0
	NowPaymentsMinTopUp      int     = 1
	NowPaymentsFeePaidByUser bool    = true
	NowPaymentsFixedRate     bool    = true
	NowPaymentsPayCurrency   string  = "usdttrc20" // 发票页预选币种，空则由用户自选
)
