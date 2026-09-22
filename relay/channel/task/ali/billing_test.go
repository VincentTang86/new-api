package ali

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testModelPrice 用整数友好的基准价，让期望额度可以手算：
// 0.1 USD/秒 × QuotaPerUnit(500000) = 50000 quota 每秒。
const (
	testModelPrice = 0.1
	testUnitQuota  = testModelPrice * 500000
)

func setResolutionRatio(t *testing.T, jsonStr string) {
	t.Helper()
	require.NoError(t, ratio_setting.UpdateModelResolutionRatioByJSONString(jsonStr))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelResolutionRatioByJSONString("{}"))
	})
}

func settledTask(props model.Properties, bc *model.TaskBillingContext, upstream string) *model.Task {
	return &model.Task{
		TaskID:      "task_wan30_test",
		Data:        json.RawMessage(upstream),
		Properties:  props,
		PrivateData: model.TaskPrivateData{BillingContext: bc},
	}
}

func wan30Billing(snapshot map[string]float64) *model.TaskBillingContext {
	return &model.TaskBillingContext{ModelPrice: testModelPrice, GroupRatio: 1, OtherRatios: snapshot}
}

// wan30Usage 拼一份任务查询响应，SR 与两个秒数是结算的全部输入；字段形态照 2026-09-21 实测回执。
func wan30Usage(sr, outputSeconds, inputSeconds int) string {
	return fmt.Sprintf(`{"output":{"task_id":"t1","task_status":"SUCCEEDED","video_url":"https://example.com/v.mp4"},
		"usage":{"duration":%d,"input_video_duration":%d,"output_video_duration":%d,"fps":30,"video_count":1,"SR":%d,"ratio":"16:9"}}`,
		outputSeconds, inputSeconds, outputSeconds, sr)
}

