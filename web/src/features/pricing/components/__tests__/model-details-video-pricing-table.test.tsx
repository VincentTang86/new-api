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
import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import type { PricingModel, TokenUnit } from '../../types'
import { ModelDetailsVideoPricingTable } from '../model-details-video-pricing-table'

const USABLE_GROUPS = {
  Production: { desc: 'Production', ratio: 1 },
  'Best Effort': { desc: 'Lower Cost', ratio: 0.5 },
}
const GROUP_RATIO = { Production: 1, 'Best Effort': 0.5 }

// Seedance as the admin grids it: two conditions, three resolutions, priced
// per second and per token beside the vendor's list, with gaps left on purpose.
function model(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'doubao-seedance-2-5-oinone',
    quota_type: 0,
    model_ratio: 3.285,
    completion_ratio: 1,
    enable_groups: ['Production', 'Best Effort'],
    output_modalities: ['video'],
    video_grid: {
      conditions: ['without_video', 'with_video'],
      resolutions: ['480p / 720p', '1080p', '4K'],
    },
    video_prices: [
      { size: '480p / 720p', condition: 'without_video', price: 0.04 },
      { size: '480p / 720p', condition: 'with_video', price: 0.08 },
      { size: '1080p', condition: 'without_video', price: 0.07 },
    ],
    video_token_prices: [
      { size: '480p / 720p', condition: 'without_video', price: 0.075 },
      { size: '1080p', condition: 'with_video', price: 0.2 },
    ],
    official_price: {
      per_second: [
        { size: '480p / 720p', condition: 'without_video', price: 0.05 },
      ],
      per_token: [{ size: '4K', condition: 'with_video', price: 0.4 }],
    },
    ...overrides,
  } as PricingModel
}

function renderTable(
  target: PricingModel,
  unit: 'second' | 'token' = 'second',
  tokenUnit: TokenUnit = 'M'
) {
  return render(
    <ModelDetailsVideoPricingTable
      model={target}
      groupRatio={GROUP_RATIO}
      usableGroup={USABLE_GROUPS}
      unit={unit}
      tokenUnit={tokenUnit}
    />
  )
}

function headers(container: HTMLElement): string[] {
  return [...container.querySelectorAll('thead th')].map(
    (cell) => cell.textContent ?? ''
  )
}

function rowCells(row: Element): string[] {
  return [...row.querySelectorAll('th, td')].map(
    (cell) => cell.textContent ?? ''
  )
}

