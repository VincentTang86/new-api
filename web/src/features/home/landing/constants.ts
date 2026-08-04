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
import type { LandingProviderKey } from './types'

/**
 * Horizontal rhythm the design repeats on every band: a 1440px column with
 * 32px gutters, dropping to 20px below the 640px breakpoint.
 */
export const LANDING_CONTAINER =
  'mx-auto w-full max-w-[1440px] px-8 max-[640px]:px-5'

/** Anchor targets used by the in-page CTAs. */
export const LANDING_SECTION_IDS = {
  pricing: 'pricing',
  code: 'quickstart',
  faq: 'faq',
} as const

/** Logo row order. Mirrors the order the FAQ copy lists them in. */
export const LANDING_PROVIDER_ORDER: readonly LandingProviderKey[] = [
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'meta',
  'alibaba',
  'kimi',
  'zhipu',
  'minimax',
  'doubao',
  'xai',
]

/**
 * Used only when /api/status has no server_address configured. The code sample
 * shows a real, callable base URL, so a wrong value here is user-visible.
 */
export const LANDING_FALLBACK_API_BASE_URL = 'https://api.fairrouter.com/v1'

/** Documentation fallback, matching the pattern used across public pages. */
export const LANDING_FALLBACK_DOCS_URL = 'https://docs.newapi.pro'

/**
 * Editor-dark surface for the code sample. Intentionally identical in light and
 * dark: the snippet reads as a terminal, not as page chrome.
 */
export const LANDING_CODE_SURFACE = '#0D1117'
