package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func refPrice(v float64) *float64 {
	return &v
}

func TestUpsertReferencePricingRowsInsertsAndUpdatesByModelAndSource(t *testing.T) {
	truncateTables(t)

	require.NoError(t, UpsertReferencePricingRows([]ReferencePricing{
		{ModelName: "m1", Source: ReferencePricingSourceOfficial, Input: refPrice(1.5), Output: refPrice(3)},
		{ModelName: "m1", Source: ReferencePricingSourceOpenRouter, Input: refPrice(2), Output: refPrice(4)},
	}))

	// 同 (model, source) 二次写入应更新而非新增；整行以提交值为准，未提交的价格列被清空
	require.NoError(t, UpsertReferencePricingRows([]ReferencePricing{
		{ModelName: "m1", Source: ReferencePricingSourceOfficial, Input: refPrice(1.8), CacheHit: refPrice(0.2), CacheCreation1h: refPrice(6)},
	}))

	rows, err := GetAllReferencePricing()
	require.NoError(t, err)
	require.Len(t, rows, 2)

	official := rows[0] // 按 model_name, source 排序：official 在前
	require.Equal(t, ReferencePricingSourceOfficial, official.Source)
	require.NotNil(t, official.Input)
	assert.Equal(t, 1.8, *official.Input)
	assert.Nil(t, official.Output)
	require.NotNil(t, official.CacheHit)
	assert.Equal(t, 0.2, *official.CacheHit)
	// 1h 缓存写入价的列名由显式 gorm tag 固定，写进去读得回来才说明冲突更新列表也对得上
	require.NotNil(t, official.CacheCreation1h)
	assert.Equal(t, 6.0, *official.CacheCreation1h)

	openrouter := rows[1]
	require.Equal(t, ReferencePricingSourceOpenRouter, openrouter.Source)
	require.NotNil(t, openrouter.Input)
	assert.Equal(t, 2.0, *openrouter.Input)
	require.NotNil(t, openrouter.Output)
	assert.Equal(t, 4.0, *openrouter.Output)
}

func TestUpsertReferencePricingRoundTripsConditionLanes(t *testing.T) {
	truncateTables(t)

	require.NoError(t, UpsertReferencePricingRows([]ReferencePricing{
		{
			ModelName: "m1",
			Source:    ReferencePricingSourceOfficial,
			Input:     refPrice(0.18),
			ConditionLanes: map[string]ReferenceLanes{
				"peak":    {Input: refPrice(0.2), Output: refPrice(0.4)},
				"offpeak": {Input: refPrice(0.1)},
			},
		},
	}))

	rows, err := GetAllReferencePricing()
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Len(t, rows[0].ConditionLanes, 2)
	peak := rows[0].ConditionLanes["peak"]
	require.NotNil(t, peak.Input)
	assert.Equal(t, 0.2, *peak.Input)
	require.NotNil(t, peak.Output)
	assert.Equal(t, 0.4, *peak.Output)
	assert.Nil(t, peak.CacheHit)

	// 整行覆盖语义与价位列一致：不带条件的二次提交应清空旧条件
	require.NoError(t, UpsertReferencePricingRows([]ReferencePricing{
		{ModelName: "m1", Source: ReferencePricingSourceOfficial, Input: refPrice(0.19)},
	}))
	rows, err = GetAllReferencePricing()
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Empty(t, rows[0].ConditionLanes)
}

func TestUpsertReferencePricingRoundTripsPerImageAndImageLanes(t *testing.T) {
	truncateTables(t)

	require.NoError(t, UpsertReferencePricingRows([]ReferencePricing{
		{
			ModelName:     "img-1",
			Source:        ReferencePricingSourceOfficial,
			Input:         refPrice(2),
			ImageOutput:   refPrice(120),
			PerImageInput: refPrice(0.01),
			PerImageSizes: []ImageSizePrice{
				{Size: "1K", Price: 0.134},
				{Size: "4K", Price: 0.24},
			},
		},
		{
			ModelName: "img-1",
			Source:    ReferencePricingSourceGateway,
			PerImageSizes: []ImageSizePrice{
				{Size: "1K", Price: 0.12},
			},
		},
	}))

	rows, err := GetAllReferencePricing()
	require.NoError(t, err)
	require.Len(t, rows, 2)

	gateway := rows[0] // 按 model_name, source 排序：gateway 在 official 前
	require.Equal(t, ReferencePricingSourceGateway, gateway.Source)
	assert.Nil(t, gateway.Input)
	assert.Nil(t, gateway.PerImageInput)
	assert.Equal(t, []ImageSizePrice{{Size: "1K", Price: 0.12}}, gateway.PerImageSizes)

	official := rows[1]
	require.Equal(t, ReferencePricingSourceOfficial, official.Source)
	require.NotNil(t, official.ImageOutput)
	assert.Equal(t, 120.0, *official.ImageOutput)
	assert.Nil(t, official.ImageInput)
	// 按张的输入图价与按 token 的 image_input 是两个独立字段
	require.NotNil(t, official.PerImageInput)
	assert.Equal(t, 0.01, *official.PerImageInput)
	// 档位顺序即展示顺序，读回必须保持提交顺序
	assert.Equal(t, []ImageSizePrice{{Size: "1K", Price: 0.134}, {Size: "4K", Price: 0.24}}, official.PerImageSizes)

	// 整行覆盖语义：不带 per_image 的二次提交应清空旧的按张价
	require.NoError(t, UpsertReferencePricingRows([]ReferencePricing{
		{ModelName: "img-1", Source: ReferencePricingSourceOfficial, Input: refPrice(2)},
	}))
	rows, err = GetAllReferencePricing()
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Empty(t, rows[1].PerImageSizes)
	assert.Nil(t, rows[1].ImageOutput)
	assert.Nil(t, rows[1].PerImageInput)
}

