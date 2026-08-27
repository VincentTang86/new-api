package xai

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// ============================
// Request / Response structures
// ============================

// imageRef 是上游表示一张输入图的结构。REST 接口收的是 {"url": "..."} 对象，
// 不是裸字符串——xAI SDK 的 image_url 参数只是它在客户端侧的写法。
type imageRef struct {
	URL string `json:"url"`
}

// videoGenerationRequest 是 xAI POST /v1/videos/generations 的请求体。
// image 用于图生视频，images 用于参考图生视频，两者互斥。
type videoGenerationRequest struct {
	Model      string     `json:"model"`
	Prompt     string     `json:"prompt,omitempty"`
	Image      *imageRef  `json:"image,omitempty"`
	Images     []imageRef `json:"images,omitempty"`
	Duration   int        `json:"duration,omitempty"`
	Resolution string     `json:"resolution,omitempty"`
}

// videoTaskResponse 同时用于提交响应与轮询响应。
// 提交只返回 request_id，轮询才带 status 与结果 URL。
type videoTaskResponse struct {
	RequestID string `json:"request_id"`
	ID        string `json:"id"`
	Status    string `json:"status"`
	URL       string `json:"url"`
	Video     struct {
		URL string `json:"url"`
	} `json:"video"`
	Error *struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

func (r *videoTaskResponse) taskID() string {
	if r.RequestID != "" {
		return r.RequestID
	}
	return r.ID
}

func (r *videoTaskResponse) videoURL() string {
	if r.URL != "" {
		return r.URL
	}
	return r.Video.URL
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	if taskErr := relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionTextGenerate); taskErr != nil {
		return taskErr
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "get_task_request_failed", http.StatusBadRequest)
	}

	if len(req.Images) > MaxReferenceImages {
		return service.TaskErrorWrapperLocal(
			fmt.Errorf("at most %d reference images are supported, got %d", MaxReferenceImages, len(req.Images)),
			"invalid_images", http.StatusBadRequest)
	}

	seconds := resolveDuration(req)
	if seconds < MinDurationSeconds || seconds > MaxDurationSeconds {
		return service.TaskErrorWrapperLocal(
			fmt.Errorf("duration must be between %d and %d seconds", MinDurationSeconds, MaxDurationSeconds),
			"invalid_duration", http.StatusBadRequest)
	}

	resolution := resolveResolution(req)
	if !SupportedResolution(resolution) {
		return service.TaskErrorWrapperLocal(
			fmt.Errorf("unsupported resolution: %s", resolution),
			"invalid_resolution", http.StatusBadRequest)
	}

	switch {
	case len(req.Images) == 1:
		info.Action = constant.TaskActionGenerate
	case len(req.Images) > 1:
		if resolution == resolution1080p {
			return service.TaskErrorWrapperLocal(
				fmt.Errorf("reference-to-video supports up to 720p"),
				"invalid_resolution", http.StatusBadRequest)
		}
		if seconds > MaxReferenceDurationSeconds {
			return service.TaskErrorWrapperLocal(
				fmt.Errorf("reference-to-video supports at most %d seconds", MaxReferenceDurationSeconds),
				"invalid_duration", http.StatusBadRequest)
		}
		info.Action = constant.TaskActionReferenceGenerate
	}
	return nil
}

// EstimateBilling 返回时长与分辨率的乘性倍率，并把按张计费的图片输入费记为加价项。
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	resolution := resolveResolution(req)
	if !SupportedResolution(resolution) {
		return nil
	}

	// 图片输入按张固定加价，与时长/分辨率的乘性倍率相互独立，因此走 Surcharge
	// 而不是 OtherRatio。文生视频不传图，图片数为 0 —— 上游在 t2v 下会先生成首帧图，
	// 该帧是否也计入 $0.01/张 官方文档未写明，需用真实 key 打一次 t2v 后核对账单，
	// 若计费则这里要按 1 起算。
	if price, ok := ratio_setting.GetModelImageInputPrice(info.OriginModelName); ok {
		images := min(len(req.Images), MaxReferenceImages)
		info.PriceData.SetSurcharge(price * float64(images))
	}

	return map[string]float64{
		"seconds":    float64(resolveDuration(req)),
		"resolution": resolutionBillingRatio(info.OriginModelName, resolution),
	}
}

