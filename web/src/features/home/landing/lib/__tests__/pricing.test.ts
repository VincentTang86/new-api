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
  formatInputPrice,
  formatOutputPrice,
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

  test('returns null for non-finite input', () => {
    expect(calculateSavingsRatio(Number.NaN, 2.5)).toBe(null)
    expect(calculateSavingsRatio(1.25, Number.POSITIVE_INFINITY)).toBe(null)
  })
})

describe('formatInputPrice', () => {
  test('keeps three decimals below a dollar so sub-cent rates stay legible', () => {
    expect(formatInputPrice(0.075)).toBe('$0.075')
    expect(formatInputPrice(0.5)).toBe('$0.500')
  })

  test('drops to two decimals from a dollar up', () => {
    expect(formatInputPrice(1)).toBe('$1.00')
    expect(formatInputPrice(1.25)).toBe('$1.25')
    expect(formatInputPrice(10.5)).toBe('$10.50')
  })

  test('renders a placeholder for unusable values', () => {
    expect(formatInputPrice(-1)).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(formatInputPrice(Number.NaN)).toBe(LANDING_PRICE_PLACEHOLDER)
  })
})

describe('formatOutputPrice', () => {
  test('always renders two decimals', () => {
    expect(formatOutputPrice(0.5)).toBe('$0.50')
    expect(formatOutputPrice(5)).toBe('$5.00')
    expect(formatOutputPrice(10)).toBe('$10.00')
  })

  test('renders a placeholder for unusable values', () => {
    expect(formatOutputPrice(-1)).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(formatOutputPrice(Number.NaN)).toBe(LANDING_PRICE_PLACEHOLDER)
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
