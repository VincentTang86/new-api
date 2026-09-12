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

import { buildMediaPricingRows } from '../build-media-pricing-rows'
import { buildPricingRows } from '../build-pricing-rows'
import { LANDING_PRICE_PLACEHOLDER } from '../pricing'

// A token-billed image model (Nano Banana shape): billed by expression, listed
// per image beside the benchmark prices. 1K is the cheapest listed size.
function imageModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'gemini-3-pro-image',
    vendor_name: 'Google',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 6,
    enable_groups: ['default'],
    output_modalities: ['image', 'text'],
    billing_mode: 'tiered_expr',
    billing_expr: 'tier("base", p * 2 + c * 12 + img_o * 120)',
    image_prices: [
      { size: '1K', price: 0.134 },
      { size: '4K', price: 0.24 },
    ],
    official_price: {
      output: 12,
      per_image: [
        { size: '1K', price: 0.16 },
        { size: '4K', price: 0.32 },
      ],
    },
    ...overrides,
  }
}

function build(model: PricingModel, groupRatio = { default: 1 }) {
  return buildMediaPricingRows({
    models: [model],
    kind: 'image',
    language: 'en',
    selectedGroup: 'default',
    groupRatio,
    benchmark: 'official',
  })
}

function buildVideo(model: PricingModel, groupRatio = { default: 1 }) {
  return buildMediaPricingRows({
    models: [model],
    kind: 'video',
    language: 'en',
    selectedGroup: 'default',
    groupRatio,
    benchmark: 'official',
  })
}

describe('buildMediaPricingRows', () => {
  test('prices "from" the cheapest listed size and compares the same size', () => {
    const [row] = build(imageModel())
    expect(row.size).toBe('1K')
    expect(row.frPrice).toBe('$0.134')
    expect(row.benchmarkPrice).toBe('$0.16')
    // (0.16 - 0.134) / 0.16 = 16.25% → whole percent
    expect(row.savings).toBe('16%')
  })

  test('scales the gateway price by the group ratio, the benchmark stays fixed', () => {
    const [row] = build(imageModel(), { default: 0.5 })
    expect(row.frPrice).toBe('$0.067')
    expect(row.benchmarkPrice).toBe('$0.16')
    expect(row.savings).toBe('58%')
  })

  test('claims no saving when the benchmark lacks the compared size', () => {
    const [row] = build(
      imageModel({
        official_price: { per_image: [{ size: '2K', price: 0.2 }] },
      })
    )
    // The source's cheapest price is still shown so the column is not empty.
    expect(row.benchmarkPrice).toBe('$0.20')
    expect(row.savings).toBe(LANDING_PRICE_PLACEHOLDER)
  })

  test('a per-call image model without a per-image list states its per-call price', () => {
    const [row] = build(
      imageModel({
        model_name: 'grok-imagine-image',
        quota_type: 1,
        model_price: 0.04,
        billing_mode: undefined,
        billing_expr: undefined,
        image_prices: undefined,
        official_price: { per_image: [{ size: '1K', price: 0.07 }] },
      })
    )
    expect(row.size).toBe('')
    expect(row.frPrice).toBe('$0.04')
    expect(row.benchmarkPrice).toBe('$0.07')
    expect(row.savings).toBe('43%')
  })

  test('a token image model without a per-image list shows dashes, never a token price', () => {
    const [row] = build(imageModel({ image_prices: undefined }))
    expect(row.frPrice).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(row.savings).toBe(LANDING_PRICE_PLACEHOLDER)
  })

  // The Image tab labels its rows the same way the token catalogue does: an
  // admin-configured display name replaces the model id, line breaks included.
  test('shows the configured display name, line breaks and all', () => {
    const [row] = build(
      imageModel({ display_name: 'Gemini 3 Pro Image\n(Nano Banana Pro)' })
    )
    expect(row.name).toBe('Gemini 3 Pro Image\n(Nano Banana Pro)')
    expect(row.modelId).toBe('gemini-3-pro-image')
  })

  test('image models leave the token catalogue and only they join the image one', () => {
    const text = imageModel({
      model_name: 'gemini-3.1-pro-preview',
      output_modalities: ['text'],
    })
    const models = [imageModel(), text]
    const imageRows = buildMediaPricingRows({
      models,
      kind: 'image',
      selectedGroup: 'default',
      groupRatio: { default: 1 },
      benchmark: 'official',
    })
    const tokenRows = buildPricingRows({
      models,
      catalog: {},
      selectedGroup: 'default',
      groupRatio: { default: 1 },
      benchmark: 'official',
    })
    expect(imageRows.map((row) => row.modelId)).toEqual(['gemini-3-pro-image'])
    expect(tokenRows.map((row) => row.modelId)).toEqual([
      'gemini-3.1-pro-preview',
    ])
  })

  test('every image row states its unit as per image', () => {
    expect(build(imageModel())[0].unit).toBe('image')
  })
})

