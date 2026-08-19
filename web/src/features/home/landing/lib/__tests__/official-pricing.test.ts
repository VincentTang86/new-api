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

import { buildOfficialPricingCatalog } from '../official-pricing'

function model(overrides: Partial<PricingModel>): PricingModel {
  return {
    id: 1,
    model_name: 'demo-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['all'],
    ...overrides,
  } as PricingModel
}

describe('buildOfficialPricingCatalog', () => {
  test('maps both benchmark sources onto the catalogue entry', () => {
    const catalog = buildOfficialPricingCatalog([
      model({
        model_name: 'gpt-4o',
        official_price: { input: 2.5, output: 10 },
        openrouter_price: { input: 3, output: 12 },
      }),
    ])

    expect(catalog['gpt-4o']).toEqual({
      officialInput: 2.5,
      officialOutput: 10,
      openrouterInput: 3,
      openrouterOutput: 12,
    })
  })

  test('drops unusable prices field by field, keeping the rest of the entry', () => {
    // A negative / zero / non-finite list price would make the savings maths
    // dishonest, so those fields vanish and the columns fall back to a dash.
    const catalog = buildOfficialPricingCatalog([
      model({
        model_name: 'a-model',
        official_price: { input: -1, output: 10 },
        openrouter_price: { input: 0, output: Number.NaN },
      }),
    ])

    expect(catalog['a-model']).toEqual({ officialOutput: 10 })
  })

  test('omits models without any usable reference price', () => {
    const catalog = buildOfficialPricingCatalog([
      model({ model_name: 'no-benchmark' }),
      model({ model_name: 'null-lanes', official_price: { input: null } }),
      model({ model_name: 'priced', official_price: { input: 1 } }),
    ])

    expect(Object.keys(catalog)).toEqual(['priced'])
  })
})
