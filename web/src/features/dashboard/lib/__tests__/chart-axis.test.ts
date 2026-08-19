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
import { afterEach, describe, expect, test } from 'vitest'

import { formatQuota } from '@/lib/format'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { emptyUsageAxisMax } from '../chart-axis'

const DEFAULT_QUOTA_PER_UNIT = DEFAULT_CURRENCY_CONFIG.quotaPerUnit

function setQuotaPerUnit(quotaPerUnit: number): void {
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG, quotaPerUnit } })
}

describe('empty usage axis maximum', () => {
  afterEach(() => {
    setQuotaPerUnit(DEFAULT_QUOTA_PER_UNIT)
  })

  test.each([
    ['tokens', 10_000],
    ['requests', 10],
    ['cost', 10 * DEFAULT_QUOTA_PER_UNIT],
  ] as const)('%s tops out at %i', (metric, expected) => {
    setQuotaPerUnit(DEFAULT_QUOTA_PER_UNIT)
    expect(emptyUsageAxisMax(metric)).toBe(expected)
  })

  test('the cost maximum tracks a non-default quota rate so the top tick still reads 10', () => {
    setQuotaPerUnit(1_000_000)

    const max = emptyUsageAxisMax('cost')

    expect(max).toBe(10_000_000)
    // The axis labels run through formatQuota, so the raw maximum has to come
    // back out as ten display units whatever quotaPerUnit is configured to.
    expect(formatQuota(max)).toBe(formatQuota(10 * 1_000_000))
    expect(formatQuota(max)).toContain('10')
  })
})
