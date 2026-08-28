package dto

import (
	"testing"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Raw usage payloads captured from DashScope (Alibaba Bailian) qwen3.8-max on
// 2026-08-28: explicit cache is marked cache_type="ephemeral" and reports its
// write count as cache_creation_input_tokens, while implicit and explicit hits
// share cached_tokens.
func TestUsageUnmarshalDashScopeExplicitCacheFields(t *testing.T) {
	tests := []struct {
		name              string
		raw               string
		wantCached        int
		wantCacheType     string
		wantCreationTotal int
	}{
		{
			name: "explicit cache creation",
			raw: `{"prompt_tokens":3564,"completion_tokens":23,"total_tokens":3587,
				"prompt_tokens_details":{"cache_creation":{"ephemeral_5m_input_tokens":3550},
				"cache_creation_input_tokens":3550,"cache_type":"ephemeral","cached_tokens":0,"text_tokens":3564}}`,
			wantCached:        0,
			wantCacheType:     CacheTypeEphemeral,
			wantCreationTotal: 3550,
		},
		{
			name: "explicit cache hit",
			raw: `{"prompt_tokens":3564,"completion_tokens":34,"total_tokens":3598,
				"prompt_tokens_details":{"cache_creation":{"ephemeral_5m_input_tokens":0},
				"cache_creation_input_tokens":0,"cache_type":"ephemeral","cached_tokens":3550,"text_tokens":3564}}`,
			wantCached:        3550,
			wantCacheType:     CacheTypeEphemeral,
			wantCreationTotal: 0,
		},
		{
			name: "implicit cache hit",
			raw: `{"prompt_tokens":3564,"completion_tokens":42,"total_tokens":3606,
				"prompt_tokens_details":{"cached_tokens":3072,"text_tokens":3564}}`,
			wantCached:        3072,
			wantCacheType:     "",
			wantCreationTotal: 0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var usage Usage
			require.NoError(t, kitutil.Unmarshal([]byte(tt.raw), &usage))
			assert.Equal(t, tt.wantCached, usage.PromptTokensDetails.CachedTokens)
			assert.Equal(t, tt.wantCacheType, usage.PromptTokensDetails.CacheType)
			assert.Equal(t, tt.wantCreationTotal, usage.PromptTokensDetails.CacheCreationTokensTotal())
		})
	}
}

func TestCacheCreationTokensTotalLargestSourceWins(t *testing.T) {
	tests := []struct {
		name    string
		details InputTokenDetails
		want    int
	}{
		{"dashscope only", InputTokenDetails{CacheCreationInputTokens: 3550}, 3550},
		{"largest wins over claude-derived", InputTokenDetails{CachedCreationTokens: 100, CacheCreationInputTokens: 3550}, 3550},
		{"largest wins over openai native", InputTokenDetails{CacheWriteTokens: 4000, CacheCreationInputTokens: 3550}, 4000},
		{"negative clamped", InputTokenDetails{CacheCreationInputTokens: -5}, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, tt.details.CacheCreationTokensTotal())
		})
	}
}
