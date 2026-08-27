package hailuo

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newH3Context(t *testing.T, body string) (*gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: ModelH3,
		},
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
		OriginModelName: ModelH3,
	}
}

// 三个上游端点共用一个对外模型名，分流完全取决于请求内容——这是本次接入的核心
// 契约，走错端点会连带计费档位一起错。
func TestValidateRequestSetsActionByRequestShape(t *testing.T) {
	tests := []struct {
		name   string
		body   string
		action string
	}{
		{
			name:   "text to video",
			body:   `{"prompt":"a cat","duration":6}`,
			action: constant.TaskActionTextGenerate,
		},
		{
			name:   "first frame image to video",
			body:   `{"prompt":"a cat","duration":6,"image":"https://example.com/a.png"}`,
			action: constant.TaskActionGenerate,
		},
		{
			name:   "context ir requested through mode",
			body:   `{"prompt":"a cat","duration":6,"mode":"context_ir"}`,
			action: constant.TaskActionContextIR,
		},
		{
			name:   "regeneration detected from base_video role",
			body:   `{"prompt":"a cat","metadata":{"content":[{"type":"text","text":"a cat"},{"type":"video_url","video_url":{"url":"https://example.com/a.mp4"},"role":"base_video"}]}}`,
			action: constant.TaskActionRegenerate,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			c, info := newH3Context(t, tc.body)
			adaptor := &TaskAdaptor{}

			require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))
			assert.Equal(t, tc.action, info.Action)
		})
	}
}

func TestValidateRequestRejectsOutOfBoundValues(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{
			name: "duration below upstream minimum",
			body: `{"prompt":"a cat","duration":3}`,
		},
		{
			name: "duration above upstream maximum",
			body: `{"prompt":"a cat","duration":16}`,
		},
		{
			name: "duration smuggled through metadata",
			body: `{"prompt":"a cat","duration":6,"metadata":{"duration":600}}`,
			// metadata 优先级最高，因此它也必须受同一个上界约束
		},
		{
			name: "unsupported resolution label",
			body: `{"prompt":"a cat","duration":6,"size":"4k"}`,
		},
		{
			name: "more reference images than supported",
			body: `{"prompt":"a cat","duration":6,"images":["a","b","c","d","e","f","g","h","i","j"]}`,
		},
		{
			name: "frame and reference inputs mixed",
			body: `{"prompt":"a cat","duration":6,"metadata":{"content":[{"type":"text","text":"a cat"},{"type":"image_url","image_url":{"url":"a"},"role":"first_frame"},{"type":"image_url","image_url":{"url":"b"},"role":"reference_image"}]}}`,
		},
		{
			name: "missing text item",
			body: `{"duration":6,"metadata":{"content":[{"type":"image_url","image_url":{"url":"a"},"role":"first_frame"}]}}`,
		},
		{
			name: "more reference videos than supported",
			body: `{"prompt":"a cat","duration":6,"metadata":{"content":[{"type":"text","text":"a cat"},{"type":"video_url","video_url":{"url":"a"},"role":"reference_video"},{"type":"video_url","video_url":{"url":"b"},"role":"reference_video"},{"type":"video_url","video_url":{"url":"c"},"role":"reference_video"},{"type":"video_url","video_url":{"url":"d"},"role":"reference_video"}]}}`,
		},
		{
			name: "regeneration needs exactly one base_video",
			body: `{"prompt":"a cat","metadata":{"content":[{"type":"text","text":"a cat"},{"type":"video_url","video_url":{"url":"a"},"role":"base_video"},{"type":"video_url","video_url":{"url":"b"},"role":"base_video"}]}}`,
		},
		{
			name: "media item without url",
			body: `{"prompt":"a cat","duration":6,"metadata":{"content":[{"type":"text","text":"a cat"},{"type":"image_url","role":"first_frame"}]}}`,
		},
		{
			name: "text to video cannot use adaptive ratio",
			body: `{"prompt":"a cat","duration":6,"metadata":{"ratio":"adaptive"}}`,
		},
		{
			name: "unsupported ratio",
			body: `{"prompt":"a cat","duration":6,"metadata":{"ratio":"5:1"}}`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			c, info := newH3Context(t, tc.body)
			adaptor := &TaskAdaptor{}

			taskErr := adaptor.ValidateRequestAndSetAction(c, info)

			require.NotNil(t, taskErr)
			assert.Equal(t, http.StatusBadRequest, taskErr.StatusCode)
		})
	}
}

// metadata 可以透传上游的其他参数，但计费相关字段必须由校验过的值覆盖，否则
// metadata 就成了绕过时长/分辨率校验的计费旁路。
func TestBuildRequestBodyKeepsBilledParametersAuthoritative(t *testing.T) {
	c, info := newH3Context(t, `{"prompt":"a cat","duration":8,"size":"2K","metadata":{"model":"another-model","resolution":"768P"}}`)
	adaptor := &TaskAdaptor{}
	require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))

	ratios := adaptor.EstimateBilling(c, info)
	require.NotNil(t, ratios)

	reader, err := adaptor.BuildRequestBody(c, info)
	require.NoError(t, err)
	raw := new(bytes.Buffer)
	_, err = raw.ReadFrom(reader)
	require.NoError(t, err)

	var sent GenerationV2Request
	require.NoError(t, common.Unmarshal(raw.Bytes(), &sent))

	assert.Equal(t, ModelH3, sent.Model)
	assert.Equal(t, 8, sent.Duration)
	// metadata.resolution 优先于 size，计费与下发必须一致地用它
	assert.Equal(t, Resolution768P, sent.Resolution)
	assert.Equal(t, float64(sent.Duration), ratios["seconds"])
	assert.Equal(t, officialH3TierRatios[TierOutput768P], ratios["resolution"])
}

