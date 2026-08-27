package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateModelResolutionRatioJSON(t *testing.T) {
	// 倍率是乘性的：0 会让模型变免费，负数会产生负计费，都不能写进数据库。
	tests := []struct {
		name    string
		json    string
		wantErr bool
	}{
		{name: "custom tiers are accepted", json: `{"m":{"480p":1,"720p":1.5,"1080p":2.75}}`},
		{name: "empty table is accepted", json: `{}`},
		{name: "zero ratio is rejected", json: `{"m":{"720p":0}}`, wantErr: true},
		{name: "negative ratio is rejected", json: `{"m":{"720p":-1.5}}`, wantErr: true},
		{name: "ratio above the cap is rejected", json: `{"m":{"720p":1001}}`, wantErr: true},
		{name: "overflowing number is rejected", json: `{"m":{"720p":1e400}}`, wantErr: true},
		{name: "malformed json is rejected", json: `{"m":`, wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateModelResolutionRatioJSON(tc.json)

			if tc.wantErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
		})
	}
}

func TestValidateModelImageInputPriceJSON(t *testing.T) {
	// 单价乘以图片数量成为计费加价项，负数会把一次调用变成充值。
	tests := []struct {
		name    string
		json    string
		wantErr bool
	}{
		{name: "ordinary price is accepted", json: `{"m":0.01}`},
		{name: "zero disables the fee", json: `{"m":0}`},
		{name: "negative price is rejected", json: `{"m":-0.01}`, wantErr: true},
		{name: "price above the cap is rejected", json: `{"m":101}`, wantErr: true},
		{name: "malformed json is rejected", json: `not json`, wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateModelImageInputPriceJSON(tc.json)

			if tc.wantErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
		})
	}
}

func TestGetModelResolutionRatioMatchesTierLabelCaseInsensitively(t *testing.T) {
	// 管理员可能把档位写成 720P，查询侧统一用小写，不该因此漏配。
	require.NoError(t, UpdateModelResolutionRatioByJSONString(`{"video-model":{"720P":1.5}}`))
	t.Cleanup(func() {
		require.NoError(t, UpdateModelResolutionRatioByJSONString("{}"))
	})

	ratio, ok := GetModelResolutionRatio("video-model", "720p")

	require.True(t, ok)
	assert.Equal(t, 1.5, ratio)
}
