package common

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-gonic/gin"
)

// upstreamRequestIdMaxLen matches the logs.upstream_request_id column (varchar(128)).
const upstreamRequestIdMaxLen = 128

// upstreamRequestIdHeaders maps a channel type to the response headers that
// carry the provider's own request identifier, in priority order. Only list
// headers verified against the real provider: proxies such as istio-envoy
// inject a generic X-Request-Id that may be a proxy trace id rather than the
// id shown in the provider console, so entries must be confirmed per channel
// type before being added.
var upstreamRequestIdHeaders = map[int][]string{
	// Verified 2026-08-21 against Bailian compatible-mode: x-request-id is
	// present on non-stream, stream and error responses, and matches the UUID
	// echoed in the body id / error.id.
	constant.ChannelTypeAli: {"X-Request-Id"},
}

// UpstreamRequestIdHeaderCandidates returns the ordered response-header names
// that may carry the upstream request id for the given channel type. The
// cascaded new-api/one-api header is always the last candidate so the existing
// cascade behavior is preserved for every channel type.
func UpstreamRequestIdHeaderCandidates(channelType int) []string {
	return append(append([]string(nil), upstreamRequestIdHeaders[channelType]...), RequestIdKey)
}

// MatchUpstreamRequestIdHeader reports whether header is a verified provider
// request-id header for the channel type. The cascaded X-Oneapi-Request-Id
// fallback is not included; callers handle it separately because its
// passthrough behavior differs (it is stripped from the client response).
func MatchUpstreamRequestIdHeader(channelType int, header string) bool {
	for _, h := range upstreamRequestIdHeaders[channelType] {
		if strings.EqualFold(header, h) {
			return true
		}
	}
	return false
}

// sanitizeUpstreamRequestId normalizes a captured upstream id: trims spaces,
// drops locally synthesized ids (e.g. the "chatcmpl-<local request id>" built
// by helper.GetResponseID), and truncates to the column limit.
func sanitizeUpstreamRequestId(c *gin.Context, id string) string {
	id = strings.TrimSpace(id)
	if id == "" {
		return ""
	}
	if localId := c.GetString(RequestIdKey); localId != "" && strings.Contains(id, localId) {
		return ""
	}
	if len(id) > upstreamRequestIdMaxLen {
		id = id[:upstreamRequestIdMaxLen]
	}
	return id
}

// SetUpstreamRequestId records the upstream request id for the current
// upstream attempt unless one is already recorded, so a response-header id
// (captured first, in doRequest) wins over a response-body id within the same
// attempt.
func SetUpstreamRequestId(c *gin.Context, id string) {
	if c == nil {
		return
	}
	if c.GetString(UpstreamRequestIdKey) != "" {
		return
	}
	if id = sanitizeUpstreamRequestId(c, id); id != "" {
		c.Set(UpstreamRequestIdKey, id)
	}
}

// ResetUpstreamRequestId unconditionally replaces the recorded upstream
// request id, clearing it when the new attempt found none. The channel retry
// loop reuses one gin context across attempts, so the per-attempt capture
// point (doRequest) must reset instead of fill-if-empty, or a failed channel's
// id would leak into the consume log of the attempt that succeeded.
func ResetUpstreamRequestId(c *gin.Context, id string) {
	if c == nil {
		return
	}
	c.Set(UpstreamRequestIdKey, sanitizeUpstreamRequestId(c, id))
}
