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
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { PricingModel } from '@/features/pricing/types'

const usePricingData = vi.fn()

vi.mock('@/features/pricing/hooks/use-pricing-data', () => ({
  usePricingData: () => usePricingData(),
}))

// The benchmark supplement is a separate fetch; the tier tabs do not depend on
// it, so it resolves empty here.
vi.mock('../official-pricing', () => ({
  fetchOfficialPricing: () => Promise.resolve({}),
}))

// The tier catalogue translates through i18next; assert against the keys.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}))

const { useLandingPricingRows } = await import('../use-landing-pricing-rows')

function model(name: string, groups: string[]): PricingModel {
  return {
    id: 1,
    model_name: name,
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: groups,
  } as PricingModel
}

function mockPricing(
  usableGroup: Record<string, { desc: string; ratio: number }>,
  groupRatio: Record<string, number>,
  models: PricingModel[]
) {
  usePricingData.mockReturnValue({
    models,
    usableGroup,
    groupRatio,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
}

function renderRows() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return renderHook(() => useLandingPricingRows(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}

describe('useLandingPricingRows tier tabs', () => {
  beforeEach(() => {
    usePricingData.mockReset()
  })

  test('leads with Production even when the backend returns it second', async () => {
    // The backend hands back an object; its key order is whatever the operator
    // configured, and the design still opens on the reliable tier.
    mockPricing(
      {
        'Best Effort': { desc: 'cheap', ratio: 0.76 },
        Production: { desc: 'reliable', ratio: 1 },
      },
      { 'Best Effort': 0.76, Production: 1 },
      [model('gpt-5', ['all'])]
    )

    const { result } = renderRows()

    await waitFor(() => expect(result.current.groups).toHaveLength(2))
    expect(result.current.groups.map((group) => group.key)).toEqual([
      'Production',
      'Best Effort',
    ])
    expect(result.current.selectedGroup).toBe('Production')
  })

  test('translates known tiers and carries their blurb', async () => {
    mockPricing(
      {
        Production: { desc: 'ignored', ratio: 1 },
        'best-effort': { desc: 'ignored', ratio: 0.76 },
      },
      { Production: 1, 'best-effort': 0.76 },
      [model('gpt-5', ['all'])]
    )

    const { result } = renderRows()

    await waitFor(() => expect(result.current.groups).toHaveLength(2))
    const [production, bestEffort] = result.current.groups
    expect(production.label).toBe('Production')
    expect(production.description).toBe(
      'Reliable endpoints suitable for production workloads.'
    )
    // Separators and case do not stop a tier from being recognised.
    expect(bestEffort.label).toBe('Best Effort')
    expect(bestEffort.lowerCost).toBe(true)
  })

  test('keeps unrecognised tiers raw, undescribed and last', async () => {
    mockPricing(
      {
        vip: { desc: 'operator tier', ratio: 2 },
        Production: { desc: 'reliable', ratio: 1 },
        svip: { desc: 'operator tier', ratio: 3 },
      },
      { vip: 2, Production: 1, svip: 3 },
      [model('gpt-5', ['all'])]
    )

    const { result } = renderRows()

    await waitFor(() => expect(result.current.groups).toHaveLength(3))
    expect(result.current.groups.map((group) => group.key)).toEqual([
      'Production',
      'vip',
      'svip',
    ])
    expect(result.current.groups[1].description).toBeUndefined()
    expect(result.current.groups[1].label).toBe('vip')
  })

  test('drops tiers that would render an empty table', async () => {
    mockPricing(
      {
        Production: { desc: 'reliable', ratio: 1 },
        'Best Effort': { desc: 'cheap', ratio: 0.76 },
      },
      { Production: 1, 'Best Effort': 0.76 },
      [model('gpt-5', ['Production'])]
    )

    const { result } = renderRows()

    await waitFor(() => expect(result.current.groups).toHaveLength(1))
    expect(result.current.groups[0].key).toBe('Production')
  })
})
