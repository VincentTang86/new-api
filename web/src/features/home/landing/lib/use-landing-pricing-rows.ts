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
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import {
  lookupServiceTier,
  UNKNOWN_SERVICE_TIER_ORDER,
} from '@/lib/service-tier'

import { LANDING_PROVIDER_ORDER } from '../constants'
import type { LandingProviderKey, PricingBenchmark, PricingRow } from '../types'
import { buildPricingRows } from './build-pricing-rows'
import { fetchOfficialPricing } from './official-pricing'
import { LANDING_PROVIDERS } from './providers'

/** One tab of the group (price tier) selector. */
export interface PricingGroupOption {
  key: string
  /** Translated tier name for known tiers, else the raw group name. */
  label: string
  /** Translated tier blurb; absent for tiers outside the design's catalogue. */
  description?: string
  ratio: number
  /** Cheaper than the most expensive tier — carries the "Lower cost" badge. */
  lowerCost: boolean
}

/** One tab of the vendor filter row. */
export interface PricingProviderOption {
  key: LandingProviderKey
  label: string
}

export type PricingProviderFilter = LandingProviderKey | 'all'

interface UseLandingPricingRows {
  rows: PricingRow[]
  groups: PricingGroupOption[]
  selectedGroup: string
  setSelectedGroup: (group: string) => void
  benchmark: PricingBenchmark
  setBenchmark: (benchmark: PricingBenchmark) => void
  providers: PricingProviderOption[]
  providerFilter: PricingProviderFilter
  setProviderFilter: (filter: PricingProviderFilter) => void
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

/** Groups that are not real price tiers and never become tabs. */
const EXCLUDED_GROUP_KEYS = new Set(['', 'auto'])

/**
 * Public-page pricing table state: rows driven live by `/api/pricing`, priced
 * at the selected group's ratio and compared against the selected external
 * benchmark (vendor list price or OpenRouter, from the hand-maintained
 * `official-pricing.json`). Shared by the home preview and the models &
 * pricing page so the two never drift — each page instantiates its own tab
 * state.
 *
 * Only `/api/pricing` can fail the table: `fetchOfficialPricing` resolves to an
 * empty map when the supplement is missing, which renders as dashes in the
 * benchmark / savings columns. Both loads gate the skeleton so a row is never
 * painted with dashes that then flip to a price.
 */
export function useLandingPricingRows(): UseLandingPricingRows {
  const { t, i18n } = useTranslation()
  const { models, usableGroup, groupRatio, isLoading, error, refetch } =
    usePricingData()
  const [groupChoice, setGroupChoice] = useState<string | null>(null)
  const [benchmark, setBenchmark] = useState<PricingBenchmark>('official')
  const [providerFilter, setProviderFilter] =
    useState<PricingProviderFilter>('all')

  const { data: catalog, isLoading: isCatalogLoading } = useQuery({
    queryKey: ['official-pricing'],
    queryFn: fetchOfficialPricing,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const groups = useMemo<PricingGroupOption[]>(() => {
    // A model enabled for "all" belongs to every group (backend convention).
    const hasModels = (key: string) =>
      models.some((model) => {
        const enableGroups = Array.isArray(model.enable_groups)
          ? model.enable_groups
          : []
        return enableGroups.includes('all') || enableGroups.includes(key)
      })
    const options = Object.entries(usableGroup)
      .filter(([key]) => !EXCLUDED_GROUP_KEYS.has(key))
      // A tier tab whose table would always be empty is noise, not a choice.
      .filter(([key]) => hasModels(key))
      .map(([key]) => {
        // Product decision: the tier tab shows the group NAME, never the
        // usable_group description — translated here for the tiers the design
        // names, raw for the ones it does not.
        const known = lookupServiceTier(key)
        return {
          key,
          label: known ? t(known.label) : key,
          description: known ? t(known.pricingBlurb) : undefined,
          order: known?.order ?? UNKNOWN_SERVICE_TIER_ORDER,
          ratio:
            typeof groupRatio[key] === 'number' &&
            Number.isFinite(groupRatio[key])
              ? groupRatio[key]
              : 1,
        }
      })
      // Stable sort, so unknown tiers keep the backend's relative order.
      .sort((a, b) => a.order - b.order)
    const maxRatio = options.reduce(
      (max, option) => Math.max(max, option.ratio),
      Number.NEGATIVE_INFINITY
    )
    return options.map((option) => ({
      key: option.key,
      label: option.label,
      description: option.description,
      ratio: option.ratio,
      lowerCost: option.ratio < maxRatio,
    }))
  }, [usableGroup, groupRatio, models, t])

  // An explicit choice wins while it exists; otherwise take the leading tab, so
  // the tier the design puts first is also the one that opens selected.
  // Derived (not an effect) so the selection self-heals when the group list
  // changes under it.
  const selectedGroup = useMemo(() => {
    if (groupChoice && groups.some((group) => group.key === groupChoice)) {
      return groupChoice
    }
    return groups[0]?.key ?? ''
  }, [groupChoice, groups])

  const allRows = useMemo(
    () =>
      buildPricingRows({
        models,
        language: i18n.language,
        catalog: catalog ?? {},
        selectedGroup,
        groupRatio,
        benchmark,
      }),
    [models, i18n.language, catalog, selectedGroup, groupRatio, benchmark]
  )

  // Vendor tabs list only the vendors present in the selected group, in the
  // marketing order, so an empty filter can never be selected.
  const providers = useMemo<PricingProviderOption[]>(() => {
    const present = new Set(allRows.map((row) => row.provider))
    return LANDING_PROVIDER_ORDER.filter((key) => present.has(key)).map(
      (key) => ({ key, label: LANDING_PROVIDERS[key].label })
    )
  }, [allRows])

  const rows = useMemo(() => {
    if (providerFilter === 'all') return allRows
    return allRows.filter((row) => row.provider === providerFilter)
  }, [allRows, providerFilter])

  return {
    rows,
    groups,
    selectedGroup,
    setSelectedGroup: setGroupChoice,
    benchmark,
    setBenchmark,
    providers,
    providerFilter,
    setProviderFilter,
    isLoading: isLoading || isCatalogLoading,
    isError: Boolean(error),
    refetch,
  }
}
