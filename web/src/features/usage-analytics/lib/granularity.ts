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
import type { TimeGranularity } from '@/lib/time'
import type { TimeRange } from '@/lib/time-range'

const HOURLY_MAX_DAYS = 2
const DAILY_MAX_DAYS = 31

/**
 * Seeds the user trend chart with a bucket size the window can carry.
 * processUserChartData emits one point per time bucket per ranked user, so a
 * 90-day window at hourly granularity is 2160 x 10 = 21,600 area points.
 */
export function defaultTimeGranularityForRange(
  range: TimeRange
): TimeGranularity {
  const spanDays = (range.end - range.start) / 86_400
  if (spanDays <= HOURLY_MAX_DAYS) return 'hour'
  if (spanDays <= DAILY_MAX_DAYS) return 'day'
  return 'week'
}
