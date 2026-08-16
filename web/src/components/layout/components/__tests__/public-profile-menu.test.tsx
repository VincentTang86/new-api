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

const boundGlobals = ['matchMedia', 'scrollTo', 'setTimeout', 'clearTimeout']
for (const key of boundGlobals) {
  const value = (domWindow as unknown as Record<string, unknown>)[key]
  if (typeof value === 'function') {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: (value as (...args: unknown[]) => unknown).bind(domWindow),
    })
  }
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

const { useAuthStore } = await import('@/stores/auth-store')
const { PublicProfileMenu } = await import('../public-profile-menu')

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

/** The console destinations the design wires the menu to. */
const MENU_TARGETS = [
  '/dashboard',
  '/keys',
  '/usage-logs',
  '/usage-logs/task',
  '/wallet',
  '/profile',
]

function seedUser() {
  useAuthStore.setState((state) => ({
    auth: {
      ...state.auth,
      user: {
        id: 1,
        username: 'jdoe',
        display_name: 'John Doe',
        email: 'jdoe@example.com',
        role: 1,
        quota: 500000,
      } as never,
    },
  }))
}

async function renderMenu() {
  seedUser()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })

  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

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

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <RouterProvider router={router as never} />
        </I18nextProvider>
      </QueryClientProvider>
    )
  })

  return {
    container,
    router,
    async open() {
      const trigger = container.querySelector('button')
      assert.ok(trigger, 'expected the avatar pill trigger')
      await act(async () => {
        trigger.dispatchEvent(
          new domWindow.MouseEvent('mouseover', {
            bubbles: true,
          }) as unknown as globalThis.Event
        )
      })
    },
    async cleanup() {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

after(async () => {
  await domWindow.happyDOM.close()
})

describe('PublicProfileMenu', () => {
  test('the pill shows the display name and opens on hover with the designed items', async () => {
    const rendered = await renderMenu()

    assert.match(rendered.container.textContent ?? '', /John Doe/)

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
      assert.match(menuText, new RegExp(label), `missing menu item: ${label}`)
    }
    // The user block carries name and email, per the design.
    assert.match(menuText, /jdoe@example\.com/)

    await rendered.cleanup()
  })

  test('the console shortcut navigates to /dashboard', async () => {
    const rendered = await renderMenu()
    await rendered.open()

    const items = [...document.querySelectorAll('[role="menuitem"]')]
    const consoleItem = items.find((item) =>
      /Console/.test(item.textContent ?? '')
    ) as HTMLElement | undefined
    assert.ok(consoleItem, 'expected a Console menu item')

    await act(async () => {
      consoleItem.click()
    })
    assert.equal(rendered.router.state.location.pathname, '/dashboard')

    await rendered.cleanup()
  })
})
