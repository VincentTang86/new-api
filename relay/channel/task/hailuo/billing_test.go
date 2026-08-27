package hailuo

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testModelPrice 用整数友好的基准价，让期望额度可以手算：
// 0.1 USD/秒 × QuotaPerUnit(500000) = 50000 quota 每秒。
const (
	testModelPrice = 0.1
	testUnitQuota  = testModelPrice * 500000
	testImagePrice = 0.02
)

func setImageInputPrice(t *testing.T, jsonStr string) {
	t.Helper()
	require.NoError(t, ratio_setting.UpdateModelImageInputPriceByJSONString(jsonStr))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelImageInputPriceByJSONString("{}"))
	})
}

func setResolutionRatio(t *testing.T, jsonStr string) {
	t.Helper()
	require.NoError(t, ratio_setting.UpdateModelResolutionRatioByJSONString(jsonStr))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelResolutionRatioByJSONString("{}"))
	})
}

func newSettledTask(modelName string, bc *model.TaskBillingContext, upstream string) *model.Task {
	return &model.Task{
		TaskID:      "task_h3_test",
		Data:        json.RawMessage(upstream),
		Properties:  model.Properties{OriginModelName: modelName},
		PrivateData: model.TaskPrivateData{BillingContext: bc},
	}
}

func billingContext(otherRatios map[string]float64, surcharge float64) *model.TaskBillingContext {
	return &model.TaskBillingContext{
		ModelPrice:      testModelPrice,
		GroupRatio:      1,
		OtherRatios:     otherRatios,
		Surcharge:       surcharge,
		OriginModelName: ModelH3,
	}
}

// upstreamTask 拼一个 v2 查询响应，秒数与图片数是结算的全部输入。
func upstreamTask(taskType, resolution string, outputSeconds, inputSeconds, imageCount int) string {
	return fmt.Sprintf(`{"task":{"id":"t1","model":"MiniMax-H3","status":"succeeded","task_type":%q,"resolution":%q,
		"usage":{"total_seconds":%d,"output_seconds":%d,"input_seconds":%d,"input_image_count":%d}}}`,
		taskType, resolution, outputSeconds+inputSeconds, outputSeconds, inputSeconds, imageCount)
}

func TestEstimateBillingTiersAndSurcharge(t *testing.T) {
	setImageInputPrice(t, fmt.Sprintf(`{%q:%v}`, ModelH3, testImagePrice))

	referenceImages := func(n int) string {
		items := `{"type":"text","text":"a cat"}`
		for i := 0; i < n; i++ {
			items += fmt.Sprintf(`,{"type":"image_url","image_url":{"url":"img%d"},"role":"reference_image"}`, i)
		}
		return items
	}

	tests := []struct {
		name          string
		body          string
		wantRatios    map[string]float64
		wantSurcharge float64
	}{
		{
			name:       "768p output is the base rate",
			body:       `{"prompt":"a cat","duration":6}`,
			wantRatios: map[string]float64{"seconds": 6, "resolution": 1},
		},
		{
			name:       "2k output carries its own multiplier",
			body:       `{"prompt":"a cat","duration":10,"size":"2K"}`,
			wantRatios: map[string]float64{"seconds": 10, "resolution": 1.6},
		},
		{
			name:       "five images stay free",
			body:       `{"prompt":"a cat","duration":6,"metadata":{"content":[` + referenceImages(5) + `]}}`,
			wantRatios: map[string]float64{"seconds": 6, "resolution": 1},
		},
		{
			name:          "images beyond the free allowance are charged per image",
			body:          `{"prompt":"a cat","duration":6,"metadata":{"content":[` + referenceImages(7) + `]}}`,
			wantRatios:    map[string]float64{"seconds": 6, "resolution": 1},
			wantSurcharge: 2 * testImagePrice,
		},
		{
			name:       "regeneration uses its own tier and the shortest duration when unknown",
			body:       `{"prompt":"a cat","metadata":{"content":[{"type":"text","text":"a cat"},{"type":"video_url","video_url":{"url":"src"},"role":"base_video"}]}}`,
			wantRatios: map[string]float64{"seconds": H3MinDuration, "regeneration": 0.6},
		},
		{
			name: "regeneration images are charged at the lower unit price",
			body: `{"prompt":"a cat","metadata":{"content":[` + referenceImages(7) +
				`,{"type":"video_url","video_url":{"url":"src"},"role":"base_video"}]}}`,
			wantRatios:    map[string]float64{"seconds": H3MinDuration, "regeneration": 0.6},
			wantSurcharge: 2 * testImagePrice * regenerationImagePriceRatio,
		},
		{
			name:       "context ir only carries a pre-charge placeholder tier",
			body:       `{"prompt":"a cat","duration":6,"mode":"context_ir"}`,
			wantRatios: map[string]float64{"context_ir": 1},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			c, info := newH3Context(t, tc.body)
			adaptor := &TaskAdaptor{}
			require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))

			ratios := adaptor.EstimateBilling(c, info)

			assert.Equal(t, tc.wantRatios, ratios)
			assert.InDelta(t, tc.wantSurcharge, info.PriceData.Surcharge(), 1e-9)
		})
	}
}

