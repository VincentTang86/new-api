package dto

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntValueUnmarshalAcceptsIntegerSpellings(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want IntValue
	}{
		{"plain integer", `5`, 5},
		{"float that is an integer in disguise", `5.0`, 5},
		{"float zero", `0.0`, 0},
		{"exponent form", `1e3`, 1000},
		{"quoted integer", `"5"`, 5},
		{"quoted float", `"5.0"`, 5},
		{"fraction rounds to nearest", `4.6`, 5},
		{"negative half rounds away from zero", `-2.5`, -3},
		{"null leaves zero", `null`, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var got IntValue
			require.NoError(t, json.Unmarshal([]byte(tt.raw), &got))
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestIntValueUnmarshalRejectsNonNumbers(t *testing.T) {
	for _, raw := range []string{`"abc"`, `true`, `{}`, `[]`, `1e400`, `"1e400"`} {
		t.Run(raw, func(t *testing.T) {
			var got IntValue
			assert.Error(t, json.Unmarshal([]byte(raw), &got))
		})
	}
}

func TestIntValueMarshalStaysInteger(t *testing.T) {
	out, err := json.Marshal(struct {
		Seconds IntValue `json:"seconds"`
	}{Seconds: 5})
	require.NoError(t, err)
	assert.JSONEq(t, `{"seconds":5}`, string(out))
}
