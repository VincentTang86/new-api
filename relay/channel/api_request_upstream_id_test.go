package channel

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	common2 "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestDoRequestUpstreamRequestIdCapture covers the per-attempt capture of the
// upstream request id in doRequest: verified provider headers win over the
// cascade fallback, unlisted channel types keep the cascade behavior, and a
// second attempt on the same gin context (the retry loop reuses it) must
// replace or clear the previous attempt's id instead of keeping it.
func TestDoRequestUpstreamRequestIdCapture(t *testing.T) {
	service.InitHttpClient()
	gin.SetMode(gin.TestMode)

	var headers atomic.Value // stores map[string]string for the next response
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		for k, v := range headers.Load().(map[string]string) {
			w.Header().Set(k, v)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "{}")
	}))
	defer upstream.Close()

	callDoRequest := func(t *testing.T, ctx *gin.Context, channelType int, respHeaders map[string]string) {
		t.Helper()
		headers.Store(respHeaders)
		req, err := http.NewRequest(http.MethodPost, upstream.URL, bytes.NewReader([]byte("{}")))
		require.NoError(t, err)
		info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelType: channelType}}
		resp, err := doRequest(ctx, req, info)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
	}

	newContext := func() *gin.Context {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Request = httptest.NewRequest(http.MethodPost, "/relay", nil)
		return ctx
	}

	t.Run("ali provider header wins over cascade fallback", func(t *testing.T) {
		ctx := newContext()
		callDoRequest(t, ctx, constant.ChannelTypeAli, map[string]string{
			"X-Request-Id":       "ali-uuid",
			common2.RequestIdKey: "cascade-id",
		})
		assert.Equal(t, "ali-uuid", ctx.GetString(common2.UpstreamRequestIdKey))
	})

	t.Run("unlisted channel type keeps cascade capture", func(t *testing.T) {
		ctx := newContext()
		callDoRequest(t, ctx, constant.ChannelTypeOpenAI, map[string]string{
			"X-Request-Id":       "proxy-trace-id",
			common2.RequestIdKey: "cascade-id",
		})
		assert.Equal(t, "cascade-id", ctx.GetString(common2.UpstreamRequestIdKey),
			"an unverified X-Request-Id must not be trusted for unlisted channel types")
	})

	t.Run("retry attempt replaces the previous id", func(t *testing.T) {
		ctx := newContext()
		callDoRequest(t, ctx, constant.ChannelTypeAli, map[string]string{"X-Request-Id": "attempt-a"})
		require.Equal(t, "attempt-a", ctx.GetString(common2.UpstreamRequestIdKey))
		callDoRequest(t, ctx, constant.ChannelTypeAli, map[string]string{"X-Request-Id": "attempt-b"})
		assert.Equal(t, "attempt-b", ctx.GetString(common2.UpstreamRequestIdKey))
	})

	t.Run("retry attempt without id clears the previous one", func(t *testing.T) {
		ctx := newContext()
		callDoRequest(t, ctx, constant.ChannelTypeAli, map[string]string{"X-Request-Id": "attempt-a"})
		require.Equal(t, "attempt-a", ctx.GetString(common2.UpstreamRequestIdKey))
		callDoRequest(t, ctx, constant.ChannelTypeOpenAI, map[string]string{})
		assert.Equal(t, "", ctx.GetString(common2.UpstreamRequestIdKey),
			"a failed channel's id must not leak into the logs of the attempt that succeeded")
	})
}