// Seedance shape: billed per token, listed per second of video beside the
// benchmark prices. 480p is the cheapest listed resolution.
function videoModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 2,
    model_name: 'seedance-2.0',
    vendor_name: 'ByteDance',
    quota_type: 0,
    model_ratio: 5.95,
    completion_ratio: 1,
    enable_groups: ['default'],
    output_modalities: ['video'],
    video_prices: [
      { size: '480p', price: 0.114 },
      { size: '720p', price: 0.257 },
    ],
    official_price: {
      per_second: [
        { size: '480p', price: 0.2 },
        { size: '720p', price: 0.45 },
      ],
    },
    ...overrides,
  }
}

describe('buildMediaPricingRows for video', () => {
  test('prices "from" the cheapest listed resolution and compares the same one', () => {
    const [row] = buildVideo(videoModel())
    expect(row.unit).toBe('second')
    expect(row.size).toBe('480p')
    expect(row.frPrice).toBe('$0.114')
    expect(row.benchmarkPrice).toBe('$0.20')
    // (0.2 - 0.114) / 0.2 = 43%
    expect(row.savings).toBe('43%')
  })

  test('scales the gateway price by the group ratio, the benchmark stays fixed', () => {
    const [row] = buildVideo(videoModel(), { default: 0.5 })
    expect(row.frPrice).toBe('$0.057')
    expect(row.benchmarkPrice).toBe('$0.20')
  })

  // A per-call video model prices the whole clip. Quoting that as a per-second
  // price would understate it by however many seconds the clip runs, so the
  // row must carry the 'video' unit and no size label.
  test('a per-call video model is priced per video, never per second', () => {
    const [row] = buildVideo(
      videoModel({
        model_name: 'MiniMax-H3',
        quota_type: 1,
        model_ratio: 0,
        model_price: 0.0714,
        video_prices: undefined,
        official_price: undefined,
      })
    )
    expect(row.unit).toBe('video')
    expect(row.size).toBe('')
    expect(row.frPrice).toBe('$0.0714')
    expect(row.benchmarkPrice).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(row.savings).toBe(LANDING_PRICE_PLACEHOLDER)
  })

  test('the video tab lists only models that output video', () => {
    const rows = buildMediaPricingRows({
      models: [videoModel(), imageModel()],
      kind: 'video',
      selectedGroup: 'default',
      groupRatio: { default: 1 },
      benchmark: 'official',
    })
    expect(rows.map((row) => row.modelId)).toEqual(['seedance-2.0'])
  })

  test('no per-second prices configured yields a placeholder, not a token price', () => {
    const [row] = buildVideo(
      videoModel({ video_prices: undefined, official_price: undefined })
    )
    expect(row.frPrice).toBe(LANDING_PRICE_PLACEHOLDER)
    expect(row.savings).toBe(LANDING_PRICE_PLACEHOLDER)
  })
})
