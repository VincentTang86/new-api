package doubao

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

var ModelList = []string{
	"doubao-seedance-1-0-pro-250528",
	"doubao-seedance-1-0-lite-t2v",
	"doubao-seedance-1-0-lite-i2v",
	"doubao-seedance-1-5-pro-251215",
	"doubao-seedance-2-0-260128",
	"doubao-seedance-2-0-fast-260128",
}

var ChannelName = "doubao-video"

// videoPriceKey 价格表的键：输出分辨率档（is1080p/is4k 均为 false 即 480p/720p 基准档）、输入是否含视频。
type videoPriceKey struct {
	is1080p  bool
	is4k     bool
	hasVideo bool
}

// videoPriceTable 各模型在不同 (输出分辨率档, 是否含视频输入) 下的单价（元/百万 token）。
// 它是后台 ModelResolutionRatio 未配置该档位时的回落，新接入的模型优先走后台配置。
// 其中零值键 {480p/720p, 不含视频} 为基准价，等于管理员应配置的 ModelRatio；
// 计费时取 实际单价/基准价 作为 OtherRatio。
var videoPriceTable = map[string]map[videoPriceKey]float64{
	"doubao-seedance-2-0-260128": {
		{hasVideo: false}:                46.0,
		{hasVideo: true}:                 28.0,
		{is1080p: true, hasVideo: false}: 51.0,
		{is1080p: true, hasVideo: true}:  31.0,
		{is4k: true, hasVideo: false}:    26.0,
		{is4k: true, hasVideo: true}:     16.0,
	},
	"doubao-seedance-2-0-fast-260128": {
		{hasVideo: false}: 37.0,
		{hasVideo: true}:  22.0,
	},
	// 2.5 经数眼（dataeyes，渠道 dataeyes1_doubao）转售，四档刊例与火山官方一致：
	// 每 1M token $10.00 / $6.00 / $11.00 / $6.57，即下面的元价 ÷7。官方与数眼
	// 都未公布 4K 专档，未配置的组合按基准价计——2.0 的 4K 是降价档，若 2.5 也有
	// 而这里缺行，会按基准价多收，拿到单价后需补一行。
	"doubao-seedance-2-5-oinone": {
		{hasVideo: false}:                70.0,
		{hasVideo: true}:                 42.0,
		{is1080p: true, hasVideo: false}: 77.0,
		{is1080p: true, hasVideo: true}:  46.0,
	},
}

// VideoRateKey 是「输出分辨率档 × 输入是否含视频」这个计费维度在后台
// ModelResolutionRatio 里的键：基准档（480p/720p 及未指定）写 base，其余写分辨率名，
// 含视频输入的组合加 +video 后缀。
func VideoRateKey(resolution string, hasVideo bool) string {
	tier := strings.ToLower(strings.TrimSpace(resolution))
	switch tier {
	case "1080p", "4k":
	default:
		tier = "base"
	}
	if hasVideo {
		return tier + "+video"
	}
	return tier
}

// GetVideoInputRatio 返回指定模型在给定输出分辨率/是否含视频输入下，相对基准价的计费倍率。
// 后台 ModelResolutionRatio 的配置优先：上游调价时运营改配置即可，不必为一张价表发版；
// 该档位没配则回落到下面内置的上游官方比值。
// 第二个返回值表示该档位是否取到了倍率；取不到时调用方按基准价计费。
func GetVideoInputRatio(modelName, resolution string, hasVideo bool) (float64, bool) {
	if ratio, ok := ratio_setting.GetModelResolutionRatio(modelName, VideoRateKey(resolution, hasVideo)); ok {
		return ratio, true
	}
	prices, ok := videoPriceTable[modelName]
	base := prices[videoPriceKey{}] // 零值键 = {480p/720p, 不含视频} 基准价
	if !ok || base <= 0 {
		return 0, false
	}
	res := strings.ToLower(strings.TrimSpace(resolution))
	price, ok := prices[videoPriceKey{is1080p: res == "1080p", is4k: res == "4k", hasVideo: hasVideo}]
	if !ok {
		// 未配置的组合（如 fast 无 1080p/4k，上游会自行报错）按基准价计费即可。
		return 1.0, true
	}
	return price / base, true
}

// VideoRate 一个计价档：输出分辨率档 × 输入是否含视频，值是相对基准价的倍率。
// 纯展示用，定价页的 /Token 矩阵按它渲染。
type VideoRate struct {
	Key        string
	Resolution string
	WithVideo  bool
	Ratio      float64
}

// videoRateTiers 是 VideoRateMatrix 的遍历顺序：基准档 → 1080p → 4k，
// 每档先「不含视频」后「含视频」，与定价页的列顺序一致。
var videoRateTiers = []struct {
	resolution string
	label      string
}{
	// 基准档覆盖 480p 与 720p 两个分辨率，它们的每 token 单价相同。
	{"", "480p / 720p"},
	{"1080p", "1080p"},
	{"4k", "4K"},
}

// VideoRateMatrix 返回该模型真实配了的计价档，供定价页展示。倍率逐档取自
// GetVideoInputRatio——即计费本身用的那个函数，页面因此不可能与实际扣费口径漂移。
// 模型没有任何档位区分时返回 nil，调用方据此回退到普通的按 token 价表。
func VideoRateMatrix(modelName string) []VideoRate {
	rates := make([]VideoRate, 0, len(videoRateTiers)*2)
	differs := false
	for _, tier := range videoRateTiers {
		for _, hasVideo := range []bool{false, true} {
			ratio, ok := GetVideoInputRatio(modelName, tier.resolution, hasVideo)
			if !ok {
				continue
			}
			if ratio != 1.0 {
				differs = true
			}
			rates = append(rates, VideoRate{
				Key:        VideoRateKey(tier.resolution, hasVideo),
				Resolution: tier.label,
				WithVideo:  hasVideo,
				Ratio:      ratio,
			})
		}
	}
	// 全档同价的模型（没有内置价表、后台也没配）不值得画成矩阵。
	if !differs {
		return nil
	}
	return rates
}
