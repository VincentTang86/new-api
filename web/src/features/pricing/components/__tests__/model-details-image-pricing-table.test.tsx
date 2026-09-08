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
import { ModelDetailsImagePricingTable } from '../model-details-image-pricing-table'

// xAI's grid as the per-request preset writes it: four output cells plus
// $0.01 per input image.
const GROK_EXPR =
  '(param("n") == nil ? 1 : param("n")) * (param("resolution") == "2k" && param("quality") == "medium" ? tier("2k-medium", 80000) : param("resolution") == "2k" ? tier("2k-low", 60000) : param("quality") == "medium" ? tier("1k-medium", 60000) : tier("1k-low", 40000)) + (param("images.#") == nil ? (param("image") != nil ? 1 : 0) : param("images.#")) * 10000'

const USABLE_GROUPS = {
  Production: { desc: 'Production', ratio: 1 },
  'Best Effort': { desc: 'Lower Cost', ratio: 0.5 },
}
const GROUP_RATIO = { Production: 1, 'Best Effort': 0.5 }

function model(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'grok-imagine-image-2.0',
    quota_type: 0,
    model_ratio: 0,
    completion_ratio: 0,
    enable_groups: ['Production', 'Best Effort'],
    output_modalities: ['image'],
    image_prices: [
      { size: '1K·Low', price: 0.08 },
      { size: '2K·Medium', price: 0.08 },
    ],
    official_price: {
      per_image: [
        { size: '1K·Low', price: 0.04 },
        { size: '2K·Medium', price: 0.08 },
      ],
    },
    ...overrides,
  } as PricingModel
}

function renderTable(target: PricingModel) {
  return render(
    <ModelDetailsImagePricingTable
      model={target}
      groupRatio={GROUP_RATIO}
      usableGroup={USABLE_GROUPS}
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

describe('ModelDetailsImagePricingTable', () => {
  test('states the per-input-image charge the expression carries, at each plan ratio', () => {
    const { container } = renderTable(
      model({ billing_mode: 'tiered_expr', billing_expr: GROK_EXPR })
    )

    expect(headers(container)).toEqual([
      'Service',
      'Input image',
      '1K·Low',
      '2K·Medium',
    ])
    const rows = [...container.querySelectorAll('tbody tr')].map(rowCells)
    expect(rows[0]).toEqual(['Production', '$0.01', '$0.08', '$0.08'])
    expect(rows[1]).toEqual(['Best Effort', '$0.005', '$0.04', '$0.04'])
    // A reference source without an input-image charge on file shows a dash.
    expect(rows[2].slice(1)).toEqual(['—', '$0.04', '$0.08'])
  })

  test('the admin-entered gateway and reference input charges win over the expression', () => {
    const { container } = renderTable(
      model({
        billing_mode: 'tiered_expr',
        billing_expr: GROK_EXPR,
        image_input_price: 0.02,
        official_price: {
          per_image: [{ size: '1K·Low', price: 0.04 }],
          per_image_input: 0.01,
        },
      })
    )

    const rows = [...container.querySelectorAll('tbody tr')].map(rowCells)
    expect(rows[0].slice(0, 2)).toEqual(['Production', '$0.02'])
    expect(rows[1].slice(0, 2)).toEqual(['Best Effort', '$0.01'])
    expect(rows[2].slice(1)).toEqual(['$0.01', '$0.04', '—'])
  })

  test('shows no input column for a model priced per output image only', () => {
    const { container } = renderTable(model())

    expect(headers(container)).toEqual(['Service', '1K·Low', '2K·Medium'])
    const rows = [...container.querySelectorAll('tbody tr')].map(rowCells)
    expect(rows[0]).toEqual(['Production', '$0.08', '$0.08'])
  })
})
