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

import type { PricingModel } from '../../types'
import { ModelDetailsVideoTokenTable } from '../model-details-video-token-table'

const USABLE_GROUPS = {
  Production: { desc: 'Production', ratio: 1 },
  'Best Effort': { desc: 'Lower Cost', ratio: 0.5 },
}
const GROUP_RATIO = { Production: 1, 'Best Effort': 0.5 }

// doubao-seedance-2-0 as the backend reports it: a base rate of $6.57/M
// (model_ratio 3.285 x 2) and the vendor's own tier multipliers.
function model(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'doubao-seedance-2-0-260128',
    quota_type: 0,
    model_ratio: 3.285,
    completion_ratio: 1,
    enable_groups: ['Production', 'Best Effort'],
    output_modalities: ['video'],
    video_rates: [
      { key: 'base', resolution: '480p / 720p', with_video: false, ratio: 1 },
      {
        key: 'base+video',
        resolution: '480p / 720p',
        with_video: true,
        ratio: 28 / 46,
      },
      { key: '1080p', resolution: '1080p', with_video: false, ratio: 51 / 46 },
      {
        key: '1080p+video',
        resolution: '1080p',
        with_video: true,
        ratio: 31 / 46,
      },
    ],
    ...overrides,
  } as PricingModel
}

function renderTable(target: PricingModel) {
  return render(
    <ModelDetailsVideoTokenTable
      model={target}
      groupRatio={GROUP_RATIO}
      usableGroup={USABLE_GROUPS}
      tokenUnit='M'
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

describe('ModelDetailsVideoTokenTable', () => {
  test('one column per resolution, two rows per plan', () => {
    const { container } = renderTable(model())
    expect(headers(container)).toEqual([
      'Service',
      'Rate Conditions',
      '480p / 720p',
      '1080p',
    ])

    const rows = [...container.querySelectorAll('tbody tr')]
    // The plan name spans both of its rows, so only the first carries it.
    expect(rowCells(rows[0])).toEqual([
      'Production',
      'Input without video',
      '$6.57',
      '$7.284130435',
    ])
    expect(rowCells(rows[1])).toEqual([
      'Input with video',
      '$3.999130435',
      '$4.427608696',
    ])
  })

  test('scales every cell by the plan group ratio', () => {
    const { container } = renderTable(model())
    const rows = [...container.querySelectorAll('tbody tr')]
    expect(rowCells(rows[2])).toEqual([
      'Best Effort',
      'Input without video',
      '$3.285',
      '$3.642065217',
    ])
  })

  // The base tier is the model's standard rate, so it reads the source's
  // default price; a surcharged tier needs its own configured price.
  test('reference reads the default price for base and per-condition elsewhere', () => {
    const { container } = renderTable(
      model({
        official_price: {
          input: 10,
          by_condition: { 'video:1080p': { input: 11 } },
        },
      })
    )
    const rows = [...container.querySelectorAll('tbody tr')]
    expect(rowCells(rows[4])).toEqual([
      'Direct First-Party APIReference',
      'Input without video',
      '$10.00',
      '$11.00',
    ])
    // Nothing configured for the with-video tiers: dashes, never a figure
    // inferred from our own multipliers.
    expect(rowCells(rows[5])).toEqual(['Input with video', '—', '—'])
  })

  test('renders nothing when the model has no resolution tiers', () => {
    const { container } = renderTable(model({ video_rates: [] }))
    expect(container.querySelector('table')).toBeNull()
  })
})
