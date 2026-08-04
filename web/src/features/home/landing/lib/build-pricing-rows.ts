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
import { getDisplayGroupRatio } from '@/features/pricing/lib/model-helpers'
import { tokenPriceUSD } from '@/features/pricing/lib/price'
import type { PricingModel } from '@/features/pricing/types'

import type { LandingProviderKey, PricingRow } from '../types'
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

interface BuildPricingRowsParams {
  models: readonly PricingModel[]
  language?: string
  /** Parsed `official-pricing.json`, keyed by the backend model_name. */
  catalog: OfficialPricingMap
}

/**
 * Turn the backend `/api/pricing` models into fully-formatted display rows,
 * merging the hand-maintained official price supplement for the list price and
 * context window. Every price is USD per 1M tokens (per call for 按次 models):
 * this is a USD comparison table by design, independent of the console's
 * display currency. Everything the table renders is a string so the
 * presentational components carry no pricing logic.
 */
export function buildPricingRows(params: BuildPricingRowsParams): PricingRow[] {
  const { models, language, catalog: catalogMap } = params

  return models.map((model) => {
    const catalog = catalogMap[model.model_name] ?? {}
    const isPerRequest = model.quota_type === QUOTA_TYPE_VALUES.REQUEST
    const groupRatio = getDisplayGroupRatio(model)
    const provider = resolveProviderKey(model.vendor_name, model.model_name)

    const base = {
      modelId: model.model_name,
      name: catalog.displayName ?? model.model_name,
      provider,
      vendorLabel: model.vendor_name || catalog.displayName || model.model_name,
      context: catalog.context ?? LANDING_PRICE_PLACEHOLDER,
    }

    if (isPerRequest) {
      const ourUSD = (model.model_price ?? 0) * groupRatio
      return {
        ...base,
        isPerRequest: true,
        frInput: formatInputPrice(ourUSD),
        frOutput: '',
        officialInput: officialInputDisplay(catalog.officialRequestPrice),
        officialOutput: LANDING_PRICE_PLACEHOLDER,
        savingsInput: formatSavings(
          catalog.officialRequestPrice,
          ourUSD,
          language
        ),
        savingsOutput: LANDING_PRICE_PLACEHOLDER,
      }
    }

    const inputUSD = tokenPriceUSD(model, 'input', groupRatio)
    const outputUSD = tokenPriceUSD(model, 'output', groupRatio)
    return {
      ...base,
      isPerRequest: false,
      frInput: formatInputPrice(inputUSD),
      frOutput: formatOutputPrice(outputUSD),
      officialInput: officialInputDisplay(catalog.officialInput),
      officialOutput: officialOutputDisplay(catalog.officialOutput),
      savingsInput: formatSavings(catalog.officialInput, inputUSD, language),
      savingsOutput: formatSavings(catalog.officialOutput, outputUSD, language),
    }
  })
}
