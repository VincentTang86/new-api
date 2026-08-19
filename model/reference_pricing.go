package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm/clause"
)

const (
	ReferencePricingSourceOfficial   = "official"
	ReferencePricingSourceOpenRouter = "openrouter"
)

// ReferencePricing 存储用于对比展示的外部标价（模型官方 API / OpenRouter），
// 单位为每百万 token 的美元价。仅用于定价页对比与看板节省估算，不参与计费。
type ReferencePricing struct {
	Id            int      `json:"id"`
	ModelName     string   `json:"model_name" gorm:"size:128;not null;uniqueIndex:idx_ref_pricing_model_source,priority:1"`
	Source        string   `json:"source" gorm:"size:32;not null;uniqueIndex:idx_ref_pricing_model_source,priority:2"`
	Input         *float64 `json:"input"`
	Output        *float64 `json:"output"`
	CachedInput   *float64 `json:"cached_input"`
	CacheCreation *float64 `json:"cache_creation"`
	CacheHit      *float64 `json:"cache_hit"`
	CreatedAt     int64    `json:"created_at"`
	UpdatedAt     int64    `json:"updated_at"`
}

func (ReferencePricing) TableName() string {
	return "reference_pricings"
}

func GetAllReferencePricing() ([]*ReferencePricing, error) {
	rows := make([]*ReferencePricing, 0)
	err := DB.Order("model_name, source").Find(&rows).Error
	return rows, err
}

// UpsertReferencePricingRows 按 (model_name, source) 批量插入或更新对比价。
func UpsertReferencePricingRows(rows []ReferencePricing) error {
	if len(rows) == 0 {
		return nil
	}
	now := common.GetTimestamp()
	for i := range rows {
		rows[i].Id = 0
		rows[i].CreatedAt = now
		rows[i].UpdatedAt = now
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "model_name"}, {Name: "source"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"input", "output", "cached_input", "cache_creation", "cache_hit", "updated_at",
		}),
	}).Create(&rows).Error
}

func DeleteReferencePricingByModel(modelName string) error {
	return DB.Where("model_name = ?", modelName).Delete(&ReferencePricing{}).Error
}

// seedReferencePricing 在表为空时一次性导入内置对比价
// （来源：原 web/public/official-pricing.json，2026-08-16 快照），非空则跳过。
func seedReferencePricing() error {
	var count int64
	if err := DB.Model(&ReferencePricing{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	seed := []struct {
		model         string
		officialIn    float64
		officialOut   float64
		openrouterIn  float64
		openrouterOut float64
	}{
		{"deepseek-v4-flash", 0.14, 0.27, 0.15, 0.3},
		{"deepseek-v4-flash-0731", 0.18, 0.36, 0.2, 0.41},
		{"glm-5.1", 0.22, 3.7, 0.26, 4.36},
		{"glm-5.2", 1.52, 4.78, 1.84, 5.77},
		{"glm-5.2-fast-preview", 3.31, 11.6, 4.2, 14.7},
		{"kimi-k2.7-code", 0.97, 4.06, 1.17, 4.9},
		{"qwen3.6-flash", 0.17, 0.99, 0.19, 1.1},
		{"qwen3.6-plus", 0.29, 1.76, 0.35, 2.08},
		{"qwen3.7-flash", 0.026, 0.1, 0.029, 0.12},
		{"qwen3.7-max", 1.89, 5.67, 2.39, 7.18},
		{"qwen3.7-plus", 1.76, 5.29, 2.08, 6.24},
		{"qwen3.8-max", 2.7, 8.1, 3.42, 10.3},
	}
	now := common.GetTimestamp()
	rows := make([]ReferencePricing, 0, len(seed)*2)
	for _, s := range seed {
		officialIn, officialOut := s.officialIn, s.officialOut
		openrouterIn, openrouterOut := s.openrouterIn, s.openrouterOut
		rows = append(rows,
			ReferencePricing{
				ModelName: s.model,
				Source:    ReferencePricingSourceOfficial,
				Input:     &officialIn,
				Output:    &officialOut,
				CreatedAt: now,
				UpdatedAt: now,
			},
			ReferencePricing{
				ModelName: s.model,
				Source:    ReferencePricingSourceOpenRouter,
				Input:     &openrouterIn,
				Output:    &openrouterOut,
				CreatedAt: now,
				UpdatedAt: now,
			},
		)
	}
	if err := DB.Create(&rows).Error; err != nil {
		return err
	}
	common.SysLog(fmt.Sprintf("reference pricing seeded with %d rows", len(rows)))
	return nil
}
