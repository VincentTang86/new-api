package xai

import (
	"strconv"
	"strings"
)

var ModelList = []string{
	"grok-imagine-video-1.5",
}

var ChannelName = "xai-video"

const (
	// MinDurationSeconds / MaxDurationSeconds 是 xAI Imagine Video 支持的时长区间。
	// 时长直接作为计费乘数，relaycommon.MaxTaskDurationSeconds(3600) 对该模型过松，
	// 必须在这里收紧。
	MinDurationSeconds = 1
	MaxDurationSeconds = 15

	// MaxReferenceImages 是 reference-to-video 允许的参考图数量上限。
	// 图片数量是按张加价的乘数，必须有上界。
	MaxReferenceImages = 7

	// 未指定时的取值。两者都会显式下发给上游，保证计费口径与实际生成一致。
	defaultDurationSeconds = 6
	defaultResolution      = "720p"

	resolution1080p = "1080p"
)

// resolutionRatios 是各分辨率相对 480p 基准秒价的比值。
// xAI 官方价：480p $0.08/秒、720p $0.14/秒、1080p $0.25/秒。管理员配置的
// ModelPrice 即 480p 每秒价，改基准价时高分辨率档位自动同比例跟随。
var resolutionRatios = map[string]float64{
	"480p":          1,
	"720p":          1.75,
	resolution1080p: 3.125,
}

// ResolutionRatio 返回分辨率对应的计费倍率，第二个返回值表示该分辨率是否受支持。
func ResolutionRatio(resolution string) (float64, bool) {
	ratio, ok := resolutionRatios[resolution]
	return ratio, ok
}

// normalizeResolution 把分辨率标签或 WxH 尺寸统一成 xAI 的分辨率档位。
// 无法识别时返回空串，由调用方拒绝请求。
func normalizeResolution(size string) string {
	s := strings.ToLower(strings.TrimSpace(size))
	if s == "" || !strings.Contains(s, "x") {
		return s
	}
	parts := strings.SplitN(s, "x", 2)
	width, _ := strconv.Atoi(strings.TrimSpace(parts[0]))
	height, _ := strconv.Atoi(strings.TrimSpace(parts[1]))
	maxDim := max(width, height)
	switch {
	case maxDim >= 1920:
		return resolution1080p
	case maxDim >= 1280:
		return "720p"
	case maxDim > 0:
		return "480p"
	}
	return ""
}
