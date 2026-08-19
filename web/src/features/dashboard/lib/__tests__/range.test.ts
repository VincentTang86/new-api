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
import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  DAY_END,
  DAY_START,
  isRangeWithinLimit,
  resolveCustomRange,
  resolvePresetRange,
} from '@/lib/time-range'

import { MAX_RANGE_DAYS, MAX_RANGE_SECONDS } from '../../constants'

// The self data endpoints reject spans over 2592000s outright, so every range
// this module hands to the queries has to stay inside that budget.
describe('dashboard range limit', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test.each([
    ['exactly at the limit', MAX_RANGE_SECONDS, true],
    ['one second over', MAX_RANGE_SECONDS + 1, false],
    ['well inside', 86_400, true],
  ])('isRangeWithinLimit: %s', (_label, span, expected) => {
    expect(
      isRangeWithinLimit(
        { key: 'custom', start: 1_000_000, end: 1_000_000 + span },
        MAX_RANGE_DAYS
      )
    ).toBe(expected)
  })

  test('clamps a Jul 1 00:00 - Jul 31 23:59 selection, which the server would reject', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T00:00:00'))

    const range = resolveCustomRange(
      new Date(2026, 6, 1),
      new Date(2026, 6, 31),
      DAY_START,
      DAY_END,
      MAX_RANGE_DAYS
    )

    // 30 days 23:59 unclamped; the clamp is what keeps it requestable.
    expect(range.end - range.start).toBe(MAX_RANGE_SECONDS)
    expect(isRangeWithinLimit(range, MAX_RANGE_DAYS)).toBe(true)
  })

  test('leaves an in-budget custom range untouched', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T00:00:00'))

    const range = resolveCustomRange(
      new Date(2026, 6, 1),
      new Date(2026, 6, 10),
      DAY_START,
      DAY_END,
      MAX_RANGE_DAYS
    )

    expect(range.end - range.start).toBeLessThan(MAX_RANGE_SECONDS)
    expect(range.end - range.start).toBe(9 * 86_400 + 23 * 3600 + 59 * 60 + 59)
  })

  test('the 30-day preset lands exactly on the budget, never past it', () => {
    vi.useFakeTimers()
    // dayjs subtract(30, 'day') is calendar arithmetic, so in a DST-observing
    // zone a window spanning a fall-back gains an hour and would trip the
    // server. The clamp makes the span exact in every zone, which is what the
    // equality below pins down.
    vi.setSystemTime(new Date('2026-11-15T12:00:00'))

    const range = resolvePresetRange('30days', MAX_RANGE_DAYS)

    expect(isRangeWithinLimit(range, MAX_RANGE_DAYS)).toBe(true)
    expect(range.end - range.start).toBe(MAX_RANGE_SECONDS)
  })
})
