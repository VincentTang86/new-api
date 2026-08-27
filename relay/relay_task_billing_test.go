package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	hosttypes "github.com/QuantumNous/new-api/types"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 按次计费的视频任务：ModelPrice 是 480p 每秒价，时长与分辨率是乘性倍率，
// 图片输入费是加性的。重算时若不先把加价项剥离，除法会把它摊进基础价。
func TestRecalcQuotaFromRatiosKeepsSurchargeAdditive(t *testing.T) {
	originalQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = originalQuotaPerUnit })

	info := &relaycommon.RelayInfo{}
	info.PriceData = hosttypes.PriceData{
		ModelPrice:     0.08,
		UsePrice:       true,
		GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1},
		Quota:          40000, // 0.08 USD × QuotaPerUnit
	}
	info.PriceData.AddOtherRatio("seconds", 15)
	info.PriceData.AddOtherRatio("resolution", 1.75)
	info.PriceData.SetSurcharge(0.01) // 一张输入图片

	// 提交阶段：倍率相乘后叠加加价项 — $0.08 × 15 × 1.75 + $0.01 = $2.11
	submitQuota, clamp := common.QuotaFromFloatChecked(
		info.PriceData.ApplyOtherRatiosToFloat(float64(info.PriceData.Quota)) + surchargeQuota(info))
	require.Nil(t, clamp)
	require.Equal(t, 1_055_000, submitQuota)
	info.PriceData.Quota = submitQuota

	// 上游返回的实际时长是 10 秒 — $0.08 × 10 × 1.75 + $0.01 = $1.41
	adjusted, ok := recalcQuotaFromRatios(info, map[string]float64{
		"seconds":    10,
		"resolution": 1.75,
	})

	require.True(t, ok)
	assert.Equal(t, 705_000, adjusted)
}

func TestRecalcQuotaFromRatiosWithoutSurchargeIsUnchanged(t *testing.T) {
	originalQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = originalQuotaPerUnit })

	info := &relaycommon.RelayInfo{}
	info.PriceData = hosttypes.PriceData{
		GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1},
		Quota:          200000, // 40000 × 5
	}
	info.PriceData.AddOtherRatio("seconds", 5)

	adjusted, ok := recalcQuotaFromRatios(info, map[string]float64{"seconds": 8})

	require.True(t, ok)
	assert.Equal(t, 320000, adjusted)
}
