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

import { ThemeProvider } from '@/context/theme-provider'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { PublicHeader } from '../public-header'

// The store boots in `loading` until /api/status answers; the header hides the
// auth actions behind a skeleton in that state, so tests start loaded.
useSystemConfigStore.setState({ loading: false })

async function renderHeader(initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })
  queryClient.setQueryData(['status'], null)

  const rootRoute = createRootRoute()
  const paths = ['/', '/pricing', '/sign-in', '/register', '/dashboard']
  const routes = paths.map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: path === initialPath ? () => <PublicHeader /> : () => null,
    })
  )
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })

  let container!: HTMLElement
  await act(async () => {
    container = render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RouterProvider router={router as never} />
        </ThemeProvider>
      </QueryClientProvider>
    ).container
  })

  return container
}

// The router scrolls after navigation and jsdom's scrollTo only logs "not
// implemented"; the pre-Vitest happy-dom bootstrap used to supply a real one.
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

describe('PublicHeader', () => {
  test('renders the five designed nav items, each wired to its destination', async () => {
    const container = await renderHeader()
    const nav = container.querySelector('nav')
    expect(nav).not.toBeNull()

    const links = [...(nav?.querySelectorAll('a') ?? [])].filter((a) =>
      ['Home', 'Models & Pricing', 'Playground', 'Docs', 'Contact Us'].includes(
        a.textContent ?? ''
      )
    )
    expect(links.map((a) => a.textContent)).toEqual([
      'Home',
      'Models & Pricing',
      'Playground',
      'Docs',
      'Contact Us',
    ])

    const disabled = links.filter(
      (a) => a.getAttribute('aria-disabled') === 'true'
    )
    expect(disabled).toEqual([])

    const contact = links.find((a) => a.textContent === 'Contact Us')
    expect(contact?.getAttribute('href')).toBe('/about')

    const playground = links.find((a) => a.textContent === 'Playground')
    expect(playground?.getAttribute('href')).toBe('/playground')

    // Docs is an external link to the configured documentation site.
    const docs = links.find((a) => a.textContent === 'Docs')
    expect(docs?.getAttribute('target')).toBe('_blank')
    expect(docs?.getAttribute('href') ?? '').toMatch(/^https:\/\//)
  })

  test('marks the current page with the active accent', async () => {
    const container = await renderHeader('/pricing')
    const nav = container.querySelector('nav')
    const pricing = [...(nav?.querySelectorAll('a') ?? [])].find(
      (a) => a.textContent === 'Models & Pricing'
    )
    expect(pricing).toBeDefined()
    expect(pricing?.className).toMatch(/font-semibold/)
    expect(pricing?.className).toMatch(/--pd-primary/)
  })

  test('signed-out visitors get Sign in and a gradient Sign up button', async () => {
    const container = await renderHeader()
    const anchors = [...container.querySelectorAll('a')]

    const signIn = anchors.find((a) => a.textContent === 'Sign in')
    expect(signIn).toBeDefined()
    expect(signIn?.getAttribute('href')).toBe('/sign-in')

    const signUp = anchors.find((a) => a.textContent === 'Sign up')
    expect(signUp).toBeDefined()
    expect(signUp?.getAttribute('href')).toBe('/register')
    expect(signUp?.className).toMatch(/--pd-gradient-from/)
  })

  test('the mobile toggle expands the drawer with the same links', async () => {
    const container = await renderHeader()
    // The language menu trigger carries aria-expanded too, so match the
    // hamburger by its accessible name.
    const toggle = [...container.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === 'Toggle navigation menu'
    )
    expect(toggle, 'expected the hamburger toggle').toBeDefined()
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(toggle as HTMLButtonElement)

    expect(toggle?.getAttribute('aria-expanded')).toBe('true')
    // The drawer repeats the nav plus the auth actions.
    const drawerLinks = [...container.querySelectorAll('a')].filter(
      (a) => a.textContent === 'Home'
    )
    expect(drawerLinks.length).toBe(2)
  })
})
