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
import { useMemo } from 'react'

import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import type { PricingModel } from '@/features/pricing/types'

import { LANDING_PROVIDER_ORDER } from '../constants'
import { resolveProviderKey } from './build-pricing-rows'
import { LANDING_PROVIDERS } from './providers'

export interface LandingModelSummary {
  /**
   * How many models the catalog serves this visitor, or null while that is not
   * known — still loading, the request failed, or the pricing module is gated
   * behind login. Null means the copy must not state a number at all.
   */
  count: number | null
  /** Vendor brand names present in the catalog, in the hero logo-row order. */
  providers: string[]
}

/**
 * Reduce the served catalog to the two facts the marketing copy states: how
 * many models there are, and whose. An empty catalog yields a null count so the
 * copy degrades to a count-free sentence rather than claiming zero models.
 *
 * Vendors follow the hero logo-row order, not the catalog order, so the FAQ
 * sentence and the logo row read the same way. A model whose vendor cannot be
 * resolved still counts — it is served, it just has no brand to name.
 */
export function summarizeLandingModels(
  models: readonly PricingModel[]
): LandingModelSummary {
  if (models.length === 0) return { count: null, providers: [] }

  const present = new Set(
    models.map((model) =>
      resolveProviderKey(model.vendor_name, model.model_name)
    )
  )
  return {
    count: models.length,
    providers: LANDING_PROVIDER_ORDER.filter((key) => present.has(key)).map(
      (key) => LANDING_PROVIDERS[key].label
    ),
  }
}

/**
 * Live model count and vendor list for the marketing copy, read from the same
 * `/api/pricing` query that drives the pricing table — React Query dedupes on
 * the shared key, so the hero and FAQ add no extra request.
 *
 * The feed is filtered by the visitor's usable groups and the route can require
 * login (`HeaderNavModuleAuth('pricing')`), so an empty result is a normal
 * outcome rather than a bug: callers fall back to count-free copy instead of
 * printing a number that may not match what the visitor can actually call.
 */
export function useLandingModelSummary(): LandingModelSummary {
  const { models, isLoading, error } = usePricingData()

  return useMemo(
    () =>
      isLoading || error
        ? { count: null, providers: [] }
        : summarizeLandingModels(models),
    [models, isLoading, error]
  )
}