// v1 海螺模型不参与按秒计费，必须保持原有的按次行为。
func TestEstimateBillingSkipsNonH3Models(t *testing.T) {
	c, info := newH3Context(t, `{"prompt":"a cat","duration":6}`)
	info.OriginModelName = "MiniMax-Hailuo-2.3"
	adaptor := &TaskAdaptor{}

	assert.Nil(t, adaptor.EstimateBilling(c, info))
}

// 结算把输出秒与输入参考视频秒分成两项，各自查自己的档位——官方对这两项分别
// 定价，合并计算会在其中一项调价时算错。
func TestAdjustBillingOnCompleteBillsOutputAndInputVideoSeparately(t *testing.T) {
	setImageInputPrice(t, fmt.Sprintf(`{%q:%v}`, ModelH3, testImagePrice))

	tests := []struct {
		name      string
		bc        *model.TaskBillingContext
		upstream  string
		wantQuota int
	}{
		{
			name:      "768p generation without reference video",
			bc:        billingContext(map[string]float64{"seconds": 6, "resolution": 1}, 0),
			upstream:  upstreamTask(TaskTypeGeneration, Resolution768P, 6, 0, 0),
			wantQuota: testUnitQuota * 6,
		},
		{
			name:      "2k generation bills the reference video seconds too",
			bc:        billingContext(map[string]float64{"seconds": 10, "resolution": 1.6}, 0),
			upstream:  upstreamTask(TaskTypeGeneration, Resolution2K, 10, 12, 0),
			wantQuota: testUnitQuota*10*1.6 + testUnitQuota*12*1.6,
		},
		{
			name:      "regeneration bills both sides at the regeneration tier",
			bc:        billingContext(map[string]float64{"seconds": 8, "regeneration": 0.6}, 0),
			upstream:  upstreamTask(TaskTypeRegeneration, Resolution2K, 8, 5, 0),
			wantQuota: testUnitQuota*8*0.6 + testUnitQuota*5*0.6,
		},
		{
			name:      "input images beyond the free allowance are added on top",
			bc:        billingContext(map[string]float64{"seconds": 6, "resolution": 1}, 2*testImagePrice),
			upstream:  upstreamTask(TaskTypeGeneration, Resolution768P, 6, 0, 7),
			wantQuota: testUnitQuota*6 + 2*testImagePrice*500000,
		},
		{
			// 按 source_task_id 再生成时提交阶段看不到源任务用了几张图，加价
			// 只能以上游报的张数为准，快照里的 0 会漏收。
			name:      "regeneration bills the images the upstream reports, not the pre-charged ones",
			bc:        billingContext(map[string]float64{"seconds": 8, "regeneration": 0.6}, 0),
			upstream:  upstreamTask(TaskTypeRegeneration, Resolution2K, 8, 0, 8),
			wantQuota: testUnitQuota*8*0.6 + 3*testImagePrice*regenerationImagePriceRatio*500000,
		},
		{
			name:      "upstream seconds are clamped before they multiply the price",
			bc:        billingContext(map[string]float64{"seconds": 10, "resolution": 1}, 0),
			upstream:  upstreamTask(TaskTypeGeneration, Resolution768P, 10_000, 0, 0),
			wantQuota: testUnitQuota * H3MaxBillableSeconds,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			adaptor := &TaskAdaptor{}
			task := newSettledTask(ModelH3, tc.bc, tc.upstream)

			assert.Equal(t, tc.wantQuota, adaptor.AdjustBillingOnComplete(task, &relaycommon.TaskInfo{}))
		})
	}
}

