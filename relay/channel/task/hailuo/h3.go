package hailuo

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// h3PayloadContextKey 缓存本次提交定稿后的 H3 请求。校验、计费、下发上游三处
// 读同一份数据，避免出现"校验用一个值、计费用另一个值"的旁路。
const h3PayloadContextKey = "h3_payload"

// h3Payload 是一次 H3 提交在校验阶段就确定下来的全部信息。
type h3Payload struct {
	Action string
	Body   any
	// Resolution 与 Duration 是最终下发上游的值，也是预扣计费的依据。
	Resolution string
	Duration   int
	// ImageCount 是最终下发的 content 里的图片总数，按张加价用它，而不是
	// 用户请求里的 images 字段——metadata 可以整体替换 content。
	ImageCount int
}

// IsH3Model 判断该模型是否走 v2 链路。其余模型保持原有 v1 行为不变。
func IsH3Model(modelName string) bool {
	return strings.EqualFold(strings.TrimSpace(modelName), ModelH3)
}

func getH3Payload(c *gin.Context) (*h3Payload, bool) {
	v, exists := c.Get(h3PayloadContextKey)
	if !exists {
		return nil, false
	}
	payload, ok := v.(*h3Payload)
	return payload, ok
}

// buildH3Payload 解析、校验并定稿一次 H3 提交。它是 H3 请求的唯一构造入口。
func buildH3Payload(c *gin.Context, info *relaycommon.RelayInfo, req relaycommon.TaskSubmitReq) (*h3Payload, error) {
	content, err := buildH3Content(req)
	if err != nil {
		return nil, err
	}

	sourceTaskID := metadataString(req.Metadata, "source_task_id")
	action := resolveH3Action(req, content, sourceTaskID)

	if err := validateH3Content(content, action, sourceTaskID); err != nil {
		return nil, err
	}

	duration, explicit := resolveH3Duration(req)
	if action == constant.TaskActionRegenerate {
		// 再生成的时长由源视频决定，上游请求体里也没有这个字段；它只用于预扣
		// 估算，没有线索时按最短时长兜底，宁可少预扣、由完成时补足。
		if !explicit {
			duration = H3MinDuration
		}
	} else if duration < H3MinDuration || duration > H3MaxDuration {
		return nil, fmt.Errorf("duration must be an integer between %d and %d", H3MinDuration, H3MaxDuration)
	}

	resolution, err := resolveH3Resolution(req, action)
	if err != nil {
		return nil, err
	}

	payload := &h3Payload{
		Action:     action,
		Resolution: resolution,
		Duration:   duration,
		ImageCount: countInputImages(content),
	}

	switch action {
	case constant.TaskActionRegenerate:
		body := &RegenerationRequest{Model: ModelH3, Resolution: resolution}
		if sourceTaskID != "" {
			upstreamID, sourceDuration, err := resolveRegenerationSource(info.UserId, sourceTaskID)
			if err != nil {
				return nil, err
			}
			body.SourceTaskID = upstreamID
			// 再生成不接受 duration，源任务时长只用于预扣估算；查不到时保持
			// resolveH3Duration 的兜底值。
			if sourceDuration > 0 {
				payload.Duration = sourceDuration
			}
		} else {
			body.Content = content
		}
		body.AigcWatermark = metadataBool(req.Metadata, "aigc_watermark")
		payload.Body = body
	case constant.TaskActionContextIR:
		payload.Body = &ContextIRRequest{
			Model:    ModelH3,
			Content:  content,
			Duration: duration,
			Ratio:    resolveH3Ratio(req, content),
		}
	default:
		ratio := resolveH3Ratio(req, content)
		if err := validateH3Ratio(ratio, content); err != nil {
			return nil, err
		}
		payload.Body = &GenerationV2Request{
			Model:         ModelH3,
			Content:       content,
			Resolution:    resolution,
			Duration:      duration,
			Ratio:         ratio,
			AigcWatermark: metadataBool(req.Metadata, "aigc_watermark"),
		}
	}

	return payload, nil
}

