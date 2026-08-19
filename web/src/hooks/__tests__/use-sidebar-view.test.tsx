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
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { AdminCapabilities } from '@/lib/admin-permissions'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { useSidebarView } from '../use-sidebar-view'

/**
 * Render useSidebarView for one account and report what the sidebar would show.
 */
async function sidebarFor(
  role: number,
  adminPermissions?: AdminCapabilities
): Promise<{ groupIds: string[]; adminUrls: string[] }> {
  useAuthStore.setState((state) => ({
    auth: {
      ...state.auth,
      user: {
        id: 1,
        username: 'probe',
        role,
        permissions: adminPermissions
          ? { admin_permissions: adminPermissions }
          : undefined,
      } as never,
    },
  }))

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })
  queryClient.setQueryData(['status'], null)

  let groupIds: string[] = []
  let adminUrls: string[] = []

  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: function Probe() {
      const { navGroups } = useSidebarView()
      groupIds = navGroups.map((group) => group.id ?? '')
      adminUrls =
        navGroups
          .find((group) => group.id === 'admin')
          ?.items.map((item) => ('url' in item ? String(item.url) : '')) ?? []
      return null
    },
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  await act(async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router as never} />
      </QueryClientProvider>
    )
  })

  return { groupIds, adminUrls }
}

// The router scrolls after navigation and jsdom's scrollTo only logs "not
// implemented".
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  useAuthStore.setState((state) => ({ auth: { ...state.auth, user: null } }))
})

describe('useSidebarView identity gating', () => {
  test('an ordinary member gets no administration group at all', async () => {
    const { groupIds } = await sidebarFor(ROLE.USER)

    expect(groupIds).toEqual(['chat', 'general', 'personal'])
  })

  test('an admin without the channel grant sees neither channels nor the super-admin entries', async () => {
    const { groupIds, adminUrls } = await sidebarFor(ROLE.ADMIN)

    expect(groupIds).toContain('admin')
    // System settings is super-admin only: its route guard redirects a plain
    // admin to /403, so offering the entry would only be a dead end.
    expect(adminUrls).toEqual([
      '/models/metadata',
      '/users',
      '/usage-analytics/flow',
      '/redemption-codes',
      '/subscriptions',
    ])
  })

  test('an admin granted channel read gets the channels entry', async () => {
    const { adminUrls } = await sidebarFor(ROLE.ADMIN, {
      channel: { read: true },
    })

    expect(adminUrls).toContain('/channels')
  })

  test('a super admin sees every administration entry without any grant', async () => {
    const { adminUrls } = await sidebarFor(ROLE.SUPER_ADMIN)

    expect(adminUrls).toEqual([
      '/channels',
      '/models/metadata',
      '/users',
      '/usage-analytics/flow',
      '/redemption-codes',
      '/subscriptions',
      '/system-info',
      '/system-settings/site',
    ])
  })
})
