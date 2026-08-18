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
import { act, fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { PublicProfileMenu } from '../public-profile-menu'

/** The console destinations the design wires the menu to. */
const MENU_TARGETS = [
  '/dashboard',
  '/keys',
  '/usage-logs',
  '/usage-logs/task',
  '/wallet',
  '/profile',
  '/system-settings/site/$section',
]

function seedUser(role: number) {
  useAuthStore.setState((state) => ({
    auth: {
      ...state.auth,
      user: {
        id: 1,
        username: 'jdoe',
        display_name: 'John Doe',
        email: 'jdoe@example.com',
        role,
        quota: 500000,
      } as never,
    },
  }))
}

async function renderMenu(role: number = ROLE.USER) {
  seedUser(role)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })

  const rootRoute = createRootRoute()
  const routes = [
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => <PublicProfileMenu />,
    }),
    ...MENU_TARGETS.map((path) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path,
        component: () => null,
      })
    ),
  ]
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  let container!: HTMLElement
  await act(async () => {
    container = render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router as never} />
      </QueryClientProvider>
    ).container
  })

  return {
    container,
    router,
    async open() {
      const trigger = container.querySelector('button')
      expect(trigger, 'expected the avatar pill trigger').not.toBeNull()
      await act(async () => {
        fireEvent.mouseOver(trigger as HTMLButtonElement)
      })
    },
  }
}

// The router scrolls after navigation and jsdom's scrollTo only logs "not
// implemented"; the pre-Vitest happy-dom bootstrap used to supply a real one.
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

describe('PublicProfileMenu', () => {
  test('the pill shows the display name and opens on hover with the designed items', async () => {
    const rendered = await renderMenu()

    expect(rendered.container.textContent ?? '').toMatch(/John Doe/)

    await rendered.open()
    const menuText = document.body.textContent ?? ''
    for (const label of [
      'Console',
      'API Keys',
      'Request Logs',
      'Async Tasks',
      'Credits',
      'Account Settings',
      'Sign out',
    ]) {
      expect(menuText, `missing menu item: ${label}`).toMatch(new RegExp(label))
    }
    // The user block carries name and email, per the design.
    expect(menuText).toMatch(/jdoe@example\.com/)
  })

  test('hides the system settings row from a non-admin', async () => {
    const rendered = await renderMenu()
    await rendered.open()

    expect(document.body.textContent ?? '').not.toMatch(/System Settings/)
  })

  test('offers a super admin the system settings row', async () => {
    const rendered = await renderMenu(ROLE.SUPER_ADMIN)
    await rendered.open()

    const settingsItem = [
      ...document.querySelectorAll('[role="menuitem"]'),
    ].find((item) => /System Settings/.test(item.textContent ?? '')) as
      | HTMLElement
      | undefined
    expect(settingsItem, 'expected a System Settings menu item').toBeDefined()

    await act(async () => {
      fireEvent.click(settingsItem as HTMLElement)
    })
    expect(rendered.router.state.location.pathname).toBe(
      '/system-settings/site/system-info'
    )
  })

  test('the console shortcut navigates to /dashboard', async () => {
    const rendered = await renderMenu()
    await rendered.open()

    const items = [...document.querySelectorAll('[role="menuitem"]')]
    const consoleItem = items.find((item) =>
      /Console/.test(item.textContent ?? '')
    ) as HTMLElement | undefined
    expect(consoleItem, 'expected a Console menu item').toBeDefined()

    await act(async () => {
      fireEvent.click(consoleItem as HTMLElement)
    })
    expect(rendered.router.state.location.pathname).toBe('/dashboard')
  })
})