// resolveH3Action 按请求内容分流到三个上游端点。再生成的两种输入模式
// （source_task_id / base_video）任一命中即为再生成。
func resolveH3Action(req relaycommon.TaskSubmitReq, content []ContentItem, sourceTaskID string) string {
	if sourceTaskID != "" || hasRole(content, RoleBaseVideo) {
		return constant.TaskActionRegenerate
	}
	if strings.EqualFold(strings.TrimSpace(req.Mode), "context_ir") {
		return constant.TaskActionContextIR
	}
	if hasMedia(content) {
		return constant.TaskActionGenerate
	}
	return constant.TaskActionTextGenerate
}

// buildH3Content 把标准任务字段映射成 H3 的多模态 content 数组。metadata.content
// 存在时整体覆盖，供调用方使用首尾帧、参考视频、参考音频等高级组合；缺少文本项
// 时仍会补上 prompt，因为上游要求每次请求都带一个非空 text。
func buildH3Content(req relaycommon.TaskSubmitReq) ([]ContentItem, error) {
	if raw, ok := req.Metadata["content"]; ok && raw != nil {
		encoded, err := common.Marshal(raw)
		if err != nil {
			return nil, errors.Wrap(err, "marshal metadata content failed")
		}
		var items []ContentItem
		if err := common.Unmarshal(encoded, &items); err != nil {
			return nil, errors.Wrap(err, "metadata content must be an array of content items")
		}
		if !hasText(items) && strings.TrimSpace(req.Prompt) != "" {
			items = append([]ContentItem{{Type: ContentTypeText, Text: req.Prompt}}, items...)
		}
		return normalizeH3Content(items), nil
	}

	items := make([]ContentItem, 0, len(req.Images)+1)
	if strings.TrimSpace(req.Prompt) != "" {
		items = append(items, ContentItem{Type: ContentTypeText, Text: req.Prompt})
	}
	switch len(req.Images) {
	case 0:
	case 1:
		items = append(items, imageItem(req.Images[0], RoleFirstFrame))
	case 2:
		items = append(items, imageItem(req.Images[0], RoleFirstFrame), imageItem(req.Images[1], RoleLastFrame))
	default:
		// 超过两张时按参考图处理：首尾帧最多一对，多图只能走全能参考入口。
		for _, url := range req.Images {
			items = append(items, imageItem(url, RoleReferenceImage))
		}
	}
	return normalizeH3Content(items), nil
}

// normalizeH3Content 补全省略的 role，让下发上游的请求体和计费统计面对的是
// 同一份显式数据。
func normalizeH3Content(items []ContentItem) []ContentItem {
	for i := range items {
		if items[i].Role != "" {
			continue
		}
		switch items[i].Type {
		case ContentTypeImageURL:
			items[i].Role = RoleFirstFrame
		case ContentTypeVideoURL:
			items[i].Role = RoleReferenceVideo
		case ContentTypeAudioURL:
			items[i].Role = RoleReferenceAudio
		}
	}
	return items
}

