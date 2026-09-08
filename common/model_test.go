package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
)

func TestIsImageGenerationModel(t *testing.T) {
	cases := []struct {
		model string
		want  bool
	}{
		{"gpt-image-1", true},
		{"gpt-image-1-mini", true},
		{"gpt-image-1.5", true},
		{"gpt-image-2", true},
		{"dall-e-3", true},
		{"imagen-4.0-generate-001", true},
		{"grok-imagine-image-2.0", true},
		{"grok-imagine-image-pro", true},
		// Gemini image models are served through generateContent / chat, not the
		// Images API, so they must not be routed to the image-generation endpoint.
		{"gemini-3.1-flash-image", false},
		{"gemini-3-pro-image", false},
		{"gpt-5.4", false},
	}
	for _, tc := range cases {
		assert.Equal(t, tc.want, IsImageGenerationModel(tc.model), tc.model)
	}
}

func TestGetEndpointTypesByChannelTypeListsImageGenerationFirst(t *testing.T) {
	got := GetEndpointTypesByChannelType(constant.ChannelTypeOpenAI, "gpt-image-2")
	assert.Equal(t, []constant.EndpointType{constant.EndpointTypeImageGeneration, constant.EndpointTypeOpenAI}, got)

	chatOnly := GetEndpointTypesByChannelType(constant.ChannelTypeOpenAI, "gpt-5.4")
	assert.Equal(t, []constant.EndpointType{constant.EndpointTypeOpenAI}, chatOnly)
}
