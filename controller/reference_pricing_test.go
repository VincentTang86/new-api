package controller

import (
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
	}
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
