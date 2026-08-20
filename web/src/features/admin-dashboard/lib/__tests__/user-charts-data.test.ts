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

import type { QuotaDataItem } from '@/features/admin-dashboard/types'

import { processUserChartData } from '../user-charts-data'

interface TrendPoint {
  Time: string
  User: string
  rawQuota: number
}

interface RankPoint {
  User: string
  rawQuota: number
}

const HOUR = 3600
// 2026-07-01 00:00 UTC, so the two granularities land in different buckets.
const BASE = 1_782_950_400

function row(username: string, quota: number, createdAt = BASE): QuotaDataItem {
  return { username, quota, created_at: createdAt }
}

// The specs are typed as Record<string, any> because they are handed straight
// to VChart, so reach into the one series the charts declare.
function seriesValues<T>(spec: Record<string, unknown>): T[] {
  return (spec.data as { values: T[] }[])[0].values
}

const rankValues = (spec: Record<string, unknown>) =>
  seriesValues<RankPoint>(spec)
const trendValues = (spec: Record<string, unknown>) =>
  seriesValues<TrendPoint>(spec)

describe('processUserChartData', () => {
  test('an empty range still renders both charts, labelled as empty', () => {
    const result = processUserChartData([], 'day', (k) => k, 10)

    expect(rankValues(result.spec_user_rank)).toEqual([])
    expect(trendValues(result.spec_user_trend)).toEqual([])
    expect(result.spec_user_rank.title.subtext).toBe('No data available')
    expect(result.spec_user_trend.title.subtext).toBe('No data available')
  })

  test('keeps only the top N users, highest spend first', () => {
    // 12 users at ascending quota; the two smallest must not survive.
    const data = Array.from({ length: 12 }, (_, i) =>
      row(`user${i}`, (i + 1) * 100)
    )

    const result = processUserChartData(data, 'day', (k) => k, 10)

    const ranked = rankValues(result.spec_user_rank)
    expect(ranked).toHaveLength(10)
    expect(ranked.map((entry) => entry.User)).toEqual([
      'user11',
      'user10',
      'user9',
      'user8',
      'user7',
      'user6',
      'user5',
      'user4',
      'user3',
      'user2',
    ])
    expect(ranked[0].rawQuota).toBe(1200)
    // The trend chart plots the same survivors, never the truncated tail.
    const plotted = new Set(
      trendValues(result.spec_user_trend).map((point) => point.User)
    )
    expect(plotted.has('user0')).toBe(false)
    expect(plotted.has('user1')).toBe(false)
  })

  test('emits a zero point for a user idle in a bucket', () => {
    // Without this the stacked area chart would draw holes where a user had
    // no traffic, which is what the time x user double loop exists to avoid.
    const data = [row('alice', 100, BASE), row('bob', 50, BASE + HOUR)]

    const result = processUserChartData(data, 'hour', (k) => k, 10)

    const points = trendValues(result.spec_user_trend)
    expect(points).toHaveLength(4)
    const bobAtFirstBucket = points.find(
      (point) => point.User === 'bob' && point.Time === points[0].Time
    )
    expect(bobAtFirstBucket?.rawQuota).toBe(0)
  })

  test('granularity decides whether neighbouring hours collapse', () => {
    const data = [row('alice', 100, BASE), row('alice', 50, BASE + HOUR)]

    const hourly = trendValues(
      processUserChartData(data, 'hour', (k) => k, 10).spec_user_trend
    )
    const daily = trendValues(
      processUserChartData(data, 'day', (k) => k, 10).spec_user_trend
    )

    expect(hourly).toHaveLength(2)
    expect(daily).toHaveLength(1)
    expect(daily[0].rawQuota).toBe(150)
  })
})
