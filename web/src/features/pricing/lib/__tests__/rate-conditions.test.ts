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

import type { PricingModel } from '../../types'
import { getRateConditions, getReferenceLaneKeys } from '../rate-conditions'

const t = (key: string) => key

// The DeepSeek shape: one base tier surcharged ×2 on weekday windows.
const PEAK_SURCHARGE_EXPR =
  '(tier("base", p * 0.176 + c * 0.528 + cr * 0.0176))' +
  ' * (weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") < 6 && hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12 ? 2 : 1)'

const CONTEXT_TIER_EXPR =
  'len <= 200000 ? tier("standard", p * 3 + c * 15) : tier("long_context", p * 6 + c * 22.5)'

function model(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'test-model',
    quota_type: 0,
    model_ratio: 1.5,
    completion_ratio: 4,
    enable_groups: ['Production'],
    ...overrides,
  }
}

function tiered(billing_expr: string): PricingModel {
  return model({ billing_mode: 'tiered_expr', billing_expr })
}

describe('getRateConditions', () => {
  test('a model without a tiered expression is the single generic condition', () => {
    // Key '' is the storage contract for the default reference price; a
    // rename here silently orphans every flat price already stored.
    expect(getRateConditions(model(), t)).toMatchObject([
      { key: '', label: 'Standard' },
    ])
  })

  test('expression tiers key by their normalized label', () => {
    expect(getRateConditions(tiered(CONTEXT_TIER_EXPR), t)).toMatchObject([
      { key: 'standard', label: 'standard' },
      { key: 'long_context', label: 'long_context' },
    ])
  })

  test('time-conditional multipliers key as peak/offpeak', () => {
    // The generic "base" tier contributes no key part, so the variant slug
    // stands alone — the same keys the settings matrix stores prices under.
    expect(getRateConditions(tiered(PEAK_SURCHARGE_EXPR), t)).toMatchObject([
      { key: 'peak', label: 'Peak Hours' },
      { key: 'offpeak', label: 'Off-Peak Hours' },
    ])
  })

  test('tiers crossed with time variants join both key parts', () => {
    const expr =
      '(len <= 200000 ? tier("standard", p * 3 + c * 15) : tier("long_context", p * 6 + c * 22.5))' +
      ' * (hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12 ? 2 : 1)'
    expect(getRateConditions(tiered(expr), t).map((c) => c.key)).toEqual([
      'standard|peak',
      'standard|offpeak',
      'long_context|peak',
      'long_context|offpeak',
    ])
  })
})

describe('getReferenceLaneKeys', () => {
  test('a tiered expression exposes exactly the lanes it prices', () => {
    expect(
      getReferenceLaneKeys(
        tiered('tier("base", p * 1.6 + c * 4.8 + crx * 0.13 + cc * 2)')
      )
    ).toEqual(['input', 'output', 'cache_creation', 'cache_hit'])
  })

  test('falls back to every lane when nothing maps', () => {
    // An expression priced purely on unmapped quantities (audio) must not
    // collapse the settings matrix to zero columns.
    expect(
      getReferenceLaneKeys(tiered('tier("base", ai * 3 + ao * 6)'))
    ).toEqual([
      'input',
      'output',
      'cached_input',
      'cache_creation',
      'cache_creation_1h',
      'cache_hit',
    ])
  })
})