func TestWan30ResolutionRatioPrefersConfiguredOverBuiltIn(t *testing.T) {
	setResolutionRatio(t, `{"wan3.0-video":{"1080P":3.2}}`)

	tests := []struct {
		name       string
		model      string
		resolution string
		want       float64
		wantOK     bool
	}{
		{"configured tier wins and keys are case-insensitive", "wan3.0-video", "1080p", 3.2, true},
		{"unconfigured tier falls back to the built-in ratio", "wan3.0-video", "720P", 2, true},
		{"other model uses the built-in table", "wan3.0-video-prime", " 480p ", 1, true},
		{"unknown tier has no ratio", "wan3.0-video-prime", "4k", 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := Wan30ResolutionRatio(tt.model, tt.resolution)
			assert.Equal(t, tt.wantOK, ok)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestEstimateBillingWan30(t *testing.T) {
	setResolutionRatio(t, `{"wan3.0-video-prime":{"1080p":3.5}}`)

	tests := []struct {
		name string
		req  relaycommon.TaskSubmitReq
		want map[string]float64
	}{
		{
			name: "explicit seconds and a configured tier",
			req:  relaycommon.TaskSubmitReq{Model: "wan3.0-video-prime", Prompt: "a cat", Size: "1920*1080", Duration: 8},
			want: map[string]float64{"seconds": 8, "resolution": 3.5},
		},
		{
			name: "unconfigured tier falls back to the built-in ratio",
			req:  relaycommon.TaskSubmitReq{Model: "wan3.0-video-prime", Prompt: "a cat", Size: "1280*720", Duration: 5},
			want: map[string]float64{"seconds": 5, "resolution": 2},
		},
		{
			name: "unlimited duration is held at the 30 second ceiling",
			req: relaycommon.TaskSubmitReq{Model: "wan3.0-video-prime", Prompt: "a cat", Size: "832*480",
				Metadata: map[string]interface{}{"parameters": map[string]interface{}{"duration": -1}}},
			want: map[string]float64{"seconds": 30, "resolution": 1},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			info := testRelayInfo()
			info.OriginModelName = tt.req.Model
			relaycommon.StoreTaskRequest(c, info, "generate", tt.req)

			assert.Equal(t, tt.want, (&TaskAdaptor{}).EstimateBilling(c, info))
		})
	}
}

func TestAdjustBillingOnCompleteWan30SettlesByUpstreamSR(t *testing.T) {
	prime := model.Properties{OriginModelName: "wan3.0-video-prime", UpstreamModelName: "wan3.0-video-prime"}
	tests := []struct {
		name  string
		props model.Properties
		bc    *model.TaskBillingContext
		data  string
		want  int
	}{
		{
			name:  "1080p output is billed at the 1080p tier even though 480p was pre-charged",
			props: prime,
			bc:    wan30Billing(map[string]float64{"seconds": 5, "resolution": 1}),
			data:  wan30Usage(1080, 5, 0),
			want:  testUnitQuota * 5 * 4,
		},
		{
			name:  "480p output stays at the base tier",
			props: prime,
			bc:    wan30Billing(map[string]float64{"seconds": 5, "resolution": 1}),
			data:  wan30Usage(480, 5, 0),
			want:  testUnitQuota * 5,
		},
		{
			name:  "unlimited pre-charge settles down to the seconds actually produced",
			props: prime,
			bc:    wan30Billing(map[string]float64{"seconds": 30, "resolution": 2}),
			data:  wan30Usage(720, 7, 0),
			want:  testUnitQuota * 7 * 2,
		},
		{
			name:  "upstream seconds are saturated at the ceiling",
			props: prime,
			bc:    wan30Billing(map[string]float64{"seconds": 30, "resolution": 1}),
			data:  wan30Usage(480, 999, 0),
			want:  testUnitQuota * MaxWan30DurationSeconds,
		},
		{
			name:  "unknown SR keeps the pre-charge resolution ratio instead of guessing",
			props: prime,
			bc:    wan30Billing(map[string]float64{"seconds": 5, "resolution": 2}),
			data:  wan30Usage(999, 5, 0),
			want:  testUnitQuota * 5 * 2,
		},
		{
			name:  "input video seconds are not charged until a ratio is configured",
			props: prime,
			bc:    wan30Billing(map[string]float64{"seconds": 5, "resolution": 1}),
			data:  wan30Usage(480, 5, 4),
			want:  testUnitQuota * 5,
		},
		{
			name:  "legacy row without an upstream name settles by the origin name",
			props: model.Properties{OriginModelName: "wan3.0-video"},
			bc:    wan30Billing(map[string]float64{"seconds": 5, "resolution": 1}),
			data:  wan30Usage(720, 5, 0),
			want:  testUnitQuota * 5 * 2,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := (&TaskAdaptor{}).AdjustBillingOnComplete(settledTask(tt.props, tt.bc, tt.data), nil)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestAdjustBillingOnCompleteWan30KeepsPreChargeWhenItCannotSettle(t *testing.T) {
	prime := model.Properties{OriginModelName: "wan3.0-video-prime", UpstreamModelName: "wan3.0-video-prime"}
	tests := []struct {
		name  string
		props model.Properties
		bc    *model.TaskBillingContext
		data  string
	}{
		{"wan2.x is left to the default settlement path", model.Properties{OriginModelName: "wan2.5-i2v-preview"}, wan30Billing(nil), wan30Usage(1080, 5, 0)},
		{"missing usage", prime, wan30Billing(nil), `{"output":{"task_id":"t1","task_status":"SUCCEEDED"}}`},
		{"unparseable task data", prime, wan30Billing(nil), `not json`},
		{"no billing context", prime, nil, wan30Usage(480, 5, 0)},
		{"ratio-priced model has no per-second base", prime, &model.TaskBillingContext{GroupRatio: 1}, wan30Usage(480, 5, 0)},
		{"zero output seconds", prime, wan30Billing(nil), wan30Usage(480, 0, 0)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, 0, (&TaskAdaptor{}).AdjustBillingOnComplete(settledTask(tt.props, tt.bc, tt.data), nil))
		})
	}
}

func TestAdjustBillingOnCompleteWan30PricesByOriginNameAndChargesConfiguredInputVideo(t *testing.T) {
	// 协议按上游名判定，倍率按原始名查——用户按原始名付费；input_video 配了才收。
	setResolutionRatio(t, `{"my-video":{"1080p":3,"input_video":0.5}}`)
	props := model.Properties{OriginModelName: "my-video", UpstreamModelName: "wan3.0-video-prime"}
	bc := wan30Billing(map[string]float64{"seconds": 5, "resolution": 1})

	got := (&TaskAdaptor{}).AdjustBillingOnComplete(settledTask(props, bc, wan30Usage(1080, 5, 4)), nil)

	want := int(testUnitQuota*5*3 + testUnitQuota*4*0.5)
	assert.Equal(t, want, got)
}

func TestAdjustBillingOnCompleteWan30AcceptsFloatSecondsFromDedicatedInstance(t *testing.T) {
	// 2026-09-22 实测：专属实例（*.maas.aliyuncs.com）把秒数序列化成 5.0 / 0.0，公共端点是 5 / 0。
	// 解析不了这份报文，任务就永远卡在 in_progress、押金永不结算——这条锁住的是那次事故。
	dedicated := `{"output":{"task_id":"t1","task_status":"SUCCEEDED","video_url":"https://example.com/v.mp4"},
		"usage":{"video_count":1,"duration":5.0,"SR":480,"output_video_duration":5.0,"input_video_duration":0.0,"fps":30,"ratio":"16:9"}}`
	props := model.Properties{OriginModelName: "wan3.0-video-prime", UpstreamModelName: "wan3.0-video-prime"}
	bc := wan30Billing(map[string]float64{"seconds": 30, "resolution": 1})

	got := (&TaskAdaptor{}).AdjustBillingOnComplete(settledTask(props, bc, dedicated), nil)

	assert.Equal(t, int(testUnitQuota*5), got)
}