// validateH3Content 收紧上游的输入约束。这些上界同时是计费乘数的上界，必须在
// 请求进入计费前拒绝，不能依赖上游报错。
func validateH3Content(items []ContentItem, action, sourceTaskID string) error {
	// 按任务 ID 再生成不需要 content，上游会引用源任务的原始输入。
	if action == constant.TaskActionRegenerate && sourceTaskID != "" {
		if len(items) > 0 && hasMedia(items) {
			return errors.New("source_task_id and content are mutually exclusive")
		}
		return nil
	}

	promptLimit := H3MaxPromptChars
	if action == constant.TaskActionRegenerate {
		promptLimit = H3MaxRegenPromptChars
	}

	var text string
	counts := map[string]int{}
	mediaFiles := 0
	for _, item := range items {
		switch item.Type {
		case ContentTypeText:
			if strings.TrimSpace(item.Text) != "" && text == "" {
				text = item.Text
			}
			continue
		case ContentTypeImageURL:
			if item.ImageURL == nil || strings.TrimSpace(item.ImageURL.URL) == "" {
				return errors.New("image_url item requires a non-empty url")
			}
		case ContentTypeVideoURL:
			if item.VideoURL == nil || strings.TrimSpace(item.VideoURL.URL) == "" {
				return errors.New("video_url item requires a non-empty url")
			}
		case ContentTypeAudioURL:
			if item.AudioURL == nil || strings.TrimSpace(item.AudioURL.URL) == "" {
				return errors.New("audio_url item requires a non-empty url")
			}
		default:
			return fmt.Errorf("unsupported content type: %s", item.Type)
		}
		mediaFiles++
		counts[item.Role]++
	}

	if strings.TrimSpace(text) == "" {
		return errors.New("content must include a non-empty text item")
	}
	if len([]rune(text)) > promptLimit {
		return fmt.Errorf("prompt must not exceed %d characters", promptLimit)
	}

	if counts[RoleBaseVideo] != boolToInt(action == constant.TaskActionRegenerate) {
		if action == constant.TaskActionRegenerate {
			return errors.New("regeneration requires exactly one content item with role=base_video")
		}
		return errors.New("role=base_video is only valid for video regeneration")
	}

	limits := []struct {
		role  string
		limit int
	}{
		{RoleFirstFrame, H3MaxFirstFrames},
		{RoleLastFrame, H3MaxLastFrames},
		{RoleReferenceImage, H3MaxReferenceImages},
		{RoleReferenceVideo, H3MaxReferenceVideos},
		{RoleReferenceAudio, H3MaxReferenceAudios},
	}
	for _, l := range limits {
		if counts[l.role] > l.limit {
			return fmt.Errorf("at most %d content items with role=%s are supported", l.limit, l.role)
		}
	}

	frames := counts[RoleFirstFrame] + counts[RoleLastFrame]
	references := counts[RoleReferenceImage] + counts[RoleReferenceVideo] + counts[RoleReferenceAudio]
	if frames > 0 && references > 0 {
		return errors.New("first_frame/last_frame and reference_* inputs are mutually exclusive")
	}
	if mediaFiles > H3MaxContentFiles {
		return fmt.Errorf("at most %d media files are supported per request", H3MaxContentFiles)
	}
	return nil
}

// resolveRegenerationSource 把调用方给的网关任务 ID 换成上游任务 ID，并顺带取出
// 源任务时长用于预扣估算。再生成只能基于本账号在本网关提交过的 H3 任务。
func resolveRegenerationSource(userID int, taskID string) (string, int, error) {
	originTask, exist, err := model.GetByTaskId(userID, taskID)
	if err != nil {
		return "", 0, errors.Wrap(err, "query source task failed")
	}
	if !exist || originTask == nil {
		return "", 0, fmt.Errorf("source task %s not found", taskID)
	}
	upstreamID := originTask.GetUpstreamTaskID()
	if strings.TrimSpace(upstreamID) == "" {
		return "", 0, fmt.Errorf("source task %s has no upstream task id", taskID)
	}
	if originTask.Status != model.TaskStatusSuccess {
		return "", 0, fmt.Errorf("source task %s is not completed successfully", taskID)
	}

	var resp QueryV2Response
	if err := common.Unmarshal(originTask.Data, &resp); err == nil && resp.Task != nil {
		return upstreamID, resp.Task.Duration, nil
	}
	return upstreamID, 0, nil
}

// resolveH3Resolution 归一化分辨率档位。再生成的目标分辨率上游只接受 2K。
func resolveH3Resolution(req relaycommon.TaskSubmitReq, action string) (string, error) {
	if action == constant.TaskActionRegenerate {
		return Resolution2K, nil
	}
	raw := metadataString(req.Metadata, "resolution")
	if raw == "" {
		raw = req.Size
	}
	if strings.TrimSpace(raw) == "" {
		return Resolution768P, nil
	}
	resolution := normalizeH3Resolution(raw)
	if resolution == "" {
		return "", fmt.Errorf("unsupported resolution: %s (expected %s or %s)", raw, Resolution768P, Resolution2K)
	}
	return resolution, nil
}