func TestBuildH3ContentMapsStandardFieldsToRoles(t *testing.T) {
	tests := []struct {
		name      string
		images    []string
		wantRoles []string
	}{
		{name: "no image", images: nil, wantRoles: nil},
		{name: "single image is the first frame", images: []string{"a"}, wantRoles: []string{RoleFirstFrame}},
		{name: "two images are first and last frame", images: []string{"a", "b"}, wantRoles: []string{RoleFirstFrame, RoleLastFrame}},
		{name: "three or more images go to the reference entry", images: []string{"a", "b", "c"}, wantRoles: []string{RoleReferenceImage, RoleReferenceImage, RoleReferenceImage}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			items, err := buildH3Content(relaycommon.TaskSubmitReq{Prompt: "a cat", Images: tc.images})
			require.NoError(t, err)

			require.Equal(t, ContentTypeText, items[0].Type)
			var roles []string
			for _, item := range items[1:] {
				require.NotNil(t, item.ImageURL)
				roles = append(roles, item.Role)
			}
			assert.Equal(t, tc.wantRoles, roles)
			assert.Equal(t, len(tc.images), countInputImages(items))
		})
	}
}

// 未指定 role 的素材必须在下发前补全，否则计费统计和上游解读会各说各话。
func TestBuildH3ContentNormalizesOmittedRoles(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		Prompt: "a cat",
		Metadata: map[string]any{"content": []any{
			map[string]any{"type": "image_url", "image_url": map[string]any{"url": "a"}},
			map[string]any{"type": "video_url", "video_url": map[string]any{"url": "b"}},
			map[string]any{"type": "audio_url", "audio_url": map[string]any{"url": "c"}},
		}},
	}

	items, err := buildH3Content(req)
	require.NoError(t, err)

	require.Len(t, items, 4)
	assert.Equal(t, ContentTypeText, items[0].Type)
	assert.Equal(t, RoleFirstFrame, items[1].Role)
	assert.Equal(t, RoleReferenceVideo, items[2].Role)
	assert.Equal(t, RoleReferenceAudio, items[3].Role)
}

func TestResolveH3RatioFollowsUpstreamRules(t *testing.T) {
	tests := []struct {
		name string
		req  relaycommon.TaskSubmitReq
		want string
	}{
		{
			name: "text to video needs a concrete ratio",
			req:  relaycommon.TaskSubmitReq{Prompt: "a cat"},
			want: DefaultH3Ratio,
		},
		{
			name: "image to video is always adaptive",
			req:  relaycommon.TaskSubmitReq{Prompt: "a cat", Images: []string{"a"}, Metadata: map[string]any{"ratio": "16:9"}},
			want: RatioAdaptive,
		},
		{
			name: "reference to video honours an explicit ratio",
			req: relaycommon.TaskSubmitReq{Prompt: "a cat", Metadata: map[string]any{
				"ratio":   "9:16",
				"content": []any{map[string]any{"type": "video_url", "video_url": map[string]any{"url": "a"}, "role": "reference_video"}},
			}},
			want: "9:16",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			items, err := buildH3Content(tc.req)
			require.NoError(t, err)
			assert.Equal(t, tc.want, resolveH3Ratio(tc.req, items))
		})
	}
}

func TestNormalizeH3Resolution(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{in: "768P", want: Resolution768P},
		{in: "2k", want: Resolution2K},
		{in: "1344x768", want: Resolution768P},
		{in: "2560x1440", want: Resolution2K},
		{in: "1440*2560", want: Resolution2K},
		{in: "4k", want: ""},
		{in: "nonsense", want: ""},
	}

	for _, tc := range tests {
		t.Run(tc.in, func(t *testing.T) {
			assert.Equal(t, tc.want, normalizeH3Resolution(tc.in))
		})
	}
}

// v1 海螺模型与 H3 共用同一个适配器，分流必须严格按模型名，不能误伤。
func TestNonH3ModelsKeepUsingV1Endpoint(t *testing.T) {
	adaptor := &TaskAdaptor{baseURL: "https://example.com"}
	info := &relaycommon.RelayInfo{
		ChannelMeta:     &relaycommon.ChannelMeta{},
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
		OriginModelName: "MiniMax-Hailuo-2.3",
	}

	url, err := adaptor.BuildRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://example.com"+TextToVideoEndpoint, url)
}

func TestH3EndpointByAction(t *testing.T) {
	tests := []struct {
		action string
		want   string
	}{
		{action: constant.TaskActionTextGenerate, want: V2GenerationEndpoint},
		{action: constant.TaskActionGenerate, want: V2GenerationEndpoint},
		{action: constant.TaskActionRegenerate, want: V2RegenerationEndpoint},
		{action: constant.TaskActionContextIR, want: V2ContextIREndpoint},
	}

	for _, tc := range tests {
		t.Run(tc.action, func(t *testing.T) {
			adaptor := &TaskAdaptor{baseURL: "https://example.com"}
			info := &relaycommon.RelayInfo{
				ChannelMeta:     &relaycommon.ChannelMeta{},
				TaskRelayInfo:   &relaycommon.TaskRelayInfo{Action: tc.action},
				OriginModelName: ModelH3,
			}

			url, err := adaptor.BuildRequestURL(info)
			require.NoError(t, err)
			assert.Equal(t, "https://example.com"+tc.want, url)
		})
	}
}