describe('ModelDetailsVideoPricingTable per second', () => {
  test('lays the grid out as service × condition rows and resolution columns', () => {
    const { container } = renderTable(model())
    expect(headers(container)).toEqual([
      'Service',
      'Rate Conditions',
      '480p / 720p',
      '1080p',
      '4K',
    ])
    const rows = [...container.querySelectorAll('tbody tr')]
    // The plan name spans both of its rows, so only the first carries it; a
    // cell nobody priced is a dash.
    expect(rowCells(rows[0])).toEqual([
      'Production',
      'Input without video',
      '~$0.04/sec',
      '~$0.07/sec',
      '—',
    ])
    expect(rowCells(rows[1])).toEqual([
      'Input with video',
      '~$0.08/sec',
      '—',
      '—',
    ])
  })

  test('scales gateway cells by the plan ratio and leaves reference cells alone', () => {
    const { container } = renderTable(model())
    const rows = [...container.querySelectorAll('tbody tr')]
    expect(rowCells(rows[2])).toEqual([
      'Best Effort',
      'Input without video',
      '~$0.02/sec',
      '~$0.035/sec',
      '—',
    ])
    expect(rowCells(rows[4])).toEqual([
      'Direct First-Party APIReference',
      'Input without video',
      '~$0.05/sec',
      '—',
      '—',
    ])
    expect(rowCells(rows[5])).toEqual(['Input with video', '—', '—', '—'])
  })

  test('hides the condition column when the grid splits on none', () => {
    const { container } = renderTable(
      model({
        video_grid: { conditions: [], resolutions: ['480P', '720P'] },
        video_prices: [
          { size: '480P', price: 0.114 },
          { size: '720P', price: 0.257 },
        ],
        official_price: { per_second: [{ size: '480P', price: 0.2 }] },
      })
    )
    expect(headers(container)).toEqual(['Service', '480P', '720P'])
    const rows = [...container.querySelectorAll('tbody tr')]
    expect(rowCells(rows[0])).toEqual([
      'Production',
      '~$0.114/sec',
      '~$0.257/sec',
    ])
    expect(rowCells(rows[1])).toEqual([
      'Best Effort',
      '~$0.057/sec',
      '~$0.1285/sec',
    ])
    // A resolution the source does not list dashes rather than borrowing a
    // neighbour's price.
    expect(rowCells(rows[2])).toEqual([
      'Direct First-Party APIReference',
      '~$0.20/sec',
      '—',
    ])
  })

  // Prices entered before grids existed carry no layout; their resolutions
  // still make the columns.
  test('derives the columns from the stored prices when no grid is defined', () => {
    const { container } = renderTable(
      model({
        video_grid: undefined,
        video_prices: [{ size: '480P', price: 0.114 }],
        video_token_prices: undefined,
        official_price: undefined,
      })
    )
    expect(headers(container)).toEqual(['Service', '480P'])
  })

  // A per-call video model prices the whole clip, so the single column must
  // say so instead of implying a per-second rate.
  test('a per-call video model gets a single per video column', () => {
    const { container } = renderTable(
      model({
        model_name: 'MiniMax-H3',
        quota_type: 1,
        model_ratio: 0,
        model_price: 0.0714,
        video_grid: undefined,
        video_prices: undefined,
        video_token_prices: undefined,
        official_price: undefined,
      })
    )
    expect(headers(container)).toEqual(['Service', 'Per video'])
    const rows = [...container.querySelectorAll('tbody tr')]
    expect(rowCells(rows[0])).toEqual(['Production', '$0.0714/video'])
  })
})

describe('ModelDetailsVideoPricingTable per token', () => {
  // The billing multipliers are on the model too; the view must state only
  // what the admin entered, never a figure computed from them.
  test('reads the admin-entered per-token prices, never the billing multipliers', () => {
    const { container } = renderTable(
      model({
        video_rates: [
          {
            key: 'base',
            resolution: '480p / 720p',
            with_video: false,
            ratio: 1,
          },
          { key: '4k', resolution: '4K', with_video: false, ratio: 2 },
        ],
      }),
      'token'
    )
    expect(headers(container)).toEqual([
      'Service',
      'Rate Conditions',
      '480p / 720p',
      '1080p',
      '4K',
    ])
    const rows = [...container.querySelectorAll('tbody tr')]
    expect(rowCells(rows[0])).toEqual([
      'Production',
      'Input without video',
      '$0.075/M',
      '—',
      '—',
    ])
    expect(rowCells(rows[1])).toEqual(['Input with video', '—', '$0.20/M', '—'])
    expect(rowCells(rows[4])).toEqual([
      'Direct First-Party APIReference',
      'Input without video',
      '—',
      '—',
      '—',
    ])
    expect(rowCells(rows[5])).toEqual(['Input with video', '—', '—', '$0.40/M'])
  })

  // The unit has to follow the drawer's token-unit switch: a per-1K rate
  // labelled "/M" misstates the price by a factor of a thousand.
  test('states the price per thousand tokens when the drawer is on /K', () => {
    const { container } = renderTable(model(), 'token', 'K')
    const rows = [...container.querySelectorAll('tbody tr')]
    expect(rowCells(rows[0])).toEqual([
      'Production',
      'Input without video',
      '$0.000075/K',
      '—',
      '—',
    ])
  })

  test('states the empty view when nothing per token is on file', () => {
    const { container } = renderTable(
      model({
        video_grid: undefined,
        video_prices: undefined,
        video_token_prices: undefined,
        official_price: undefined,
      }),
      'token'
    )
    expect(container.querySelector('table')).toBeNull()
    expect(container.textContent).toContain(
      'No per-token prices are configured for this model.'
    )
  })
})