func TestUpsertReferencePricingRoundTripsPerSecondTiers(t *testing.T) {
	truncateTables(t)

	require.NoError(t, UpsertReferencePricingRows([]ReferencePricing{
		{
			ModelName: "vid-1",
			Source:    ReferencePricingSourceGateway,
			PerSecondTiers: []ImageSizePrice{
				{Size: "480p", Price: 0.028},
				{Size: "720p", Price: 0.062},
				{Size: "1080p", Price: 0.14},
			},
		},
		{
			ModelName: "vid-1",
			Source:    ReferencePricingSourceOfficial,
			Input:     refPrice(6.57),
			// 按秒与按张是两条独立的档位列表，同一行可以只有其中一条
			PerSecondTiers: []ImageSizePrice{{Size: "480p", Price: 0.05}},
		},
	}))

	rows, err := GetAllReferencePricing()
	require.NoError(t, err)
	require.Len(t, rows, 2)

	gateway := rows[0] // 按 model_name, source 排序：gateway 在 official 前
	require.Equal(t, ReferencePricingSourceGateway, gateway.Source)
	assert.Empty(t, gateway.PerImageSizes)
	// 档位顺序即展示顺序，读回必须保持提交顺序
	assert.Equal(t, []ImageSizePrice{
		{Size: "480p", Price: 0.028},
		{Size: "720p", Price: 0.062},
		{Size: "1080p", Price: 0.14},
	}, gateway.PerSecondTiers)

	official := rows[1]
	require.NotNil(t, official.Input)
	assert.Equal(t, 6.57, *official.Input)
	assert.Equal(t, []ImageSizePrice{{Size: "480p", Price: 0.05}}, official.PerSecondTiers)

	// 整行覆盖语义：不带 per_second 的二次提交应清空旧的按秒价
	require.NoError(t, UpsertReferencePricingRows([]ReferencePricing{
		{ModelName: "vid-1", Source: ReferencePricingSourceGateway, PerImageSizes: []ImageSizePrice{{Size: "1K", Price: 0.1}}},
	}))
	rows, err = GetAllReferencePricing()
	require.NoError(t, err)
	assert.Empty(t, rows[0].PerSecondTiers)
	assert.Equal(t, []ImageSizePrice{{Size: "1K", Price: 0.1}}, rows[0].PerImageSizes)
}

