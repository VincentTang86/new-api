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

import { evalExprLocally, exprUsesRequestProbe } from '../tier-expr'

const NO_EXTRAS = {
  cacheReadTokens: 0,
  cacheReadExplicitTokens: 0,
  cacheCreateTokens: 0,
  cacheCreate1hTokens: 0,
  imageTokens: 0,
  imageOutputTokens: 0,
  audioInputTokens: 0,
  audioOutputTokens: 0,
}

const PER_IMAGE_EXPR =
  '(param("n") == nil ? 1 : param("n")) * ((param("resolution") == "2k" || param("resolution") == "2K") ? ((param("quality") == "medium" || (param("quality") == "auto" && (param("image") != nil || param("images") != nil))) ? tier("2k-medium", 80000) : tier("2k-low", 60000)) : ((param("quality") == "medium" || (param("quality") == "auto" && (param("image") != nil || param("images") != nil))) ? tier("1k-medium", 60000) : tier("1k-low", 40000))) + (param("images.#") == nil ? (param("image") != nil ? 1 : 0) : param("images.#")) * 10000'

describe('evalExprLocally with request probes', () => {
  test('evaluates per-image tiers against a sample request body', () => {
    const result = evalExprLocally(PER_IMAGE_EXPR, 0, 0, NO_EXTRAS, {
      body: { resolution: '2k', quality: 'medium', n: 2 },
    })
    expect(result.error).toBeNull()
    expect(result.cost).toBe(160000)
    expect(result.matchedTier).toBe('2k-medium')
  })

  test('falls back to the default tier without a body', () => {
    const result = evalExprLocally(PER_IMAGE_EXPR, 0, 0, NO_EXTRAS)
    expect(result.error).toBeNull()
    expect(result.cost).toBe(40000)
    expect(result.matchedTier).toBe('1k-low')
  })

  test('counts input images through the gjson length path', () => {
    const result = evalExprLocally(PER_IMAGE_EXPR, 0, 0, NO_EXTRAS, {
      body: { quality: 'auto', images: [{ url: 'a' }, { url: 'b' }] },
    })
    expect(result.cost).toBe(80000)
    expect(result.matchedTier).toBe('1k-medium')
  })

  test('reads headers case-insensitively for has()', () => {
    const expr =
      'tier("base", p * 5) * (has(header("Anthropic-Beta"), "fast-mode") ? 6 : 1)'
    const fast = evalExprLocally(expr, 1000, 0, NO_EXTRAS, {
      headers: { 'anthropic-beta': 'fast-mode-2026-02-01' },
    })
    const normal = evalExprLocally(expr, 1000, 0, NO_EXTRAS)
    expect(fast.cost).toBe(30000)
    expect(normal.cost).toBe(5000)
  })

  test('detects request-aware expressions', () => {
    expect(exprUsesRequestProbe(PER_IMAGE_EXPR)).toBe(true)
    expect(exprUsesRequestProbe('tier("base", p * 5 + c * 30)')).toBe(false)
    expect(
      exprUsesRequestProbe('tier("base", p * 5) * (hour("UTC") < 6 ? 0.5 : 1)')
    ).toBe(true)
  })
})
