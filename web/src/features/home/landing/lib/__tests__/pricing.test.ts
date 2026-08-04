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

import {
  LANDING_PRICE_PLACEHOLDER,
  calculateSavingsRatio,
  formatInputPrice,
  formatOutputPrice,
  formatSavingsPercent,
} from '../pricing'

describe('calculateSavingsRatio', () => {
  test('returns the discount fraction when we are cheaper', () => {
    assert.equal(calculateSavingsRatio(1.25, 2.5), 0.5)
    assert.equal(calculateSavingsRatio(0.8, 1.6), 0.5)
  })

  test('returns null when the vendor list price is missing', () => {
    // A zero baseline would make the ratio Infinity and render "Infinity%".
    assert.equal(calculateSavingsRatio(1.25, 0), null)
    assert.equal(calculateSavingsRatio(0, 0), null)
    assert.equal(calculateSavingsRatio(1.25, -1), null)
  })

  test('returns null when we are not actually cheaper', () => {
    // Equal prices (DeepSeek R1 in the current table) must not claim "0% off",
    // and a higher price must never render as a negative saving.
    assert.equal(calculateSavingsRatio(2.19, 2.19), null)
    assert.equal(calculateSavingsRatio(3, 2.5), null)
  })

  test('returns null for non-finite input', () => {
    assert.equal(calculateSavingsRatio(Number.NaN, 2.5), null)
    assert.equal(calculateSavingsRatio(1.25, Number.POSITIVE_INFINITY), null)
  })
})

describe('formatInputPrice', () => {
  test('keeps three decimals below a dollar so sub-cent rates stay legible', () => {
    assert.equal(formatInputPrice(0.075), '$0.075')
    assert.equal(formatInputPrice(0.5), '$0.500')
  })

  test('drops to two decimals from a dollar up', () => {
    assert.equal(formatInputPrice(1), '$1.00')
    assert.equal(formatInputPrice(1.25), '$1.25')
    assert.equal(formatInputPrice(10.5), '$10.50')
  })

  test('renders a placeholder for unusable values', () => {
    assert.equal(formatInputPrice(-1), LANDING_PRICE_PLACEHOLDER)
    assert.equal(formatInputPrice(Number.NaN), LANDING_PRICE_PLACEHOLDER)
  })
})

describe('formatOutputPrice', () => {
  test('always renders two decimals', () => {
    assert.equal(formatOutputPrice(0.5), '$0.50')
    assert.equal(formatOutputPrice(5), '$5.00')
    assert.equal(formatOutputPrice(10), '$10.00')
  })

  test('renders a placeholder for unusable values', () => {
    assert.equal(formatOutputPrice(-1), LANDING_PRICE_PLACEHOLDER)
    assert.equal(formatOutputPrice(Number.NaN), LANDING_PRICE_PLACEHOLDER)
  })
})

describe('formatSavingsPercent', () => {
  test('formats a ratio as a whole percentage', () => {
    assert.equal(formatSavingsPercent(0.5, 'en'), '50%')
    assert.equal(formatSavingsPercent(0.482, 'en'), '48%')
  })

  test('accepts the repo language codes that Intl rejects', () => {
    // new Intl.NumberFormat('zhCN') throws RangeError; toIntlLocale maps it.
    assert.equal(formatSavingsPercent(0.5, 'zhCN'), '50%')
    assert.equal(formatSavingsPercent(0.5, 'zhTW'), '50%')
  })

  test('renders a placeholder rather than a zero or negative saving', () => {
    assert.equal(formatSavingsPercent(0, 'en'), LANDING_PRICE_PLACEHOLDER)
    assert.equal(formatSavingsPercent(-0.2, 'en'), LANDING_PRICE_PLACEHOLDER)
  })
})
