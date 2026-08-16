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

import type { PricingRow } from '../../types'

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
  'customElements',
  'CSSStyleSheet',
  'HTMLStyleElement',
  'ShadowRoot',
  'DocumentFragment',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

// Bare-global call sites: antd-style (pulled in by the provider icons) calls
// matchMedia at import time, and the router calls scrollTo after navigation.
const boundGlobals = ['matchMedia', 'scrollTo'] as const
for (const key of boundGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: (domWindow[key] as (...args: unknown[]) => unknown).bind(domWindow),
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
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

const { PricingModelList } = await import('../pricing/pricing-model-list')

type PricingListVariant = 'preview' | 'catalogue'

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

// The adapter has already formatted every value; the list only lays them out.
const SAMPLE_ROWS: PricingRow[] = [
  {
    modelId: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    vendorLabel: 'OpenAI',
    isPerRequest: false,
    frInput: '$1.25',
    frOutput: '$5.00',
    officialInput: '$2.50',
    officialOutput: '$10.00',
    savingsInput: '50%',
    savingsOutput: '50%',
  },
  {
    modelId: 'deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'deepseek',
    vendorLabel: 'DeepSeek',
    isPerRequest: false,
    frInput: '$0.55',
    frOutput: '$2.19',
    // No configured list price → official and savings collapse to a dash.
    officialInput: '—',
    officialOutput: '—',
    savingsInput: '—',
    savingsOutput: '—',
  },
]

type Rendered = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

async function renderList(
  rows: readonly PricingRow[],
  variant: PricingListVariant = 'preview'
): Promise<Rendered> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => (
      <PricingModelList rows={rows} variant={variant} benchmark='official' />
    ),
  })
  const modelRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/pricing/$modelId',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, modelRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <RouterProvider router={router as never} />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmountList(rendered: Rendered) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

after(async () => {
  await domWindow.happyDOM.close()
})

describe('PricingModelList', () => {
  test('renders the seven designed columns in order, each a column header', async () => {
    const rendered = await renderList(SAMPLE_ROWS)
    const headers = [...rendered.container.querySelectorAll('thead th')]

    assert.equal(headers.length, 7)
    assert.deepEqual(
      headers.map((th) => th.textContent),
      [
        'Model',
        'FR Input / 1M',
        'FR Output / 1M',
        'Official Input / 1M',
        'Official Output / 1M',
        'Savings',
        // The last column carries the per-row View link and is unlabelled by
        // design.
        '',
      ]
    )
    for (const th of headers) {
      assert.equal(th.getAttribute('scope'), 'col')
    }

    await unmountList(rendered)
  })

  test('ships both responsive presentations, gated by the md breakpoint', async () => {
    // Seven columns cannot fit a phone. The contract is table-above-md /
    // accordion-below-md — not a horizontally scrolling table.
    const rendered = await renderList(SAMPLE_ROWS)

    const tableWrapper = rendered.container.querySelector(
      '[data-slot="pricing-table"]'
    )
    assert.ok(tableWrapper)
    assert.match(tableWrapper?.className ?? '', /\bhidden\b/)
    assert.match(tableWrapper?.className ?? '', /\bmd:block\b/)

    const accordion = rendered.container.querySelector(
      '[data-slot="pricing-accordion"]'
    )
    assert.ok(accordion, 'expected a mobile accordion alongside the table')
    assert.match(accordion?.className ?? '', /\bmd:hidden\b/)

    await unmountList(rendered)
  })

  test('renders one body row per model, with the model name as its row header', async () => {
    const rendered = await renderList(SAMPLE_ROWS)
    const bodyRows = [...rendered.container.querySelectorAll('tbody tr')]

    assert.equal(bodyRows.length, SAMPLE_ROWS.length)
    for (const [index, row] of bodyRows.entries()) {
      const rowHeader = row.querySelector('th')
      assert.equal(rowHeader?.getAttribute('scope'), 'row')
      assert.match(
        rowHeader?.textContent ?? '',
        new RegExp(SAMPLE_ROWS[index].name)
      )
    }

    await unmountList(rendered)
  })

  test('collapses the savings pill to a dash when a row has no savings', async () => {
    // A row the adapter could not compute savings for arrives with dashes in
    // both savings fields; the combined pill must degrade to a single dash.
    const rendered = await renderList(SAMPLE_ROWS)
    const bodyRows = [...rendered.container.querySelectorAll('tbody tr')]

    const withSavings = [...bodyRows[0].querySelectorAll('td')]
    assert.equal(withSavings[4].textContent, 'In 50% · Out 50%')

    const withoutSavings = [...bodyRows[1].querySelectorAll('td')]
    assert.equal(withoutSavings[4].textContent, '—')

    await unmountList(rendered)
  })

  test('renders a fallback instead of an empty table shell', async () => {
    const rendered = await renderList([])

    assert.equal(rendered.container.querySelector('table'), null)
    assert.equal(
      rendered.container.querySelector('[data-slot="pricing-accordion"]'),
      null
    )
    assert.match(
      rendered.container.textContent ?? '',
      /No models are available right now/
    )

    await unmountList(rendered)
  })
})
