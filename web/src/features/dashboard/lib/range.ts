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
import dayjs from '@/lib/dayjs'

import type {
  DashboardRange,
  DashboardRangeKey,
  UsageGranularity,
} from '../types'

// The self data endpoints reject spans longer than 30 days (2592000s).
export const MAX_RANGE_DAYS = 30

// Spans longer than this default to daily buckets in the trend chart.
const DAILY_GRANULARITY_THRESHOLD_DAYS = 2

export function resolvePresetRange(key: DashboardRangeKey): DashboardRange {
  const now = dayjs()
  switch (key) {
    case 'today':
      return {
        key,
        start: now.startOf('day').unix(),
        end: now.unix(),
      }
    case 'yesterday': {
      const yesterday = now.subtract(1, 'day')
      return {
        key,
        start: yesterday.startOf('day').unix(),
        end: yesterday.endOf('day').unix(),
      }
    }
    case '7days':
      return {
        key,
        start: now.subtract(7, 'day').unix(),
        end: now.unix(),
      }
    case '30days':
    default:
      return {
        key: '30days',
        start: now.subtract(MAX_RANGE_DAYS, 'day').unix(),
        end: now.unix(),
      }
  }
}

export function resolveCustomRange(
  startDay: Date,
  endDay: Date
): DashboardRange {
  const start = dayjs(startDay).startOf('day')
  let end = dayjs(endDay).endOf('day')
  const now = dayjs()
  if (end.isAfter(now)) end = now
  return { key: 'custom', start: start.unix(), end: end.unix() }
}

export function defaultGranularityForRange(
  range: DashboardRange
): UsageGranularity {
  const spanDays = (range.end - range.start) / 86400
  return spanDays > DAILY_GRANULARITY_THRESHOLD_DAYS ? 'day' : 'hour'
}

export function rangeSpanMinutes(range: DashboardRange): number {
  return Math.max(1, (range.end - range.start) / 60)
}
