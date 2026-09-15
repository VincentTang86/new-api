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
)
