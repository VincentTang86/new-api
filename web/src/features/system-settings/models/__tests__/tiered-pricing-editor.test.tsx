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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { tryParsePerRequestConfig } from '@/features/pricing/lib/per-request-expr'

import { TieredPricingEditor } from '../tiered-pricing-editor'

const PER_IMAGE_EXPR =
  '(param("n") == nil ? 1 : param("n")) * ((param("resolution") == "2k") ? tier("2k-low", 60000) : tier("1k-low", 40000))'

describe('TieredPricingEditor with an expression the visual editor cannot show', () => {
  test('opens in expression mode and does not write a placeholder back', () => {
    const onBillingExprChange = vi.fn()
    const onRequestRuleExprChange = vi.fn()

    render(
      <TieredPricingEditor
        modelName='grok-imagine-image-2.0'
        billingExpr={PER_IMAGE_EXPR}
        requestRuleExpr=''
        onBillingExprChange={onBillingExprChange}
        onRequestRuleExprChange={onRequestRuleExprChange}
      />
    )

    expect(
      screen.getByPlaceholderText('tier("base", p * 3 + c * 15)')
    ).toHaveValue(PER_IMAGE_EXPR)
    // The stored expression must survive open → save untouched.
    expect(onBillingExprChange).not.toHaveBeenCalled()
  })

  test('keeps an expression that arrives after mount', () => {
    const onBillingExprChange = vi.fn()
    const onRequestRuleExprChange = vi.fn()

    const { rerender } = render(
      <TieredPricingEditor
        modelName='grok-imagine-image-2.0'
        billingExpr=''
        requestRuleExpr=''
        onBillingExprChange={onBillingExprChange}
        onRequestRuleExprChange={onRequestRuleExprChange}
      />
    )
    rerender(
      <TieredPricingEditor
        modelName='grok-imagine-image-2.0'
        billingExpr={PER_IMAGE_EXPR}
        requestRuleExpr=''
        onBillingExprChange={onBillingExprChange}
        onRequestRuleExprChange={onRequestRuleExprChange}
      />
    )

    expect(
      screen.getByPlaceholderText('tier("base", p * 3 + c * 15)')
    ).toHaveValue(PER_IMAGE_EXPR)
    expect(onBillingExprChange).not.toHaveBeenCalled()
  })
})

describe('the Grok Imagine Image 2.0 preset', () => {
  test('bills the four official resolution × quality cells plus input images', async () => {
    const onBillingExprChange = vi.fn()

    render(
      <TieredPricingEditor
        modelName='grok-imagine-image-2.0'
        billingExpr=''
        requestRuleExpr=''
        onBillingExprChange={onBillingExprChange}
        onRequestRuleExprChange={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('More templates...'))
    fireEvent.click(screen.getByText('Grok Imagine Image 2.0'))

    // xAI's published grid: one price per cell, the same for text-to-image
    // and edits, so no rule looks at whether an input image is attached.
    const expected =
      '(param("n") == nil ? 1 : param("n")) * (param("resolution") == "2k" && param("quality") == "medium" ? tier("2k-medium", 80000) : param("resolution") == "2k" ? tier("2k-low", 60000) : param("quality") == "medium" ? tier("1k-medium", 60000) : tier("1k-low", 40000)) + (param("images.#") == nil ? (param("image") != nil ? 1 : 0) : param("images.#")) * 10000'
    await waitFor(() =>
      expect(onBillingExprChange).toHaveBeenLastCalledWith(expected)
    )
    const config = tryParsePerRequestConfig(expected)
    expect(config?.rules.map((rule) => [rule.label, rule.price])).toEqual([
      ['2k-medium', '0.08'],
      ['2k-low', '0.06'],
      ['1k-medium', '0.06'],
    ])
    expect(config?.inputImagePrice).toBe('0.01')
  })
})
