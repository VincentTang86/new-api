package constant

type TaskPlatform string

const (
	TaskPlatformSuno       TaskPlatform = "suno"
	TaskPlatformMidjourney              = "mj"
)

const (
	SunoActionMusic  = "MUSIC"
	SunoActionLyrics = "LYRICS"

	TaskActionGenerate          = "generate"
	TaskActionTextGenerate      = "textGenerate"
	TaskActionFirstTailGenerate = "firstTailGenerate"
	TaskActionReferenceGenerate = "referenceGenerate"
	TaskActionRemix             = "remixGenerate"
	// TaskActionRegenerate 与 TaskActionContextIR 供 MiniMax-H3 的两个衍生接口使用：
	// 前者把已生成的 768P 视频再生成为 2K，后者只产出增强提示词、不产视频。
	TaskActionRegenerate = "regenerate"
	TaskActionContextIR  = "contextIR"
)

var SunoModel2Action = map[string]string{
	"suno_music":  SunoActionMusic,
	"suno_lyrics": SunoActionLyrics,
}
