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
  LANDING_PRICE_PLACEHOLDER,
  calculateSavingsRatio,
  formatLandingPrice,
  formatSavingsPercent,
} from '../pricing'

describe('calculateSavingsRatio', () => {
  test('returns the discount fraction when we are cheaper', () => {
    expect(calculateSavingsRatio(1.25, 2.5)).toBe(0.5)
    expect(calculateSavingsRatio(0.8, 1.6)).toBe(0.5)
  })

  test('returns null when the vendor list price is missing', () => {
    // A zero baseline would make the ratio Infinity and render "Infinity%".
    expect(calculateSavingsRatio(1.25, 0)).toBe(null)
    expect(calculateSavingsRatio(0, 0)).toBe(null)
    expect(calculateSavingsRatio(1.25, -1)).toBe(null)
  })

  test('returns null when we are not actually cheaper', () => {
    // Equal prices (DeepSeek R1 in the current table) must not claim "0% off",
    // and a higher price must never render as a negative saving.
    expect(calculateSavingsRatio(2.19, 2.19)).toBe(null)
    expect(calculateSavingsRatio(3, 2.5)).toBe(null)
  })

  test('returns null for a gap that rounds away to "0%"', () => {
    // 0.4% off would render as "0%" beside two prices that clearly differ.
    expect(calculateSavingsRatio(2.49, 2.5)).toBe(null)
    // 0.5% is the first gap worth stating; it renders as "1%".
    expect(calculateSavingsRatio(2.4875, 2.5)).toBeCloseTo(0.005)
  })

  test('returns null for non-finite input', () => {
    expect(calculateSavingsRatio(Number.NaN, 2.5)).toBe(null)
    expect(calculateSavingsRatio(1.25, Number.POSITIVE_INFINITY)).toBe(null)
  })
})

describe('formatLandingPrice', () => {
  test.each<[number, string]>([
    // Every configured digit survives — the reported bug was 0.7875 landing in
    // the table as "$0.787".
    [0.7875, '$0.7875'],
    [0.787, '$0.787'],
    [0.000016, '$0.000016'],
    // Cents stay the floor, however round the rate is.
    [1, '$1.00'],
    [1.25, '$1.25'],
    [10.5, '$10.50'],
    [75, '$75.00'],
    // Zeros past that floor are noise: a rate configured as 0.16 reads back as
    // "$0.16", not "$0.160", and both price columns agree on it.
    [0.16, '$0.16'],
    [0.32, '$0.32'],
    [0.02, '$0.02'],
    [0.5, '$0.50'],
    // A price is a ratio x 2 x group-ratio product, so it arrives carrying
    // float drift that must not surface as digits.
    [0.7875 * 0.9, '$0.70875'],
    [0.1 + 0.2, '$0.30'],
    // The ratios are themselves stored snapped to twelve decimals, so the
    // product can drift past the twelfth decimal: kimi-k3's $2.60 input times a
    // completion ratio of 4.942307692308 read as "$12.850000000001".
    [1.3 * 2 * 4.942307692308, '$12.85'],
    [15.000000000001 * 2 * 2.5, '$75.00'],
    // Finer than twelve decimals is unstatable, but still not free.
    [1e-15, '<$0.000000000001'],
    [0, '$0.00'],
  ])('formats %p as %p', (value, expected) => {
    expect(formatLandingPrice(value)).toBe(expected)
  })

  test('renders a placeholder for unusable values', () => {
    expect(formatLandingPrice(undefined)).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(formatLandingPrice(-1)).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(formatLandingPrice(Number.NaN)).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(formatLandingPrice(Number.POSITIVE_INFINITY)).toBe(
      LANDING_PRICE_PLACEHOLDER
    )
  })
})

describe('formatSavingsPercent', () => {
  test('formats a ratio as a whole percentage', () => {
    expect(formatSavingsPercent(0.5, 'en')).toBe('50%')
    expect(formatSavingsPercent(0.482, 'en')).toBe('48%')
  })

  test('accepts the repo language codes that Intl rejects', () => {
    // new Intl.NumberFormat('zhCN') throws RangeError; toIntlLocale maps it.
    expect(formatSavingsPercent(0.5, 'zhCN')).toBe('50%')
    expect(formatSavingsPercent(0.5, 'zhTW')).toBe('50%')
  })

  test('renders a placeholder rather than a zero or negative saving', () => {
    expect(formatSavingsPercent(0, 'en')).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(formatSavingsPercent(-0.2, 'en')).toBe(LANDING_PRICE_PLACEHOLDER)
  })
})
