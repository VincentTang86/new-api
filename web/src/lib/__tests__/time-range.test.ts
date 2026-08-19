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
} from '../time-range'

const SELF_MAX_DAYS = 30
const ADMIN_MAX_DAYS = 90

// The cap travels as an argument because callers query different endpoints:
// /api/data/self rejects spans over 2592000s, /api/data/flow has no limit.
// A shared default would silently narrow whichever caller wanted more.
describe('time range cap is per caller', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function sixtyDays(maxDays: number) {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-15T00:00:00'))
    return resolveCustomRange(
      new Date(2026, 5, 1),
      new Date(2026, 6, 30),
      DAY_START,
      DAY_END,
      maxDays
    )
  }

  test('a 60-day selection survives intact under a 90-day cap', () => {
    const range = sixtyDays(ADMIN_MAX_DAYS)

    expect(range.end - range.start).toBeGreaterThan(SELF_MAX_DAYS * 86_400)
    expect(isRangeWithinLimit(range, ADMIN_MAX_DAYS)).toBe(true)
  })

  test('the same selection clamps to exactly 30 days under a 30-day cap', () => {
    const range = sixtyDays(SELF_MAX_DAYS)

    expect(range.end - range.start).toBe(SELF_MAX_DAYS * 86_400)
  })

  test('isRangeWithinLimit answers per cap, not per range', () => {
    const range = sixtyDays(ADMIN_MAX_DAYS)

    expect(isRangeWithinLimit(range, ADMIN_MAX_DAYS)).toBe(true)
    expect(isRangeWithinLimit(range, SELF_MAX_DAYS)).toBe(false)
  })
})
