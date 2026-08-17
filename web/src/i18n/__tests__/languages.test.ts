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
  INTERFACE_LANGUAGE_OPTIONS,
  normalizeInterfaceLanguage,
} from '../languages'

describe('interface language options', () => {
  test('English leads and the Chinese variants close the list', () => {
    // Product requirement shared by the public pages and the console:
    // English first (it is also the first-visit default), 中文 last.
    const codes = INTERFACE_LANGUAGE_OPTIONS.map((option) => option.code)
    expect(codes[0]).toBe('en')
    expect(codes.slice(-2)).toEqual(['zhCN', 'zhTW'])
  })

  test('every option carries the compact badge the public header shows', () => {
    for (const option of INTERFACE_LANGUAGE_OPTIONS) {
      expect(
        option.short.length,
        `${option.code} needs a short badge`
      ).toBeGreaterThan(0)
    }
  })

  test('unknown and empty values normalize to the English default', () => {
    expect(normalizeInterfaceLanguage(undefined)).toBe('en')
    expect(normalizeInterfaceLanguage('')).toBe('en')
    expect(normalizeInterfaceLanguage('klingon')).toBe('en')
  })

  test('legacy BCP-47 values stored by older builds still resolve', () => {
    expect(normalizeInterfaceLanguage('zh-CN')).toBe('zhCN')
    expect(normalizeInterfaceLanguage('zh-TW')).toBe('zhTW')
  })
})
