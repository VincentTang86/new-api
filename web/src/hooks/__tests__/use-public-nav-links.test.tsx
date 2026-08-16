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
import { after, beforeEach, describe, test } from 'node:test'

import { Window } from 'happy-dom'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
  'localStorage',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')

const i18n = createInstance()
await i18n.use(initReactI18next).init({ lng: 'en', resources: { en: {} } })

const { usePublicNavLinks } = await import('../use-public-nav-links')
type TopNavLink = ReturnType<typeof usePublicNavLinks>[number]

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

let captured: TopNavLink[] = []

function Probe() {
  captured = usePublicNavLinks()
  return null
}

async function renderProbe(status: Record<string, unknown> | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })
  queryClient.setQueryData(['status'], status)

  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <Probe />
        </I18nextProvider>
      </QueryClientProvider>
    )
  })
  await act(async () => root.unmount())
  container.remove()
  return captured
}

beforeEach(() => {
  window.localStorage.clear()
})

after(async () => {
  await domWindow.happyDOM.close()
})

describe('usePublicNavLinks', () => {
  test('ships the five designed items, all navigable', async () => {
    const links = await renderProbe(null)

    assert.deepEqual(
      links.map((link) => link.title),
      ['Home', 'Models & Pricing', 'Playground', 'Docs', 'Contact Us']
    )
    // Playground navigates (its authenticated route guard sends signed-out
    // visitors to /sign-in by itself); Docs opens the configured docs site;
    // Contact Us routes to the About page.
    assert.deepEqual(
      links.map((link) => Boolean(link.disabled)),
      [false, false, false, false, false]
    )
    const contact = links.find((link) => link.title === 'Contact Us')
    assert.equal(contact?.href, '/about')
  })

  test('docs routes to the configured documentation link, external', async () => {
    const links = await renderProbe({ docs_link: 'https://docs.fairrouter.ai' })
    const docs = links.find((link) => link.title === 'Docs')
    assert.equal(docs?.href, 'https://docs.fairrouter.ai')
    assert.equal(docs?.external, true)

    // Unset falls back to the project documentation.
    const fallback = await renderProbe(null)
    const fallbackDocs = fallback.find((link) => link.title === 'Docs')
    assert.equal(fallbackDocs?.href, 'https://docs.newapi.pro')
  })

  test('home and pricing keep honoring the HeaderNavModules switches', async () => {
    const links = await renderProbe({
      HeaderNavModules: JSON.stringify({
        home: false,
        pricing: { enabled: false, requireAuth: false },
      }),
    })

    // The admin hid both configurable items; the placeholders remain.
    assert.deepEqual(
      links.map((link) => link.title),
      ['Playground', 'Docs', 'Contact Us']
    )
  })

  test('pricing carries requiresAuth for signed-out visitors when configured', async () => {
    const links = await renderProbe({
      HeaderNavModules: JSON.stringify({
        pricing: { enabled: true, requireAuth: true },
      }),
    })

    const pricing = links.find((link) => link.href === '/pricing')
    assert.ok(pricing)
    assert.equal(pricing?.requiresAuth, true)
  })
})