// normalizeH3Resolution 接受档位名（768P / 2K）或 WxH 尺寸，无法识别时返回空串。
func normalizeH3Resolution(raw string) string {
	v := strings.ToLower(strings.TrimSpace(raw))
	switch v {
	case "768p":
		return Resolution768P
	case "2k", "1440p":
		return Resolution2K
	}
	width, height, ok := parseSize(v)
	if !ok {
		return ""
	}
	// 2K 的短边是 1440，768P 的短边是 768，按短边判档最稳。
	if min(width, height) >= 1080 {
		return Resolution2K
	}
	return Resolution768P
}

func parseSize(v string) (int, int, bool) {
	separator := "x"
	if !strings.Contains(v, separator) {
		separator = "*"
	}
	parts := strings.SplitN(v, separator, 2)
	if len(parts) != 2 {
		return 0, 0, false
	}
	width, err := strconv.Atoi(strings.TrimSpace(parts[0]))
	if err != nil || width <= 0 {
		return 0, 0, false
	}
	height, err := strconv.Atoi(strings.TrimSpace(parts[1]))
	if err != nil || height <= 0 {
		return 0, 0, false
	}
	return width, height, true
}

// resolveH3Duration 返回目标视频时长，以及调用方是否显式指定过。metadata 优先于
// 标准字段，校验、计费与下发上游三处用的是同一个值。
func resolveH3Duration(req relaycommon.TaskSubmitReq) (int, bool) {
	if seconds, ok := metadataInt(req.Metadata, "duration"); ok {
		return seconds, true
	}
	if req.Duration > 0 {
		return req.Duration, true
	}
	if seconds, err := strconv.Atoi(strings.TrimSpace(req.Seconds)); err == nil && seconds > 0 {
		return seconds, true
	}
	return DefaultDuration, false
}

// resolveH3Ratio 返回宽高比。图生视频的比例由输入图片决定，上游恒按 adaptive
// 处理；纯文生视频不接受 adaptive，需要一个具体比例。
func resolveH3Ratio(req relaycommon.TaskSubmitReq, content []ContentItem) string {
	if hasRole(content, RoleFirstFrame) || hasRole(content, RoleLastFrame) {
		return RatioAdaptive
	}
	if ratio := metadataString(req.Metadata, "ratio"); ratio != "" {
		return ratio
	}
	if hasMedia(content) {
		return RatioAdaptive
	}
	return DefaultH3Ratio
}

func validateH3Ratio(ratio string, content []ContentItem) error {
	if !common.StringsContains(h3SupportedRatios, ratio) {
		return fmt.Errorf("unsupported ratio: %s", ratio)
	}
	if ratio == RatioAdaptive && !hasMedia(content) {
		return errors.New("text-to-video requires a concrete ratio, adaptive is not accepted")
	}
	return nil
}

// countInputImages 统计计费口径下的输入图片数：首帧、尾帧与参考图全部相加，
// 与上游 usage.input_image_count 的口径一致。
func countInputImages(items []ContentItem) int {
	count := 0
	for _, item := range items {
		if item.Type == ContentTypeImageURL {
			count++
		}
	}
	return count
}

func imageItem(url, role string) ContentItem {
	return ContentItem{Type: ContentTypeImageURL, ImageURL: &MediaURL{URL: url}, Role: role}
}

func hasText(items []ContentItem) bool {
	for _, item := range items {
		if item.Type == ContentTypeText && strings.TrimSpace(item.Text) != "" {
			return true
		}
	}
	return false
}

func hasMedia(items []ContentItem) bool {
	for _, item := range items {
		if item.Type != ContentTypeText {
			return true
		}
	}
	return false
}

