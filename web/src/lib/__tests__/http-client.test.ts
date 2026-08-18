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
import { AxiosError, type AxiosAdapter } from 'axios'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/lib/http-client'
import { useAuthStore, type AuthBundle } from '@/stores/auth-store'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/lib/auth-session', () => ({
  applyAuthRotation: vi.fn(),
  clearAuthentication: vi.fn(),
  refreshAuthentication: vi.fn(async () => ({ kind: 'anonymous' })),
}))

const bundle: AuthBundle = {
  access_token: 'access-token',
  token_type: 'Bearer',
  access_expires_at: Math.floor(Date.now() / 1000) + 600,
  user: {
    id: 42,
    username: 'test-user',
    role: 1,
  },
  session: {
    sid: 'session-a',
    current: true,
    login_method: 'password',
    ip: '127.0.0.1',
    user_agent: 'test',
    created_at: 100,
    last_active_at: 100,
    expires_at: 1000,
  },
}

const unauthorized: AxiosAdapter = (config) =>
  Promise.reject(
    new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
      status: 401,
      statusText: 'Unauthorized',
      data: {},
      headers: {},
      config,
    })
  )

const defaultAdapter = api.defaults.adapter

beforeEach(() => {
  api.defaults.adapter = unauthorized
  // Keep redirectToSignIn from asking jsdom to navigate.
  window.history.pushState({}, '', '/sign-in')
})

afterEach(() => {
  api.defaults.adapter = defaultAdapter
  useAuthStore.getState().auth.reset('idle')
})

describe('unauthorized response handling', () => {
  test('an expired session reports once under a shared toast id', async () => {
    useAuthStore.getState().auth.setBundle(bundle)

    await expect(api.post('/api/user/self')).rejects.toThrow()
    await expect(api.post('/api/user/auth/sessions')).rejects.toThrow()

    expect(toast.error).toHaveBeenCalledTimes(2)
    expect(toast.error).toHaveBeenNthCalledWith(1, 'Session expired!', {
      id: 'auth-session-expired',
    })
    expect(toast.error).toHaveBeenNthCalledWith(2, 'Session expired!', {
      id: 'auth-session-expired',
    })
  })

  test('queries that trail a sign-out fail silently', async () => {
    useAuthStore.getState().auth.reset('complete')

    await expect(api.post('/api/user/self')).rejects.toThrow()
    await expect(api.post('/api/user/auth/sessions')).rejects.toThrow()

    expect(toast.error).not.toHaveBeenCalled()
  })
})
