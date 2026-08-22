package common

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newUpstreamIdTestContext(t *testing.T, localRequestId string) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	if localRequestId != "" {
		c.Set(RequestIdKey, localRequestId)
	}
	return c
}

func TestSetUpstreamRequestId(t *testing.T) {
	const localId = "20260821local1234567890"

	tests := []struct {
		name     string
		existing string
		input    string
		want     string
	}{
		{name: "valid id is recorded", input: "90ccc89e-94df-9471-bc60-67282c4f35fa", want: "90ccc89e-94df-9471-bc60-67282c4f35fa"},
		{name: "surrounding spaces are trimmed", input: "  abc-123  ", want: "abc-123"},
		{name: "empty id is dropped", input: "", want: ""},
		{name: "blank id is dropped", input: "   ", want: ""},
		{name: "existing value is not overwritten", existing: "header-id", input: "body-id", want: "header-id"},
		{name: "locally synthesized chatcmpl id is rejected", input: "chatcmpl-" + localId, want: ""},
		{name: "locally synthesized realtime id is rejected", input: "evt_" + localId, want: ""},
		{name: "id longer than column limit is truncated", input: strings.Repeat("a", 200), want: strings.Repeat("a", 128)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newUpstreamIdTestContext(t, localId)
			if tt.existing != "" {
				c.Set(UpstreamRequestIdKey, tt.existing)
			}
			SetUpstreamRequestId(c, tt.input)
			assert.Equal(t, tt.want, c.GetString(UpstreamRequestIdKey))
		})
	}
}

func TestResetUpstreamRequestId(t *testing.T) {
	const localId = "20260821local1234567890"

	t.Run("replaces the previous attempt's id", func(t *testing.T) {
		c := newUpstreamIdTestContext(t, localId)
		c.Set(UpstreamRequestIdKey, "failed-channel-id")
		ResetUpstreamRequestId(c, "succeeded-channel-id")
		assert.Equal(t, "succeeded-channel-id", c.GetString(UpstreamRequestIdKey))
	})

	t.Run("clears when the new attempt found none", func(t *testing.T) {
		c := newUpstreamIdTestContext(t, localId)
		c.Set(UpstreamRequestIdKey, "failed-channel-id")
		ResetUpstreamRequestId(c, "")
		assert.Equal(t, "", c.GetString(UpstreamRequestIdKey))
	})

	t.Run("clears when the new value is locally synthesized", func(t *testing.T) {
		c := newUpstreamIdTestContext(t, localId)
		c.Set(UpstreamRequestIdKey, "failed-channel-id")
		ResetUpstreamRequestId(c, "chatcmpl-"+localId)
		assert.Equal(t, "", c.GetString(UpstreamRequestIdKey))
	})
}

func TestUpstreamRequestIdHeaderCandidates(t *testing.T) {
	aliCandidates := UpstreamRequestIdHeaderCandidates(constant.ChannelTypeAli)
	require.Equal(t, []string{"X-Request-Id", RequestIdKey}, aliCandidates,
		"verified provider headers must come before the cascade fallback")

	unknownCandidates := UpstreamRequestIdHeaderCandidates(0)
	require.Equal(t, []string{RequestIdKey}, unknownCandidates,
		"unlisted channel types must keep the cascade fallback only")
}

func TestMatchUpstreamRequestIdHeader(t *testing.T) {
	assert.True(t, MatchUpstreamRequestIdHeader(constant.ChannelTypeAli, "x-request-id"), "matching is case-insensitive")
	assert.False(t, MatchUpstreamRequestIdHeader(constant.ChannelTypeAli, RequestIdKey), "the cascade fallback is handled separately by callers")
	assert.False(t, MatchUpstreamRequestIdHeader(0, "X-Request-Id"), "unlisted channel types trust no provider header")
}
