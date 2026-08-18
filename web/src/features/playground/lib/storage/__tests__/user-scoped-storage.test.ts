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
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { STORAGE_KEY_PREFIXES } from '../../../constants'
import type { Message } from '../../../types'
import {
  loadConfig,
  loadMessages,
  loadParameterEnabled,
  removeLegacyPlaygroundStorage,
  saveConfig,
  saveMessages,
  saveParameterEnabled,
} from '../storage'
import { MAX_STORED_MESSAGES_BYTES, STORAGE_VERSION } from '../storage-schema'

const ACCOUNT_A = 4
const ACCOUNT_B = 7

function message(key: string, content: string): Message {
  return {
    key,
    from: 'user',
    versions: [{ id: `${key}-v1`, content }],
  } as Message
}

function messagesKey(userId: number): string {
  return `${STORAGE_KEY_PREFIXES.MESSAGES}:${userId}`
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('per-account playground storage', () => {
  test('one account never loads another account conversation', () => {
    saveMessages(ACCOUNT_A, [message('a1', 'quota error from account A')])

    expect(loadMessages(ACCOUNT_B)).toBeNull()
    expect(loadMessages(ACCOUNT_A)?.[0].versions[0].content).toBe(
      'quota error from account A'
    )
  })

  test('config and parameter toggles are scoped the same way', () => {
    saveConfig(ACCOUNT_A, { model: 'model-a', stream: false })
    saveParameterEnabled(ACCOUNT_A, { max_tokens: true })

    expect(loadConfig(ACCOUNT_B)).toEqual({})
    expect(loadParameterEnabled(ACCOUNT_B)).toEqual({})
    expect(loadConfig(ACCOUNT_A).model).toBe('model-a')
    expect(loadParameterEnabled(ACCOUNT_A).max_tokens).toBe(true)
  })

  test('legacy account-agnostic keys are dropped, not inherited', () => {
    // Shape written by the pre-scoping build.
    window.localStorage.setItem(
      STORAGE_KEY_PREFIXES.MESSAGES,
      JSON.stringify({
        version: STORAGE_VERSION,
        data: [message('legacy', 'left behind by whoever was signed in')],
      })
    )
    window.localStorage.setItem(
      STORAGE_KEY_PREFIXES.CONFIG,
      JSON.stringify({ version: STORAGE_VERSION, data: { model: 'legacy' } })
    )
    window.localStorage.setItem(
      STORAGE_KEY_PREFIXES.PARAMETER_ENABLED,
      JSON.stringify({ version: STORAGE_VERSION, data: { seed: true } })
    )

    removeLegacyPlaygroundStorage()

    expect(
      window.localStorage.getItem(STORAGE_KEY_PREFIXES.MESSAGES)
    ).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY_PREFIXES.CONFIG)).toBeNull()
    expect(
      window.localStorage.getItem(STORAGE_KEY_PREFIXES.PARAMETER_ENABLED)
    ).toBeNull()
    expect(loadMessages(ACCOUNT_A)).toBeNull()
    expect(loadConfig(ACCOUNT_A)).toEqual({})
  })

  test('a bucket over the size cap is discarded on load', () => {
    window.localStorage.setItem(
      messagesKey(ACCOUNT_A),
      'x'.repeat(MAX_STORED_MESSAGES_BYTES + 1)
    )

    expect(loadMessages(ACCOUNT_A)).toBeNull()
    expect(window.localStorage.getItem(messagesKey(ACCOUNT_A))).toBeNull()
  })

  test('a full quota evicts other accounts, never the signed-in one', () => {
    saveMessages(ACCOUNT_B, [message('b1', 'account B history')])

    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementationOnce(() => {
        throw new DOMException('quota', 'QuotaExceededError')
      })

    saveMessages(ACCOUNT_A, [message('a1', 'account A history')])
    setItem.mockRestore()

    expect(loadMessages(ACCOUNT_A)?.[0].versions[0].content).toBe(
      'account A history'
    )
    expect(window.localStorage.getItem(messagesKey(ACCOUNT_B))).toBeNull()
  })
})
