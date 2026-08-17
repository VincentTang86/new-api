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

/** A service tier the marketing design names, translates and orders itself. */
interface KnownPriceTier {
  /** Position in the tab strip; the design leads with the reliable tier. */
  order: number
  /** i18n key for the tab label. */
  label: string
  /** i18n key for the sentence shown beside the tab strip. */
  description: string
}

/**
 * The price tiers the public pages know by name.
 *
 * Backend `usable_group` keys are operator-configured free text, so only the
 * tiers the design actually covers can be translated or ordered. Anything else
 * keeps its raw key as the label, carries no description, and sorts after the
 * known tiers in whatever order the backend returned it — an unrecognised
 * group is still a usable tab, just an untranslated one.
 */
const KNOWN_PRICE_TIERS: Record<string, KnownPriceTier> = {
  production: {
    order: 0,
    label: 'Production',
    description: 'Reliable endpoints suitable for production workloads.',
  },
  besteffort: {
    order: 1,
    label: 'Best Effort',
    description:
      'Lower-cost endpoints with best-effort availability, suited for development and testing.',
  },
}

/** Sorts after every known tier while keeping the backend's relative order. */
export const UNKNOWN_PRICE_TIER_ORDER = Number.MAX_SAFE_INTEGER

/**
 * Matches a backend group key against the catalogue, ignoring case and the
 * separators operators write tier names with (`Best Effort`, `best-effort`,
 * `best_effort` are the same tier).
 */
export function lookupPriceTier(groupKey: string): KnownPriceTier | undefined {
  return KNOWN_PRICE_TIERS[groupKey.toLowerCase().replaceAll(/[\s_-]/g, '')]
}
