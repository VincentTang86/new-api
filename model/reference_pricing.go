package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm/clause"
)

const (
	ReferencePricingSourceOfficial   = "official"
	ReferencePricingSourceOpenRouter = "openrouter"
	// ReferencePricingSourceGateway 存网关自己的按张标价（分组倍率 1 的基准价），
	// 只有 per_image 有意义。放在同一张表里是为了让对比价后台一处录入图片模型的每张价。
	ReferencePricingSourceGateway = "gateway"
)

// ImageSizePrice 图片模型的按张标价：一档分辨率/规格（如 "1K"）对应一个每张美元价。
type ImageSizePrice struct {
	Size  string  `json:"size"`
	Price float64 `json:"price"`
}

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
	// GORM 的默认命名会把 CacheCreation1h 拼成 cache_creation1h，显式指定列名。
	CacheCreation1h *float64 `json:"cache_creation_1h" gorm:"column:cache_creation_1h"`
	CacheHit        *float64 `json:"cache_hit"`
	// ImageInput / ImageOutput 图片输入、图片输出的每百万 token 标价，图片模型才有。
	ImageInput  *float64 `json:"image_input"`
	ImageOutput *float64 `json:"image_output"`
	// PerImage 按张标价，JSON 文本（如 [{"size":"1K","price":0.067}]），顺序即展示顺序。
	PerImage string `json:"-" gorm:"type:text"`
	// PerImageSizes 是 PerImage 的 API 出入参形态，不落库。
	PerImageSizes []ImageSizePrice `json:"per_image,omitempty" gorm:"-"`
	// PerImageInput 每张输入图的标价（USD / 张），图生图模型才有（如 xAI 的 media input）；
	// 与 ImageInput（按 token）并存，两者分别对应按张、按 token 两种计价口径。
	PerImageInput *float64 `json:"per_image_input" gorm:"column:per_image_input"`
	// Conditions 按计价条件的专属价，JSON 文本（如 {"peak":{"input":0.2}}）。
	// 键由前端按模型计费表达式派生（rate-conditions 模块），后端只存取；
	// 上面的扁平价位是默认价，供首页对比与看板节省估算消费。
	Conditions string `json:"-" gorm:"type:text"`
	// ConditionLanes 是 Conditions 的 API 出入参形态，不落库。
	ConditionLanes map[string]ReferenceLanes `json:"conditions,omitempty" gorm:"-"`
	CreatedAt      int64                     `json:"created_at"`
	UpdatedAt      int64                     `json:"updated_at"`
}

// NormalizeConditions 在写库前把 ConditionLanes / PerImageSizes 序列化进对应的文本列；
// 空值归一为空串，使"清空"与"从未配置"落库形态一致。
func (rp *ReferencePricing) NormalizeConditions() error {
	rp.Conditions = ""
	if len(rp.ConditionLanes) > 0 {
		data, err := common.Marshal(rp.ConditionLanes)
		if err != nil {
			return err
		}
		rp.Conditions = string(data)
	}
	rp.PerImage = ""
	if len(rp.PerImageSizes) > 0 {
		data, err := common.Marshal(rp.PerImageSizes)
		if err != nil {
			return err
		}
		rp.PerImage = string(data)
	}
	return nil
}

func (ReferencePricing) TableName() string {
	return "reference_pricings"
}

func GetAllReferencePricing() ([]*ReferencePricing, error) {
	rows := make([]*ReferencePricing, 0)
	err := DB.Order("model_name, source").Find(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		// 单行脏数据不应拖垮整个定价页，跳过并留痕
		if row.Conditions != "" {
			if err := common.UnmarshalJsonStr(row.Conditions, &row.ConditionLanes); err != nil {
				common.SysError(fmt.Sprintf("invalid reference pricing conditions for %s/%s: %s", row.ModelName, row.Source, err.Error()))
				row.ConditionLanes = nil
			}
		}
		if row.PerImage != "" {
			if err := common.UnmarshalJsonStr(row.PerImage, &row.PerImageSizes); err != nil {
				common.SysError(fmt.Sprintf("invalid reference pricing per_image for %s/%s: %s", row.ModelName, row.Source, err.Error()))
				row.PerImageSizes = nil
			}
		}
	}
	return rows, nil
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
		if err := rows[i].NormalizeConditions(); err != nil {
			return err
		}
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "model_name"}, {Name: "source"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"input", "output", "cached_input", "cache_creation", "cache_creation_1h", "cache_hit",
			"image_input", "image_output", "per_image", "per_image_input", "conditions", "updated_at",
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
