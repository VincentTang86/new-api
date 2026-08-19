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

export type TimeRangeKey = 'today' | 'yesterday' | '7days' | '30days' | 'custom'

/** Resolved time range in unix seconds. */
export interface TimeRange {
  key: TimeRangeKey
  start: number
  end: number
}

export interface DayTime {
  hours: number
  minutes: number
}

export const DAY_START: DayTime = { hours: 0, minutes: 0 }
export const DAY_END: DayTime = { hours: 23, minutes: 59 }

/*
 * `maxDays` is required throughout, deliberately. The cap belongs to whichever
 * endpoint the caller queries — /api/data/self rejects spans over 2592000s
 * while /api/data/flow has no server-side limit at all — so there is no value
 * safe to inherit. A default here is exactly what would let a caller silently
 * receive a range narrower than the one it asked for.
 */

export function isRangeWithinLimit(range: TimeRange, maxDays: number): boolean {
  return range.end - range.start <= maxDays * 86_400
}

export function resolvePresetRange(
  key: TimeRangeKey,
  maxDays: number
): TimeRange {
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
      // gains an hour. On a caller whose cap is 30 days that would push this
      // already-at-the-limit preset past what the endpoint accepts.
      return {
        key: '30days',
        start: Math.max(now.subtract(30, 'day').unix(), end - maxDays * 86_400),
        end,
      }
    }
  }
}

/**
 * Times filter exactly. Note that `quota_data` is pre-aggregated into hour
 * buckets keyed by bucket start, so for quota-driven views a partial hour
 * only shows from the next full bucket; the log-metrics endpoint filters to
 * the minute.
 */
export function resolveCustomRange(
  startDay: Date,
  endDay: Date,
  startTime: DayTime,
  endTime: DayTime,
  maxDays: number
): TimeRange {
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
    // Never hand the endpoint a span it would reject outright.
    end: Math.min(end.unix(), startUnix + maxDays * 86_400),
  }
}

export function rangeSpanMinutes(range: TimeRange): number {
  return Math.max(1, (range.end - range.start) / 60)
}
