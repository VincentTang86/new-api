package doubao

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 押金必须随视频规格走：固定基数下 4K 一秒就押不住，而 token 数是分辨率与帧数
// 的乘积。期望值按火山 Ark 公式（宽 × 高 × 帧数 ÷ 1024）手算，480p / 720p 两档
// 已用真实请求核对过上游 usage。
func TestEstimateVideoTokensScalesWithSpec(t *testing.T) {
	cases := []struct {
		name string
		req  relaycommon.TaskSubmitReq
		want int
	}{
		{
			// 实测 seedance-2.0-mini 480p/4s 上游报 40594 token（上游多出 1 帧，
			// 97 而非 96）；预估按整秒算，差 1% 在押金上无妨。
			name: "480p four seconds",
			req: relaycommon.TaskSubmitReq{
				Seconds:  "4",
				Metadata: map[string]interface{}{"resolution": "480p"},
			},
			want: 864 * 496 * 4 * VideoFPS / 1024,
		},
		{
			// 不传 resolution / 时长时上游出 720p、5 秒，实测 108900 token。
			name: "defaults to 720p five seconds",
			req:  relaycommon.TaskSubmitReq{},
			want: 1280 * 720 * defaultDurationSeconds * VideoFPS / 1024,
		},
		{
			name: "1080p costs far more than 480p at equal length",
			req: relaycommon.TaskSubmitReq{
				Seconds:  "4",
				Metadata: map[string]interface{}{"resolution": "1080p"},
			},
			want: 1920 * 1088 * 4 * VideoFPS / 1024,
		},
		{
			name: "resolution label is case-insensitive",
			req: relaycommon.TaskSubmitReq{
				Seconds:  "4",
				Metadata: map[string]interface{}{"resolution": " 4K "},
			},
			want: 3840 * 2176 * 4 * VideoFPS / 1024,
		},
		{
			// metadata.duration 是顶层 seconds 之外的第二条通道。
			name: "falls back to metadata duration",
			req: relaycommon.TaskSubmitReq{
				Metadata: map[string]interface{}{"resolution": "480p", "duration": float64(10)},
			},
			want: 864 * 496 * 10 * VideoFPS / 1024,
		},
		{
			// frames 与「时长 × 帧率」取大者，否则只填 frames 的请求会按默认 5 秒押。
			name: "frames wins when larger than duration",
			req: relaycommon.TaskSubmitReq{
				Seconds:  "2",
				Metadata: map[string]interface{}{"resolution": "720p", "frames": float64(600)},
			},
			want: 1280 * 720 * 600 / 1024,
		},
		{
			name: "unknown resolution keeps the flat baseline",
			req: relaycommon.TaskSubmitReq{
				Seconds:  "4",
				Metadata: map[string]interface{}{"resolution": "8k"},
			},
			want: 0,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, EstimateVideoTokens(&tc.req))
		})
	}
}

// 越界的时长 / 帧数不能变成无界的押金乘数，也不能在乘法里溢出成负数。
func TestEstimateVideoTokensClampsHostileInput(t *testing.T) {
	capped := 3840 * 2176 * MaxFrames / 1024

	huge := relaycommon.TaskSubmitReq{
		Metadata: map[string]interface{}{"resolution": "4k", "frames": float64(1 << 40)},
	}
	assert.Equal(t, capped, EstimateVideoTokens(&huge))

	// 18446744073686646784 这类「回绕的负数」以 float64 到达，同样要收进上限，
	// 既不能溢出成负押金，也不能被当成未设置而悄悄放行（见下面的校验用例）。
	wrapped := relaycommon.TaskSubmitReq{
		Seconds:  "4",
		Metadata: map[string]interface{}{"resolution": "4k", "frames": float64(18446744073686646784)},
	}
	assert.Equal(t, capped, EstimateVideoTokens(&wrapped))

	negative := relaycommon.TaskSubmitReq{
		Metadata: map[string]interface{}{"resolution": "480p", "duration": float64(-99)},
	}
	assert.Positive(t, EstimateVideoTokens(&negative))
}

// metadata 绕过了顶层 seconds 的校验，两条通道都必须在请求入口被拒。
func TestValidateVideoBoundsRejectsOversizedSpec(t *testing.T) {
	cases := []struct {
		name    string
		req     relaycommon.TaskSubmitReq
		wantErr bool
	}{
		{
			name: "normal request",
			req: relaycommon.TaskSubmitReq{
				Seconds:  "5",
				Metadata: map[string]interface{}{"resolution": "720p"},
			},
		},
		{
			// relaycommon.MaxTaskDurationSeconds 允许到 3600 秒，对视频过松。
			name:    "top-level seconds beyond the video cap",
			req:     relaycommon.TaskSubmitReq{Seconds: "600"},
			wantErr: true,
		},
		{
			name:    "metadata duration beyond the video cap",
			req:     relaycommon.TaskSubmitReq{Metadata: map[string]interface{}{"duration": float64(3600)}},
			wantErr: true,
		},
		{
			name:    "metadata frames beyond the frame cap",
			req:     relaycommon.TaskSubmitReq{Metadata: map[string]interface{}{"frames": float64(MaxFrames + 1)}},
			wantErr: true,
		},
		{
			name: "frames at the cap is allowed",
			req:  relaycommon.TaskSubmitReq{Metadata: map[string]interface{}{"frames": float64(MaxFrames)}},
		},
		{
			// 超出 int32 的巨数不能因为「装不下」就被当成未设置放行。
			name:    "frames beyond int32 is still rejected",
			req:     relaycommon.TaskSubmitReq{Metadata: map[string]interface{}{"frames": float64(18446744073686646784)}},
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateVideoBounds(&tc.req)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}
