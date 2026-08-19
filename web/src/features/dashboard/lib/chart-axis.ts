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
import { parseQuotaFromDollars } from '@/lib/format'

import type { UsageMetric } from '../types'

// Six ticks put the placeholder maximum on a round step for every metric.
export const EMPTY_AXIS_TICK_COUNT = 6

/**
 * Placeholder left-axis maximum for a usage chart with nothing to plot. VChart
 * falls back to a 0–1 linear domain on an empty dataset, which reads as
 * "0.2 tokens"; these give the empty state a frame that matches the metric.
 */
export function emptyUsageAxisMax(metric: UsageMetric): number {
  if (metric === 'tokens') return 10_000
  if (metric === 'requests') return 10
  // Cost is plotted in raw quota units, so convert 10 display-currency units
  // back through the site's quota rate rather than hardcoding a quota amount.
  return parseQuotaFromDollars(10)
}
