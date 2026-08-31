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
import {
  ModelDetailsPricingNotes,
  ModelDetailsPricingTable,
} from '../model-details-pricing-table'

// A base rate surcharged ×2 on weekday mornings and afternoons — the shape the
// DeepSeek peak/off-peak configuration stores.
const PEAK_SURCHARGE_EXPR =
  '(tier("base", p * 0.176 + c * 0.528 + cr * 0.0176))' +
  ' * (weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") < 6 && hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12 ? 2 : 1)' +
  ' * (weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") < 6 && hour("Asia/Shanghai") >= 14 && hour("Asia/Shanghai") < 18 ? 2 : 1)'

const USABLE_GROUPS = {
  Production: { desc: 'Production', ratio: 1 },
  'Best Effort': { desc: 'Lower Cost', ratio: 0.9 },
}
const GROUP_RATIO = { Production: 1, 'Best Effort': 0.9 }

function model(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'test-model',
    quota_type: 0,
    // A $3.00 input rate: the helper reads model_ratio x 2 x group ratio.
    model_ratio: 1.5,
    completion_ratio: 4,
    enable_groups: ['Production', 'Best Effort'],
    ...overrides,
  }
}

function renderTable(target: PricingModel) {
  return render(
    <ModelDetailsPricingTable
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

describe('ModelDetailsPricingTable', () => {
  test('prices every plan the model is enabled for, at that plan ratio', () => {
    const { container } = renderTable(model())
    const rows = [...container.querySelectorAll('tbody tr')]

    expect(rows).toHaveLength(2)
    // Production bills at 1x, Best Effort at 0.9x, and output carries the
    // completion ratio on top of the input rate.
    expect(rowCells(rows[0])).toEqual([
      'Production',
      'Standard',
      '$3.00',
      '$12.00',
    ])
    expect(rowCells(rows[1])).toEqual([
      'Best Effort',
      'Standard',
      '$2.70',
      '$10.80',
    ])
  })

  test('drops the columns a model prices nothing under', () => {
    // No cache/image/audio ratios configured, so those columns would be a
    // strip of dashes rather than information.
    expect(headers(renderTable(model()).container)).toEqual([
      'Service',
      'Rate Conditions',
      'Input/1M',
      'Output/1M',
    ])

    const withCache = renderTable(
      model({ cache_ratio: 0.1, create_cache_ratio: 1.25 })
    ).container
    expect(headers(withCache)).toEqual([
      'Service',
      'Rate Conditions',
      'Input/1M',
      'Output/1M',
      'Cache Read/1M',
      'Cache Write/1M',
    ])
  })

  test('states external list prices as their own rows, dashing absent lanes', () => {
    const { container } = renderTable(
      model({
        official_price: { input: 3.5, output: 17.5 },
        // OpenRouter lists no output price for this model.
        openrouter_price: { input: 4 },
      })
    )
    const rows = [...container.querySelectorAll('tbody tr')]

    expect(rows).toHaveLength(4)
    expect(rowCells(rows[2])).toEqual([
      'Direct First-Party APIReference',
      'Standard',
      '$3.50',
      '$17.50',
    ])
    expect(rowCells(rows[3])).toEqual([
      'OpenRouter First-PartyReference',
      'Standard',
      '$4.00',
      '—',
    ])
  })

  test('crosses each plan with every rate condition the expression defines', () => {
    const { container } = renderTable(
      model({
        billing_mode: 'tiered_expr',
        billing_expr:
          'len <= 200000 ? tier("standard", p * 3 + c * 15) : tier("long_context", p * 6 + c * 22.5)',
      })
    )
    const rows = [...container.querySelectorAll('tbody tr')]

    // Two plans x two conditions. The condition set belongs to the model, not
    // to the plan, so both plans carry the same two.
    expect(rows).toHaveLength(4)
    expect(rows.map((row) => rowCells(row)[0])).toEqual([
      'Production',
      'long_context',
      'Best Effort',
      'long_context',
    ])
    // The plan name spans its condition rows rather than repeating.
    const planCell = rows[0].querySelector('th')
    expect(planCell?.getAttribute('rowspan')).toBe('2')
    expect(rowCells(rows[0])).toEqual([
      'Production',
      'standard',
      '$3.00',
      '$15.00',
    ])
    expect(rowCells(rows[3])).toEqual(['long_context', '$5.40', '$20.25'])
  })

  test('materializes purely time-conditional multipliers as peak/off-peak rows', () => {
    const { container } = renderTable(
      model({
        enable_groups: ['Production'],
        billing_mode: 'tiered_expr',
        billing_expr: PEAK_SURCHARGE_EXPR,
      })
    )
    const rows = [...container.querySelectorAll('tbody tr')]

    // The surcharged windows price above the base rate, so Peak leads and the
    // base rate reads as the off-peak price — every column scales by the
    // multiplier because the expression is linear in its token counts.
    expect(rows).toHaveLength(2)
    expect(rowCells(rows[0])).toEqual([
      'Production',
      'Peak Hours',
      '$0.352',
      '$1.056',
      '$0.0352',
    ])
    expect(rowCells(rows[1])).toEqual([
      'Off-Peak Hours',
      '$0.176',
      '$0.528',
      '$0.0176',
    ])
    expect(rows[0].querySelector('th')?.getAttribute('rowspan')).toBe('2')
  })

  test('keeps a single Standard row when a rule also reads request params', () => {
    const { container } = renderTable(
      model({
        enable_groups: ['Production'],
        billing_mode: 'tiered_expr',
        billing_expr:
          '(tier("base", p * 1 + c * 2)) * (param("service_tier") == "flex" ? 0.5 : 1)',
      })
    )
    const rows = [...container.querySelectorAll('tbody tr')]

    // A param-conditional multiplier varies per request, so it cannot be
    // stated as a price row.
    expect(rows).toHaveLength(1)
    expect(rowCells(rows[0])).toEqual([
      'Production',
      'Standard',
      '$1.00',
      '$2.00',
    ])
  })

  test('shows every cache column a five-variable expression prices', () => {
    const { container } = renderTable(
      model({
        enable_groups: ['Production'],
        billing_mode: 'tiered_expr',
        billing_expr:
          'tier("base", p * 5 + c * 25 + cr * 0.5 + cc * 6.25 + cc1h * 10)',
      })
    )

    expect(headers(container)).toEqual([
      'Service',
      'Rate Conditions',
      'Input/1M',
      'Output/1M',
      'Cache Read/1M',
      'Cache Write/1M',
      'Cache Write (1h)/1M',
    ])
    const rows = [...container.querySelectorAll('tbody tr')]
    expect(rowCells(rows[0])).toEqual([
      'Production',
      'Standard',
      '$5.00',
      '$25.00',
      '$0.50',
      '$6.25',
      '$10.00',
    ])
  })

  test('states the time windows behind each rate row in the notes', () => {
    const { container } = render(
      <ModelDetailsPricingNotes
        model={model({
          billing_mode: 'tiered_expr',
          billing_expr: PEAK_SURCHARGE_EXPR,
        })}
        tokenUnit='M'
      />
    )

    expect(container.textContent).toContain(
      'Peak Hours: Mon–Fri 09:00–12:00, Mon–Fri 14:00–18:00 (Asia/Shanghai)'
    )
  })

  test('splits DashScope dual cache hits into their own priced columns', () => {
    const { container } = renderTable(
      model({
        enable_groups: ['Production'],
        billing_mode: 'tiered_expr',
        // Implicit hits (cr) and explicit 5-minute cache hits (crx) bill at
        // different rates, with explicit creation on cc.
        billing_expr:
          'tier("base", p * 1.6 + c * 4.8 + cr * 0.2 + crx * 0.13 + cc * 2)',
        // The explicit-hit lane of the reference table lines up under crx.
        official_price: { input: 2, output: 6, cache_hit: 0.16 },
      })
    )

    expect(headers(container)).toEqual([
      'Service',
      'Rate Conditions',
      'Input/1M',
      'Output/1M',
      'Cache Read/1M',
      'Cache Read (5m)/1M',
      'Cache Write/1M',
    ])
    const rows = [...container.querySelectorAll('tbody tr')]
    expect(rowCells(rows[0])).toEqual([
      'Production',
      'Standard',
      '$1.60',
      '$4.80',
      '$0.20',
      '$0.13',
      '$2.00',
    ])
    expect(rowCells(rows[1])).toEqual([
      'Direct First-Party APIReference',
      'Standard',
      '$2.00',
      '$6.00',
      '—',
      '$0.16',
      '—',
    ])
  })

  test('bills per-request models by the call, not by the token', () => {
    const { container } = renderTable(
      model({ quota_type: 1, model_price: 0.02 })
    )
    const rows = [...container.querySelectorAll('tbody tr')]

    expect(headers(container)).toEqual(['Service', 'Price'])
    expect(rowCells(rows[0])).toEqual(['Production', '$0.02 / call'])
  })

  test('states the per-image add-on and scales it by the plan ratio', () => {
    const { container } = renderTable(
      model({ quota_type: 1, model_price: 0.08, image_input_price: 0.01 })
    )
    const rows = [...container.querySelectorAll('tbody tr')]

    expect(rowCells(rows[0])).toEqual([
      'Production',
      '$0.08 / call+ $0.01 / image',
    ])
    expect(rowCells(rows[1])).toEqual([
      'Best Effort',
      '$0.072 / call+ $0.009 / image',
    ])
  })
})