// 输入视频档位独立可配：调整它只影响输入项，输出项仍按提交时的快照收费。
func TestAdjustBillingOnCompleteUsesConfiguredInputVideoTier(t *testing.T) {
	setResolutionRatio(t, fmt.Sprintf(`{%q:{"input_video_2k":0.8}}`, ModelH3))

	adaptor := &TaskAdaptor{}
	task := newSettledTask(ModelH3,
		billingContext(map[string]float64{"seconds": 10, "resolution": 1.6}, 0),
		upstreamTask(TaskTypeGeneration, Resolution2K, 10, 12, 0))

	quota := adaptor.AdjustBillingOnComplete(task, &relaycommon.TaskInfo{})

	assert.Equal(t, int(testUnitQuota*10*1.6+testUnitQuota*12*0.8), quota)
}

// 上游没给用量就保持预扣，绝不按猜测扣费。
func TestAdjustBillingOnCompleteKeepsPreChargeWhenUnusable(t *testing.T) {
	tests := []struct {
		name      string
		modelName string
		bc        *model.TaskBillingContext
		upstream  string
	}{
		{
			name:      "usage missing",
			modelName: ModelH3,
			bc:        billingContext(map[string]float64{"seconds": 6, "resolution": 1}, 0),
			upstream:  `{"task":{"id":"t1","status":"succeeded","task_type":"generation"}}`,
		},
		{
			name:      "response is not a v2 task",
			modelName: ModelH3,
			bc:        billingContext(map[string]float64{"seconds": 6, "resolution": 1}, 0),
			upstream:  `{"task_id":"t1","status":"Success"}`,
		},
		{
			name:      "billing context missing",
			modelName: ModelH3,
			bc:        nil,
			upstream:  upstreamTask(TaskTypeGeneration, Resolution768P, 6, 0, 0),
		},
		{
			name:      "model price snapshot lost",
			modelName: ModelH3,
			bc:        &model.TaskBillingContext{GroupRatio: 1, OtherRatios: map[string]float64{"resolution": 1}},
			upstream:  upstreamTask(TaskTypeGeneration, Resolution768P, 6, 0, 0),
		},
		{
			name:      "non h3 model keeps the v1 per-call behaviour",
			modelName: "MiniMax-Hailuo-2.3",
			bc:        billingContext(map[string]float64{"seconds": 6, "resolution": 1}, 0),
			upstream:  upstreamTask(TaskTypeGeneration, Resolution768P, 6, 0, 0),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			adaptor := &TaskAdaptor{}
			task := newSettledTask(tc.modelName, tc.bc, tc.upstream)

			assert.Zero(t, adaptor.AdjustBillingOnComplete(task, &relaycommon.TaskInfo{}))
		})
	}
}

// Context-IR 按 token 结算，输入与输出各有单价，不能混成一个 total_tokens。
func TestAdjustBillingOnCompleteContextIRUsesTokenRatios(t *testing.T) {
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(fmt.Sprintf(`{%q:0.4}`, ModelH3)))
	require.NoError(t, ratio_setting.UpdateCompletionRatioByJSONString(fmt.Sprintf(`{%q:4}`, ModelH3)))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{}`))
		require.NoError(t, ratio_setting.UpdateCompletionRatioByJSONString(`{}`))
	})

	adaptor := &TaskAdaptor{}
	task := newSettledTask(ModelH3,
		billingContext(map[string]float64{"context_ir": 1}, 0),
		`{"task":{"id":"t1","status":"succeeded","task_type":"h3_context_ir","modality":"text",
			"usage":{"total_tokens":3000,"prompt_tokens":1000,"completion_tokens":2000}}}`)

	quota := adaptor.AdjustBillingOnComplete(task, &relaycommon.TaskInfo{})

	assert.Equal(t, common.QuotaFromFloat((1000+2000*4)*0.4), quota)
}
