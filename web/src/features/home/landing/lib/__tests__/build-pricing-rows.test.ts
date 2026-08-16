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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

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

    assert.equal(row.isPerRequest, false)
    // USD per 1M, fixed-point: input keeps two decimals from a dollar up,
    // output always two decimals.
    assert.equal(row.frInput, '$1.25')
    assert.equal(row.frOutput, '$5.00')
    assert.equal(row.officialInput, '$2.50')
    assert.equal(row.officialOutput, '$10.00')
    assert.equal(row.savingsInput, '50%')
    assert.equal(row.savingsOutput, '50%')
  })

  test('prices FR by the selected group ratio, so a cheaper tier deepens the saving', () => {
    // groupRatio 0.5 halves FR input to 0.625 → 75% off the $2.50 list price.
    const row = build(
      tokenModel({ enable_groups: ['vip'] }),
      { 'demo-model': { officialInput: 2.5 } },
      { selectedGroup: 'vip', groupRatio: { vip: 0.5 } }
    )
    assert.equal(row.frInput, '$0.625')
    assert.equal(row.savingsInput, '75%')
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

    assert.equal(fullPrice.officialInput, '$2.50')
    assert.equal(discounted.officialInput, '$2.50')
    assert.notEqual(fullPrice.frInput, discounted.frInput)
    assert.equal(discounted.frInput, '$1.00')
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

    assert.equal(row.officialInput, '$5.00')
    assert.equal(row.officialOutput, '$20.00')
    assert.equal(row.savingsInput, '75%')
    assert.equal(row.savingsOutput, '75%')
  })

  test('a benchmark with no data shows dashes even when the other one is set', () => {
    const row = build(
      tokenModel(),
      { 'demo-model': { officialInput: 2.5, officialOutput: 10 } },
      { benchmark: 'openrouter' }
    )
    assert.equal(row.officialInput, LANDING_PRICE_PLACEHOLDER)
    assert.equal(row.officialOutput, LANDING_PRICE_PLACEHOLDER)
    assert.equal(row.savingsInput, LANDING_PRICE_PLACEHOLDER)
    assert.equal(row.savingsOutput, LANDING_PRICE_PLACEHOLDER)
    // The model is still listed — the product decision is to show everything.
    assert.equal(row.modelId, 'demo-model')
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

    assert.deepEqual(rows.map((row) => row.modelId).sort(), [
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
    assert.equal(rows.length, 1)
    assert.equal(rows[0].frInput, '$1.25')
  })

  test('never claims a saving when the list price is not higher', () => {
    const row = build(tokenModel(), {
      'demo-model': { officialInput: 1.25 }, // equal to FR, not cheaper
    })
    assert.equal(row.savingsInput, LANDING_PRICE_PLACEHOLDER)
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

    assert.equal(official.isPerRequest, true)
    // Per-call price is USD too; three decimals below a dollar.
    assert.equal(official.frInput, '$0.040')
    assert.equal(official.frOutput, '')
    assert.equal(official.savingsInput, '50%')
    // The output side has no meaning for a per-call price.
    assert.equal(official.officialOutput, LANDING_PRICE_PLACEHOLDER)
    assert.equal(official.savingsOutput, LANDING_PRICE_PLACEHOLDER)

    const openrouter = build(model, catalog, { benchmark: 'openrouter' })
    assert.equal(openrouter.savingsInput, '20%')
  })

  test('resolves the vendor chip from vendor name or model id, else null', () => {
    const named = build(tokenModel({ vendor_name: 'OpenAI' }), {})
    assert.equal(named.provider, 'openai')

    const byModelId = build(tokenModel({ model_name: 'qwen2.5-72b' }), {})
    assert.equal(byModelId.provider, 'alibaba')

    const unknown = build(
      tokenModel({ model_name: 'mystery-model', vendor_name: 'ACME' }),
      {}
    )
    assert.equal(unknown.provider, null)
    assert.equal(unknown.vendorLabel, 'ACME')
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

    assert.deepEqual(
      rows.map((row) => row.modelId),
      ['GLM-5.2', 'qwen3.6-plus', 'qwen3.10-plus', 'deepseek-v4-flash']
    )
  })

  test('prefers the catalog display name over the raw model id', () => {
    const row = build(tokenModel(), {
      'demo-model': { displayName: 'Demo Model' },
    })
    assert.equal(row.name, 'Demo Model')
    assert.equal(row.modelId, 'demo-model')
  })
})
