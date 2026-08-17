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

import type { PricingModel } from '@/features/pricing/types'

import { summarizeLandingModels } from '../use-landing-model-summary'

function model(
  modelName: string,
  vendorName?: string,
  id = 1
): PricingModel & { vendor_name?: string } {
  return {
    id,
    model_name: modelName,
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
    group_ratio: { default: 1 },
    vendor_name: vendorName,
  }
}

describe('summarizeLandingModels', () => {
  test('states the served model count and the vendors behind it', () => {
    const summary = summarizeLandingModels([
      model('gpt-4o', 'OpenAI', 1),
      model('claude-sonnet-4', 'Anthropic', 2),
      model('gpt-4o-mini', 'OpenAI', 3),
    ])

    expect(summary.count).toBe(3)
    // Deduplicated, and ordered by the hero logo row rather than by catalog
    // order, so the FAQ sentence matches the logos above it.
    expect(summary.providers).toEqual(['OpenAI', 'Anthropic'])
  })

  test('resolves the vendor from the model id when the backend has none', () => {
    const summary = summarizeLandingModels([model('qwen3.7-max')])

    expect(summary.count).toBe(1)
    expect(summary.providers).toEqual(['Alibaba'])
  })

  test('counts a model whose vendor cannot be resolved but names no brand', () => {
    const summary = summarizeLandingModels([model('house-model-v1')])

    expect(summary.count).toBe(1)
    expect(summary.providers).toEqual([])
  })

  test('reports an unknown count for an empty catalog so the copy drops the number', () => {
    // Anonymous visitors get nothing when /api/pricing requires login; the
    // marketing copy must not turn that into "0 curated models".
    const summary = summarizeLandingModels([])

    expect(summary.count).toBe(null)
    expect(summary.providers).toEqual([])
  })
})
