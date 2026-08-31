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
