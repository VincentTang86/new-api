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
import { describe, expect, test } from 'vitest'

import type { TimeRange } from '@/lib/time-range'

import { defaultTimeGranularityForRange } from '../granularity'

function spanOf(days: number): TimeRange {
  return { key: 'custom', start: 0, end: days * 86_400 }
}

// The seeded bucket size is what keeps a wide admin window from pushing tens
// of thousands of points into the trend chart, so both thresholds are pinned.
describe('default granularity for a range', () => {
  test.each([
    [1, 'hour'],
    [2, 'hour'],
    [3, 'day'],
    [31, 'day'],
    [32, 'week'],
    [90, 'week'],
  ] as const)('%i days buckets by %s', (days, expected) => {
    expect(defaultTimeGranularityForRange(spanOf(days))).toBe(expected)
  })
})
