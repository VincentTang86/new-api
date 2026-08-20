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
import { getCurrencyDisplay } from '@/lib/currency'
import { formatChartTime, type TimeGranularity } from '@/lib/time'

import type { ProcessedUserChartData, QuotaDataItem } from '../types'

type TFunction = (key: string) => string

function renderQuotaCompat(rawQuota: number, digits = 4): string {
  const { config, meta } = getCurrencyDisplay()
  if (meta.kind === 'tokens') return rawQuota.toLocaleString()
  const usd = rawQuota / config.quotaPerUnit
  const rate = 'exchangeRate' in meta ? meta.exchangeRate : 1
  const symbol = 'symbol' in meta ? meta.symbol : '$'
  const value = usd * rate
  const fixed = value.toFixed(digits)
  if (Number.parseFloat(fixed) === 0 && rawQuota > 0 && value > 0) {
    return symbol + Math.pow(10, -digits).toFixed(digits)
  }
  return symbol + fixed
}

const USER_COLORS = [
  '#5B8FF9',
  '#5AD8A6',
  '#F6BD16',
  '#E8684A',
  '#6DC8EC',
  '#9270CA',
  '#FF9D4D',
  '#269A99',
  '#FF99C3',
  '#5D7092',
]

export function processUserChartData(
  data: QuotaDataItem[],
  timeGranularity: TimeGranularity = 'day',
  t?: TFunction,
  limit = 10
): ProcessedUserChartData {
  const tt: TFunction = t ?? ((x) => x)
  const { config } = getCurrencyDisplay()
  const quotaPerUnit = config.quotaPerUnit

  const formatVal = (raw: number) => renderQuotaCompat(raw, 2)

  const emptyResult: ProcessedUserChartData = {
    spec_user_rank: {
      type: 'bar',
      data: [{ id: 'userRankData', values: [] }],
      xField: 'rawQuota',
      yField: 'User',
      seriesField: 'User',
      direction: 'horizontal',
      title: {
        visible: true,
        text: tt('User Consumption Ranking'),
        subtext: tt('No data available'),
      },
      legends: { visible: false },
      color: { type: 'ordinal', range: USER_COLORS },
      background: { fill: 'transparent' },
    },
    spec_user_trend: {
      type: 'area',
      data: [{ id: 'userTrendData', values: [] }],
      xField: 'Time',
      yField: 'rawQuota',
      seriesField: 'User',
      title: {
        visible: true,
        text: tt('User Consumption Trend'),
        subtext: tt('No data available'),
      },
      legends: { visible: true, selectMode: 'single' },
      color: { type: 'ordinal', range: USER_COLORS },
      point: { visible: false },
      background: { fill: 'transparent' },
    },
  }

  if (!data || data.length === 0) return emptyResult

  const userQuotaTotal = new Map<string, number>()
  data.forEach((item) => {
    const username = item.username || 'unknown'
    const prev = userQuotaTotal.get(username) || 0
    userQuotaTotal.set(username, prev + (Number(item.quota) || 0))
  })

  const sorted = [...userQuotaTotal.entries()].sort((a, b) => b[1] - a[1])
  const topUsers = sorted.slice(0, limit).map(([u]) => u)
  const topUserSet = new Set(topUsers)
  const totalQuota = sorted.slice(0, limit).reduce((s, [, q]) => s + q, 0)

  const rankValues = sorted.slice(0, limit).map(([username, quota]) => ({
    User: username,
    rawQuota: quota,
    Usage: Number((quota / quotaPerUnit).toFixed(4)),
  }))

  const userColorMap = topUsers.reduce<Record<string, string>>(
    (acc, user, i) => {
      acc[user] = USER_COLORS[i % USER_COLORS.length]
      return acc
    },
    {}
  )

  const timeUserMap = new Map<string, Map<string, number>>()
  const allTimePoints = new Set<string>()

  data.forEach((item) => {
    const ts = Number(item.created_at)
    const timeKey = formatChartTime(ts, timeGranularity)
    allTimePoints.add(timeKey)
    const user = item.username || 'unknown'
    if (!topUserSet.has(user)) return
    let map = timeUserMap.get(timeKey)
    if (!map) {
      map = new Map()
      timeUserMap.set(timeKey, map)
    }
    map.set(user, (map.get(user) || 0) + (Number(item.quota) || 0))
  })

  const sortedTimePoints = [...allTimePoints].sort()
  const trendValues: Array<{
    Time: string
    User: string
    rawQuota: number
    Usage: number
  }> = []

  sortedTimePoints.forEach((time) => {
    topUsers.forEach((user) => {
      const q = timeUserMap.get(time)?.get(user) || 0
      trendValues.push({
        Time: time,
        User: user,
        rawQuota: q,
        Usage: Number((q / quotaPerUnit).toFixed(4)),
      })
    })
  })

  return {
    spec_user_rank: {
      type: 'bar',
      data: [{ id: 'userRankData', values: rankValues }],
      xField: 'rawQuota',
      yField: 'User',
      seriesField: 'User',
      direction: 'horizontal',
      title: {
        visible: true,
        text: tt('User Consumption Ranking'),
        subtext: `${tt('Total:')} ${formatVal(totalQuota)}`,
      },
      legends: { visible: false },
      bar: {
        state: { hover: { stroke: '#000', lineWidth: 1 } },
      },
      label: {
        visible: true,
        position: 'outside',
        formatMethod: (value: number) => formatVal(value),
        style: { fontSize: 11 },
      },
      axes: [
        { orient: 'left', type: 'band' },
        { orient: 'bottom', type: 'linear', visible: false },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.User,
              value: (datum: Record<string, unknown>) =>
                formatVal(Number(datum?.rawQuota) || 0),
            },
          ],
          updateContent: (
            array: Array<{
              key: string
              value: string | number
              datum?: Record<string, unknown>
            }>
          ) => {
            for (let i = 0; i < array.length; i++) {
              const rawQuota = array[i].datum?.rawQuota
              const value =
                rawQuota === undefined ? array[i].value : Number(rawQuota)
              array[i].value = formatVal(Number(value) || 0)
            }
            return array
          },
        },
      },
      color: { specified: userColorMap },
      background: { fill: 'transparent' },
      animation: true,
    },
    spec_user_trend: {
      type: 'area',
      data: [{ id: 'userTrendData', values: trendValues }],
      xField: 'Time',
      yField: 'rawQuota',
      seriesField: 'User',
      stack: false,
      title: {
        visible: true,
        text: tt('User Consumption Trend'),
        subtext: `${tt('Total:')} ${formatVal(totalQuota)}`,
      },
      legends: { visible: true, selectMode: 'single' },
      axes: [
        { orient: 'bottom', type: 'band' },
        {
          orient: 'left',
          type: 'linear',
          label: {
            formatMethod: (value: number) => formatVal(value),
          },
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.User,
              value: (datum: Record<string, unknown>) =>
                formatVal(Number(datum?.rawQuota) || 0),
            },
          ],
        },
        dimension: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.User,
              value: (datum: Record<string, unknown>) =>
                Number(datum?.rawQuota) || 0,
            },
          ],
          updateContent: (
            array: Array<{
              key: string
              value: string | number
            }>
          ) => {
            array.sort(
              (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)
            )
            let sum = 0
            for (let i = 0; i < array.length; i++) {
              const v = Number(array[i].value) || 0
              sum += v
              array[i].value = formatVal(v)
            }
            array.unshift({
              key: tt('Total:'),
              value: formatVal(sum),
            })
            return array
          },
        },
      },
      area: {
        style: {
          fillOpacity: 0.15,
          curveType: 'monotone',
        },
      },
      line: {
        style: {
          lineWidth: 2,
          curveType: 'monotone',
        },
      },
      point: { visible: false },
      color: { specified: userColorMap },
      background: { fill: 'transparent' },
      animation: true,
    },
  }
}
