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

/** A service tier the product names, translates and orders itself. */
interface KnownServiceTier {
  /** Position wherever tiers are listed; the design leads with the reliable tier. */
  order: number
  /** i18n key for the tier name. */
  label: string
  /** i18n key for the sentence shown beside the public pricing tier strip. */
  pricingBlurb: string
  /** i18n key for the sentence shown on the API key tier card. */
  workloadBlurb: string
  /** i18n key for the badge naming how the tier is priced. */
  pricingBadge: string
  /** Priced below the regular tier — carries the "Lower cost" badge. */
  lowerCost: boolean
}

/**
 * The service tiers the product knows by name.
 *
 * Backend `usable_group` keys are operator-configured free text, so only the
 * tiers the design actually covers can be translated or ordered. Anything else
 * keeps its raw key as the label, carries no blurb, and sorts after the known
 * tiers in whatever order the backend returned it — an unrecognised group is
 * still a usable tier, just an untranslated one.
 */
const KNOWN_SERVICE_TIERS: Record<string, KnownServiceTier> = {
  production: {
    order: 0,
    label: 'Production',
    pricingBlurb: 'Reliable endpoints suitable for production workloads.',
    workloadBlurb: 'Higher-reliability endpoints for production workloads.',
    pricingBadge: 'Regular pricing',
    lowerCost: false,
  },
  besteffort: {
    order: 1,
    label: 'Best Effort',
    pricingBlurb:
      'Lower-cost endpoints with best-effort availability, suited for development and testing.',
    workloadBlurb:
      'Lower-cost endpoints for development, testing, and non-critical workloads.',
    pricingBadge: 'Discounted pricing',
    lowerCost: true,
  },
}

/** Sorts after every known tier while keeping the backend's relative order. */
export const UNKNOWN_SERVICE_TIER_ORDER = Number.MAX_SAFE_INTEGER

/**
 * Matches a backend group key against the catalogue, ignoring case and the
 * separators operators write tier names with (`Best Effort`, `best-effort`,
 * `best_effort` are the same tier).
 */
export function lookupServiceTier(
  groupKey: string
): KnownServiceTier | undefined {
  return KNOWN_SERVICE_TIERS[groupKey.toLowerCase().replaceAll(/[\s_-]/g, '')]
}
