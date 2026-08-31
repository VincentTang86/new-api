package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 目录元数据是 /api/models 写入口与 /api/pricing 出口共享的契约：
// 枚举、日期格式、多语言 JSON 的规范化结果直接决定前端能否渲染。
func TestNormalizeAndValidateCatalogMeta(t *testing.T) {
	t.Run("normalizes enum lists and dates", func(t *testing.T) {
		m := &Model{
			InputModalities:  " Text , IMAGE ,text,",
			OutputModalities: "text",
			Capabilities:     "Function_Calling, vision",
			ContextLength:    128000,
			MaxOutputTokens:  8192,
			ReleaseDate:      " 2025-06 ",
			KnowledgeCutoff:  "2024-12-31",
			ParameterCount:   " 685B ",
		}
		require.NoError(t, m.NormalizeAndValidateCatalogMeta())
		assert.Equal(t, "text,image", m.InputModalities)
		assert.Equal(t, "text", m.OutputModalities)
		assert.Equal(t, "function_calling,vision", m.Capabilities)
		assert.Equal(t, "2025-06", m.ReleaseDate)
		assert.Equal(t, "2024-12-31", m.KnowledgeCutoff)
		assert.Equal(t, "685B", m.ParameterCount)
	})

	t.Run("normalizes description_i18n and drops empty entries", func(t *testing.T) {
		m := &Model{DescriptionI18n: `{"en":" Fast model ","zh-CN":"快速模型","ja":"  "}`}
		require.NoError(t, m.NormalizeAndValidateCatalogMeta())
		descMap := make(map[string]string)
		require.NoError(t, common.UnmarshalJsonStr(m.DescriptionI18n, &descMap))
		assert.Equal(t, map[string]string{"en": "Fast model", "zh-CN": "快速模型"}, descMap)
	})

	t.Run("empty i18n object collapses to empty string", func(t *testing.T) {
		m := &Model{DescriptionI18n: `{"en":"   "}`}
		require.NoError(t, m.NormalizeAndValidateCatalogMeta())
		assert.Empty(t, m.DescriptionI18n)
	})

	rejected := []struct {
		name string
		m    Model
	}{
		{"unknown modality", Model{InputModalities: "text,3d"}},
		{"unknown capability", Model{Capabilities: "teleport"}},
		{"unknown locale key", Model{DescriptionI18n: `{"de":"Modell"}`}},
		{"i18n not an object", Model{DescriptionI18n: `["en"]`}},
		{"i18n non-string value", Model{DescriptionI18n: `{"en":1}`}},
		{"bad month", Model{ReleaseDate: "2025-13"}},
		{"bad day", Model{KnowledgeCutoff: "2024-02-32"}},
		{"date without month", Model{ReleaseDate: "2025"}},
		{"negative context length", Model{ContextLength: -1}},
		{"context length above cap", Model{ContextLength: maxCatalogTokenCount + 1}},
		{"max output above cap", Model{MaxOutputTokens: maxCatalogTokenCount + 1}},
	}
	for _, tc := range rejected {
		t.Run("rejects "+tc.name, func(t *testing.T) {
			m := tc.m
			assert.Error(t, m.NormalizeAndValidateCatalogMeta())
		})
	}
}

// Update() 用 Select 白名单强制写入零值；目录元数据列一旦漏出白名单，
// 保存会静默失效。该测试保护 Insert/Update 对这些列的完整读写回路。
func TestModelCatalogMetaPersistsThroughUpdate(t *testing.T) {
	t.Cleanup(func() { DB.Exec("DELETE FROM models") })

	m := &Model{
		ModelName:         "catalog-meta-rt",
		VendorDisplayName: "Byte",
		Description:       "fallback",
		DescriptionI18n:  `{"en":"Fast","zh-CN":"快"}`,
		InputModalities:  "text,image",
		OutputModalities: "text",
		Capabilities:     "vision,reasoning",
		ContextLength:    128000,
		MaxOutputTokens:  8192,
		ReleaseDate:      "2025-06",
		KnowledgeCutoff:  "2024-12",
		ParameterCount:   "685B",
	}
	require.NoError(t, m.Insert())

	m.InputModalities = "text"
	m.OutputModalities = "text,audio"
	m.Capabilities = ""
	m.ContextLength = 200000
	m.MaxOutputTokens = 0
	m.ReleaseDate = "2025-07-01"
	m.KnowledgeCutoff = ""
	m.ParameterCount = ""
	m.DescriptionI18n = `{"en":"Faster"}`
	m.VendorDisplayName = "ByteDance"
	require.NoError(t, m.Update())

	var got Model
	require.NoError(t, DB.Where("model_name = ?", "catalog-meta-rt").First(&got).Error)
	assert.Equal(t, `{"en":"Faster"}`, got.DescriptionI18n)
	assert.Equal(t, "ByteDance", got.VendorDisplayName)
	assert.Equal(t, "text", got.InputModalities)
	assert.Equal(t, "text,audio", got.OutputModalities)
	assert.Empty(t, got.Capabilities)
	assert.Equal(t, 200000, got.ContextLength)
	assert.Zero(t, got.MaxOutputTokens)
	assert.Equal(t, "2025-07-01", got.ReleaseDate)
	assert.Empty(t, got.KnowledgeCutoff)
	assert.Empty(t, got.ParameterCount)
}
