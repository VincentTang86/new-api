package hailuo

import (
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

// H3MaxBillableTokens 是 Context-IR 单次结算的 token 上界。token 数来自上游，
// 作为计费乘数前必须有上界。
const H3MaxBillableTokens = 5_000_000

// EstimateBilling 返回提交时可预知的计费倍率与加价项。
//
// 输入参考视频的秒数此刻不可知——content 里只有 URL，网关不下载素材，所以预扣
// 里完全不含这一项，差额由 AdjustBillingOnComplete 拿到上游 usage 后补扣。
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	if !IsH3Model(info.OriginModelName) {
		return nil
	}
	payload, ok := getH3Payload(c)
	if !ok {
		return nil
	}

	// Context-IR 按 token 计费，这里只给一个预扣占位档位，最终额度完成时重算。
	if payload.Action == constant.TaskActionContextIR {
		return map[string]float64{TierContextIR: tierRatio(info.OriginModelName, TierContextIR)}
	}

	if price, ok := ratio_setting.GetModelImageInputPrice(info.OriginModelName); ok {
		images := billableImages(payload.ImageCount)
		info.PriceData.SetSurcharge(price * imagePriceFactor(payload.Action) * float64(images))
	}

	return map[string]float64{
		"seconds":                      float64(payload.Duration),
		outputRatioKey(payload.Action): tierRatio(info.OriginModelName, outputTierKey(payload.Action, payload.Resolution)),
	}
}

// AdjustBillingOnComplete 用上游返回的真实用量重算最终额度（绝对值，非增量）。
// 上游没给用量、或数据无法解析时返回 0，保持预扣不动——绝不猜。
func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, _ *relaycommon.TaskInfo) int {
	modelName := task.Properties.OriginModelName
	if !IsH3Model(modelName) {
		return 0
	}
	bc := task.PrivateData.BillingContext
	if bc == nil || bc.GroupRatio <= 0 {
		return 0
	}

	var resp QueryV2Response
	if err := common.Unmarshal(task.Data, &resp); err != nil || resp.Task == nil || resp.Task.Usage == nil {
		return 0
	}

	if resp.Task.TaskType == TaskTypeContextIR {
		return contextIRQuota(modelName, bc, resp.Task.Usage)
	}
	return videoQuota(modelName, bc, resp.Task, task.TaskID)
}

// videoQuota 按官方口径逐项计费：输出秒与输入参考视频秒各自查自己的档位倍率，
// 再加上按张计的超额图片费。两个秒数分量分开取，因此不依赖上游
// "total = input + output" 这条口径假设。
func videoQuota(modelName string, bc *model.TaskBillingContext, upstream *VideoTaskV2, taskID string) int {
	if bc.ModelPrice <= 0 {
		// 配置被改成了倍率计费，这套按秒公式的基准价就没了，保持预扣等人工处理。
		common.SysError(fmt.Sprintf("hailuo: task %s has no model price snapshot, skip settlement", taskID))
		return 0
	}

	outputSeconds, inputSeconds := billableSeconds(upstream.Usage)
	if outputSeconds <= 0 && inputSeconds <= 0 {
		return 0
	}

	unitQuota := bc.ModelPrice * common.QuotaPerUnit * bc.GroupRatio
	quota := unitQuota * float64(outputSeconds) * outputRatio(modelName, bc, upstream)
	quota += unitQuota * float64(inputSeconds) * tierRatio(modelName, inputVideoTierKey(upstream))

	// 图片加价按上游报的张数重算，而不是沿用提交时的快照：再生成引用源任务
	// （source_task_id 模式）时，源任务用了几张图在提交时根本无从得知，只有上游
	// 的 input_image_count 说了算。两者不一致时记日志，供与上游账单人工对账。
	imageQuota := 0.0
	if price, ok := ratio_setting.GetModelImageInputPrice(modelName); ok && price > 0 {
		billable := billableImages(upstream.Usage.InputImageCount)
		imageQuota = price * imagePriceFactor(upstream.TaskType) * float64(billable) * common.QuotaPerUnit * bc.GroupRatio
		// 再生成引用源任务时提交阶段本就无从预扣图片费，差异是设计如此，不算异常。
		preCharged := bc.Surcharge * common.QuotaPerUnit * bc.GroupRatio
		if upstream.TaskType != TaskTypeRegeneration && math.Abs(imageQuota-preCharged) > 1 {
			common.SysError(fmt.Sprintf("hailuo: task %s pre-charged %.0f for input images but upstream reported %d images (%d billable, %.0f)",
				taskID, preCharged, upstream.Usage.InputImageCount, billable, imageQuota))
		}
	}
	quota += imageQuota

	value, clamp := common.QuotaFromFloatChecked(quota)
	if clamp != nil {
		common.SysError(fmt.Sprintf("hailuo: task %s quota saturated during settlement: %+v", taskID, clamp))
	}
	return value
}

