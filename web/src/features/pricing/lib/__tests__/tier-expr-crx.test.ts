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
  evalExprLocally,
  generateExprFromVisualConfig,
  normalizeVisualTier,
  tryParseVisualConfig,
} from '../tier-expr'

// DashScope dual cache-hit pricing: crx (explicit cache read) must survive the
// visual-config roundtrip and evaluate in the local estimator.
describe('tier-expr crx support', () => {
  test('visual config with explicit cache read price generates and re-parses to the same config', () => {
    const config = {
      tiers: [
        normalizeVisualTier({
          label: 'base',
          conditions: [],
          input_unit_cost: 2,
          output_unit_cost: 6,
          cache_read_unit_cost: 0.25,
          cache_read_explicit_unit_cost: 0.17,
          cache_create_unit_cost: 2.5,
        }),
      ],
    }
    const expr = generateExprFromVisualConfig(config)
    expect(expr).toContain('crx * 0.17')

    const parsed = tryParseVisualConfig(expr)
    expect(parsed).not.toBeNull()
    expect(parsed!.tiers[0].cache_read_unit_cost).toBe(0.25)
    expect(parsed!.tiers[0].cache_read_explicit_unit_cost).toBe(0.17)
    expect(parsed!.tiers[0].cache_create_unit_cost).toBe(2.5)
  })

  test('expression without crx still parses with explicit read cost defaulting to zero', () => {
    const parsed = tryParseVisualConfig(
      'tier("base", p * 2 + c * 6 + cr * 0.25)'
    )
    expect(parsed).not.toBeNull()
    expect(parsed!.tiers[0].cache_read_unit_cost).toBe(0.25)
    expect(parsed!.tiers[0].cache_read_explicit_unit_cost).toBe(0)
  })

  test('estimator evaluates crx tokens at the explicit cache read price', () => {
    const result = evalExprLocally(
      'tier("base", p * 2 + c * 6 + cr * 0.25 + crx * 0.17 + cc * 2.5)',
      14,
      34,
      {
        cacheReadTokens: 0,
        cacheReadExplicitTokens: 3550,
        cacheCreateTokens: 0,
        cacheCreate1hTokens: 0,
        imageTokens: 0,
        imageOutputTokens: 0,
        audioInputTokens: 0,
        audioOutputTokens: 0,
      }
    )
    expect(result.error).toBeNull()
    expect(result.matchedTier).toBe('base')
    expect(result.cost).toBeCloseTo(14 * 2 + 34 * 6 + 3550 * 0.17, 6)
  })
})