// 视频网格：格子按 (档位, 条件) 定位，每 token 价与网格定义随 gateway 行一起往返；
// 没带 condition 的老 per_second 数据读回后 Condition 为空串，仍能落到"不分条件"的行。
func TestUpsertReferencePricingRoundTripsVideoGridAndPerTokenTiers(t *testing.T) {
	truncateTables(t)

	require.NoError(t, UpsertReferencePricingRows([]ReferencePricing{
		{
			ModelName: "vid-3",
			Source:    ReferencePricingSourceGateway,
			VideoGridDef: &VideoGrid{
				Conditions:  []string{VideoConditionWithoutVideo, VideoConditionWithVideo},
				Resolutions: []string{"480p / 720p", "1080p", "4K"},
			},
			PerSecondTiers: []ImageSizePrice{
				{Size: "480p / 720p", Condition: VideoConditionWithoutVideo, Price: 0.04},
				{Size: "480p / 720p", Condition: VideoConditionWithVideo, Price: 0.08},
			},
			PerTokenTiers: []ImageSizePrice{
				{Size: "1080p", Condition: VideoConditionWithoutVideo, Price: 0.1},
			},
		},
		{
			ModelName:      "vid-3",
			Source:         ReferencePricingSourceOfficial,
			PerSecondTiers: []ImageSizePrice{{Size: "480p / 720p", Price: 0.05}},
			PerTokenTiers:  []ImageSizePrice{{Size: "4K", Condition: VideoConditionWithVideo, Price: 0.4}},
		},
	}))

	rows, err := GetAllReferencePricing()
	require.NoError(t, err)
	require.Len(t, rows, 2)

	gateway := rows[0]
	require.Equal(t, ReferencePricingSourceGateway, gateway.Source)
	require.NotNil(t, gateway.VideoGridDef)
	assert.Equal(t, []string{VideoConditionWithoutVideo, VideoConditionWithVideo}, gateway.VideoGridDef.Conditions)
	assert.Equal(t, []string{"480p / 720p", "1080p", "4K"}, gateway.VideoGridDef.Resolutions)
	assert.Equal(t, []ImageSizePrice{
		{Size: "480p / 720p", Condition: VideoConditionWithoutVideo, Price: 0.04},
		{Size: "480p / 720p", Condition: VideoConditionWithVideo, Price: 0.08},
	}, gateway.PerSecondTiers)
	assert.Equal(t, []ImageSizePrice{{Size: "1080p", Condition: VideoConditionWithoutVideo, Price: 0.1}}, gateway.PerTokenTiers)

	official := rows[1]
	assert.Nil(t, official.VideoGridDef)
	assert.Equal(t, []ImageSizePrice{{Size: "480p / 720p", Price: 0.05}}, official.PerSecondTiers)
	assert.Equal(t, []ImageSizePrice{{Size: "4K", Condition: VideoConditionWithVideo, Price: 0.4}}, official.PerTokenTiers)

	// 整行覆盖语义：不带 per_token / video_grid 的二次提交应把两者一并清空
	require.NoError(t, UpsertReferencePricingRows([]ReferencePricing{
		{ModelName: "vid-3", Source: ReferencePricingSourceGateway, PerSecondTiers: []ImageSizePrice{{Size: "720p", Price: 0.06}}},
	}))
	rows, err = GetAllReferencePricing()
	require.NoError(t, err)
	assert.Nil(t, rows[0].VideoGridDef)
	assert.Empty(t, rows[0].PerTokenTiers)
	assert.Equal(t, []ImageSizePrice{{Size: "720p", Price: 0.06}}, rows[0].PerSecondTiers)
}

// 单行脏数据不应拖垮整个定价页：per_second 解析失败时该字段降级为 nil，其余字段照常返回。
func TestGetAllReferencePricingDropsUnparsablePerSecond(t *testing.T) {
	truncateTables(t)

	require.NoError(t, UpsertReferencePricingRows([]ReferencePricing{
		{ModelName: "vid-2", Source: ReferencePricingSourceGateway, PerSecondTiers: []ImageSizePrice{{Size: "720p", Price: 0.06}}},
	}))
	require.NoError(t, DB.Model(&ReferencePricing{}).
		Where("model_name = ?", "vid-2").
		Update("per_second", "{not json").Error)

	rows, err := GetAllReferencePricing()
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Nil(t, rows[0].PerSecondTiers)
	assert.Equal(t, ReferencePricingSourceGateway, rows[0].Source)
}

// /api/pricing 的线格式契约：默认价保持扁平（首页/看板按此消费），
// 条件价整体挂在 by_condition 下（仅模型详情抽屉消费）。
func TestReferencePriceMarshalKeepsFlatLanesAndNestsConditions(t *testing.T) {
	data, err := common.Marshal(&ReferencePrice{
		ReferenceLanes: ReferenceLanes{Input: refPrice(0.18)},
		ByCondition: map[string]ReferenceLanes{
			"peak": {Input: refPrice(0.2)},
		},
	})
	require.NoError(t, err)

	parsed := map[string]any{}
	require.NoError(t, common.Unmarshal(data, &parsed))
	assert.Equal(t, 0.18, parsed["input"])
	byCondition, ok := parsed["by_condition"].(map[string]any)
	require.True(t, ok)
	peak, ok := byCondition["peak"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, 0.2, peak["input"])
}

