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
import { beforeEach, describe, expect, test } from 'vitest'

import { usePublicNavLinks } from '../use-public-nav-links'

function renderProbe(status: Record<string, unknown> | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })
  queryClient.setQueryData(['status'], status)

  const { result } = renderHook(() => usePublicNavLinks(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
  return result.current
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('usePublicNavLinks', () => {
  test('ships the five designed items, all navigable', () => {
    const links = renderProbe(null)

    expect(links.map((link) => link.title)).toEqual([
      'Home',
      'Models & Pricing',
      'Playground',
      'Docs',
      'Contact Us',
    ])
    // Playground navigates (its authenticated route guard sends signed-out
    // visitors to /sign-in by itself); Docs opens the configured docs site;
    // Contact Us routes to the About page.
    expect(links.map((link) => Boolean(link.disabled))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ])
    const contact = links.find((link) => link.title === 'Contact Us')
    expect(contact?.href).toBe('/about')
  })

  test('docs routes to the configured documentation link, external', () => {
    const links = renderProbe({ docs_link: 'https://docs.fairrouter.ai' })
    const docs = links.find((link) => link.title === 'Docs')
    expect(docs?.href).toBe('https://docs.fairrouter.ai')
    expect(docs?.external).toBe(true)

    // Unset falls back to the project documentation.
    const fallback = renderProbe(null)
    const fallbackDocs = fallback.find((link) => link.title === 'Docs')
    expect(fallbackDocs?.href).toBe('https://docs.newapi.pro')
  })

  test('home and pricing keep honoring the HeaderNavModules switches', () => {
    const links = renderProbe({
      HeaderNavModules: JSON.stringify({
        home: false,
        pricing: { enabled: false, requireAuth: false },
      }),
    })

    // The admin hid both configurable items; the placeholders remain.
    expect(links.map((link) => link.title)).toEqual([
      'Playground',
      'Docs',
      'Contact Us',
    ])
  })

  test('pricing carries requiresAuth for signed-out visitors when configured', () => {
    const links = renderProbe({
      HeaderNavModules: JSON.stringify({
        pricing: { enabled: true, requireAuth: true },
      }),
    })

    const pricing = links.find((link) => link.href === '/pricing')
    expect(pricing).toBeDefined()
    expect(pricing?.requiresAuth).toBe(true)
  })
})
