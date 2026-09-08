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
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { PricingModel } from '@/features/pricing/types'

const usePricingData = vi.fn()

vi.mock('@/features/pricing/hooks/use-pricing-data', () => ({
  usePricingData: () => usePricingData(),
}))

vi.mock('@/hooks/use-system-config', () => ({
  useSystemConfig: () => ({ systemName: 'FairRouter' }),
}))

// The drawer host fetches its own model; the preview's tabs do not depend on
// it.
vi.mock('@/features/pricing/components/model-details-drawer-host', () => ({
  ModelDetailsDrawerHost: () => null,
}))

const { LandingPricingPreview } = await import('../sections/pricing-preview')

const LLM_MODEL = {
  id: 1,
  model_name: 'gpt-5',
  vendor_name: 'OpenAI',
  quota_type: 0,
  model_ratio: 0.625,
  completion_ratio: 8,
  enable_groups: ['all'],
} as PricingModel

const IMAGE_MODEL = {
  id: 2,
  model_name: 'grok-imagine-image-2.0',
  vendor_name: 'xAI',
  quota_type: 0,
  model_ratio: 0,
  completion_ratio: 0,
  enable_groups: ['all'],
  output_modalities: ['image'],
  image_prices: [{ size: '1K·Low', price: 0.08 }],
  official_price: { per_image: [{ size: '1K·Low', price: 0.04 }] },
} as PricingModel

async function renderPreview(): Promise<void> {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    validateSearch: (search: Record<string, unknown>) => ({
      model: typeof search.model === 'string' ? search.model : undefined,
    }),
    component: LandingPricingPreview,
  })
  // "View all models" links into the catalogue with the tab it should open
  // on, so the route under test has to accept that param as the real one does.
  const pricingRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/pricing',
    validateSearch: (search: Record<string, unknown>) => ({
      model: typeof search.model === 'string' ? search.model : undefined,
      type: search.type === 'image' ? ('image' as const) : undefined,
    }),
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, pricingRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  await act(async () => {
    render(<RouterProvider router={router as never} />)
  })
}

beforeEach(() => {
  usePricingData.mockReset()
  usePricingData.mockReturnValue({
    models: [LLM_MODEL, IMAGE_MODEL],
    usableGroup: { Production: { desc: 'reliable', ratio: 1 } },
    groupRatio: { Production: 1 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

describe('LandingPricingPreview', () => {
  test('opens on the token table and links to the catalogue as is', async () => {
    await renderPreview()

    expect(screen.getAllByText('gpt-5').length).toBeGreaterThan(0)
    expect(screen.queryByText('grok-imagine-image-2.0')).toBeNull()
    expect(
      screen.getByRole('link', { name: /View all models/ })
    ).toHaveAttribute('href', '/pricing')
  })

  test('the Image tab lists image models per image, like the catalogue page', async () => {
    await renderPreview()
    const user = userEvent.setup()

    await user.click(screen.getByRole('tab', { name: 'Image' }))

    expect(
      screen.getAllByText('grok-imagine-image-2.0').length
    ).toBeGreaterThan(0)
    expect(screen.queryByText('gpt-5')).toBeNull()
    expect(screen.getAllByText('from ~$0.08 / image').length).toBeGreaterThan(0)
    expect(screen.getAllByText('from ~$0.04 / image').length).toBeGreaterThan(0)
    // The catalogue opens on the same tab the visitor was reading.
    expect(
      screen.getByRole('link', { name: /View all models/ })
    ).toHaveAttribute('href', '/pricing?type=image')
  })

  test('the Image tab keeps its headers when it lists nothing', async () => {
    // A tier or vendor with no image models used to take the column headers
    // with it; the table now stays and carries the note in its body.
    usePricingData.mockReturnValue({
      models: [LLM_MODEL],
      usableGroup: { Production: { desc: 'reliable', ratio: 1 } },
      groupRatio: { Production: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    await renderPreview()
    const user = userEvent.setup()

    await user.click(screen.getByRole('tab', { name: 'Image' }))

    expect(
      screen.getByRole('columnheader', { name: 'FR Price' })
    ).toBeInTheDocument()
    expect(
      screen.getAllByText('No models are available right now.').length
    ).toBeGreaterThan(0)
  })
})
