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

import {
  estimateOfficialCostUSD,
  type OfficialCostUsage,
} from '../official-cost'

function usage(overrides: Partial<OfficialCostUsage> = {}): OfficialCostUsage {
  const base = {
    promptTokens: 0,
    completionTokens: 0,
    cacheTokens: 0,
    cacheCreationTokens: 0,
    ...overrides,
  }
  return {
    ...base,
    // Split rows satisfy prompt + completion === token_used by construction;
    // tests override totalTokens only to model partial (legacy-mixed) rows.
    totalTokens:
      overrides.totalTokens ?? base.promptTokens + base.completionTokens,
  }
}

describe('estimateOfficialCostUSD', () => {
  test('bills every lane at its configured price', () => {
    // 800k uncached at $2 + 200k cache hits at $0.2 + 100k cache writes at
    // $2.5 + 500k completion at $10 = 1.6 + 0.04 + 0.25 + 5 (USD).
    const cost = estimateOfficialCostUSD(
      usage({
        promptTokens: 1_000_000,
        cacheTokens: 200_000,
        cacheCreationTokens: 100_000,
        completionTokens: 500_000,
      }),
      { input: 2, output: 10, cache_hit: 0.2, cache_creation: 2.5 }
    )
    expect(cost).toBeCloseTo(6.89, 10)
  })

  test('falls back from cache_hit to cached_input to input for cached tokens', () => {
    const base = usage({ promptTokens: 1_000_000, cacheTokens: 500_000 })
    expect(
      estimateOfficialCostUSD(base, { input: 2, cached_input: 1 })
    ).toBeCloseTo(1.5, 10)
    expect(estimateOfficialCostUSD(base, { input: 2 })).toBeCloseTo(2, 10)
  })

  test('clamps cached tokens to the prompt total', () => {
    // Defensive: aggregated rows can never bill more cache reads than prompts.
    const cost = estimateOfficialCostUSD(
      usage({ promptTokens: 100, cacheTokens: 500 }),
      { input: 2, cache_hit: 1 }
    )
    expect(cost).toBeCloseTo((100 * 1) / 1_000_000, 15)
  })

  test('returns null when no honest estimate exists', () => {
    // No configured prices at all.
    expect(
      estimateOfficialCostUSD(usage({ promptTokens: 10 }), undefined)
    ).toBeNull()
    // Historical rows: tokens were used but the split columns are all zero.
    expect(
      estimateOfficialCostUSD(usage({ totalTokens: 500 }), {
        input: 2,
        output: 10,
      })
    ).toBeNull()
    // Aggregates mixing legacy (unsplit) and split traffic: the splits cover
    // only part of the token total, so no honest whole-row estimate exists.
    expect(
      estimateOfficialCostUSD(
        usage({ promptTokens: 100, completionTokens: 50, totalTokens: 400 }),
        { input: 2, output: 10 }
      )
    ).toBeNull()
    // A lane with usage but no price to bill it at.
    expect(
      estimateOfficialCostUSD(
        usage({ promptTokens: 10, completionTokens: 10 }),
        { input: 2 }
      )
    ).toBeNull()
    expect(
      estimateOfficialCostUSD(usage({ promptTokens: 10 }), { output: 10 })
    ).toBeNull()
    // Unusable configured values are dropped rather than billed.
    expect(
      estimateOfficialCostUSD(usage({ promptTokens: 10 }), { input: -1 })
    ).toBeNull()
  })
})