func hasRole(items []ContentItem, role string) bool {
	for _, item := range items {
		if item.Role == role {
			return true
		}
	}
	return false
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

func metadataString(metadata map[string]any, key string) string {
	v, ok := metadata[key]
	if !ok {
		return ""
	}
	s, _ := v.(string)
	return strings.TrimSpace(s)
}

func metadataBool(metadata map[string]any, key string) *bool {
	v, ok := metadata[key]
	if !ok {
		return nil
	}
	b, ok := v.(bool)
	if !ok {
		return nil
	}
	return &b
}

// metadataInt 读取 metadata 中的整数值。JSON 数字会被解析成 float64，表单字段
// 则可能已经是 int。
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

// doH3Response 解析 v2 的提交响应。v2 用 {"type":"error","error":{...}} 表达
// 失败，与 v1 的 base_resp 完全不同。
func (a *TaskAdaptor) doH3Response(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, responseBody []byte) (string, []byte, *taskdto.TaskError) {
	var errResp ErrorV2Response
	if err := common.Unmarshal(responseBody, &errResp); err == nil && errResp.Error != nil {
		return "", nil, service.TaskErrorWrapper(
			fmt.Errorf("minimax api error: %s", errResp.Error.Message),
			errResp.Error.Type, resp.StatusCode)
	}

	var submitted SubmitV2Response
	if err := common.Unmarshal(responseBody, &submitted); err != nil {
		return "", nil, service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody),
			"unmarshal_response_body_failed", http.StatusInternalServerError)
	}
	if strings.TrimSpace(submitted.TaskID) == "" {
		return "", nil, service.TaskErrorWrapper(fmt.Errorf("task_id is empty, body: %s", responseBody),
			"invalid_response", http.StatusInternalServerError)
	}

	openAIVideo := dto.NewOpenAIVideo()
	openAIVideo.ID = info.PublicTaskID
	openAIVideo.TaskID = info.PublicTaskID
	openAIVideo.CreatedAt = common.GetTimestamp()
	openAIVideo.Model = info.OriginModelName
	c.JSON(http.StatusOK, openAIVideo)

	return submitted.TaskID, responseBody, nil
}

// parseH3TaskResult 把 v2 的任务状态映射到网关的任务状态。未知状态按排队处理，
// 避免把还在生成的任务判成失败。
func parseH3TaskResult(upstream *VideoTaskV2) *relaycommon.TaskInfo {
	taskResult := &relaycommon.TaskInfo{Code: 0, TaskID: upstream.ID}
	switch upstream.Status {
	case V2StatusRunning:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = taskcommon.ProgressInProgress
	case V2StatusSucceeded:
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = taskcommon.ProgressComplete
		if upstream.Content != nil {
			taskResult.Url = upstream.Content.URL
		}
	case V2StatusFailed, V2StatusCancelled:
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = taskcommon.ProgressComplete
		taskResult.Reason = "task " + upstream.Status
		if upstream.Error != nil && upstream.Error.Message != "" {
			taskResult.Reason = upstream.Error.Message
		}
	default:
		taskResult.Status = model.TaskStatusQueued
		taskResult.Progress = taskcommon.ProgressQueued
	}
	return taskResult
}

// convertH3ToOpenAIVideo 组装对外的视频任务响应。Context-IR 的产物是增强提示词
// 而不是视频，放进 metadata.prompt 返回。
func convertH3ToOpenAIVideo(task *model.Task, upstream *VideoTaskV2) ([]byte, error) {
	openAIVideo := task.ToOpenAIVideo()
	if upstream.Error != nil {
		openAIVideo.Error = &dto.OpenAIVideoError{
			Code:    upstream.Error.Code,
			Message: upstream.Error.Message,
		}
	}
	if upstream.Content != nil && upstream.Content.Prompt != "" {
		openAIVideo.SetMetadata("prompt", upstream.Content.Prompt)
	}
	if upstream.Duration > 0 {
		openAIVideo.Seconds = strconv.Itoa(upstream.Duration)
	}
	if upstream.Resolution != "" {
		openAIVideo.Size = upstream.Resolution
	}

	jsonData, err := common.Marshal(openAIVideo)
	if err != nil {
		return nil, errors.Wrap(err, "marshal openai video failed")
	}
	return jsonData, nil
}
