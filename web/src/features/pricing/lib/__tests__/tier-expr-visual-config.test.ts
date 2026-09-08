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
  generateExprFromVisualConfig,
  tryParseVisualConfig,
} from '../tier-expr'

const PER_IMAGE_EXPR =
  '(param("n") == nil ? 1 : param("n")) * ((param("resolution") == "2k") ? tier("2k-low", 60000) : tier("1k-low", 40000)) + (param("images.#") == nil ? 0 : param("images.#")) * 10000'

describe('tryParseVisualConfig', () => {
  test('round-trips a plain token expression', () => {
    const config = tryParseVisualConfig('tier("base", p * 5 + c * 30 + cr * 2)')
    expect(config).not.toBeNull()
    expect(generateExprFromVisualConfig(config)).toBe(
      'tier("base", p * 5 + c * 30 + cr * 2)'
    )
  })

  test('rejects expressions the visual editor cannot represent', () => {
    // Per-image pricing keyed on request fields has no token coefficients;
    // parsing it into zeroed tiers would let the editor overwrite it.
    expect(tryParseVisualConfig(PER_IMAGE_EXPR)).toBeNull()
    expect(tryParseVisualConfig('p * 0 + c * 0')).toBeNull()
    expect(tryParseVisualConfig('')).toBeNull()
  })
})
