/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { QUOTA_TYPE_VALUES } from '@/features/pricing/constants'
import { getConfiguredGroupRatio } from '@/features/pricing/lib/model-helpers'
import { tokenPriceUSD } from '@/features/pricing/lib/price'
import type { PricingModel } from '@/features/pricing/types'

import type { LandingProviderKey, PricingBenchmark, PricingRow } from '../types'
import type { OfficialPricingMap } from './official-pricing'
import {
  LANDING_PRICE_PLACEHOLDER,
  calculateSavingsRatio,
  formatInputPrice,
  formatOutputPrice,
  formatSavingsPercent,
} from './pricing'

/**
 * Substring aliases that map a backend vendor name (or, as a fallback, the
 * model id) onto one of the marketing chips. Order matters only in that the
 * first match wins; the keys are deliberately broad so `qwen2.5-72b` resolves
 * to Alibaba even when no vendor is configured.
 */
const VENDOR_ALIASES: Array<[string, LandingProviderKey]> = [
  ['openai', 'openai'],
  ['chatgpt', 'openai'],
  ['gpt', 'openai'],
  ['anthropic', 'anthropic'],
  ['claude', 'anthropic'],
  ['google', 'google'],
  ['gemini', 'google'],
  ['deepseek', 'deepseek'],
  ['meta', 'meta'],
  ['llama', 'meta'],
  ['alibaba', 'alibaba'],
  ['qwen', 'alibaba'],
  ['tongyi', 'alibaba'],
  ['moonshot', 'kimi'],
  ['kimi', 'kimi'],
  ['zhipu', 'zhipu'],
  ['chatglm', 'zhipu'],
  ['glm', 'zhipu'],
  ['minimax', 'minimax'],
  ['doubao', 'doubao'],
  ['grok', 'xai'],
  ['xai', 'xai'],
]

export function resolveProviderKey(
  vendorName: string | undefined,
  modelName: string
): LandingProviderKey | null {
  const haystack = `${vendorName ?? ''} ${modelName}`.toLowerCase()
  for (const [alias, key] of VENDOR_ALIASES) {
    if (haystack.includes(alias)) return key
  }
  return null
}

/** Vendor list price for the input columns, or the placeholder dash. */
function officialInputDisplay(value: number | undefined): string {
  return value === undefined
    ? LANDING_PRICE_PLACEHOLDER
    : formatInputPrice(value)
}

/** Vendor list price for the output columns, or the placeholder dash. */
function officialOutputDisplay(value: number | undefined): string {
  return value === undefined
    ? LANDING_PRICE_PLACEHOLDER
    : formatOutputPrice(value)
}

/**
 * Savings vs the vendor list price, both in USD so the percentage is exact.
 * Dash when there is no configured list price or we are not actually cheaper.
 */
function formatSavings(
  officialUSD: number | undefined,
  ourUSD: number,
  language?: string
): string {
  if (officialUSD === undefined) return LANDING_PRICE_PLACEHOLDER
  const ratio = calculateSavingsRatio(ourUSD, officialUSD)
  if (ratio === null) return LANDING_PRICE_PLACEHOLDER
  return formatSavingsPercent(ratio, language)
}

/** Backend convention: a model whose enable_groups contains "all" is usable
 * from every group (mirrors filterPricingByUsableGroups in the backend). */
function isModelInGroup(model: PricingModel, group: string): boolean {
  if (!group) return true
  const enableGroups = Array.isArray(model.enable_groups)
    ? model.enable_groups
    : []
  return enableGroups.includes('all') || enableGroups.includes(group)
}

interface BuildPricingRowsParams {
  models: readonly PricingModel[]
  language?: string
  /** Parsed `official-pricing.json`, keyed by the backend model_name. */
  catalog: OfficialPricingMap
  /** Group tab the visitor selected; '' prices at ratio 1 with no filtering. */
  selectedGroup: string
  /** `group_ratio` map from /api/pricing. */
  groupRatio: Record<string, number>
  /** "Compare with" source the benchmark columns show. */
  benchmark: PricingBenchmark
}

/**
 * Turn the backend `/api/pricing` models into fully-formatted display rows.
 * FR prices are the model's configured price multiplied by the selected
 * group's ratio; the benchmark columns come from the hand-maintained
 * supplement for the selected "Compare with" source, and savings are computed
 * against that benchmark. Models not enabled for the selected group are
 * dropped, matching what that group can actually call. Every price is USD per
 * 1M tokens (per call for 按次 models): this is a USD comparison table by
 * design, independent of the console's display currency. Everything the table
 * renders is a string so the presentational components carry no pricing logic.
 *
 * Rows come out sorted A→Z by displayed name, so the catalogue reads
 * predictably and the home preview's first ten are the alphabetical head
 * rather than whatever order the backend happened to return.
 */
export function buildPricingRows(params: BuildPricingRowsParams): PricingRow[] {
  const { models, language, catalog: catalogMap, benchmark } = params
  const ratio = params.selectedGroup
    ? getConfiguredGroupRatio(params.groupRatio, params.selectedGroup)
    : 1

  const rows = models
    .filter((model) => isModelInGroup(model, params.selectedGroup))
    .map((model) => {
      const catalog = catalogMap[model.model_name] ?? {}
      const isPerRequest = model.quota_type === QUOTA_TYPE_VALUES.REQUEST
      const provider = resolveProviderKey(model.vendor_name, model.model_name)

      const base = {
        modelId: model.model_name,
        name: catalog.displayName ?? model.model_name,
        provider,
        vendorLabel:
          model.vendor_name || catalog.displayName || model.model_name,
      }

      if (isPerRequest) {
        const benchmarkRequestPrice =
          benchmark === 'official'
            ? catalog.officialRequestPrice
            : catalog.openrouterRequestPrice
        const ourUSD = (model.model_price ?? 0) * ratio
        return {
          ...base,
          isPerRequest: true,
          frInput: formatInputPrice(ourUSD),
          frOutput: '',
          officialInput: officialInputDisplay(benchmarkRequestPrice),
          officialOutput: LANDING_PRICE_PLACEHOLDER,
          savingsInput: formatSavings(benchmarkRequestPrice, ourUSD, language),
          savingsOutput: LANDING_PRICE_PLACEHOLDER,
        }
      }

      const benchmarkInput =
        benchmark === 'official'
          ? catalog.officialInput
          : catalog.openrouterInput
      const benchmarkOutput =
        benchmark === 'official'
          ? catalog.officialOutput
          : catalog.openrouterOutput
      const inputUSD = tokenPriceUSD(model, 'input', ratio)
      const outputUSD = tokenPriceUSD(model, 'output', ratio)
      return {
        ...base,
        isPerRequest: false,
        frInput: formatInputPrice(inputUSD),
        frOutput: formatOutputPrice(outputUSD),
        officialInput: officialInputDisplay(benchmarkInput),
        officialOutput: officialOutputDisplay(benchmarkOutput),
        savingsInput: formatSavings(benchmarkInput, inputUSD, language),
        savingsOutput: formatSavings(benchmarkOutput, outputUSD, language),
      }
    })

  // Case-insensitive and digit-aware, so `qwen3.6` precedes `qwen3.10` instead
  // of sorting by codepoint. Fixed to 'en' because this catalogue is English
  // model ids in every UI language.
  return rows.sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' })
  )
}
