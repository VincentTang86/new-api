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
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { PricingRow } from '../../types'
import { PricingModelList } from '../pricing/pricing-model-list'

type PricingListVariant = 'preview' | 'catalogue'

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

async function renderList(
  rows: readonly PricingRow[],
  variant: PricingListVariant = 'preview'
): Promise<HTMLElement> {
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

  let container!: HTMLElement
  await act(async () => {
    container = render(<RouterProvider router={router as never} />).container
  })

  return container
}

// The router scrolls after navigation and jsdom's scrollTo only logs "not
// implemented"; the pre-Vitest happy-dom bootstrap used to supply a real one.
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

describe('PricingModelList', () => {
  test('renders the seven designed columns in order, each a column header', async () => {
    const container = await renderList(SAMPLE_ROWS)
    const headers = [...container.querySelectorAll('thead th')]

    expect(headers.length).toBe(7)
    expect(headers.map((th) => th.textContent)).toEqual([
      'Model',
      'FR Input / 1M',
      'FR Output / 1M',
      'Official Input / 1M',
      'Official Output / 1M',
      'Savings',
      // The last column carries the per-row View link and is unlabelled by
      // design.
      '',
    ])
    for (const th of headers) {
      expect(th.getAttribute('scope')).toBe('col')
    }
  })

  test('ships both responsive presentations, gated by the md breakpoint', async () => {
    // Seven columns cannot fit a phone. The contract is table-above-md /
    // accordion-below-md — not a horizontally scrolling table.
    const container = await renderList(SAMPLE_ROWS)

    const tableWrapper = container.querySelector('[data-slot="pricing-table"]')
    expect(tableWrapper).not.toBeNull()
    expect(tableWrapper?.className ?? '').toMatch(/\bhidden\b/)
    expect(tableWrapper?.className ?? '').toMatch(/\bmd:block\b/)

    const accordion = container.querySelector('[data-slot="pricing-accordion"]')
    expect(
      accordion,
      'expected a mobile accordion alongside the table'
    ).not.toBeNull()
    expect(accordion?.className ?? '').toMatch(/\bmd:hidden\b/)
  })

  test('renders one body row per model, with the model name as its row header', async () => {
    const container = await renderList(SAMPLE_ROWS)
    const bodyRows = [...container.querySelectorAll('tbody tr')]

    expect(bodyRows.length).toBe(SAMPLE_ROWS.length)
    for (const [index, row] of bodyRows.entries()) {
      const rowHeader = row.querySelector('th')
      expect(rowHeader?.getAttribute('scope')).toBe('row')
      expect(rowHeader?.textContent ?? '').toMatch(
        new RegExp(SAMPLE_ROWS[index].name)
      )
    }
  })

  test('collapses the savings pill to a dash when a row has no savings', async () => {
    // A row the adapter could not compute savings for arrives with dashes in
    // both savings fields; the combined pill must degrade to a single dash.
    const container = await renderList(SAMPLE_ROWS)
    const bodyRows = [...container.querySelectorAll('tbody tr')]

    const withSavings = [...bodyRows[0].querySelectorAll('td')]
    expect(withSavings[4].textContent).toBe('In 50% · Out 50%')

    const withoutSavings = [...bodyRows[1].querySelectorAll('td')]
    expect(withoutSavings[4].textContent).toBe('—')
  })

  test('renders a fallback instead of an empty table shell', async () => {
    const container = await renderList([])

    expect(container.querySelector('table')).toBe(null)
    expect(container.querySelector('[data-slot="pricing-accordion"]')).toBe(
      null
    )
    expect(container.textContent ?? '').toMatch(
      /No models are available right now/
    )
  })
})