// contextIRQuota 按 token 结算 Context-IR。
//
// 它的输入 / 输出单价配在同名模型的 ModelRatio / CompletionRatio 上：ModelPrice
// 命中后常规定价链路根本不读这两项（relay/helper/price.go 的 usePrice 分支、
// model/pricing.go 的展示分支都只在没有 ModelPrice 时才走 ratio），所以复用它们
// 既不影响别处，又让 IR 的 token 价保持可配而不必硬编码。
func contextIRQuota(modelName string, bc *model.TaskBillingContext, usage *VideoTaskUsage) int {
	modelRatio, hasRatio, _ := ratio_setting.GetModelRatio(modelName)
	if !hasRatio || modelRatio <= 0 {
		return 0
	}
	promptTokens := clampTokens(usage.PromptTokens)
	completionTokens := clampTokens(usage.CompletionTokens)
	if promptTokens <= 0 && completionTokens <= 0 {
		return 0
	}

	weighted := float64(promptTokens) + float64(completionTokens)*ratio_setting.GetCompletionRatio(modelName)
	value, clamp := common.QuotaFromFloatChecked(weighted * modelRatio * bc.GroupRatio)
	if clamp != nil {
		common.SysError(fmt.Sprintf("hailuo: context-ir quota saturated during settlement: %+v", clamp))
	}
	return value
}

// billableSeconds 返回计费用的输出秒数与输入参考视频秒数。
//
// 再生成场景下上游的 input_seconds 是否包含 base_video 自身，官方文档没有写明；
// 若包含就会把源视频重复收一遍。口径确认后只需要改这个函数。
func billableSeconds(usage *VideoTaskUsage) (int, int) {
	output := clampSeconds(usage.OutputSeconds)
	input := clampSeconds(usage.InputSeconds)
	if output == 0 && input == 0 {
		// 上游只给了汇总秒数时按输出秒兜底。
		output = clampSeconds(usage.TotalSeconds)
	}
	return output, input
}

// clampSeconds 给上游返回的秒数封顶：它是计费乘数，异常值不能让额度失控。
func clampSeconds(seconds int) int {
	if seconds <= 0 {
		return 0
	}
	if seconds > H3MaxBillableSeconds {
		common.SysError(fmt.Sprintf("hailuo: upstream reported %d seconds, clamped to %d", seconds, H3MaxBillableSeconds))
		return H3MaxBillableSeconds
	}
	return seconds
}

func clampTokens(tokens int) int {
	if tokens <= 0 {
		return 0
	}
	if tokens > H3MaxBillableTokens {
		common.SysError(fmt.Sprintf("hailuo: upstream reported %d tokens, clamped to %d", tokens, H3MaxBillableTokens))
		return H3MaxBillableTokens
	}
	return tokens
}

// outputRatio 取提交时写入的输出档位倍率。主计费项必须与预扣同源，避免任务进行
// 中改价导致差额错误；快照缺失时才回落到当前配置。
func outputRatio(modelName string, bc *model.TaskBillingContext, upstream *VideoTaskV2) float64 {
	action := constant.TaskActionGenerate
	if upstream.TaskType == TaskTypeRegeneration {
		action = constant.TaskActionRegenerate
	}
	if ratio, ok := bc.OtherRatios[outputRatioKey(action)]; ok && ratio > 0 {
		return ratio
	}
	return tierRatio(modelName, outputTierKey(action, upstream.Resolution))
}

// outputRatioKey 是输出档位倍率在 OtherRatios 里的键名。键名固定，结算时才能
// 按任务类型确定地取回快照。
func outputRatioKey(action string) string {
	if action == constant.TaskActionRegenerate {
		return TierOutputRegeneration
	}
	return "resolution"
}

func outputTierKey(action, resolution string) string {
	if action == constant.TaskActionRegenerate {
		return TierOutputRegeneration
	}
	if resolution == Resolution2K {
		return TierOutput2K
	}
	return TierOutput768P
}

func inputVideoTierKey(upstream *VideoTaskV2) string {
	if upstream.TaskType == TaskTypeRegeneration {
		return TierInputVideoRegeneration
	}
	if upstream.Resolution == Resolution2K {
		return TierInputVideo2K
	}
	return TierInputVideo768P
}

// tierRatio 返回某个计费维度相对 768P 输出秒价的倍率：管理员配置优先，未配置时
// 回落到官方比值。输出秒与输入参考视频秒共用它，所以官方单独调整其中任何一项，
// 改配置即可生效。
func tierRatio(modelName, tier string) float64 {
	if ratio, ok := ratio_setting.GetModelResolutionRatio(modelName, tier); ok {
		return ratio
	}
	return officialH3TierRatios[tier]
}

// billableImages 返回超出免费额度、需要按张加价的图片数。
func billableImages(count int) int {
	if count > H3MaxReferenceImages {
		count = H3MaxReferenceImages
	}
	if count <= H3FreeImageCount {
		return 0
	}
	return count - H3FreeImageCount
}

// imagePriceFactor 把生成的图片单价折算到再生成口径（官方 0.15 / 0.20 元每张）。
// 入参既接受本地 action，也接受上游 task_type，两者的再生成标识各有一个。
func imagePriceFactor(actionOrTaskType string) float64 {
	switch actionOrTaskType {
	case constant.TaskActionRegenerate, TaskTypeRegeneration:
		return regenerationImagePriceRatio
	default:
		return 1
	}
}
