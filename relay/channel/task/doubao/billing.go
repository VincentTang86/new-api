package doubao

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

const (
	// MaxDurationSeconds 是 Seedance 单次生成的输出时长上限。时长与分辨率共同
	// 决定视频 token 数，而 token 数正是计费乘数，relaycommon.MaxTaskDurationSeconds
	// (3600) 对视频模型过松，必须在这里收紧；更长的请求上游也会自行拒绝。
	MaxDurationSeconds = 60

	// VideoFPS 是 Seedance 的输出帧率，上游固定 24（实测回执 framespersecond=24）。
	VideoFPS = 24

	// MaxFrames 是总帧数上限，与 MaxDurationSeconds 对齐。metadata.frames 是另一条
	// 设定帧数的通道，绕过了顶层 seconds 的校验，必须单独设界。
	MaxFrames = MaxDurationSeconds * VideoFPS

	// 上游未指定时的取值：实测不传 resolution / duration 时出 720p、5 秒。
	defaultDurationSeconds = 5
	defaultResolution      = "720p"

	// videoTokenDivisor 是火山 Ark 视频 token 公式里的常数除数。
	videoTokenDivisor = 1024

	// upstreamExtraFrames 是上游在「整秒 × 帧率」之外多出的那一帧：实测 4 秒出
	// 97 帧、5 秒出 121 帧。补上它预估才等于上游 usage，否则押金每笔都低 1%，
	// 每笔都要补扣一次。
	upstreamExtraFrames = 1
)

// videoResolutionPixels 是各分辨率档的输出像素数（宽 × 高），用于预估视频 token。
// 480p / 720p 取 16:9 实测值（864×496、1280×720——按下面的公式算出的 token 数与
// 上游 usage 精确相等）；1080p / 4K 按 16 对齐的标准分辨率取值。同一档内其他画幅
// （1:1、21:9）的像素数有 ±25% 浮动，预扣容得下这个量级的偏差：结算一律以上游
// 回传的 usage 为准，这里只负责让押金与请求规格同数量级。
var videoResolutionPixels = map[string]int{
	"480p":  864 * 496,
	"720p":  1280 * 720,
	"1080p": 1920 * 1088,
	"4k":    3840 * 2176,
}

// EstimateVideoTokens 预估一次生成消耗的上游视频 token：
//
//	token = 输出宽 × 输出高 × 总帧数 ÷ 1024
//
// 这是火山 Ark 的官方口径，也是上游 usage.completion_tokens 的来源；480p/4s 与
// 720p/5s 两笔真实请求的预估值与上游 usage 完全相等。输入视频的
// 时长同样计入上游 token，但提交时只拿得到 URL、读不到时长，那部分缺口留给结算
// 时的 usage 重算补齐。分辨率档不认识时返回 0，调用方回退到固定预扣基数。
func EstimateVideoTokens(req *relaycommon.TaskSubmitReq) int {
	pixels, ok := videoResolutionPixels[videoResolution(req)]
	if !ok {
		return 0
	}
	// 中间积最大约 1.2e10（4K × MaxFrames），在 32 位 int 上会溢出成负数，
	// 而负的预扣额度等于白送，所以乘法走 int64 再收回。
	return int(int64(pixels) * int64(videoFrames(req)) / videoTokenDivisor)
}

// ValidateVideoBounds 给真正下发给上游的时长 / 帧数补上边界校验。顶层 seconds 已由
// relaycommon.ValidateBasicTaskRequest 兜住 3600 秒，但那对视频过松，且 metadata
// 是透传通道——duration / frames 从那里进来完全绕过顶层校验，而两者都是视频
// token 数的乘数。
func ValidateVideoBounds(req *relaycommon.TaskSubmitReq) error {
	if sec, _ := strconv.Atoi(req.Seconds); sec > MaxDurationSeconds {
		return fmt.Errorf("duration must not exceed %d seconds", MaxDurationSeconds)
	}
	if sec := metadataInt(req.Metadata, "duration"); sec > MaxDurationSeconds {
		return fmt.Errorf("metadata.duration must not exceed %d seconds", MaxDurationSeconds)
	}
	if frames := metadataInt(req.Metadata, "frames"); frames > MaxFrames {
		return fmt.Errorf("metadata.frames must not exceed %d", MaxFrames)
	}
	return nil
}

// videoResolution 是最终生效的输出分辨率档。
func videoResolution(req *relaycommon.TaskSubmitReq) string {
	resolution, _ := req.Metadata["resolution"].(string)
	resolution = strings.ToLower(strings.TrimSpace(resolution))
	if resolution == "" {
		return defaultResolution
	}
	return resolution
}

// videoFrames 是计费用的总帧数：metadata.frames 与「时长 × 帧率」取大者，再补上
// 上游多出的那一帧。两条通道都可能被指定，取大的一边押金才押得住。
func videoFrames(req *relaycommon.TaskSubmitReq) int {
	frames := metadataInt(req.Metadata, "frames")
	if byDuration := videoDurationSeconds(req) * VideoFPS; byDuration > frames {
		frames = byDuration
	}
	return min(frames+upstreamExtraFrames, MaxFrames)
}

// videoDurationSeconds 是最终下发给上游的输出时长，口径与 convertToRequestPayload
// 一致：顶层 seconds 优先（它会覆盖 metadata.duration），其次 metadata.duration。
func videoDurationSeconds(req *relaycommon.TaskSubmitReq) int {
	if sec, _ := strconv.Atoi(req.Seconds); sec > 0 {
		return min(sec, MaxDurationSeconds)
	}
	if sec := metadataInt(req.Metadata, "duration"); sec > 0 {
		return min(sec, MaxDurationSeconds)
	}
	return defaultDurationSeconds
}

// metadataInt 读 metadata 里的正整数字段。metadata 来自客户端 JSON，数字按解析器
// 不同会是 float64 或 json.Number；非数字、非正、超出 int32 的值一律当未设置，
// 这样越界输入既不会变成乘数，也不会在后面的乘法里溢出。
func metadataInt(metadata map[string]interface{}, key string) int {
	switch v := metadata[key].(type) {
	case float64:
		return boundedInt(v)
	case json.Number:
		parsed, err := v.Float64()
		if err != nil {
			return 0
		}
		return boundedInt(parsed)
	}
	return 0
}

func boundedInt(v float64) int {
	if math.IsNaN(v) || v <= 0 {
		return 0
	}
	if v > math.MaxInt32 {
		// 越界值不能当「未设置」放过：18446744073686646784 这类回绕的巨数必须
		// 留下来让 ValidateVideoBounds 拒掉，否则它既逃过校验又原样透传给上游。
		// 收到 int32 上限即可，后续乘法走 int64，且帧数还会被 MaxFrames 截断。
		return math.MaxInt32
	}
	return int(v)
}
