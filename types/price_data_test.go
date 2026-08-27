package types

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSetSurchargeRejectsInvalidValues(t *testing.T) {
	tests := []struct {
		name  string
		value float64
		want  float64
	}{
		{name: "zero is accepted", value: 0, want: 0},
		{name: "ordinary value is accepted", value: 0.07, want: 0.07},
		{name: "value at the cap is accepted", value: MaxSurcharge, want: MaxSurcharge},
		{name: "negative value is rejected", value: -0.01, want: 0},
		{name: "NaN is rejected", value: math.NaN(), want: 0},
		{name: "positive infinity is rejected", value: math.Inf(1), want: 0},
		{name: "negative infinity is rejected", value: math.Inf(-1), want: 0},
		{name: "value above the cap is rejected", value: MaxSurcharge + 1, want: 0},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			priceData := PriceData{}

			priceData.SetSurcharge(tc.value)

			assert.Equal(t, tc.want, priceData.Surcharge())
		})
	}
}

func TestSetSurchargeKeepsPreviousValueWhenRejected(t *testing.T) {
	// 拒绝非法值时必须保留已接受的加价，否则一个坏配置会把收费悄悄变成免费。
	priceData := PriceData{}
	priceData.SetSurcharge(0.05)

	priceData.SetSurcharge(-1)

	assert.Equal(t, 0.05, priceData.Surcharge())
}
