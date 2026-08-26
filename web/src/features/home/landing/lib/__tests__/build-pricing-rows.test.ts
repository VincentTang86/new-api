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
import { describe, expect, test } from 'vitest'

import type { PricingModel } from '@/features/pricing/types'

import type { PricingBenchmark } from '../../types'
import { buildPricingRows } from '../build-pricing-rows'
import type { OfficialPricingMap } from '../official-pricing'
import { LANDING_PRICE_PLACEHOLDER } from '../pricing'

// A token model priced so that FR input = model_ratio*2*groupRatio = 1.25 and
// FR output = *completion_ratio = 5.00 at ratio 1. Against a $2.50 / $10 list
// price that is exactly a 50% saving on both — the invariant the marketing
// page sells.
function tokenModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'demo-model',
    quota_type: 0,
    model_ratio: 0.625,
    completion_ratio: 4,
    enable_groups: ['default'],
    group_ratio: { default: 1 },
    ...overrides,
  }
}

interface BuildOverrides {
  selectedGroup?: string
  groupRatio?: Record<string, number>
  benchmark?: PricingBenchmark
}

function build(
  model: PricingModel,
  catalog: OfficialPricingMap,
  overrides: BuildOverrides = {}
) {
  return buildPricingRows({
    models: [model],
    language: 'en',
    catalog,
    selectedGroup: overrides.selectedGroup ?? 'default',
    groupRatio: overrides.groupRatio ?? { default: 1 },
    benchmark: overrides.benchmark ?? 'official',
  })[0]
}

