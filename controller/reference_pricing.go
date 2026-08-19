package controller

import (
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// maxReferencePrice 对比价上限（USD / 1M tokens），仅用于挡住误输入的离谱数值。
const maxReferencePrice = 1e6

func GetReferencePricing(c *gin.Context) {
	rows, err := model.GetAllReferencePricing()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, rows)
}

type updateReferencePricingRequest struct {
	Rows []model.ReferencePricing `json:"rows"`
}

func UpdateReferencePricing(c *gin.Context) {
	req := updateReferencePricingRequest{}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "无效的参数")
		return
	}
	if len(req.Rows) == 0 {
		common.ApiErrorMsg(c, "价格列表不能为空")
		return
	}
	seen := make(map[string]bool, len(req.Rows))
	for i := range req.Rows {
		row := &req.Rows[i]
		row.ModelName = strings.TrimSpace(row.ModelName)
		if row.ModelName == "" || len(row.ModelName) > 128 {
			common.ApiErrorMsg(c, "模型名不能为空且长度不能超过 128")
			return
		}
		if row.Source != model.ReferencePricingSourceOfficial && row.Source != model.ReferencePricingSourceOpenRouter {
			common.ApiErrorMsg(c, fmt.Sprintf("无效的价格来源：%s", row.Source))
			return
		}
		// PostgreSQL 的 ON CONFLICT DO UPDATE 不允许同一批次内命中同一行两次，
		// 因此重复的 (model_name, source) 必须在这里拒绝。
		key := row.ModelName + "\x00" + row.Source
		if seen[key] {
			common.ApiErrorMsg(c, fmt.Sprintf("模型 %s 的 %s 价格重复提交", row.ModelName, row.Source))
			return
		}
		seen[key] = true
		for _, price := range []*float64{row.Input, row.Output, row.CachedInput, row.CacheCreation, row.CacheHit} {
			if price == nil {
				continue
			}
			if math.IsNaN(*price) || math.IsInf(*price, 0) || *price <= 0 || *price > maxReferencePrice {
				common.ApiErrorMsg(c, fmt.Sprintf("模型 %s 存在无效价格：价格必须大于 0 且不超过 %.0f", row.ModelName, float64(maxReferencePrice)))
				return
			}
		}
	}
	if err := model.UpsertReferencePricingRows(req.Rows); err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidatePricingCache()
	common.ApiSuccess(c, nil)
}

func DeleteReferencePricing(c *gin.Context) {
	modelName := strings.TrimSpace(c.Query("model_name"))
	if modelName == "" {
		common.ApiErrorMsg(c, "model_name 不能为空")
		return
	}
	if err := model.DeleteReferencePricingByModel(modelName); err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidatePricingCache()
	common.ApiSuccess(c, nil)
}
