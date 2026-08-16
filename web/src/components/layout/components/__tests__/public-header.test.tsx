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
import { after, describe, test } from 'node:test'

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
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
  'localStorage',
  'customElements',
  'CSSStyleSheet',
  'HTMLStyleElement',
  'ShadowRoot',
  'DocumentFragment',
  'KeyboardEvent',
  'MouseEvent',
  'PointerEvent',
  'FocusEvent',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const boundGlobals = ['matchMedia', 'scrollTo'] as const
for (const key of boundGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: (domWindow[key] as (...args: unknown[]) => unknown).bind(domWindow),
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} = await import('@tanstack/react-router')

const i18n = createInstance()
await i18n.use(initReactI18next).init({ lng: 'en', resources: { en: {} } })

const { ThemeProvider } = await import('@/context/theme-provider')
const { useSystemConfigStore } = await import('@/stores/system-config-store')
const { PublicHeader } = await import('../public-header')

// The store boots in `loading` until /api/status answers; the header hides the
// auth actions behind a skeleton in that state, so tests start loaded.
useSystemConfigStore.setState({ loading: false })

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

async function renderHeader(initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })
  queryClient.setQueryData(['status'], null)

  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

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

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider>
            <RouterProvider router={router as never} />
          </ThemeProvider>
        </I18nextProvider>
      </QueryClientProvider>
    )
  })

  return {
    container,
    async cleanup() {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

after(async () => {
  await domWindow.happyDOM.close()
})

describe('PublicHeader', () => {
  test('renders the five designed nav items, each wired to its destination', async () => {
    const rendered = await renderHeader()
    const nav = rendered.container.querySelector('nav')
    assert.ok(nav)

    const links = [...nav.querySelectorAll('a')].filter((a) =>
      ['Home', 'Models & Pricing', 'Playground', 'Docs', 'Contact Us'].includes(
        a.textContent ?? ''
      )
    )
    assert.deepEqual(
      links.map((a) => a.textContent),
      ['Home', 'Models & Pricing', 'Playground', 'Docs', 'Contact Us']
    )

    const disabled = links.filter(
      (a) => a.getAttribute('aria-disabled') === 'true'
    )
    assert.deepEqual(disabled, [])

    const contact = links.find((a) => a.textContent === 'Contact Us')
    assert.equal(contact?.getAttribute('href'), '/about')

    const playground = links.find((a) => a.textContent === 'Playground')
    assert.equal(playground?.getAttribute('href'), '/playground')

    // Docs is an external link to the configured documentation site.
    const docs = links.find((a) => a.textContent === 'Docs')
    assert.equal(docs?.getAttribute('target'), '_blank')
    assert.match(docs?.getAttribute('href') ?? '', /^https:\/\//)

    await rendered.cleanup()
  })

  test('marks the current page with the active accent', async () => {
    const rendered = await renderHeader('/pricing')
    const nav = rendered.container.querySelector('nav')
    const pricing = [...(nav?.querySelectorAll('a') ?? [])].find(
      (a) => a.textContent === 'Models & Pricing'
    )
    assert.ok(pricing)
    assert.match(pricing.className, /font-semibold/)
    assert.match(pricing.className, /--pd-primary/)

    await rendered.cleanup()
  })

  test('signed-out visitors get Sign in and a gradient Sign up button', async () => {
    const rendered = await renderHeader()
    const anchors = [...rendered.container.querySelectorAll('a')]

    const signIn = anchors.find((a) => a.textContent === 'Sign in')
    assert.ok(signIn)
    assert.equal(signIn.getAttribute('href'), '/sign-in')

    const signUp = anchors.find((a) => a.textContent === 'Sign up')
    assert.ok(signUp)
    assert.equal(signUp.getAttribute('href'), '/register')
    assert.match(signUp.className, /--pd-gradient-from/)

    await rendered.cleanup()
  })

  test('the mobile toggle expands the drawer with the same links', async () => {
    const rendered = await renderHeader()
    // The language menu trigger carries aria-expanded too, so match the
    // hamburger by its accessible name.
    const toggle = [...rendered.container.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === 'Toggle navigation menu'
    )
    assert.ok(toggle, 'expected the hamburger toggle')
    assert.equal(toggle.getAttribute('aria-expanded'), 'false')

    await act(async () => {
      toggle.click()
    })
    assert.equal(toggle.getAttribute('aria-expanded'), 'true')
    // The drawer repeats the nav plus the auth actions.
    const drawerLinks = [...rendered.container.querySelectorAll('a')].filter(
      (a) => a.textContent === 'Home'
    )
    assert.equal(drawerLinks.length, 2)

    await rendered.cleanup()
  })
})
