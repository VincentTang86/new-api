package hailuo

type SubjectReference struct {
	Type  string   `json:"type"`  // Subject type, currently only supports "character"
	Image []string `json:"image"` // Array of subject reference images (currently only supports single image)
}

type VideoRequest struct {
	Model            string             `json:"model"`
	Prompt           string             `json:"prompt,omitempty"`
	PromptOptimizer  *bool              `json:"prompt_optimizer,omitempty"`
	FastPretreatment *bool              `json:"fast_pretreatment,omitempty"`
	Duration         *int               `json:"duration,omitempty"`
	Resolution       string             `json:"resolution,omitempty"`
	CallbackURL      string             `json:"callback_url,omitempty"`
	AigcWatermark    *bool              `json:"aigc_watermark,omitempty"`
	FirstFrameImage  string             `json:"first_frame_image,omitempty"` // For image-to-video and start-end-to-video
	LastFrameImage   string             `json:"last_frame_image,omitempty"`  // For start-end-to-video
	SubjectReference []SubjectReference `json:"subject_reference,omitempty"` // For subject-reference-to-video
}

type VideoResponse struct {
	TaskID   string   `json:"task_id"`
	BaseResp BaseResp `json:"base_resp"`
}

type BaseResp struct {
	StatusCode int    `json:"status_code"`
	StatusMsg  string `json:"status_msg"`
}

type QueryTaskRequest struct {
	TaskID string `json:"task_id"`
}

type QueryTaskResponse struct {
	TaskID      string   `json:"task_id"`
	Status      string   `json:"status"`
	FileID      string   `json:"file_id,omitempty"`
	VideoWidth  int      `json:"video_width,omitempty"`
	VideoHeight int      `json:"video_height,omitempty"`
	BaseResp    BaseResp `json:"base_resp"`
}

type ErrorInfo struct {
	StatusCode int    `json:"status_code"`
	StatusMsg  string `json:"status_msg"`
}

type TaskStatusInfo struct {
	TaskID    string `json:"task_id"`
	Status    string `json:"status"`
	FileID    string `json:"file_id,omitempty"`
	VideoURL  string `json:"video_url,omitempty"`
	ErrorCode int    `json:"error_code,omitempty"`
	ErrorMsg  string `json:"error_msg,omitempty"`
}

type ModelConfig struct {
	Name                 string
	DefaultResolution    string
	SupportedDurations   []int
	SupportedResolutions []string
	HasPromptOptimizer   bool
	HasFastPretreatment  bool
}

type RetrieveFileResponse struct {
	File     FileObject `json:"file"`
	BaseResp BaseResp   `json:"base_resp"`
}

type FileObject struct {
	FileID      int64  `json:"file_id"`
	Bytes       int64  `json:"bytes"`
	CreatedAt   int64  `json:"created_at"`
	Filename    string `json:"filename"`
	Purpose     string `json:"purpose"`
	DownloadURL string `json:"download_url"`
}

