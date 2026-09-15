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

// 条件价的键与数量上限，防止把垃圾塞进 conditions 文本列。
const (
	maxReferenceConditions      = 64
	maxReferenceConditionKeyLen = 64
)

// 按单位标价的档位数量与档位名长度上限，按张（per_image）、按秒（per_second）、
// 每 token（per_token）与视频网格的分辨率列共用。
const (
	maxReferenceTierCount       = 16
	maxReferenceTierLabelLength = 32
)

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
		if row.Source != model.ReferencePricingSourceOfficial &&
			row.Source != model.ReferencePricingSourceOpenRouter &&
			row.Source != model.ReferencePricingSourceGateway {
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
		lanesToCheck := [][]*float64{{row.Input, row.Output, row.CachedInput, row.CacheCreation, row.CacheCreation1h, row.CacheHit, row.ImageInput, row.ImageOutput, row.PerImageInput}}
		if len(row.ConditionLanes) > maxReferenceConditions {
			common.ApiErrorMsg(c, fmt.Sprintf("模型 %s 的计价条件数量不能超过 %d", row.ModelName, maxReferenceConditions))
			return
		}
		for conditionKey, lanes := range row.ConditionLanes {
			if conditionKey == "" || len(conditionKey) > maxReferenceConditionKeyLen {
				common.ApiErrorMsg(c, fmt.Sprintf("模型 %s 存在无效的计价条件键：不能为空且长度不能超过 %d", row.ModelName, maxReferenceConditionKeyLen))
				return
			}
			lanesToCheck = append(lanesToCheck, []*float64{lanes.Input, lanes.Output, lanes.CachedInput, lanes.CacheCreation, lanes.CacheCreation1h, lanes.CacheHit, lanes.ImageInput, lanes.ImageOutput})
		}
		for _, tiers := range []struct {
			label   string
			entries []model.ImageSizePrice
		}{
			{"按张价", row.PerImageSizes},
			{"按秒价", row.PerSecondTiers},
			{"每 token 价", row.PerTokenTiers},
		} {
			// 档位上限按去重后的档位名计：视频网格里一列可以有多个条件行，
			// 条件行数本身已被 IsVideoCondition 限死，不再单独设限。
			seenSizes := make(map[string]bool, len(tiers.entries))
			seenCells := make(map[string]bool, len(tiers.entries))
			for i := range tiers.entries {
				entry := &tiers.entries[i]
				entry.Size = strings.TrimSpace(entry.Size)
				if !model.IsVideoCondition(entry.Condition) {
					common.ApiErrorMsg(c, fmt.Sprintf("模型 %s 存在无效的%s计价条件：%s", row.ModelName, tiers.label, entry.Condition))
					return
				}
				// (档位, 条件) 才是一个格子的坐标：同一档位在不同条件下各有一个价
				cell := entry.Size + "\x00" + entry.Condition
				if entry.Size == "" || len(entry.Size) > maxReferenceTierLabelLength || seenCells[cell] {
					common.ApiErrorMsg(c, fmt.Sprintf("模型 %s 存在无效的%s档位：档位名不能为空、不能重复且长度不能超过 %d", row.ModelName, tiers.label, maxReferenceTierLabelLength))
					return
				}
				seenCells[cell] = true
				seenSizes[entry.Size] = true
				if len(seenSizes) > maxReferenceTierCount {
					common.ApiErrorMsg(c, fmt.Sprintf("模型 %s 的%s档位数量不能超过 %d", row.ModelName, tiers.label, maxReferenceTierCount))
					return
				}
				price := entry.Price
				lanesToCheck = append(lanesToCheck, []*float64{&price})
			}
		}
		if grid := row.VideoGridDef; grid != nil {
			if row.Source != model.ReferencePricingSourceGateway {
				common.ApiErrorMsg(c, fmt.Sprintf("模型 %s 的视频网格定义只能提交在 gateway 行", row.ModelName))
				return
			}
			if len(grid.Resolutions) > maxReferenceTierCount {
				common.ApiErrorMsg(c, fmt.Sprintf("模型 %s 的分辨率列数不能超过 %d", row.ModelName, maxReferenceTierCount))
				return
			}
			seenResolutions := make(map[string]bool, len(grid.Resolutions))
			for i := range grid.Resolutions {
				grid.Resolutions[i] = strings.TrimSpace(grid.Resolutions[i])
				label := grid.Resolutions[i]
				if label == "" || len(label) > maxReferenceTierLabelLength || seenResolutions[label] {
					common.ApiErrorMsg(c, fmt.Sprintf("模型 %s 存在无效的分辨率列：列名不能为空、不能重复且长度不能超过 %d", row.ModelName, maxReferenceTierLabelLength))
					return
				}
				seenResolutions[label] = true
			}
			seenConditions := make(map[string]bool, len(grid.Conditions))
			for _, condition := range grid.Conditions {
				if condition == "" || !model.IsVideoCondition(condition) || seenConditions[condition] {
					common.ApiErrorMsg(c, fmt.Sprintf("模型 %s 存在无效的视频计价条件：%s", row.ModelName, condition))
					return
				}
				seenConditions[condition] = true
			}
		}
		for _, lanes := range lanesToCheck {
			for _, price := range lanes {
				if price == nil {
					continue
				}
				if math.IsNaN(*price) || math.IsInf(*price, 0) || *price <= 0 || *price > maxReferencePrice {
					common.ApiErrorMsg(c, fmt.Sprintf("模型 %s 存在无效价格：价格必须大于 0 且不超过 %.0f", row.ModelName, float64(maxReferencePrice)))
					return
				}
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
