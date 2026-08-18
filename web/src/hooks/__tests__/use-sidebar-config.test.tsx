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
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import type { NavGroup } from '@/components/layout/types'
import { useAuthStore } from '@/stores/auth-store'

import {
  useIsSidebarModuleVisible,
  useSidebarConfig,
} from '../use-sidebar-config'

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'general',
    title: 'API',
    items: [
      { title: 'Dashboard', url: '/dashboard' },
      { title: 'API Keys', url: '/keys' },
    ],
  },
  {
    id: 'personal',
    title: 'Account',
    items: [
      { title: 'Credits', url: '/wallet' },
      { title: 'Account Settings', url: '/profile' },
    ],
  },
]

function wrapper(status: Record<string, unknown> | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })
  queryClient.setQueryData(['status'], status)

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function signInWith(sidebarModules?: string) {
  useAuthStore.setState((state) => ({
    auth: {
      ...state.auth,
      user: {
        id: 4,
        username: 'fair',
        role: 1,
        sidebar_modules: sidebarModules,
        permissions: { sidebar_settings: true },
      },
    },
  }))
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  useAuthStore.setState((state) => ({ auth: { ...state.auth, user: null } }))
})

describe('useSidebarConfig', () => {
  test('a stored per-user narrowing no longer hides anything', () => {
    // Written by the retired profile card. The UI to undo it is gone, so the
    // console must not keep honoring it.
    signInWith(JSON.stringify({ personal: { enabled: false } }))

    const { result } = renderHook(() => useSidebarConfig(NAV_GROUPS), {
      wrapper: wrapper(null),
    })

    expect(result.current.map((group) => group.id)).toEqual([
      'general',
      'personal',
    ])
    expect(
      result.current
        .find((group) => group.id === 'personal')
        ?.items.map((item) => item.title)
    ).toEqual(['Credits', 'Account Settings'])
  })

  test('the site-wide config still hides what an admin turned off', () => {
    signInWith()

    const { result } = renderHook(() => useSidebarConfig(NAV_GROUPS), {
      wrapper: wrapper({
        SidebarModulesAdmin: JSON.stringify({
          personal: { enabled: true, topup: false, personal: true },
        }),
      }),
    })

    expect(
      result.current
        .find((group) => group.id === 'personal')
        ?.items.map((item) => item.title)
    ).toEqual(['Account Settings'])
  })

  test('an empty or invalid site config falls back to everything visible', () => {
    signInWith()

    for (const value of ['', 'not json']) {
      const { result } = renderHook(() => useSidebarConfig(NAV_GROUPS), {
        wrapper: wrapper({ SidebarModulesAdmin: value }),
      })

      expect(result.current.flatMap((group) => group.items)).toHaveLength(4)
    }
  })
})

describe('useIsSidebarModuleVisible', () => {
  test('follows the site-wide config and ignores the stored per-user value', () => {
    signInWith(JSON.stringify({ personal: { enabled: false } }))

    const visible = renderHook(() => useIsSidebarModuleVisible('/wallet'), {
      wrapper: wrapper(null),
    })
    expect(visible.result.current).toBe(true)

    const hiddenByAdmin = renderHook(
      () => useIsSidebarModuleVisible('/wallet'),
      {
        wrapper: wrapper({
          SidebarModulesAdmin: JSON.stringify({
            personal: { enabled: true, topup: false },
          }),
        }),
      }
    )
    expect(hiddenByAdmin.result.current).toBe(false)
  })
})
