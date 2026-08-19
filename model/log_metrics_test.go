package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGetUserLogMetrics protects the /api/log/self/metrics contract:
// consume/error logs are aggregated per user within the requested range,
// other log types and other users never leak into the numbers. Quota is
// summed over consume logs only — the dashboard cost card reads it, so a
// topup or an error log leaking in would overstate what the user spent.
func TestGetUserLogMetrics(t *testing.T) {
	require.NoError(t, DB.Exec("DELETE FROM logs").Error)

	logs := []Log{
		// user 1, in range: three consume logs
		{UserId: 1, Type: LogTypeConsume, CreatedAt: 1000, PromptTokens: 100, CompletionTokens: 50, UseTime: 2, Quota: 10},
		{UserId: 1, Type: LogTypeConsume, CreatedAt: 1100, PromptTokens: 200, CompletionTokens: 100, UseTime: 4, Quota: 20},
		{UserId: 1, Type: LogTypeConsume, CreatedAt: 1200, PromptTokens: 300, CompletionTokens: 150, UseTime: 6, Quota: 30},
		// user 1, in range: one error log (tokens/use_time/quota must not affect consume totals)
		{UserId: 1, Type: LogTypeError, CreatedAt: 1150, UseTime: 30, Quota: 999},
		// user 1, in range: topup log must be ignored entirely
		{UserId: 1, Type: LogTypeTopup, CreatedAt: 1150, Quota: 500},
		// user 1, out of range: must be excluded
		{UserId: 1, Type: LogTypeConsume, CreatedAt: 2000, PromptTokens: 999, CompletionTokens: 999, UseTime: 99, Quota: 888},
		{UserId: 1, Type: LogTypeError, CreatedAt: 2000},
		// user 2, in range: must be excluded by user scoping
		{UserId: 2, Type: LogTypeConsume, CreatedAt: 1100, PromptTokens: 777, CompletionTokens: 777, UseTime: 7, Quota: 777},
		{UserId: 2, Type: LogTypeError, CreatedAt: 1100},
	}
	for i := range logs {
		require.NoError(t, DB.Create(&logs[i]).Error)
	}

	metrics, err := GetUserLogMetrics(1, 1000, 1500)
	require.NoError(t, err)
	assert.Equal(t, int64(600), metrics.PromptTokens)
	assert.Equal(t, int64(300), metrics.CompletionTokens)
	assert.Equal(t, int64(60), metrics.Quota)
	assert.Equal(t, int64(3), metrics.ConsumeCount)
	assert.Equal(t, int64(1), metrics.ErrorCount)
	assert.InDelta(t, 4.0, metrics.AvgUseTime, 1e-9)

	// widening the range picks up the later logs
	metrics, err = GetUserLogMetrics(1, 1000, 3000)
	require.NoError(t, err)
	assert.Equal(t, int64(4), metrics.ConsumeCount)
	assert.Equal(t, int64(2), metrics.ErrorCount)
	assert.Equal(t, int64(948), metrics.Quota)

	// a user with no logs gets zero values, not an error
	metrics, err = GetUserLogMetrics(99, 1000, 1500)
	require.NoError(t, err)
	assert.Equal(t, UserLogMetrics{}, metrics)
}
