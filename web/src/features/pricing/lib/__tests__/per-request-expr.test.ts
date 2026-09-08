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

import { MATCH_EQ, MATCH_EXISTS } from '../billing-expr'
import {
  PER_REQUEST_KIND,
  createPerRequestCondition,
  createPerRequestRule,
  generateExprFromPerRequestConfig,
  isPerRequestConfig,
  tryParseAnyVisualConfig,
  tryParsePerRequestConfig,
  type PerRequestConfig,
} from '../per-request-expr'
import { evalExprLocally } from '../tier-expr'

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

function eq(path: string, value: string) {
  return createPerRequestCondition({
    source: 'param',
    path,
    mode: MATCH_EQ,
    value,
  })
}
function exists(path: string) {
  return createPerRequestCondition({
    source: 'param',
    path,
    mode: MATCH_EXISTS,
    value: '',
  })
}

const GROK: PerRequestConfig = {
  kind: PER_REQUEST_KIND,
  defaultLabel: '1k-low',
  defaultPrice: '0.04',
  countByN: true,
  inputImagePrice: '0.01',
  rules: [
    createPerRequestRule({
      label: '2k-medium',
      price: '0.08',
      conditions: [eq('resolution', '2k'), eq('quality', 'medium')],
    }),
    createPerRequestRule({
      label: '2k-medium',
      price: '0.08',
      conditions: [
        eq('resolution', '2k'),
        eq('quality', 'auto'),
        exists('image'),
      ],
    }),
    createPerRequestRule({
      label: '2k-low',
      price: '0.06',
      conditions: [eq('resolution', '2k')],
    }),
    createPerRequestRule({
      label: '1k-medium',
      price: '0.06',
      conditions: [eq('quality', 'medium')],
    }),
  ],
}

const GROK_EXPR =
  '(param("n") == nil ? 1 : param("n")) * (param("resolution") == "2k" && param("quality") == "medium" ? tier("2k-medium", 80000) : param("resolution") == "2k" && param("quality") == "auto" && param("image") != nil ? tier("2k-medium", 80000) : param("resolution") == "2k" ? tier("2k-low", 60000) : param("quality") == "medium" ? tier("1k-medium", 60000) : tier("1k-low", 40000)) + (param("images.#") == nil ? (param("image") != nil ? 1 : 0) : param("images.#")) * 10000'

describe('per-request pricing expressions', () => {
  test('generates the canonical expression', () => {
    expect(generateExprFromPerRequestConfig(GROK)).toBe(GROK_EXPR)
  })

  test('round-trips the canonical expression back into a config', () => {
    const parsed = tryParsePerRequestConfig(GROK_EXPR)
    if (!parsed) {
      throw new Error('canonical expression did not parse')
    }
    expect(parsed.countByN).toBe(true)
    expect(parsed.inputImagePrice).toBe('0.01')
    expect(parsed.defaultLabel).toBe('1k-low')
    expect(parsed.defaultPrice).toBe('0.04')
    expect(
      parsed.rules.map((rule) => [
        rule.label,
        rule.price,
        rule.conditions.length,
      ])
    ).toEqual([
      ['2k-medium', '0.08', 2],
      ['2k-medium', '0.08', 3],
      ['2k-low', '0.06', 1],
      ['1k-medium', '0.06', 1],
    ])
    expect(generateExprFromPerRequestConfig(parsed)).toBe(GROK_EXPR)
  })

  test('flat and count-less forms round-trip too', () => {
    const flat = 'tier("image", 40000)'
    const parsed = tryParsePerRequestConfig(flat)
    if (!parsed) {
      throw new Error('flat expression did not parse')
    }
    expect(parsed.countByN).toBe(false)
    expect(parsed.rules).toEqual([])
    expect(generateExprFromPerRequestConfig(parsed)).toBe(flat)
    expect(isPerRequestConfig(tryParseAnyVisualConfig(flat))).toBe(true)
  })

  test('rejects token expressions and hand-written non-canonical forms', () => {
    expect(tryParsePerRequestConfig('tier("base", p * 5 + c * 30)')).toBeNull()
    expect(
      isPerRequestConfig(
        tryParseAnyVisualConfig('tier("base", p * 5 + c * 30)')
      )
    ).toBe(false)
    expect(
      tryParsePerRequestConfig(
        '(param("n") == nil ? 1 : param("n")) * ((param("resolution") == "2k" || param("resolution") == "2K") ? tier("2k-low", 60000) : tier("1k-low", 40000))'
      )
    ).toBeNull()
  })

  test('the generated expression prices requests as configured', () => {
    const run = (body: unknown) =>
      evalExprLocally(GROK_EXPR, 0, 0, NO_EXTRAS, { body })
    expect(run({ resolution: '2k', quality: 'medium', n: 2 })).toMatchObject({
      cost: 160000,
      matchedTier: '2k-medium',
    })
    expect(
      run({ resolution: '2k', quality: 'auto', image: 'data:' })
    ).toMatchObject({ cost: 90000, matchedTier: '2k-medium' })
    expect(run({ resolution: '2k' })).toMatchObject({
      cost: 60000,
      matchedTier: '2k-low',
    })
    expect(run({ quality: 'medium' })).toMatchObject({
      cost: 60000,
      matchedTier: '1k-medium',
    })
    expect(run({ images: ['a', 'b'] })).toMatchObject({
      cost: 60000,
      matchedTier: '1k-low',
    })
    expect(run(undefined)).toMatchObject({ cost: 40000, matchedTier: '1k-low' })
  })
})
