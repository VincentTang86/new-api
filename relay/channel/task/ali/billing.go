package ali

import (
	"fmt"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// InputVideoRateKey 是参考视频输入秒数在后台 ModelResolutionRatio 里的键。百炼是否对
// 输入视频单独计价尚未实测，所以配了才收：未配置时这部分秒数不计费并记日志，运营
// 实测后填上即可开启，不必发版。
const InputVideoRateKey = "input_video"

// AdjustBillingOnComplete 用上游回传的真实用量重算万相 3.0 的最终额度（绝对值，非增量）。
//
// 定义在 *TaskAdaptor 上会覆盖内嵌 BaseBilling 的实现、对所有阿里视频模型生效，而轮询
// 结算里 adaptor 的正数返回优先于 PerCallBilling——首行守卫是 wan2.x 行为不变的唯一保证。
// 上游没给用量、或数据无法解析时返回 0，保持预扣不动——绝不猜。
func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, _ *relaycommon.TaskInfo) int {
	// 协议由上游模型名决定；旧任务行没存 UpstreamModelName 时回落原始名。
	upstreamModel := task.Properties.UpstreamModelName
	if upstreamModel == "" {
		upstreamModel = task.Properties.OriginModelName
	}
	if !IsWan30Model(upstreamModel) {
		return 0
	}
	bc := task.PrivateData.BillingContext
	if bc == nil || bc.GroupRatio <= 0 {
		return 0
	}
	if bc.ModelPrice <= 0 {
		// 配置被改成了倍率计费，这套按秒公式的基准价就没了，保持预扣等人工处理。
		common.SysError(fmt.Sprintf("ali: task %s has no model price snapshot, skip wan3.0 settlement", task.TaskID))
		return 0
	}

	var resp AliVideoResponse
	if err := common.Unmarshal(task.Data, &resp); err != nil || resp.Usage == nil {
		return 0
	}
	usage := resp.Usage

	outputSeconds := int(usage.OutputVideoDuration)
	if outputSeconds <= 0 {
		outputSeconds = int(usage.Duration)
	}
	if outputSeconds <= 0 {
		return 0
	}
	// 上游回传的秒数同样是不可信输入，作为乘数前先饱和。
	outputSeconds = min(outputSeconds, MaxWan30DurationSeconds)

	// 用户按原始模型名付费，倍率与单价一律按它查。
	modelName := task.Properties.OriginModelName
	unitQuota := bc.ModelPrice * common.QuotaPerUnit * bc.GroupRatio
	quota := unitQuota * float64(outputSeconds) * settledResolutionRatio(modelName, bc, usage, task.TaskID)

	if inputSeconds := min(int(usage.InputVideoDuration), MaxWan30DurationSeconds); inputSeconds > 0 {
		if ratio, ok := ratio_setting.GetModelResolutionRatio(modelName, InputVideoRateKey); ok {
			quota += unitQuota * float64(inputSeconds) * ratio
		} else {
			common.SysError(fmt.Sprintf("ali: task %s reported %d seconds of input video but %s has no %q ratio configured, not charged",
				task.TaskID, inputSeconds, modelName, InputVideoRateKey))
		}
	}

	value, clamp := common.QuotaFromFloatChecked(quota)
	if clamp != nil {
		common.SysError(fmt.Sprintf("ali: task %s quota saturated during settlement: %+v", task.TaskID, clamp))
	}
	return value
}

// settledResolutionRatio 由上游 usage.SR（实际输出分辨率）定档——这是本次修复的核心：
// 万相 3.0 会忽略请求里的 size，只有产物的分辨率才可信。SR 识别不出来时回落到预扣时
// 的倍率快照，不静默改价，并记日志供对账。
func settledResolutionRatio(modelName string, bc *model.TaskBillingContext, usage *AliUsage, taskID string) float64 {
	if sr := int(usage.SR); sr > 0 {
		if ratio, ok := Wan30ResolutionRatio(modelName, strconv.Itoa(sr)+"p"); ok {
			return ratio
		}
	}
	snapshot := bc.OtherRatios["resolution"]
	if snapshot <= 0 {
		snapshot = 1
	}
	common.SysError(fmt.Sprintf("ali: task %s has unrecognised upstream SR=%d, falling back to pre-charge resolution ratio %g",
		taskID, int(usage.SR), snapshot))
	return snapshot
}
