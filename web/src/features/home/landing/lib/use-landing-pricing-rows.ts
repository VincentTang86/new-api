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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'

import type { PricingRow } from '../types'
import { buildPricingRows } from './build-pricing-rows'
import { fetchOfficialPricing } from './official-pricing'

interface UseLandingPricingRows {
  rows: PricingRow[]
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

/**
 * Public-page pricing rows, driven live by `/api/pricing` and merged with the
 * hand-maintained `official-pricing.json`. Shared by the home preview and the
 * models & pricing page so the two never drift.
 *
 * Only `/api/pricing` can fail the table: `fetchOfficialPricing` resolves to an
 * empty map when the supplement is missing, which renders as dashes in the
 * official / savings columns. Both loads gate the skeleton so a row is never
 * painted with dashes that then flip to a price.
 */
export function useLandingPricingRows(): UseLandingPricingRows {
  const { i18n } = useTranslation()
  const { models, isLoading, error, refetch } = usePricingData()

  const { data: catalog, isLoading: isCatalogLoading } = useQuery({
    queryKey: ['official-pricing'],
    queryFn: fetchOfficialPricing,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const rows = useMemo(
    () =>
      buildPricingRows({
        models,
        language: i18n.language,
        catalog: catalog ?? {},
      }),
    [models, i18n.language, catalog]
  )

  return {
    rows,
    isLoading: isLoading || isCatalogLoading,
    isError: Boolean(error),
    refetch,
  }
}
