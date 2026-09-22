package ali

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

var ModelList = []string{
	"wan3.0-video-prime", // 万相3.0高速版（标准版 wan3.0-video 未列入百炼官方列表，暂不接）
	"wan2.7-i2v",         // 万相2.7图生视频（新input.media协议）
	"wan2.7-t2v",         // 万相2.7文生视频
	"wan2.5-i2v-preview", // 万相2.5 preview（有声视频）推荐
	"wan2.2-i2v-flash",   // 万相2.2极速版（无声视频）
	"wan2.2-i2v-plus",    // 万相2.2专业版（无声视频）
	"wanx2.1-i2v-plus",   // 万相2.1专业版（无声视频）
	"wanx2.1-i2v-turbo",  // 万相2.1极速版（无声视频）
}

var ChannelName = "ali"

const (
	// MaxWan30DurationSeconds 是万相 3.0 单次生成的输出时长上限。时长是计费乘数，
	// relaycommon.MaxTaskDurationSeconds(3600) 对视频过松；且 metadata.parameters.duration
	// 是绕过顶层校验的透传通道，边界必须在适配器内自己兜。
	MaxWan30DurationSeconds = 30

	// UnlimitedDurationSentinel 是万相 3.0 的不定长标记：由模型自定时长（最长 30 秒）。
	// 顶层 seconds/duration 校验拒绝负数，所以它只能经 metadata.parameters.duration 传入；
	// 预扣按 MaxWan30DurationSeconds 计，结算以上游 usage 为准退差额。
	UnlimitedDurationSentinel = -1

	// wan30DefaultResolution 是未指定分辨率时下发的档位。
	wan30DefaultResolution = "720P"

	// wan30ReferenceVideoMediaType 是 input.media 里参考视频的 type 值（万相 3.0 文档口径）。
	// 上游会把输入视频的秒数计入 usage.duration，押金与结算都要认得它。
	wan30ReferenceVideoMediaType = "reference_video"
)

// wan30OfficialResolutionRatios 是各分辨率档相对基准档（480P）的倍率，后台
// ModelResolutionRatio 未配置时的回落。
//
// 数值取自上游 issue QuantumNous/new-api#7238 的描述（480P/720P/1080P = 1/2/4），
// 尚未用真实扣费核对——上线前必须在渠道上各跑一笔 480P/720P/1080P，用上游实际扣费
// 算出真实比值写进后台。这里的数只保证 1080P 不会按 480P 收。
var wan30OfficialResolutionRatios = map[string]float64{
	"480p":  1,
	"720p":  2,
	"1080p": 4,
}

// IsWan30Model 判断是否万相 3.0 系列（wan3.0-video / wan3.0-video-prime）。
// 协议归一化按上游模型名判定，计费按原始模型名查价，调用方各自传对应的名字。
func IsWan30Model(model string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(model)), "wan3.0-")
}

// Wan30ResolutionRatio 返回该模型在指定分辨率档相对基准价的计费倍率。
// 后台 ModelResolutionRatio 优先（上游调价时运营改配置即可，不必发版），
// 未配置回落到内置比值；两处都没有时返回 false，调用方按基准价计。
func Wan30ResolutionRatio(modelName, resolution string) (float64, bool) {
	key := strings.ToLower(strings.TrimSpace(resolution))
	if ratio, ok := ratio_setting.GetModelResolutionRatio(modelName, key); ok {
		return ratio, true
	}
	ratio, ok := wan30OfficialResolutionRatios[key]
	return ratio, ok
}
