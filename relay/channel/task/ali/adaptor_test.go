package ali

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
}

func TestConvertToAliRequestWan27I2VBuildsMediaFromImage(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:    "wan2.7-i2v",
		Prompt:   "animate the first frame",
		Image:    "https://example.com/first.png",
		Size:     "720p",
		Duration: 10,
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, "wan2.7-i2v", aliReq.Model)
	require.Equal(t, "720P", aliReq.Parameters.Resolution)
	require.Equal(t, 10, aliReq.Parameters.Duration)
	require.Equal(t, []AliVideoMedia{
		{Type: "first_frame", URL: "https://example.com/first.png"},
	}, aliReq.Input.Media)
	require.Empty(t, aliReq.Input.ImgURL)

	body, err := common.Marshal(aliReq)
	require.NoError(t, err)
	require.Contains(t, string(body), `"media"`)
	require.NotContains(t, string(body), `"img_url"`)
}

func TestConvertToAliRequestWan27I2VBuildsFirstAndLastFrameFromImages(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "wan2.7-i2v",
		Prompt: "interpolate between frames",
		Images: []string{
			"https://example.com/first.png",
			"https://example.com/last.png",
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{
		{Type: "first_frame", URL: "https://example.com/first.png"},
		{Type: "last_frame", URL: "https://example.com/last.png"},
	}, aliReq.Input.Media)
}

func TestConvertToAliRequestWan27I2VPrefersImageBeforeImagesAndInputReference(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:          "wan2.7-i2v",
		Prompt:         "use the direct image",
		Image:          " https://example.com/direct.png ",
		Images:         []string{"https://example.com/images-first.png", " https://example.com/images-last.png "},
		InputReference: "https://example.com/input-reference.png",
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{
		{Type: "first_frame", URL: "https://example.com/direct.png"},
		{Type: "last_frame", URL: "https://example.com/images-last.png"},
	}, aliReq.Input.Media)
}

func TestConvertToAliRequestWan27I2VFallsBackToFirstNonEmptyImage(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "wan2.7-i2v",
		Prompt: "skip blank images",
		Image:  " ",
		Images: []string{
			" ",
			" https://example.com/first.png ",
			" https://example.com/last.png ",
		},
		InputReference: "https://example.com/input-reference.png",
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{
		{Type: "first_frame", URL: "https://example.com/first.png"},
		{Type: "last_frame", URL: "https://example.com/last.png"},
	}, aliReq.Input.Media)
}

func TestConvertToAliRequestWan27I2VKeepsExplicitMetadataMedia(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:          "wan2.7-i2v",
		Prompt:         "continue the clip",
		Image:          "https://example.com/direct.png",
		Images:         []string{"https://example.com/images-first.png", "https://example.com/images-last.png"},
		InputReference: "https://example.com/input-reference.png",
		Metadata: map[string]interface{}{
			"input": map[string]interface{}{
				"media": []interface{}{
					map[string]interface{}{
						"type": "first_clip",
						"url":  "https://example.com/input.mp4",
					},
				},
			},
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{
		{Type: "first_clip", URL: "https://example.com/input.mp4"},
	}, aliReq.Input.Media)
	require.Empty(t, aliReq.Input.ImgURL)

	body, err := common.Marshal(aliReq)
	require.NoError(t, err)
	require.Contains(t, string(body), `"media"`)
	require.NotContains(t, string(body), `"img_url"`)
}

func TestConvertToAliRequestWan27I2VRequiresMedia(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "wan2.7-i2v",
		Prompt: "animate without a frame",
	}

	_, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.Error(t, err)
	require.True(t, strings.Contains(err.Error(), "requires image"))
}

func TestConvertToAliRequestWan25I2VKeepsLegacyImgURL(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "wan2.5-i2v-preview",
		Prompt: "animate the first frame",
		Image:  "https://example.com/first.png",
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, "https://example.com/first.png", aliReq.Input.ImgURL)
	require.Empty(t, aliReq.Input.Media)

	body, err := common.Marshal(aliReq)
	require.NoError(t, err)
	require.Contains(t, string(body), `"img_url"`)
	require.NotContains(t, string(body), `"media"`)
}