func GetModelConfig(model string) ModelConfig {
	configs := map[string]ModelConfig{
		"MiniMax-Hailuo-2.3": {
			Name:                 "MiniMax-Hailuo-2.3",
			DefaultResolution:    Resolution768P,
			SupportedDurations:   []int{6, 10},
			SupportedResolutions: []string{Resolution768P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  true,
		},
		"MiniMax-Hailuo-2.3-Fast": {
			Name:                 "MiniMax-Hailuo-2.3-Fast",
			DefaultResolution:    Resolution768P,
			SupportedDurations:   []int{6, 10},
			SupportedResolutions: []string{Resolution768P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  true,
		},
		"MiniMax-Hailuo-02": {
			Name:                 "MiniMax-Hailuo-02",
			DefaultResolution:    Resolution768P,
			SupportedDurations:   []int{6, 10},
			SupportedResolutions: []string{Resolution512P, Resolution768P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  true,
		},
		"T2V-01-Director": {
			Name:                 "T2V-01-Director",
			DefaultResolution:    Resolution768P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution768P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
		"T2V-01": {
			Name:                 "T2V-01",
			DefaultResolution:    Resolution720P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution720P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
		"I2V-01-Director": {
			Name:                 "I2V-01-Director",
			DefaultResolution:    Resolution720P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution720P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
		"I2V-01-live": {
			Name:                 "I2V-01-live",
			DefaultResolution:    Resolution720P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution720P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
		"I2V-01": {
			Name:                 "I2V-01",
			DefaultResolution:    Resolution720P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution720P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
		"S2V-01": {
			Name:                 "S2V-01",
			DefaultResolution:    Resolution720P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution720P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
	}

	if config, exists := configs[model]; exists {
		return config
	}

	return ModelConfig{
		Name:                 model,
		DefaultResolution:    DefaultResolution,
		SupportedDurations:   []int{6},
		SupportedResolutions: []string{DefaultResolution},
		HasPromptOptimizer:   true,
		HasFastPretreatment:  false,
	}
}

// ---------------------------------------------------------------------------
// MiniMax-H3 (video generation V2) 请求 / 响应
// ---------------------------------------------------------------------------

// MediaURL 是 content 数组里图片 / 视频 / 音频的地址对象。上游收的是
// {"url": "..."} 而不是裸字符串。
type MediaURL struct {
	URL string `json:"url"`
}

// ContentItem 是 H3 的多模态输入项。Type 决定哪个字段生效，Role 标注用途
// （首尾帧 / 参考素材 / 再生成源视频）。
type ContentItem struct {
	Type     string    `json:"type"`
	Text     string    `json:"text,omitempty"`
	ImageURL *MediaURL `json:"image_url,omitempty"`
	VideoURL *MediaURL `json:"video_url,omitempty"`
	AudioURL *MediaURL `json:"audio_url,omitempty"`
	Role     string    `json:"role,omitempty"`
}

// GenerationV2Request 是 POST /v2/video_generation 的请求体。
type GenerationV2Request struct {
	Model         string        `json:"model"`
	Content       []ContentItem `json:"content"`
	Resolution    string        `json:"resolution"`
	Duration      int           `json:"duration"`
	Ratio         string        `json:"ratio,omitempty"`
	CallbackURL   string        `json:"callback_url,omitempty"`
	AigcWatermark *bool         `json:"aigc_watermark,omitempty"`
}

// RegenerationRequest 是 POST /v2/video_regeneration 的请求体。SourceTaskID 与
// Content 必须且只能提供其一：前者引用上游已有的成功任务（需白名单），后者由
// 调用方原样重传源任务的全部输入并额外带一个 role=base_video 的源视频项。
type RegenerationRequest struct {
	Model         string        `json:"model"`
	SourceTaskID  string        `json:"source_task_id,omitempty"`
	Content       []ContentItem `json:"content,omitempty"`
	Resolution    string        `json:"resolution"`
	CallbackURL   string        `json:"callback_url,omitempty"`
	AigcWatermark *bool         `json:"aigc_watermark,omitempty"`
}

// ContextIRRequest 是 POST /v2/h3_context_ir 的请求体。该接口只产出增强提示词，
// 不生成视频，因此没有 resolution。
type ContextIRRequest struct {
	Model       string        `json:"model"`
	Content     []ContentItem `json:"content"`
	Duration    int           `json:"duration"`
	Ratio       string        `json:"ratio,omitempty"`
	CallbackURL string        `json:"callback_url,omitempty"`
}

// SubmitV2Response 是三个提交接口的共同响应。
type SubmitV2Response struct {
	TaskID string `json:"task_id"`
}

// ErrorV2Response 是 v2 的错误体，与 v1 的 base_resp 结构完全不同。
type ErrorV2Response struct {
	Type  string `json:"type"`
	Error *struct {
		Type     string `json:"type"`
		Message  string `json:"message"`
		HTTPCode string `json:"http_code"`
	} `json:"error,omitempty"`
	RequestID string `json:"request_id,omitempty"`
}

// QueryV2Response 是 GET /v2/query/video_generation/{task_id} 的响应，三类任务共用。
type QueryV2Response struct {
	Task *VideoTaskV2 `json:"task,omitempty"`
}

type VideoTaskV2 struct {
	ID         string            `json:"id"`
	Model      string            `json:"model"`
	Status     string            `json:"status"`
	Error      *VideoTaskV2Error `json:"error,omitempty"`
	CreatedAt  int64             `json:"created_at,omitempty"`
	UpdatedAt  int64             `json:"updated_at,omitempty"`
	Content    *VideoTaskContent `json:"content,omitempty"`
	Resolution string            `json:"resolution,omitempty"`
	Duration   int               `json:"duration,omitempty"`
	Usage      *VideoTaskUsage   `json:"usage,omitempty"`
	Ratio      string            `json:"ratio,omitempty"`
	TaskType   string            `json:"task_type,omitempty"`
	Modality   string            `json:"modality,omitempty"`
}

type VideoTaskV2Error struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// VideoTaskContent 承载产物：视频任务给 URL，Context-IR 任务给增强提示词。
type VideoTaskContent struct {
	URL    string `json:"url,omitempty"`
	Prompt string `json:"prompt,omitempty"`
}

// VideoTaskUsage 是上游返回的真实用量，仅任务成功时返回，是结算的唯一依据。
// 视频任务给按秒计量的字段，Context-IR 任务给 Token 用量。
type VideoTaskUsage struct {
	TotalSeconds      int `json:"total_seconds,omitempty"`
	InputSeconds      int `json:"input_seconds,omitempty"`
	OutputSeconds     int `json:"output_seconds,omitempty"`
	InputImageCount   int `json:"input_image_count,omitempty"`
	InputAudioSeconds int `json:"input_audio_seconds,omitempty"`
	TotalTokens       int `json:"total_tokens,omitempty"`
	PromptTokens      int `json:"prompt_tokens,omitempty"`
	CompletionTokens  int `json:"completion_tokens,omitempty"`
}
