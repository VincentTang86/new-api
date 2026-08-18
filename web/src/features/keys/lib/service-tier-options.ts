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
import type { TFunction } from 'i18next'

import {
  lookupServiceTier,
  UNKNOWN_SERVICE_TIER_ORDER,
} from '@/lib/service-tier'

/** One selectable service tier card in the API key form. */
export interface ServiceTierOption {
  value: string
  /** Translated tier name for known tiers, else the raw group name. */
  label: string
  description?: string
  /** Translated pricing badge; known tiers only, the ratio badge covers the rest. */
  pricingLabel?: string
  ratio?: number | string
}

export type UserGroupMap = Record<
  string,
  { desc?: string; ratio?: number | string }
>

/**
 * Turns the backend usable groups into the tier cards, translated and ordered
 * for the tiers the design names.
 *
 * Group descriptions are operator-managed display copy that drifts from the
 * group it names (dev once described `Production` as 默认分组), so a known tier
 * shows the product's own wording and only an unrecognised group falls back to
 * the configured description.
 */
export function buildServiceTierOptions(
  groups: UserGroupMap | undefined,
  t: TFunction
): ServiceTierOption[] {
  const entries = Object.entries(groups ?? {}).map(([value, info]) => ({
    value,
    info,
    order: lookupServiceTier(value)?.order ?? UNKNOWN_SERVICE_TIER_ORDER,
  }))
  // Stable sort, so unknown tiers keep the backend's relative order.
  entries.sort((a, b) => a.order - b.order)

  return entries.map((entry) => {
    const known = lookupServiceTier(entry.value)
    const configuredDesc = entry.info.desc?.trim()
    const fallbackDesc =
      configuredDesc && configuredDesc !== entry.value
        ? configuredDesc
        : undefined

    return {
      value: entry.value,
      label: known ? t(known.label) : entry.value,
      description: known ? t(known.workloadBlurb) : fallbackDesc,
      pricingLabel: known ? t(known.pricingBadge) : undefined,
      ratio: entry.info.ratio,
    }
  })
}

/**
 * The tier a new API key opens on: Auto when the deployment defaults to it,
 * otherwise the leading known tier (Production before Best Effort), and only
 * then the deployment's own groups.
 */
export function pickDefaultServiceTier(
  options: ServiceTierOption[],
  preferAuto: boolean
): string {
  if (preferAuto && options.some((option) => option.value === 'auto')) {
    return 'auto'
  }

  const ordinaryTiers = options.filter((option) => option.value !== 'auto')
  const knownTier = ordinaryTiers.find((option) =>
    lookupServiceTier(option.value)
  )
  if (knownTier) return knownTier.value

  const defaultTier = ordinaryTiers.find((option) => option.value === 'default')
  return defaultTier?.value ?? ordinaryTiers[0]?.value ?? ''
}
