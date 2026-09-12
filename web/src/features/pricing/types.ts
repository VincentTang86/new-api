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
// ----------------------------------------------------------------------------
// Pricing Types
// ----------------------------------------------------------------------------

export type PricingVendor = {
  id: number
  name: string
  icon?: string
  description?: string
}

export type PricingModel = {
  id: number
  model_name: string
  /** Admin-configured label shown in place of model_name; may contain "\n". */
  display_name?: string
  description?: string
  /** Per-language description keyed by standard locale codes (en, zh-CN, ...). */
  description_i18n?: Record<string, string>
  icon?: string
  vendor_id?: number
  /** Model-level override shown to users in place of vendor_name when set. */
  vendor_display_name?: string
  vendor_name?: string
  vendor_icon?: string
  vendor_description?: string
  quota_type: number
  model_ratio: number
  /** True when no ratio is configured and model_ratio carries the backend
   * fallback (37.5) — never a real selling price. */
  unset_ratio?: boolean
  completion_ratio: number
  model_price?: number
  /**
   * USD per input image: a per-call model's fixed add-on, overridden by the
   * admin-entered gateway row of the benchmark prices when that is filled.
   */
  image_input_price?: number | null
  cache_ratio?: number | null
  create_cache_ratio?: number | null
  image_ratio?: number | null
  audio_ratio?: number | null
  audio_completion_ratio?: number | null
  enable_groups: string[]
  tags?: string
  supported_endpoint_types?: string[]
  key?: string
  group_ratio?: Record<string, number>
  /** Billing mode (e.g. "tiered_expr") used to flag dynamic pricing */
  billing_mode?: string
  /** Raw expression describing dynamic / tiered billing */
  billing_expr?: string
  /** Admin-configured external list prices (USD per 1M tokens). */
  official_price?: ReferencePrice
  openrouter_price?: ReferencePrice
  /**
   * The gateway's own per-image list prices for an image model (USD per
   * image at group ratio 1), maintained beside the benchmark prices. Display
   * only: billing still runs on the expression or the per-call price.
   */
  image_prices?: ImageSizePrice[]
  /**
   * The gateway's own per-second list prices for a video model (USD per second
   * of video at group ratio 1), maintained the same way as `image_prices`.
   * Display only: billing still runs on the tokens the upstream reports.
   */
  video_prices?: ImageSizePrice[]
  /**
   * The video model's billing tiers — output resolution crossed with whether
   * the input carries a video. Each ratio multiplies the model's base rate,
   * and is read straight off the billing lookup, so the drawer's /Token matrix
   * states what the request would actually be charged.
   */
  video_rates?: VideoRate[]
  /** Pricing version returned by backend, useful for cache busting */
  pricing_version?: string
  /**
   * Optional model metadata fields reserved for backend-provided catalog data.
   * Keep them data-driven; do not synthesize display values on the client.
   */
  context_length?: number
  max_output_tokens?: number
  knowledge_cutoff?: string
  release_date?: string
  parameter_count?: string
  input_modalities?: Modality[]
  output_modalities?: Modality[]
  capabilities?: ModelCapability[]
}

/**
 * One external benchmark's list prices for a model, USD per 1M tokens.
 * Maintained by admins in the reference-pricing table; absent lanes mean the
 * source has no such price.
 */
export type ReferencePriceLanes = {
  input?: number | null
  output?: number | null
  cached_input?: number | null
  cache_creation?: number | null
  cache_creation_1h?: number | null
  cache_hit?: number | null
  image_input?: number | null
  image_output?: number | null
}

/**
 * One listed price of a media model: a tier label and a USD price. Image
 * models list it per image (the label is a size/quality), video models per
 * second of video (the label is an output resolution).
 */
export type ImageSizePrice = {
  size: string
  price: number
}

/**
 * One billing tier of a video model: an output resolution crossed with whether
 * the input carries a video, and the multiplier applied to the model's base
 * rate. `key` is the stable storage key shared with the resolution-ratio
 * setting and with per-condition reference prices.
 */
export type VideoRate = {
  key: string
  /** Column header; a tier covering several resolutions reads "480p / 720p". */
  resolution: string
  with_video: boolean
  ratio: number
}

/**
 * A source's full reference price: the flat lanes are the default price
 * (what the landing comparison and dashboard estimate consume); by_condition
 * holds per-rate-condition overrides keyed by `rateConditionKey`, consumed
 * only by the model details drawer.
 */
export type ReferencePrice = ReferencePriceLanes & {
  by_condition?: Record<string, ReferencePriceLanes>
  /** The source's per-image list prices, in display order. */
  per_image?: ImageSizePrice[]
  /** The source's charge per input image (USD), for image-to-image models. */
  per_image_input?: number | null
  /** The source's per-second list prices for a video model, in display order. */
  per_second?: ImageSizePrice[]
}

/** Input/output modalities supported by a model. */
export type Modality = 'text' | 'image' | 'audio' | 'video' | 'file'

/** Functional capabilities a model exposes. */
export type ModelCapability =
  | 'function_calling'
  | 'streaming'
  | 'vision'
  | 'json_mode'
  | 'structured_output'
  | 'reasoning'
  | 'tools'
  | 'system_prompt'
  | 'web_search'
  | 'code_interpreter'
  | 'caching'
  | 'embeddings'

export type PricingData = {
  success: boolean
  message?: string
  data: PricingModel[]
  vendors: PricingVendor[]
  group_ratio: Record<string, number>
  usable_group: Record<string, { desc: string; ratio: number }>
  supported_endpoint: Record<string, string>
  auto_groups: string[]
}

export type TokenUnit = 'M' | 'K'
export type PriceType =
  | 'input'
  | 'output'
  | 'cache'
  | 'create_cache'
  | 'image'
  | 'audio_input'
  | 'audio_output'
export type QuotaType = 0 | 1 // 0: token-based, 1: per-request
