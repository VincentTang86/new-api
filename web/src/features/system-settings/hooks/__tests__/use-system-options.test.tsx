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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import * as api from '../../api'
import { useSystemOptions } from '../use-system-options'

function renderFor(role: number) {
  useAuthStore.setState((state) => ({
    auth: { ...state.auth, user: { id: 1, username: 'probe', role } as never },
  }))

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return renderHook(() => useSystemOptions(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
}

afterEach(() => {
  useAuthStore.setState((state) => ({ auth: { ...state.auth, user: null } }))
})

describe('useSystemOptions', () => {
  test('does not request the root-only endpoint for an admin', async () => {
    // GET /api/option/ is behind RootAuth. Requesting it as an admin only
    // produced a "permission denied" toast on the models and subscriptions
    // pages, which render for admins.
    const getSystemOptions = vi.spyOn(api, 'getSystemOptions')

    const { result } = renderFor(ROLE.ADMIN)

    expect(getSystemOptions).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  test('requests it for a super admin', async () => {
    const getSystemOptions = vi
      .spyOn(api, 'getSystemOptions')
      .mockResolvedValue({ success: true, message: '', data: [] } as never)

    renderFor(ROLE.SUPER_ADMIN)

    await waitFor(() => expect(getSystemOptions).toHaveBeenCalled())
  })
})
