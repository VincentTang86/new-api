package relayconvert

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Opus 4.7/4.8 removed the sampling parameters: upstream answers temperature,
// top_p or top_k with a 400 whether or not thinking is enabled, and the model
// name carries no suffix on a plain request.
func TestClaudeSamplingParamsDroppedForOpus47And48(t *testing.T) {
	maxTokens := uint(1024)
	temperature := 0.7
	topP := 0.9
	topK := 40

	converters := []struct {
		name      string
		sendsTopK bool
		convert   func(t *testing.T, model string) (*dto.ClaudeRequest, error)
	}{
		{
			name:      "chat completions",
			sendsTopK: true,
			convert: func(t *testing.T, model string) (*dto.ClaudeRequest, error) {
				t.Helper()
				return OpenAIChatRequestToClaudeMessages(context.Background(), &convmeta.Values{}, dto.GeneralOpenAIRequest{
					Model:       model,
					MaxTokens:   &maxTokens,
					Temperature: &temperature,
					TopP:        &topP,
					TopK:        &topK,
					Messages: []dto.Message{
						{Role: "user", Content: "hello"},
					},
				})
			},
		},
		{
			name: "responses",
			convert: func(t *testing.T, model string) (*dto.ClaudeRequest, error) {
				t.Helper()
				return OpenAIResponsesRequestToClaudeMessages(context.Background(), &convmeta.Values{}, &dto.OpenAIResponsesRequest{
					Model:           model,
					Input:           []byte(`"hello"`),
					MaxOutputTokens: &maxTokens,
					Temperature:     &temperature,
					TopP:            &topP,
				})
			},
		},
	}

	models := []struct {
		model   string
		dropped bool
	}{
		{model: "claude-opus-4-8", dropped: true},
		{model: "claude-opus-4-7", dropped: true},
		{model: "claude-opus-4-6", dropped: false},
		{model: "claude-sonnet-4-5", dropped: false},
	}

	for _, converter := range converters {
		t.Run(converter.name, func(t *testing.T) {
			for _, m := range models {
				t.Run(m.model, func(t *testing.T) {
					got, err := converter.convert(t, m.model)
					require.NoError(t, err)
					require.NotNil(t, got)

					if m.dropped {
						assert.Nil(t, got.Temperature)
						assert.Nil(t, got.TopP)
						assert.Nil(t, got.TopK)
						return
					}

					require.NotNil(t, got.Temperature)
					assert.Equal(t, temperature, *got.Temperature)
					require.NotNil(t, got.TopP)
					assert.Equal(t, topP, *got.TopP)
					if converter.sendsTopK {
						require.NotNil(t, got.TopK)
						assert.Equal(t, topK, *got.TopK)
					}
				})
			}
		})
	}
}
