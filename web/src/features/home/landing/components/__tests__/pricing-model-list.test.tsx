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
    context: '128K',
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
    context: '64K',
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
    component: () => <PricingModelList rows={rows} variant={variant} />,
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
  test('renders the nine designed columns in order, each a column header', async () => {
    const rendered = await renderList(SAMPLE_ROWS)
    const headers = [...rendered.container.querySelectorAll('thead th')]

    assert.equal(headers.length, 9)
    assert.deepEqual(
      headers.map((th) => th.textContent),
      [
        'Model',
        'Input / 1M',
        'Output / 1M',
        'Official input / 1M',
        'Official output / 1M',
        'Input savings',
        'Output savings',
        'Context',
        // The last column carries the per-row Details link and is unlabelled
        // by design.
        '',
      ]
    )
    for (const th of headers) {
      assert.equal(th.getAttribute('scope'), 'col')
    }

    await unmountList(rendered)
  })

  test('ships both responsive presentations, gated by the md breakpoint', async () => {
    // Nine columns cannot fit a phone. The contract is table-above-md /
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

  test('renders the pre-formatted dash when a row has no savings', async () => {
    // A row the adapter could not compute savings for arrives with a dash in
    // both savings cells; the list must render it verbatim, not blank.
    const rendered = await renderList(SAMPLE_ROWS)
    const bodyRows = [...rendered.container.querySelectorAll('tbody tr')]
    const cells = [...bodyRows[1].querySelectorAll('td')]

    assert.equal(cells[4].textContent, '—')
    assert.equal(cells[5].textContent, '—')

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
