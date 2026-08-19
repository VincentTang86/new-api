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
export const MAX_RANGE_SECONDS = MAX_RANGE_DAYS * 86_400

export function isRangeWithinLimit(range: DashboardRange): boolean {
  return range.end - range.start <= MAX_RANGE_SECONDS
}

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
    default: {
      const end = now.unix()
      // dayjs day arithmetic is calendar-based, so crossing a DST fall-back
      // gains an hour and pushes this already-at-the-limit preset over the
      // server's 2592000s cap.
      return {
        key: '30days',
        start: Math.max(
          now.subtract(MAX_RANGE_DAYS, 'day').unix(),
          end - MAX_RANGE_SECONDS
        ),
        end,
      }
    }
  }
}

export interface DayTime {
  hours: number
  minutes: number
}

export const DAY_START: DayTime = { hours: 0, minutes: 0 }
export const DAY_END: DayTime = { hours: 23, minutes: 59 }

/**
 * Times filter exactly. Note that `quota_data` is pre-aggregated into hour
 * buckets keyed by bucket start, so for quota-driven views a partial hour
 * only shows from the next full bucket; the log-metrics endpoint filters to
 * the minute.
 */
export function resolveCustomRange(
  startDay: Date,
  endDay: Date,
  startTime: DayTime = DAY_START,
  endTime: DayTime = DAY_END
): DashboardRange {
  const start = dayjs(startDay)
    .startOf('day')
    .add(startTime.hours, 'hour')
    .add(startTime.minutes, 'minute')
  let end = dayjs(endDay)
    .startOf('day')
    .add(endTime.hours, 'hour')
    .add(endTime.minutes, 'minute')
    .endOf('minute')
  const now = dayjs()
  if (end.isAfter(now)) end = now
  if (end.isBefore(start)) end = start
  const startUnix = start.unix()
  return {
    key: 'custom',
    start: startUnix,
    // Never hand the endpoints a span they will reject outright.
    end: Math.min(end.unix(), startUnix + MAX_RANGE_SECONDS),
  }
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
