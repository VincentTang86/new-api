package doubao

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 定价页 /Token 矩阵直接渲染这张表，格子里的倍率必须与实际计费一致，
// 顺序也必须稳定（列头按基准档 → 1080p → 4K，行按不含视频 → 含视频）。
func TestVideoRateMatrixMirrorsListedRates(t *testing.T) {
	cases := []struct {
		name  string
		model string
		want  []VideoRate
	}{
		{
			name:  "full six-cell matrix",
			model: "doubao-seedance-2-0-260128",
			want: []VideoRate{
				{Key: "base", Resolution: "480p / 720p", WithVideo: false, Ratio: 1},
				{Key: "base+video", Resolution: "480p / 720p", WithVideo: true, Ratio: 28.0 / 46.0},
				{Key: "1080p", Resolution: "1080p", WithVideo: false, Ratio: 51.0 / 46.0},
				{Key: "1080p+video", Resolution: "1080p", WithVideo: true, Ratio: 31.0 / 46.0},
				{Key: "4k", Resolution: "4K", WithVideo: false, Ratio: 26.0 / 46.0},
				{Key: "4k+video", Resolution: "4K", WithVideo: true, Ratio: 16.0 / 46.0},
			},
		},
		{
			// fast 上游只出基准档；缺的组合按基准价计费，矩阵里就是 1.0 而不是缺格。
			name:  "model without high tiers still fills them at parity",
			model: "doubao-seedance-2-0-fast-260128",
			want: []VideoRate{
				{Key: "base", Resolution: "480p / 720p", WithVideo: false, Ratio: 1},
				{Key: "base+video", Resolution: "480p / 720p", WithVideo: true, Ratio: 22.0 / 37.0},
				{Key: "1080p", Resolution: "1080p", WithVideo: false, Ratio: 1},
				{Key: "1080p+video", Resolution: "1080p", WithVideo: true, Ratio: 1},
				{Key: "4k", Resolution: "4K", WithVideo: false, Ratio: 1},
				{Key: "4k+video", Resolution: "4K", WithVideo: true, Ratio: 1},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := VideoRateMatrix(tc.model)
			require.Len(t, got, len(tc.want))
			for i := range tc.want {
				assert.Equal(t, tc.want[i].Key, got[i].Key)
				assert.Equal(t, tc.want[i].Resolution, got[i].Resolution)
				assert.Equal(t, tc.want[i].WithVideo, got[i].WithVideo)
				assert.InDelta(t, tc.want[i].Ratio, got[i].Ratio, 0.0001)
			}
		})
	}
}

// 全档同价的模型画成矩阵只会让人以为有档位差异，应当回退到普通的按 token 价表。
func TestVideoRateMatrixSkipsModelsWithoutTierDifference(t *testing.T) {
	assert.Nil(t, VideoRateMatrix("seedance-2.5"))
	assert.Nil(t, VideoRateMatrix("gpt-5.2"))
}

// 后台改了档位倍率，页面显示的必须跟着变——否则运营改完价页面还在报旧数。
func TestVideoRateMatrixFollowsConfiguredTiers(t *testing.T) {
	const model = "doubao-seedance-9-9-preview"
	require.NoError(t, ratio_setting.UpdateModelResolutionRatioByJSONString(
		`{"doubao-seedance-9-9-preview":{"1080p":1.5,"base+video":0.4}}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelResolutionRatioByJSONString("{}"))
	})

	got := VideoRateMatrix(model)
	byKey := make(map[string]float64, len(got))
	for _, rate := range got {
		byKey[rate.Key] = rate.Ratio
	}
	assert.InDelta(t, 1.5, byKey["1080p"], 0.0001)
	assert.InDelta(t, 0.4, byKey["base+video"], 0.0001)
	// 内置表里没有这个模型，后台也没配这几档，它们取不到倍率，不该出现在矩阵里。
	assert.NotContains(t, byKey, "base")
	assert.NotContains(t, byKey, "4k")
}
