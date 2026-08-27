package hailuo

const (
	ChannelName = "hailuo-video"
)

var ModelList = []string{
	ModelH3,
	"MiniMax-Hailuo-2.3",
	"MiniMax-Hailuo-2.3-Fast",
	"MiniMax-Hailuo-02",
	"T2V-01-Director",
	"T2V-01",
	"I2V-01-Director",
	"I2V-01-live",
	"I2V-01",
	"S2V-01",
}

const (
	TextToVideoEndpoint = "/v1/video_generation"
	QueryTaskEndpoint   = "/v1/query/video_generation"
)

const (
	StatusSuccess    = 0
	StatusRateLimit  = 1002
	StatusAuthFailed = 1004
	StatusNoBalance  = 1008
	StatusSensitive  = 1026
	StatusParamError = 2013
	StatusInvalidKey = 2049
)

const (
	TaskStatusPreparing  = "Preparing"
	TaskStatusQueueing   = "Queueing"
	TaskStatusProcessing = "Processing"
	TaskStatusSuccess    = "Success"
	TaskStatusFailed     = "Fail"
)

const (
	Resolution512P  = "512P"
	Resolution720P  = "720P"
	Resolution768P  = "768P"
	Resolution1080P = "1080P"
)

const (
	DefaultDuration   = 6
	DefaultResolution = Resolution720P
)

// ---------------------------------------------------------------------------
// MiniMax-H3 (video generation V2)
//
// H3 与 v1 海螺共用 MiniMax 渠道，但请求体、响应体、状态枚举、错误格式和计费
// 维度全部不同，因此适配器内按模型名分流，两套逻辑并存。
// 文档：https://platform.minimaxi.com/docs/api-reference/video-generation-v2-create
// ---------------------------------------------------------------------------

// ModelH3 是对外暴露的唯一 H3 模型名。生成、再生成、Context-IR 三个能力都走
// 它，按请求内容分流到不同的上游端点（见 resolveH3Action）。下发上游时 model
// 字段恒为该值——上游枚举也只认这一个。
const ModelH3 = "MiniMax-H3"

const (
	V2GenerationEndpoint   = "/v2/video_generation"
	V2RegenerationEndpoint = "/v2/video_regeneration"
	V2ContextIREndpoint    = "/v2/h3_context_ir"
	V2QueryTaskEndpoint    = "/v2/query/video_generation/"
)

const Resolution2K = "2K"

// H3 的输入输出规格。时长直接作为计费乘数，relaycommon.MaxTaskDurationSeconds
// (3600) 对该模型过松，必须在这里收紧。
const (
	H3MinDuration = 4
	H3MaxDuration = 15

	H3MaxFirstFrames     = 1
	H3MaxLastFrames      = 1
	H3MaxReferenceImages = 9
	H3MaxReferenceVideos = 3
	H3MaxReferenceAudios = 3
	H3MaxContentFiles    = 12

	H3MaxPromptChars      = 7000
	H3MaxRegenPromptChars = 40000

	// H3FreeImageCount 是免费的输入图片张数，超出部分按张加价。
	H3FreeImageCount = 5

	// H3MaxBillableSeconds 是单个计费秒数分量（输出秒 / 输入参考视频秒）的上界。
	// 官方当前上限是各 15 秒，这里留一倍余量：上游返回的秒数是计费乘数，即便
	// 上游放宽或返回异常值也不能让额度失控。
	H3MaxBillableSeconds = 30
)

const (
	ContentTypeText     = "text"
	ContentTypeImageURL = "image_url"
	ContentTypeVideoURL = "video_url"
	ContentTypeAudioURL = "audio_url"
)

const (
	RoleFirstFrame     = "first_frame"
	RoleLastFrame      = "last_frame"
	RoleReferenceImage = "reference_image"
	RoleReferenceVideo = "reference_video"
	RoleReferenceAudio = "reference_audio"
	RoleBaseVideo      = "base_video"
)

const (
	V2StatusQueued    = "queued"
	V2StatusRunning   = "running"
	V2StatusSucceeded = "succeeded"
	V2StatusFailed    = "failed"
	V2StatusCancelled = "cancelled"
)

const (
	TaskTypeGeneration   = "generation"
	TaskTypeRegeneration = "regeneration"
	TaskTypeContextIR    = "h3_context_ir"
)

const (
	RatioAdaptive  = "adaptive"
	DefaultH3Ratio = "16:9"
)

// h3SupportedRatios 是上游接受的宽高比枚举。
var h3SupportedRatios = []string{RatioAdaptive, "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"}

// 计费档位 key。每个官方计费维度一个 key，管理员可通过 ModelResolutionRatio
// 逐个覆盖倍率——输出秒价与输入视频秒价彼此解耦，输入视频再分「生成」与
// 「再生成」两块，官方哪一项调价都只需改配置。
const (
	TierOutput768P             = "768p"
	TierOutput2K               = "2k"
	TierOutputRegeneration     = "regeneration"
	TierInputVideo768P         = "input_video_768p"
	TierInputVideo2K           = "input_video_2k"
	TierInputVideoRegeneration = "input_video_regeneration"
	TierContextIR              = "context_ir"
)

// officialH3TierRatios 是各计费维度相对 768P 输出秒价的官方比值，作为管理员
// 未配置 ModelResolutionRatio 时的兜底。管理员配置的 ModelPrice 即 768P 输出
// 每秒价，改基准价时各档位自动同比例跟随。
//
// 官方刊例（元/秒）：生成输出 2K 0.80、768P 0.50；生成输入参考视频按生成分辨
// 率同价；再生成输出 0.30，其输入参考视频同为 0.30。
// context_ir 不按秒计费，这里的 1 只是提交时的预扣占位档位，最终额度由
// AdjustBillingOnComplete 按 token 重算。
var officialH3TierRatios = map[string]float64{
	TierOutput768P:             1,
	TierOutput2K:               1.6,
	TierOutputRegeneration:     0.6,
	TierInputVideo768P:         1,
	TierInputVideo2K:           1.6,
	TierInputVideoRegeneration: 0.6,
	TierContextIR:              1,
}

// regenerationImagePriceRatio 是再生成的输入图片单价相对生成的比值
// （官方 0.15 / 0.20 元每张）。ModelImageInputPrice 是「模型 → 单价」的一层
// 映射，单模型名下配不出两个单价，故这一比值内置。
const regenerationImagePriceRatio = 0.75
