package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 只覆盖校验失败路径：这些分支在触达数据库之前返回，
// 成功路径的持久化行为由 model 层测试保障。
func TestUpdateReferencePricingRejectsInvalidRows(t *testing.T) {
	cases := []struct {
		name string
		body string
	}{
		{"empty rows", `{"rows":[]}`},
		{"blank model name", `{"rows":[{"model_name":"  ","source":"official","input":1}]}`},
		{"unknown source", `{"rows":[{"model_name":"m","source":"azure","input":1}]}`},
		{"zero price", `{"rows":[{"model_name":"m","source":"official","input":0}]}`},
		{"negative price", `{"rows":[{"model_name":"m","source":"official","output":-1}]}`},
		{"oversized price", `{"rows":[{"model_name":"m","source":"official","cache_hit":1000001}]}`},
		{"duplicate model and source", `{"rows":[{"model_name":"m","source":"official","input":1},{"model_name":"m","source":"official","input":2}]}`},
		{"zero condition price", `{"rows":[{"model_name":"m","source":"official","conditions":{"peak":{"input":0}}}]}`},
		{"oversized condition price", `{"rows":[{"model_name":"m","source":"official","conditions":{"peak":{"output":1000001}}}]}`},
		{"blank condition key", `{"rows":[{"model_name":"m","source":"official","conditions":{"":{"input":1}}}]}`},
		{"oversized condition key", `{"rows":[{"model_name":"m","source":"official","conditions":{"` + strings.Repeat("k", 65) + `":{"input":1}}}]}`},
		{"zero image lane price", `{"rows":[{"model_name":"m","source":"official","image_output":0}]}`},
		{"zero per_image_input price", `{"rows":[{"model_name":"m","source":"official","per_image_input":0}]}`},
		{"blank per_image size", `{"rows":[{"model_name":"m","source":"gateway","per_image":[{"size":" ","price":0.1}]}]}`},
		{"zero per_image price", `{"rows":[{"model_name":"m","source":"gateway","per_image":[{"size":"1K","price":0}]}]}`},
		{"duplicate per_image size", `{"rows":[{"model_name":"m","source":"gateway","per_image":[{"size":"1K","price":0.1},{"size":"1K","price":0.2}]}]}`},
		{"oversized per_image size", `{"rows":[{"model_name":"m","source":"gateway","per_image":[{"size":"` + strings.Repeat("s", 33) + `","price":0.1}]}]}`},
		{"blank per_second tier", `{"rows":[{"model_name":"m","source":"gateway","per_second":[{"size":" ","price":0.1}]}]}`},
		{"zero per_second price", `{"rows":[{"model_name":"m","source":"gateway","per_second":[{"size":"720p","price":0}]}]}`},
		{"negative per_second price", `{"rows":[{"model_name":"m","source":"official","per_second":[{"size":"720p","price":-0.1}]}]}`},
		{"duplicate per_second tier", `{"rows":[{"model_name":"m","source":"gateway","per_second":[{"size":"720p","price":0.1},{"size":"720p","price":0.2}]}]}`},
		{"oversized per_second tier", `{"rows":[{"model_name":"m","source":"gateway","per_second":[{"size":"` + strings.Repeat("s", 33) + `","price":0.1}]}]}`},
		{"unknown per_second condition", `{"rows":[{"model_name":"m","source":"gateway","per_second":[{"size":"720p","condition":"peak","price":0.1}]}]}`},
		{"duplicate per_second cell", `{"rows":[{"model_name":"m","source":"gateway","per_second":[{"size":"720p","condition":"with_video","price":0.1},{"size":"720p","condition":"with_video","price":0.2}]}]}`},
		{"zero per_token price", `{"rows":[{"model_name":"m","source":"gateway","per_token":[{"size":"720p","price":0}]}]}`},
		{"unknown per_token condition", `{"rows":[{"model_name":"m","source":"official","per_token":[{"size":"720p","condition":"video:1080p","price":0.1}]}]}`},
		{"video_grid on a non-gateway row", `{"rows":[{"model_name":"m","source":"official","video_grid":{"conditions":[],"resolutions":["720p"]}}]}`},
		{"blank video_grid resolution", `{"rows":[{"model_name":"m","source":"gateway","video_grid":{"conditions":[],"resolutions":[" "]}}]}`},
		{"duplicate video_grid resolution", `{"rows":[{"model_name":"m","source":"gateway","video_grid":{"conditions":[],"resolutions":["720p","720p"]}}]}`},
		{"oversized video_grid resolution", `{"rows":[{"model_name":"m","source":"gateway","video_grid":{"conditions":[],"resolutions":["` + strings.Repeat("r", 33) + `"]}}]}`},
		{"unknown video_grid condition", `{"rows":[{"model_name":"m","source":"gateway","video_grid":{"conditions":["none"],"resolutions":["720p"]}}]}`},
		{"blank video_grid condition", `{"rows":[{"model_name":"m","source":"gateway","video_grid":{"conditions":[""],"resolutions":["720p"]}}]}`},
		{"duplicate video_grid condition", `{"rows":[{"model_name":"m","source":"gateway","video_grid":{"conditions":["with_video","with_video"],"resolutions":["720p"]}}]}`},
	}
	// 条件数量上限是独立的拒绝分支，用例体积大，程序化构造
	manyConditions := make([]string, 0, 65)
	for i := 0; i < 65; i++ {
		manyConditions = append(manyConditions, fmt.Sprintf(`"c%d":{"input":1}`, i))
	}
	cases = append(cases, struct {
		name string
		body string
	}{"too many conditions", `{"rows":[{"model_name":"m","source":"official","conditions":{` + strings.Join(manyConditions, ",") + `}}]}`})
	manySizes := make([]string, 0, 17)
	for i := 0; i < 17; i++ {
		manySizes = append(manySizes, fmt.Sprintf(`{"size":"s%d","price":0.1}`, i))
	}
	cases = append(cases, struct {
		name string
		body string
	}{"too many per_image sizes", `{"rows":[{"model_name":"m","source":"gateway","per_image":[` + strings.Join(manySizes, ",") + `]}]}`})
	cases = append(cases, struct {
		name string
		body string
	}{"too many per_second tiers", `{"rows":[{"model_name":"m","source":"gateway","per_second":[` + strings.Join(manySizes, ",") + `]}]}`})
	cases = append(cases, struct {
		name string
		body string
	}{"too many per_token tiers", `{"rows":[{"model_name":"m","source":"gateway","per_token":[` + strings.Join(manySizes, ",") + `]}]}`})
	manyResolutions := make([]string, 0, 17)
	for i := 0; i < 17; i++ {
		manyResolutions = append(manyResolutions, fmt.Sprintf(`"r%d"`, i))
	}
	cases = append(cases, struct {
		name string
		body string
	}{"too many video_grid resolutions", `{"rows":[{"model_name":"m","source":"gateway","video_grid":{"conditions":[],"resolutions":[` + strings.Join(manyResolutions, ",") + `]}}]}`})

	gin.SetMode(gin.TestMode)
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPut, "/api/reference_pricing/", strings.NewReader(tc.body))

			UpdateReferencePricing(c)

			require.Equal(t, http.StatusOK, recorder.Code)
			resp := map[string]any{}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &resp))
			assert.Equal(t, false, resp["success"])
			assert.NotEmpty(t, resp["message"])
		})
	}
}
