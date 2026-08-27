package xai

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testModel = "grok-imagine-video-1.5"

func newTestContext(t *testing.T, body string) (*gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: testModel,
		},
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
		OriginModelName: testModel,
	}
}

// setImageInputPrice 把图片单价写进全局配置表，并在用例结束后清空，
// 避免用例之间互相影响。
func setImageInputPrice(t *testing.T, json string) {
	t.Helper()
	require.NoError(t, ratio_setting.UpdateModelImageInputPriceByJSONString(json))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelImageInputPriceByJSONString("{}"))
	})
}

func TestValidateRequestRejectsOutOfBoundValues(t *testing.T) {
	tests := []struct {
		name string
		body string
		code string
	}{
		{
			name: "duration above upstream maximum",
			body: `{"prompt":"a cat","duration":16}`,
			code: "invalid_duration",
		},
		{
			name: "duration below one",
			body: `{"prompt":"a cat","duration":-1}`,
			code: "invalid_seconds",
		},
		{
			name: "duration smuggled through metadata",
			body: `{"prompt":"a cat","metadata":{"duration":100}}`,
			code: "invalid_duration",
		},
		{
			name: "more reference images than supported",
			body: `{"prompt":"a cat","images":["a","b","c","d","e","f","g","h"]}`,
			code: "invalid_images",
		},
		{
			name: "reference to video above 720p",
			body: `{"prompt":"a cat","images":["a","b"],"size":"1080p"}`,
			code: "invalid_resolution",
		},
		{
			name: "unsupported resolution label",
			body: `{"prompt":"a cat","size":"2160p"}`,
			code: "invalid_resolution",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			c, info := newTestContext(t, tc.body)
			adaptor := &TaskAdaptor{}

			taskErr := adaptor.ValidateRequestAndSetAction(c, info)

			require.NotNil(t, taskErr)
			assert.Equal(t, http.StatusBadRequest, taskErr.StatusCode)
			assert.Equal(t, tc.code, taskErr.Code)
		})
	}
}

func TestValidateRequestSetsActionByImageCount(t *testing.T) {
	tests := []struct {
		name   string
		body   string
		action string
	}{
		{
			name:   "text to video",
			body:   `{"prompt":"a cat","duration":5}`,
			action: constant.TaskActionTextGenerate,
		},
		{
			name:   "image to video",
			body:   `{"prompt":"a cat","image":"https://example.com/a.png"}`,
			action: constant.TaskActionGenerate,
		},
		{
			name:   "reference to video",
			body:   `{"prompt":"a cat","images":["https://example.com/a.png","https://example.com/b.png"]}`,
			action: constant.TaskActionReferenceGenerate,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			c, info := newTestContext(t, tc.body)
			adaptor := &TaskAdaptor{}

			require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))
			assert.Equal(t, tc.action, info.Action)
		})
	}
}

func TestEstimateBillingRatiosAndSurcharge(t *testing.T) {
	setImageInputPrice(t, `{"`+testModel+`":0.01}`)

	tests := []struct {
		name          string
		body          string
		wantSeconds   float64
		wantResRatio  float64
		wantSurcharge float64
	}{
		{
			name:          "text to video defaults to 720p",
			body:          `{"prompt":"a cat","duration":5}`,
			wantSeconds:   5,
			wantResRatio:  1.75,
			wantSurcharge: 0,
		},
		{
			name:          "480p is the base rate",
			body:          `{"prompt":"a cat","duration":15,"size":"480p"}`,
			wantSeconds:   15,
			wantResRatio:  1,
			wantSurcharge: 0,
		},
		{
			name:          "1080p carries the highest multiplier",
			body:          `{"prompt":"a cat","duration":8,"size":"1080p"}`,
			wantSeconds:   8,
			wantResRatio:  3.125,
			wantSurcharge: 0,
		},
		{
			name:          "single input image is charged once",
			body:          `{"prompt":"a cat","duration":6,"image":"https://example.com/a.png"}`,
			wantSeconds:   6,
			wantResRatio:  1.75,
			wantSurcharge: 0.01,
		},
		{
			name:          "seven reference images are charged per image",
			body:          `{"prompt":"a cat","duration":6,"images":["a","b","c","d","e","f","g"]}`,
			wantSeconds:   6,
			wantResRatio:  1.75,
			wantSurcharge: 0.07,
		},
		{
			name:          "WxH size maps onto a resolution tier",
			body:          `{"prompt":"a cat","duration":4,"size":"1920x1080"}`,
			wantSeconds:   4,
			wantResRatio:  3.125,
			wantSurcharge: 0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			c, info := newTestContext(t, tc.body)
			adaptor := &TaskAdaptor{}
			require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))

			ratios := adaptor.EstimateBilling(c, info)

			require.NotNil(t, ratios)
			assert.Equal(t, tc.wantSeconds, ratios["seconds"])
			assert.Equal(t, tc.wantResRatio, ratios["resolution"])
			assert.InDelta(t, tc.wantSurcharge, info.PriceData.Surcharge(), 1e-9)
		})
	}
}

func TestEstimateBillingWithoutConfiguredImagePriceChargesNoSurcharge(t *testing.T) {
	setImageInputPrice(t, `{}`)
	c, info := newTestContext(t, `{"prompt":"a cat","duration":6,"images":["a","b"]}`)
	adaptor := &TaskAdaptor{}
	require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))

	ratios := adaptor.EstimateBilling(c, info)

	require.NotNil(t, ratios)
	assert.Zero(t, info.PriceData.Surcharge())
}

func TestBuildRequestBodyMatchesBilledParameters(t *testing.T) {
	// 下发给上游的时长与分辨率必须与计费用的值一致，否则扣的钱和实际生成的不符。
	c, info := newTestContext(t, `{"prompt":"a cat","duration":5,"images":["https://example.com/a.png"],"metadata":{"resolution":"1080p","seed":42}}`)
	adaptor := &TaskAdaptor{}
	require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))

	ratios := adaptor.EstimateBilling(c, info)
	require.NotNil(t, ratios)

	reader, err := adaptor.BuildRequestBody(c, info)
	require.NoError(t, err)
	raw, err := io.ReadAll(reader)
	require.NoError(t, err)
	var body videoGenerationRequest
	require.NoError(t, common.Unmarshal(raw, &body))

	assert.Equal(t, testModel, body.Model)
	assert.Equal(t, ratios["seconds"], float64(body.Duration))
	billedRatio, ok := ResolutionRatio(body.Resolution)
	require.True(t, ok)
	assert.Equal(t, ratios["resolution"], billedRatio)
	assert.Equal(t, "https://example.com/a.png", body.ImageURL)
	assert.Empty(t, body.ImageURLs)
}
