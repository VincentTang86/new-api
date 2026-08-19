package model

import (
	"testing"

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
		{ModelName: "m1", Source: ReferencePricingSourceOfficial, Input: refPrice(1.8), CacheHit: refPrice(0.2)},
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

	openrouter := rows[1]
	require.Equal(t, ReferencePricingSourceOpenRouter, openrouter.Source)
	require.NotNil(t, openrouter.Input)
	assert.Equal(t, 2.0, *openrouter.Input)
	require.NotNil(t, openrouter.Output)
	assert.Equal(t, 4.0, *openrouter.Output)
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