func TestConvertToAliRequestWan30SendsResolutionNotSize(t *testing.T) {
	// 万相 3.0 不认 size 只认 resolution：实测传 size "832*480" 出的是 1920x1080。
	// 这里锁住的是"下发体里永远没有 size"，否则计费档与产物对不上。
	adaptor := &TaskAdaptor{}
	tests := []struct {
		name           string
		req            relaycommon.TaskSubmitReq
		wantResolution string
	}{
		{
			name:           "pixel size is mapped to its tier",
			req:            relaycommon.TaskSubmitReq{Model: "wan3.0-video-prime", Prompt: "a cat", Size: "832*480"},
			wantResolution: "480P",
		},
		{
			name:           "tier name is upper-cased",
			req:            relaycommon.TaskSubmitReq{Model: "wan3.0-video", Prompt: "a cat", Size: "1080p"},
			wantResolution: "1080P",
		},
		{
			name:           "omitted size falls back to 720P",
			req:            relaycommon.TaskSubmitReq{Model: "wan3.0-video-prime", Prompt: "a cat"},
			wantResolution: "720P",
		},
		{
			name: "size smuggled through metadata is normalised too",
			req: relaycommon.TaskSubmitReq{Model: "wan3.0-video-prime", Prompt: "a cat", Metadata: map[string]interface{}{
				"parameters": map[string]interface{}{"size": "1920*1080"},
			}},
			wantResolution: "1080P",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), tt.req)
			require.NoError(t, err)
			assert.Empty(t, aliReq.Parameters.Size)
			assert.Equal(t, tt.wantResolution, aliReq.Parameters.Resolution)

			body, err := common.Marshal(aliReq)
			require.NoError(t, err)
			assert.NotContains(t, string(body), `"size"`)
		})
	}
}

func TestConvertToAliRequestWan30RejectsUnknownSize(t *testing.T) {
	_, err := (&TaskAdaptor{}).convertToAliRequest(testRelayInfo(), relaycommon.TaskSubmitReq{
		Model: "wan3.0-video-prime", Prompt: "a cat", Size: "999*999",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid size")
}

func TestConvertToAliRequestWan30AppliesToMappedUpstreamModel(t *testing.T) {
	// 管理员把自定义名映射到 wan3.0 时，协议归一化按上游名生效。
	info := testRelayInfo()
	info.IsModelMapped = true
	info.UpstreamModelName = "wan3.0-video-prime"

	aliReq, err := (&TaskAdaptor{}).convertToAliRequest(info, relaycommon.TaskSubmitReq{
		Model: "my-video", Prompt: "a cat", Size: "832*480",
	})

	require.NoError(t, err)
	assert.Equal(t, "wan3.0-video-prime", aliReq.Model)
	assert.Empty(t, aliReq.Parameters.Size)
	assert.Equal(t, "480P", aliReq.Parameters.Resolution)
}

func TestConvertToAliRequestWan2KeepsSize(t *testing.T) {
	// 回归保护：wan2.x 认 size，万相 3.0 的归一化不得波及它。
	aliReq, err := (&TaskAdaptor{}).convertToAliRequest(testRelayInfo(), relaycommon.TaskSubmitReq{
		Model: "wan2.5-t2v-preview", Prompt: "a cat", Size: "832*480",
	})

	require.NoError(t, err)
	assert.Equal(t, "832*480", aliReq.Parameters.Size)
	assert.Empty(t, aliReq.Parameters.Resolution)
}

func TestConvertToAliRequestWan30DurationBounds(t *testing.T) {
	// 顶层 duration 拒绝负数，不定长只能经 metadata 进来；metadata 绕过了顶层校验，
	// 边界必须在适配器里兜住。
	tests := []struct {
		name     string
		duration int
		wantErr  bool
	}{
		{"unlimited sentinel is accepted", UnlimitedDurationSentinel, false},
		{"ceiling is inclusive", MaxWan30DurationSeconds, false},
		{"above the ceiling is rejected", MaxWan30DurationSeconds + 1, true},
		{"other negatives are not sentinels", -2, true},
		{"zero is rejected", 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			aliReq, err := (&TaskAdaptor{}).convertToAliRequest(testRelayInfo(), relaycommon.TaskSubmitReq{
				Model: "wan3.0-video-prime", Prompt: "a cat",
				Metadata: map[string]interface{}{"parameters": map[string]interface{}{"duration": tt.duration}},
			})
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.duration, aliReq.Parameters.Duration)
		})
	}
}

func TestParseTaskResultAcceptsFloatUsageFromDedicatedInstance(t *testing.T) {
	// 专属实例把 usage 里的秒数写成 5.0 / 0.0；轮询器靠这里解析终态，解析失败任务就永久卡住。
	body := []byte(`{"request_id":"r1","output":{"task_id":"t1","task_status":"SUCCEEDED","video_url":"https://example.com/v.mp4"},
		"usage":{"video_count":1,"duration":5.0,"SR":480,"output_video_duration":5.0,"input_video_duration":0.0,"fps":30,"ratio":"16:9"}}`)

	result, err := (&TaskAdaptor{}).ParseTaskResult(body)

	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusSuccess, result.Status)
	assert.Equal(t, "https://example.com/v.mp4", result.Url)
}
