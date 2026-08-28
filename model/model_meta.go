package model

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	NameRuleExact = iota
	NameRulePrefix
	NameRuleContains
	NameRuleSuffix
)

type BoundChannel struct {
	Name string `json:"name"`
	Type int    `json:"type"`
}

type Model struct {
	Id          int    `json:"id"`
	ModelName   string `json:"model_name" gorm:"size:128;not null;uniqueIndex:uk_model_name_delete_at,priority:1"`
	Description string `json:"description,omitempty" gorm:"type:text"`
	// DescriptionI18n 按语言的模型说明，JSON 对象 {"en": "...", "zh-CN": "..."}，
	// 键限定 modelDescriptionLocales；Description 保留为兜底（上游同步写入）。
	DescriptionI18n string `json:"description_i18n,omitempty" gorm:"column:description_i18n;type:text"`
	Icon            string `json:"icon,omitempty" gorm:"type:varchar(128)"`
	Tags            string `json:"tags,omitempty" gorm:"type:varchar(255)"`
	VendorID        int    `json:"vendor_id,omitempty" gorm:"index"`
	Endpoints       string `json:"endpoints,omitempty" gorm:"type:text"`
	// 目录元数据（纯展示，不进计费链路）
	InputModalities  string         `json:"input_modalities,omitempty" gorm:"type:varchar(128)"`
	OutputModalities string         `json:"output_modalities,omitempty" gorm:"type:varchar(128)"`
	ContextLength    int            `json:"context_length,omitempty"`
	MaxOutputTokens  int            `json:"max_output_tokens,omitempty"`
	ReleaseDate      string         `json:"release_date,omitempty" gorm:"type:varchar(16)"`
	KnowledgeCutoff  string         `json:"knowledge_cutoff,omitempty" gorm:"type:varchar(16)"`
	ParameterCount   string         `json:"parameter_count,omitempty" gorm:"type:varchar(32)"`
	Capabilities     string         `json:"capabilities,omitempty" gorm:"type:varchar(255)"`
	Status           int            `json:"status" gorm:"default:1"`
	SyncOfficial     int            `json:"sync_official" gorm:"default:1"`
	CreatedTime      int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime      int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt        gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_model_name_delete_at,priority:2"`

	BoundChannels []BoundChannel `json:"bound_channels,omitempty" gorm:"-"`
	EnableGroups  []string       `json:"enable_groups,omitempty" gorm:"-"`
	QuotaTypes    []int          `json:"quota_types,omitempty" gorm:"-"`
	NameRule      int            `json:"name_rule" gorm:"default:0"`

	MatchedModels []string `json:"matched_models,omitempty" gorm:"-"`
	MatchedCount  int      `json:"matched_count,omitempty" gorm:"-"`
}

func (mi *Model) Insert() error {
	now := common.GetTimestamp()
	mi.CreatedTime = now
	mi.UpdatedTime = now

	// 保存原始值（因为 Create 后可能被 GORM 的 default 标签覆盖为 1）
	originalStatus := mi.Status
	originalSyncOfficial := mi.SyncOfficial

	// 先创建记录（GORM 会对零值字段应用默认值）
	if err := DB.Create(mi).Error; err != nil {
		return err
	}

	// 使用保存的原始值进行更新，确保零值能正确保存
	return DB.Model(&Model{}).Where("id = ?", mi.Id).Updates(map[string]interface{}{
		"status":        originalStatus,
		"sync_official": originalSyncOfficial,
	}).Error
}

func IsModelNameDuplicated(id int, name string) (bool, error) {
	if name == "" {
		return false, nil
	}
	var cnt int64
	err := DB.Model(&Model{}).Where("model_name = ? AND id <> ?", name, id).Count(&cnt).Error
	return cnt > 0, err
}

func (mi *Model) Update() error {
	mi.UpdatedTime = common.GetTimestamp()
	// 使用 Select 强制更新所有字段，包括零值
	return DB.Model(&Model{}).Where("id = ?", mi.Id).
		Select("model_name", "description", "description_i18n", "icon", "tags", "vendor_id", "endpoints",
			"input_modalities", "output_modalities", "context_length", "max_output_tokens",
			"release_date", "knowledge_cutoff", "parameter_count", "capabilities",
			"status", "sync_official", "name_rule", "updated_time").
		Updates(mi).Error
}

func (mi *Model) Delete() error {
	return DB.Delete(mi).Error
}

