package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// 收款币种白名单是用户输入进入上游支付请求前的唯一闸门：未在 NOWPayments 后台
// 勾选的 ticker 会让创建支付直接失败，而任意字符串更会把订单打到无人认领的链上。
func TestNowPaymentsPayCurrencyWhitelist(t *testing.T) {
	original := NowPaymentsPayCurrencies
	t.Cleanup(func() { NowPaymentsPayCurrencies = original })

	t.Run("normalizes the configured list", func(t *testing.T) {
		cases := []struct {
			name     string
			config   string
			expected []string
		}{
			{
				name:     "trims spaces, lowercases and drops duplicates",
				config:   " USDTBSC , usdtton,usdtbsc,, USDC ",
				expected: []string{"usdtbsc", "usdtton", "usdc"},
			},
			{
				name:     "empty config accepts nothing",
				config:   "  ,  ",
				expected: []string{},
			},
		}

		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				NowPaymentsPayCurrencies = tc.config
				assert.Equal(t, tc.expected, GetNowPaymentsPayCurrencies())
			})
		}
	})

	t.Run("only accepts tickers on the list", func(t *testing.T) {
		NowPaymentsPayCurrencies = "usdtbsc,usdtton"

		cases := []struct {
			ticker  string
			allowed bool
		}{
			{ticker: "usdtbsc", allowed: true},
			{ticker: " USDTBSC ", allowed: true},
			{ticker: "usdterc20", allowed: false},
			{ticker: "", allowed: false},
			{ticker: "btc", allowed: false},
		}

		for _, tc := range cases {
			assert.Equal(t, tc.allowed, IsNowPaymentsPayCurrencyAllowed(tc.ticker), "ticker %q", tc.ticker)
		}
	})
}