// /api/pricing 的线格式契约：视频网格与网关的每秒 / 每 token 价随 gateway 行挂到模型上，
// 对比来源的 per_token 透出，键名与前端 PricingModel 类型一致（video_grid、
// video_token_prices、per_token、格子里的 condition）。
func TestGetPricingAttachesVideoGridAndPerTokenPrices(t *testing.T) {
	resetPricingEndpointTestTables(t)
	truncateTables(t)
	require.NoError(t, DB.Exec("DELETE FROM reference_pricings").Error)

	insertPricingEndpointChannel(t, 201, constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{})
	insertPricingEndpointAbility(t, 201, "vid-grid")
	withVideo1080p := ImageSizePrice{Size: "1080p", Condition: VideoConditionWithVideo, Price: 0.14}
	require.NoError(t, UpsertReferencePricingRows([]ReferencePricing{
		{
			ModelName: "vid-grid",
			Source:    ReferencePricingSourceGateway,
			VideoGridDef: &VideoGrid{
				Conditions:  []string{VideoConditionWithVideo},
				Resolutions: []string{"1080p"},
			},
			PerSecondTiers: []ImageSizePrice{withVideo1080p},
			PerTokenTiers:  []ImageSizePrice{{Size: "1080p", Condition: VideoConditionWithVideo, Price: 0.2}},
		},
		{
			ModelName:     "vid-grid",
			Source:        ReferencePricingSourceOfficial,
			PerTokenTiers: []ImageSizePrice{{Size: "1080p", Condition: VideoConditionWithVideo, Price: 0.16}},
		},
	}))
	InitChannelCache()
	InvalidatePricingCache()

	var found *Pricing
	for _, pricing := range GetPricing() {
		if pricing.ModelName == "vid-grid" {
			item := pricing
			found = &item
			break
		}
	}
	require.NotNil(t, found)
	require.NotNil(t, found.VideoGrid)
	assert.Equal(t, []string{VideoConditionWithVideo}, found.VideoGrid.Conditions)
	assert.Equal(t, []string{"1080p"}, found.VideoGrid.Resolutions)
	assert.Equal(t, []ImageSizePrice{withVideo1080p}, found.VideoPrices)
	assert.Equal(t, []ImageSizePrice{{Size: "1080p", Condition: VideoConditionWithVideo, Price: 0.2}}, found.VideoTokenPrices)
	require.NotNil(t, found.OfficialPrice)
	assert.Equal(t, []ImageSizePrice{{Size: "1080p", Condition: VideoConditionWithVideo, Price: 0.16}}, found.OfficialPrice.PerToken)
	// 网格定义只属于网关，不会串到对比来源上
	assert.Nil(t, found.OpenRouterPrice)

	data, err := common.Marshal(found)
	require.NoError(t, err)
	parsed := map[string]any{}
	require.NoError(t, common.Unmarshal(data, &parsed))
	grid, ok := parsed["video_grid"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, []any{"1080p"}, grid["resolutions"])
	assert.Contains(t, parsed, "video_token_prices")
	official, ok := parsed["official_price"].(map[string]any)
	require.True(t, ok)
	tiers, ok := official["per_token"].([]any)
	require.True(t, ok)
	require.Len(t, tiers, 1)
	cell, ok := tiers[0].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "with_video", cell["condition"])
	assert.Equal(t, "1080p", cell["size"])
}

func TestDeleteReferencePricingByModelRemovesBothSources(t *testing.T) {
	truncateTables(t)

	require.NoError(t, UpsertReferencePricingRows([]ReferencePricing{
		{ModelName: "m1", Source: ReferencePricingSourceOfficial, Input: refPrice(1)},
		{ModelName: "m1", Source: ReferencePricingSourceOpenRouter, Input: refPrice(2)},
		{ModelName: "m2", Source: ReferencePricingSourceOfficial, Input: refPrice(3)},
	}))

	require.NoError(t, DeleteReferencePricingByModel("m1"))

	rows, err := GetAllReferencePricing()
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, "m2", rows[0].ModelName)
}

func TestSeedReferencePricingOnlyRunsOnEmptyTable(t *testing.T) {
	truncateTables(t)

	require.NoError(t, seedReferencePricing())
	rows, err := GetAllReferencePricing()
	require.NoError(t, err)
	require.Len(t, rows, 24) // 12 个模型 × official/openrouter

	// 表非空时重复执行不得覆盖管理员改过的数据
	require.NoError(t, UpsertReferencePricingRows([]ReferencePricing{
		{ModelName: "deepseek-v4-flash", Source: ReferencePricingSourceOfficial, Input: refPrice(9.9)},
	}))
	require.NoError(t, seedReferencePricing())

	rows, err = GetAllReferencePricing()
	require.NoError(t, err)
	require.Len(t, rows, 24)
	for _, row := range rows {
		if row.ModelName == "deepseek-v4-flash" && row.Source == ReferencePricingSourceOfficial {
			require.NotNil(t, row.Input)
			assert.Equal(t, 9.9, *row.Input)
		}
	}
}