// resolutionBillingRatio 返回分辨率相对基准秒价的计费倍率。管理员配置的售价
// 档位优先，未配置时回落到 xAI 官方比值——自定售价的档位关系（例如 480p/720p/
// 1080p 卖 $0.04/$0.06/$0.11）与官方并不一致，写死比值就配不出来。
func resolutionBillingRatio(modelName, resolution string) float64 {
	if ratio, ok := ratio_setting.GetModelResolutionRatio(modelName, resolution); ok {
		return ratio
	}
	return officialResolutionRatios[resolution]
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/videos/generations", a.baseURL), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}

	body := videoGenerationRequest{}
	if err := taskcommon.UnmarshalMetadata(req.Metadata, &body); err != nil {
		return nil, err
	}
	// metadata 可以透传上游的其他参数，但计费相关字段必须由校验过的值覆盖，
	// 否则 metadata 就成了绕过时长/分辨率校验的计费旁路。
	body.Model = info.UpstreamModelName
	body.Prompt = req.Prompt
	body.Duration = resolveDuration(req)
	body.Resolution = resolveResolution(req)
	body.Image = nil
	body.Images = nil
	switch info.Action {
	case constant.TaskActionGenerate:
		body.Image = &imageRef{URL: req.Images[0]}
	case constant.TaskActionReferenceGenerate:
		body.Images = make([]imageRef, 0, len(req.Images))
		for _, url := range req.Images {
			body.Images = append(body.Images, imageRef{URL: url})
		}
	}

	data, err := common.Marshal(body)
	if err != nil {
		return nil, errors.Wrap(err, "marshal request body failed")
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *taskdto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	var xaiResp videoTaskResponse
	if err := common.Unmarshal(responseBody, &xaiResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}
	if xaiResp.Error != nil {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("%s: %s", xaiResp.Error.Code, xaiResp.Error.Message), "xai_api_error", resp.StatusCode)
		return
	}
	if xaiResp.taskID() == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("request_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	openAIResp := dto.NewOpenAIVideo()
	openAIResp.ID = info.PublicTaskID
	openAIResp.TaskID = info.PublicTaskID
	openAIResp.Model = info.OriginModelName
	openAIResp.Status = convertXaiStatus(xaiResp.Status)
	openAIResp.CreatedAt = common.GetTimestamp()
	c.JSON(http.StatusOK, openAIResp)

	return xaiResp.taskID(), responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/v1/videos/%s", baseUrl, taskID), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Accept", "application/json")

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var xaiResp videoTaskResponse
	if err := common.Unmarshal(respBody, &xaiResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{Code: 0}
	switch convertXaiStatus(xaiResp.Status) {
	case dto.VideoStatusInProgress:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = taskcommon.ProgressInProgress
	case dto.VideoStatusCompleted:
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = taskcommon.ProgressComplete
		taskResult.Url = xaiResp.videoURL()
	case dto.VideoStatusFailed:
		taskResult.Status = model.TaskStatusFailure
		taskResult.Reason = "task failed"
		if xaiResp.Error != nil && xaiResp.Error.Message != "" {
			taskResult.Reason = xaiResp.Error.Message
		}
	default:
		taskResult.Status = model.TaskStatusQueued
		taskResult.Progress = taskcommon.ProgressQueued
	}
	return &taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	var xaiResp videoTaskResponse
	if err := common.Unmarshal(task.Data, &xaiResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal xai response failed")
	}

	openAIResp := dto.NewOpenAIVideo()
	openAIResp.ID = task.TaskID
	openAIResp.Model = task.Properties.OriginModelName
	openAIResp.Status = task.Status.ToVideoStatus()
	openAIResp.SetProgressStr(task.Progress)
	openAIResp.CreatedAt = task.CreatedAt
	openAIResp.CompletedAt = task.UpdatedAt
	if url := xaiResp.videoURL(); url != "" {
		openAIResp.SetMetadata("url", url)
	}
	if xaiResp.Error != nil {
		openAIResp.Error = &dto.OpenAIVideoError{
			Code:    xaiResp.Error.Code,
			Message: xaiResp.Error.Message,
		}
	}
	return common.Marshal(openAIResp)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

// ============================
// helpers
// ============================

// resolveDuration 返回请求的视频时长（秒）。metadata 优先于标准字段，校验、
// 计费与下发上游三处都用它，保证看到的是同一个值。
func resolveDuration(req relaycommon.TaskSubmitReq) int {
	if seconds, ok := metadataInt(req.Metadata, "duration"); ok {
		return seconds
	}
	if req.Duration > 0 {
		return req.Duration
	}
	if seconds, err := strconv.Atoi(strings.TrimSpace(req.Seconds)); err == nil {
		return seconds
	}
	return defaultDurationSeconds
}

// resolveResolution 返回归一化后的分辨率档位，来源优先级与 resolveDuration 一致。
func resolveResolution(req relaycommon.TaskSubmitReq) string {
	if v, ok := req.Metadata["resolution"]; ok {
		if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
			return normalizeResolution(s)
		}
	}
	if req.Size != "" {
		return normalizeResolution(req.Size)
	}
	return defaultResolution
}

// metadataInt 读取 metadata 中的整数值。JSON 数字会被解析成 float64，
// 表单字段则可能已经是 int。
func metadataInt(metadata map[string]any, key string) (int, bool) {
	v, ok := metadata[key]
	if !ok {
		return 0, false
	}
	switch n := v.(type) {
	case float64:
		return int(n), true
	case int:
		return n, true
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(n))
		return parsed, err == nil
	}
	return 0, false
}

// convertXaiStatus 把上游状态映射成 OpenAI 视频状态。上游可能用不同的措辞
// 表达同一阶段，未知状态按排队处理，避免把还在生成的任务判成失败。
func convertXaiStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "processing", "in_progress", "running", "generating":
		return dto.VideoStatusInProgress
	case "completed", "succeeded", "success", "done":
		return dto.VideoStatusCompleted
	case "failed", "error", "canceled", "cancelled", "expired":
		return dto.VideoStatusFailed
	default:
		return dto.VideoStatusQueued
	}
}
