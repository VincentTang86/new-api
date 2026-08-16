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
  INTERFACE_LANGUAGE_OPTIONS,
  normalizeInterfaceLanguage,
} from '../languages'

describe('interface language options', () => {
  test('English leads and the Chinese variants close the list', () => {
    // Product requirement shared by the public pages and the console:
    // English first (it is also the first-visit default), 中文 last.
    const codes = INTERFACE_LANGUAGE_OPTIONS.map((option) => option.code)
    assert.equal(codes[0], 'en')
    assert.deepEqual(codes.slice(-2), ['zhCN', 'zhTW'])
  })

  test('every option carries the compact badge the public header shows', () => {
    for (const option of INTERFACE_LANGUAGE_OPTIONS) {
      assert.ok(option.short.length > 0, `${option.code} needs a short badge`)
    }
  })

  test('unknown and empty values normalize to the English default', () => {
    assert.equal(normalizeInterfaceLanguage(undefined), 'en')
    assert.equal(normalizeInterfaceLanguage(''), 'en')
    assert.equal(normalizeInterfaceLanguage('klingon'), 'en')
  })

  test('legacy BCP-47 values stored by older builds still resolve', () => {
    assert.equal(normalizeInterfaceLanguage('zh-CN'), 'zhCN')
    assert.equal(normalizeInterfaceLanguage('zh-TW'), 'zhTW')
  })
})