describe('buildPricingRows', () => {
  test('computes savings from the backend ratio against the official list price', () => {
    const row = build(tokenModel(), {
      'demo-model': { officialInput: 2.5, officialOutput: 10 },
    })

    expect(row.isPerRequest).toBe(false)
    // USD per 1M, fixed-point: input keeps two decimals from a dollar up,
    // output always two decimals.
    expect(row.frInput).toBe('$1.25')
    expect(row.frOutput).toBe('$5.00')
    expect(row.officialInput).toBe('$2.50')
    expect(row.officialOutput).toBe('$10.00')
    expect(row.savingsInput).toBe('50%')
    expect(row.savingsOutput).toBe('50%')
  })

  test('a tiered-expression model prices from its expression, not the fallback ratio', () => {
    // gpt-image-2 shape: billing lives in the expression while model_ratio
    // carries the backend's 37.5 fallback. The row must read $0.30/$1.80 from
    // the expression (and scale by group ratio), never $75 from the fallback.
    const model = tokenModel({
      model_ratio: 37.5,
      completion_ratio: 2,
      unset_ratio: true,
      billing_mode: 'tiered_expr',
      billing_expr:
        'tier("base", p * 0.3 + c * 1.8 + cr * 0.12 + img * 0.48 + img_o * 1.8)',
    })
    const row = build(model, {
      'demo-model': { officialInput: 0.6, officialOutput: 3.6 },
    })
    expect(row.frInput).toBe('$0.30')
    expect(row.frOutput).toBe('$1.80')
    expect(row.savingsInput).toBe('50%')
    expect(row.savingsOutput).toBe('50%')

    const scaled = build(model, {}, { groupRatio: { default: 5 } })
    expect(scaled.frInput).toBe('$1.50')
    expect(scaled.frOutput).toBe('$9.00')
  })

  test('a multi-tier expression renders its first (standard) tier', () => {
    const row = build(
      tokenModel({
        unset_ratio: true,
        billing_mode: 'tiered_expr',
        billing_expr:
          'len <= 200000 ? tier("standard", p * 3 + c * 15) : tier("long_context", p * 6 + c * 22.5)',
      }),
      {}
    )
    expect(row.frInput).toBe('$3.00')
    expect(row.frOutput).toBe('$15.00')
  })

  test('a model with neither expression nor configured ratio shows dashes, not the fallback price', () => {
    const row = build(
      tokenModel({ model_ratio: 37.5, completion_ratio: 2, unset_ratio: true }),
      { 'demo-model': { officialInput: 2.5, officialOutput: 10 } }
    )
    expect(row.frInput).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(row.frOutput).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(row.savingsInput).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(row.savingsOutput).toBe(LANDING_PRICE_PLACEHOLDER)
    // The benchmark columns still render so the table stays comparable.
    expect(row.officialInput).toBe('$2.50')
    expect(row.officialOutput).toBe('$10.00')
  })

  test('prices FR by the selected group ratio, so a cheaper tier deepens the saving', () => {
    // groupRatio 0.5 halves FR input to 0.625 → 75% off the $2.50 list price.
    const row = build(
      tokenModel({ enable_groups: ['vip'] }),
      { 'demo-model': { officialInput: 2.5 } },
      { selectedGroup: 'vip', groupRatio: { vip: 0.5 } }
    )
    expect(row.frInput).toBe('$0.625')
    expect(row.savingsInput).toBe('75%')
  })

  test('official benchmark stays fixed while the group ratio changes FR', () => {
    const catalog: OfficialPricingMap = {
      'demo-model': { officialInput: 2.5 },
    }
    const fullPrice = build(
      tokenModel({ enable_groups: ['a', 'b'] }),
      catalog,
      {
        selectedGroup: 'a',
        groupRatio: { a: 1, b: 0.8 },
      }
    )
    const discounted = build(
      tokenModel({ enable_groups: ['a', 'b'] }),
      catalog,
      { selectedGroup: 'b', groupRatio: { a: 1, b: 0.8 } }
    )

    expect(fullPrice.officialInput).toBe('$2.50')
    expect(discounted.officialInput).toBe('$2.50')
    expect(fullPrice.frInput).not.toBe(discounted.frInput)
    expect(discounted.frInput).toBe('$1.00')
  })

  test('the openrouter benchmark reads the openrouter columns of the catalog', () => {
    const catalog: OfficialPricingMap = {
      'demo-model': {
        officialInput: 2.5,
        officialOutput: 10,
        openrouterInput: 5,
        openrouterOutput: 20,
      },
    }
    const row = build(tokenModel(), catalog, { benchmark: 'openrouter' })

    expect(row.officialInput).toBe('$5.00')
    expect(row.officialOutput).toBe('$20.00')
    expect(row.savingsInput).toBe('75%')
    expect(row.savingsOutput).toBe('75%')
  })

  test('a benchmark with no data shows dashes even when the other one is set', () => {
    const row = build(
      tokenModel(),
      { 'demo-model': { officialInput: 2.5, officialOutput: 10 } },
      { benchmark: 'openrouter' }
    )
    expect(row.officialInput).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(row.officialOutput).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(row.savingsInput).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(row.savingsOutput).toBe(LANDING_PRICE_PLACEHOLDER)
    // The model is still listed — the product decision is to show everything.
    expect(row.modelId).toBe('demo-model')
  })

  test('drops models not enabled for the selected group, honoring the "all" convention', () => {
    const rows = buildPricingRows({
      models: [
        tokenModel({ model_name: 'in-group', enable_groups: ['vip'] }),
        tokenModel({ model_name: 'out-of-group', enable_groups: ['default'] }),
        tokenModel({ model_name: 'always-on', enable_groups: ['all'] }),
      ],
      language: 'en',
      catalog: {},
      selectedGroup: 'vip',
      groupRatio: { vip: 0.5 },
      benchmark: 'official',
    })

    expect(rows.map((row) => row.modelId).sort()).toEqual([
      'always-on',
      'in-group',
    ])
  })

  test('an empty selected group lists everything at ratio 1', () => {
    const rows = buildPricingRows({
      models: [tokenModel({ enable_groups: ['vip'] })],
      language: 'en',
      catalog: {},
      selectedGroup: '',
      groupRatio: { vip: 0.5 },
      benchmark: 'official',
    })
    expect(rows.length).toBe(1)
    expect(rows[0].frInput).toBe('$1.25')
  })

  test('never claims a saving when the list price is not higher', () => {
    const row = build(tokenModel(), {
      'demo-model': { officialInput: 1.25 }, // equal to FR, not cheaper
    })
    expect(row.savingsInput).toBe(LANDING_PRICE_PLACEHOLDER)
  })

  test('treats per-request models as billed by call, per benchmark', () => {
    const model = tokenModel({
      model_name: 'flux-1.1-pro',
      quota_type: 1,
      model_price: 0.04,
    })
    const catalog: OfficialPricingMap = {
      'flux-1.1-pro': {
        officialRequestPrice: 0.08,
        openrouterRequestPrice: 0.05,
      },
    }
    const official = build(model, catalog)

    expect(official.isPerRequest).toBe(true)
    // Per-call price is USD too, on the same magnitude rule.
    expect(official.frInput).toBe('$0.04')
    expect(official.frOutput).toBe('')
    expect(official.savingsInput).toBe('50%')
    // The output side has no meaning for a per-call price.
    expect(official.officialOutput).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(official.savingsOutput).toBe(LANDING_PRICE_PLACEHOLDER)

    const openrouter = build(model, catalog, { benchmark: 'openrouter' })
    expect(openrouter.savingsInput).toBe('20%')
  })

  test('resolves the vendor chip from vendor name or model id, else null', () => {
    const named = build(tokenModel({ vendor_name: 'OpenAI' }), {})
    expect(named.provider).toBe('openai')

    const byModelId = build(tokenModel({ model_name: 'qwen2.5-72b' }), {})
    expect(byModelId.provider).toBe('alibaba')

    const unknown = build(
      tokenModel({ model_name: 'mystery-model', vendor_name: 'ACME' }),
      {}
    )
    expect(unknown.provider).toBe(null)
    expect(unknown.vendorLabel).toBe('ACME')
  })

  test('orders rows A→Z by displayed name, digit-aware and case-insensitive', () => {
    const rows = buildPricingRows({
      models: [
        tokenModel({ model_name: 'qwen3.10-plus' }),
        tokenModel({ model_name: 'GLM-5.2' }),
        tokenModel({ model_name: 'qwen3.6-plus' }),
        tokenModel({ model_name: 'deepseek-v4-flash' }),
      ],
      language: 'en',
      // The display name wins over the model id, so the sort must follow it.
      catalog: { 'deepseek-v4-flash': { displayName: 'Zeta Flash' } },
      selectedGroup: 'default',
      groupRatio: { default: 1 },
      benchmark: 'official',
    })

    expect(rows.map((row) => row.modelId)).toEqual([
      'GLM-5.2',
      'qwen3.6-plus',
      'qwen3.10-plus',
      'deepseek-v4-flash',
    ])
  })

  test('prefers the catalog display name over the raw model id', () => {
    const row = build(tokenModel(), {
      'demo-model': { displayName: 'Demo Model' },
    })
    expect(row.name).toBe('Demo Model')
    expect(row.modelId).toBe('demo-model')
  })
})