// 目录元数据枚举，与前端 web/src/features/pricing/types.ts 的 Modality / ModelCapability 对齐
var (
	modelCatalogModalities = map[string]bool{
		"text": true, "image": true, "audio": true, "video": true, "file": true,
	}
	modelCatalogCapabilities = map[string]bool{
		"function_calling": true, "streaming": true, "vision": true, "json_mode": true,
		"structured_output": true, "reasoning": true, "tools": true, "system_prompt": true,
		"web_search": true, "code_interpreter": true, "caching": true, "embeddings": true,
	}
	// 多语言说明的存储键，与前端界面语言集合对齐（标准码）
	modelDescriptionLocales = map[string]bool{
		"en": true, "zh-CN": true, "zh-TW": true, "fr": true, "ru": true, "ja": true, "vi": true,
	}
	catalogDatePattern = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$`)
)

// maxCatalogTokenCount 上下文长度/最大输出的上限，纯展示字段的脏数据护栏
const maxCatalogTokenCount = 100_000_000

// NormalizeAndValidateCatalogMeta 规范化并校验目录元数据（多语言说明、模态、上下文长度、
// 发布时间等）。这些字段仅用于展示、不进计费链路，校验只为拒绝脏数据。
func (mi *Model) NormalizeAndValidateCatalogMeta() error {
	var err error
	if mi.InputModalities, err = normalizeCatalogEnumList(mi.InputModalities, modelCatalogModalities, "输入模态"); err != nil {
		return err
	}
	if mi.OutputModalities, err = normalizeCatalogEnumList(mi.OutputModalities, modelCatalogModalities, "输出模态"); err != nil {
		return err
	}
	if mi.Capabilities, err = normalizeCatalogEnumList(mi.Capabilities, modelCatalogCapabilities, "能力标签"); err != nil {
		return err
	}
	if mi.ContextLength < 0 || mi.ContextLength > maxCatalogTokenCount {
		return fmt.Errorf("上下文长度超出范围 [0, %d]", maxCatalogTokenCount)
	}
	if mi.MaxOutputTokens < 0 || mi.MaxOutputTokens > maxCatalogTokenCount {
		return fmt.Errorf("最大输出 token 数超出范围 [0, %d]", maxCatalogTokenCount)
	}
	if mi.ReleaseDate, err = normalizeCatalogDate(mi.ReleaseDate, "发布时间"); err != nil {
		return err
	}
	if mi.KnowledgeCutoff, err = normalizeCatalogDate(mi.KnowledgeCutoff, "知识截止时间"); err != nil {
		return err
	}
	mi.ParameterCount = strings.TrimSpace(mi.ParameterCount)

	raw := strings.TrimSpace(mi.DescriptionI18n)
	if raw == "" {
		mi.DescriptionI18n = ""
		return nil
	}
	descMap := make(map[string]string)
	if err := common.UnmarshalJsonStr(raw, &descMap); err != nil {
		return fmt.Errorf("多语言说明必须是 {语言码: 文本} 的 JSON 对象: %s", err.Error())
	}
	for locale, text := range descMap {
		if !modelDescriptionLocales[locale] {
			return fmt.Errorf("多语言说明包含不支持的语言码: %s", locale)
		}
		trimmed := strings.TrimSpace(text)
		if trimmed == "" {
			delete(descMap, locale)
		} else {
			descMap[locale] = trimmed
		}
	}
	if len(descMap) == 0 {
		mi.DescriptionI18n = ""
		return nil
	}
	normalized, err := common.Marshal(descMap)
	if err != nil {
		return err
	}
	mi.DescriptionI18n = string(normalized)
	return nil
}

func normalizeCatalogEnumList(raw string, allowed map[string]bool, label string) (string, error) {
	items := make([]string, 0)
	seen := make(map[string]bool)
	for _, item := range strings.Split(raw, ",") {
		item = strings.ToLower(strings.TrimSpace(item))
		if item == "" || seen[item] {
			continue
		}
		if !allowed[item] {
			return "", fmt.Errorf("%s包含不支持的值: %s", label, item)
		}
		seen[item] = true
		items = append(items, item)
	}
	return strings.Join(items, ","), nil
}

func normalizeCatalogDate(raw string, label string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	if !catalogDatePattern.MatchString(raw) {
		return "", fmt.Errorf("%s格式须为 YYYY-MM 或 YYYY-MM-DD", label)
	}
	return raw, nil
}

func GetVendorModelCounts() (map[int64]int64, error) {
	var stats []struct {
		VendorID int64
		Count    int64
	}
	if err := DB.Model(&Model{}).
		Select("vendor_id as vendor_id, count(*) as count").
		Group("vendor_id").
		Scan(&stats).Error; err != nil {
		return nil, err
	}
	m := make(map[int64]int64, len(stats))
	for _, s := range stats {
		m[s.VendorID] = s.Count
	}
	return m, nil
}

func GetAllModels(offset int, limit int) ([]*Model, error) {
	models, _, err := SearchModels("", "", "", "", offset, limit)
	return models, err
}

func GetBoundChannelsByModelsMap(modelNames []string) (map[string][]BoundChannel, error) {
	result := make(map[string][]BoundChannel)
	if len(modelNames) == 0 {
		return result, nil
	}
	type row struct {
		Model string
		Name  string
		Type  int
	}
	var rows []row
	err := DB.Table("channels").
		Select("abilities.model as model, channels.name as name, channels.type as type").
		Joins("JOIN abilities ON abilities.channel_id = channels.id").
		Where("abilities.model IN ? AND abilities.enabled = ?", modelNames, true).
		Distinct().
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		result[r.Model] = append(result[r.Model], BoundChannel{Name: r.Name, Type: r.Type})
	}
	return result, nil
}

func normalizeLookupValues(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	return normalized
}

func GetPreferredModelOwnerChannelTypes(modelNames []string, groups []string) (map[string]int, error) {
	result := make(map[string]int)
	modelNames = normalizeLookupValues(modelNames)
	if len(modelNames) == 0 {
		return result, nil
	}

	type row struct {
		Model       string
		ChannelType int
	}
	var rows []row

	query := DB.Table("abilities").
		Select("abilities.model as model, channels.type as channel_type").
		Joins("JOIN channels ON abilities.channel_id = channels.id").
		Where("abilities.model IN ? AND abilities.enabled = ? AND channels.status = ?", modelNames, true, common.ChannelStatusEnabled).
		Order("COALESCE(abilities.priority, 0) DESC").
		Order("abilities.weight DESC").
		Order("abilities.channel_id ASC")

	groups = normalizeLookupValues(groups)
	if len(groups) > 0 {
		query = query.Where("abilities."+commonGroupCol+" IN ?", groups)
	}

	if err := query.Scan(&rows).Error; err != nil {
		return nil, err
	}

	for _, r := range rows {
		if _, ok := result[r.Model]; ok {
			continue
		}
		result[r.Model] = r.ChannelType
	}
	return result, nil
}

func SearchModels(keyword string, vendor string, status string, syncOfficial string, offset int, limit int) ([]*Model, int64, error) {
	var models []*Model
	db := DB.Model(&Model{})
	if keyword != "" {
		like := "%" + keyword + "%"
		db = db.Where("model_name LIKE ? OR description LIKE ? OR tags LIKE ?", like, like, like)
	}
	if vendor != "" {
		if vid, err := strconv.Atoi(vendor); err == nil {
			db = db.Where("models.vendor_id = ?", vid)
		} else {
			db = db.Joins("JOIN vendors ON vendors.id = models.vendor_id").Where("vendors.name LIKE ?", "%"+vendor+"%")
		}
	}
	if statusValue, ok := parseModelStatusFilter(status); ok {
		db = db.Where("models.status = ?", statusValue)
	}
	if syncValue, ok := parseModelSyncFilter(syncOfficial); ok {
		db = db.Where("models.sync_official = ?", syncValue)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := db.Order("models.id DESC").Offset(offset).Limit(limit).Find(&models).Error; err != nil {
		return nil, 0, err
	}
	return models, total, nil
}

// parseModelStatusFilter maps UI/API status values to the models.status column.
// Returns ok=false when no status filter should be applied.
func parseModelStatusFilter(status string) (value int, ok bool) {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "", "all":
		return 0, false
	case "enabled", "1":
		return 1, true
	case "disabled", "0":
		return 0, true
	default:
		n, err := strconv.Atoi(status)
		if err != nil {
			return 0, false
		}
		return n, true
	}
}

// parseModelSyncFilter maps UI/API sync values to the models.sync_official column.
// Returns ok=false when no sync filter should be applied.
func parseModelSyncFilter(syncOfficial string) (value int, ok bool) {
	switch strings.ToLower(strings.TrimSpace(syncOfficial)) {
	case "", "all":
		return 0, false
	case "yes", "1":
		return 1, true
	case "no", "0":
		return 0, true
	default:
		n, err := strconv.Atoi(syncOfficial)
		if err != nil {
			return 0, false
		}
		return n, true
	}
}
