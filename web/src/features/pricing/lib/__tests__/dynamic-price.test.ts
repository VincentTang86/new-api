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

import type { PricingModel } from '../../types'
import {
  formatTimeWindows,
  getTimeRateVariants,
  timeRateVariantLabel,
} from '../dynamic-price'

const t = (key: string) => key

function tieredModel(billingExpr: string): PricingModel {
  return {
    id: 1,
    model_name: 'test-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['Production'],
    billing_mode: 'tiered_expr',
    billing_expr: billingExpr,
  }
}

describe('getTimeRateVariants', () => {
  test('merges same-multiplier windows and orders the dearest rate first', () => {
    const variants = getTimeRateVariants(
      tieredModel(
        '(tier("base", p * 0.176 + c * 0.528))' +
          ' * (weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") < 6 && hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12 ? 2 : 1)' +
          ' * (weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") < 6 && hour("Asia/Shanghai") >= 14 && hour("Asia/Shanghai") < 18 ? 2 : 1)'
      )
    )

    // Two ×2 windows are the same rate, so they collapse into one Peak row;
    // the base rate is what remains outside them — the off-peak price.
    expect(variants).toHaveLength(2)
    expect(variants[0].labelKey).toBe('Peak Hours')
    expect(variants[0].multiplier).toBe(2)
    expect(variants[0].windows).toHaveLength(2)
    expect(variants[1].labelKey).toBe('Off-Peak Hours')
    expect(variants[1].multiplier).toBe(1)
    expect(variants[1].windows).toHaveLength(0)
  })

  test('labels a discount window Off-Peak and the base rate Peak', () => {
    const variants = getTimeRateVariants(
      tieredModel(
        '(tier("base", p * 1 + c * 2)) * (hour("UTC") >= 22 || hour("UTC") < 6 ? 0.5 : 1)'
      )
    )

    expect(variants.map((v) => [v.labelKey, v.multiplier])).toEqual([
      ['Peak Hours', 1],
      ['Off-Peak Hours', 0.5],
    ])
    expect(formatTimeWindows(variants[1].windows, t)).toBe('22:00–06:00 (UTC)')
  })

  test('disambiguates two surcharge rates by their multiplier', () => {
    const variants = getTimeRateVariants(
      tieredModel(
        '(tier("base", p * 1 + c * 2))' +
          ' * (hour("UTC") >= 9 && hour("UTC") < 12 ? 3 : 1)' +
          ' * (hour("UTC") >= 14 && hour("UTC") < 18 ? 2 : 1)'
      )
    )

    expect(variants.map((v) => timeRateVariantLabel(v, t))).toEqual([
      'Peak Hours ×3',
      'Peak Hours ×2',
      'Off-Peak Hours',
    ])
  })

  test('mixed surcharge and discount leave the base rate as Standard', () => {
    const variants = getTimeRateVariants(
      tieredModel(
        '(tier("base", p * 1 + c * 2))' +
          ' * (hour("UTC") >= 9 && hour("UTC") < 12 ? 2 : 1)' +
          ' * (hour("UTC") >= 0 && hour("UTC") < 6 ? 0.5 : 1)'
      )
    )

    expect(variants.map((v) => [v.labelKey, v.multiplier])).toEqual([
      ['Peak Hours', 2],
      ['Standard', 1],
      ['Off-Peak Hours', 0.5],
    ])
  })

  test('refuses to state rows for rules that also read the request', () => {
    // A param-conditional multiplier varies per request; the model keeps the
    // generic time-aware treatment instead of a wrong static row.
    expect(
      getTimeRateVariants(
        tieredModel(
          '(tier("base", p * 1 + c * 2))' +
            ' * (hour("UTC") >= 9 && hour("UTC") < 12 ? 2 : 1)' +
            ' * (param("service_tier") == "flex" ? 0.5 : 1)'
        )
      )
    ).toEqual([])
  })

  test('returns nothing for a plain tiered expression without rules', () => {
    expect(
      getTimeRateVariants(tieredModel('tier("base", p * 5 + c * 25)'))
    ).toEqual([])
  })
})

describe('formatTimeWindows', () => {
  test('reads weekday and hour bounds as day and clock ranges', () => {
    const variants = getTimeRateVariants(
      tieredModel(
        '(tier("base", p * 1 + c * 2))' +
          ' * (weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") < 6 && hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12 ? 2 : 1)'
      )
    )

    expect(formatTimeWindows(variants[0].windows, t)).toBe(
      'Mon–Fri 09:00–12:00 (Asia/Shanghai)'
    )
  })

  test('keeps the literal condition for shapes with no friendlier reading', () => {
    const variants = getTimeRateVariants(
      tieredModel('(tier("base", p * 1 + c * 2)) * (day("UTC") >= 15 ? 2 : 1)')
    )

    expect(formatTimeWindows(variants[0].windows, t)).toBe('Day ≥ 15 (UTC)')
  })
})
