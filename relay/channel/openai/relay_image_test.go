package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeOpenAIUsageMapsImageOutputTokenDetails(t *testing.T) {
	// Images API usage as returned by gpt-image models: output_tokens carries the
	// image/text split in output_tokens_details, which must reach
	// CompletionTokenDetails so img_o billing and the image_output_tokens log
	// detail see it.
	var usage dto.Usage
	require.NoError(t, common.UnmarshalJsonStr(`{
		"input_tokens": 12,
		"input_tokens_details": {"image_tokens": 0, "text_tokens": 12},
		"output_tokens": 2058,
		"output_tokens_details": {"image_tokens": 2058, "text_tokens": 0},
		"total_tokens": 2070
	}`, &usage))

	normalizeOpenAIUsage(&usage)

	assert.Equal(t, 12, usage.PromptTokens)
	assert.Equal(t, 2058, usage.CompletionTokens)
	assert.Equal(t, 2070, usage.TotalTokens)
	assert.Equal(t, 12, usage.PromptTokensDetails.TextTokens)
	assert.Equal(t, 0, usage.PromptTokensDetails.ImageTokens)
	assert.Equal(t, 2058, usage.CompletionTokenDetails.ImageTokens)
	assert.Equal(t, 0, usage.CompletionTokenDetails.TextTokens)
}

func TestNormalizeOpenAIUsageWithoutOutputTokenDetails(t *testing.T) {
	// dall-e style usage has no output_tokens_details; completion details must
	// stay zero so nothing is subtracted from c during tiered settlement.
	var usage dto.Usage
	require.NoError(t, common.UnmarshalJsonStr(`{
		"input_tokens": 20,
		"input_tokens_details": {"image_tokens": 0, "text_tokens": 20},
		"output_tokens": 300
	}`, &usage))

	normalizeOpenAIUsage(&usage)

	assert.Equal(t, 20, usage.PromptTokens)
	assert.Equal(t, 300, usage.CompletionTokens)
	assert.Equal(t, 320, usage.TotalTokens)
	assert.Equal(t, dto.OutputTokenDetails{}, usage.CompletionTokenDetails)
}
