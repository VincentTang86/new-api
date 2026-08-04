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
import {
  Alibaba,
  Anthropic,
  DeepSeek,
  Doubao,
  Google,
  Kimi,
  Meta,
  Minimax,
  OpenAI,
  XAI,
  Zhipu,
} from '@lobehub/icons'
import type { ComponentType } from 'react'

import type { LandingProviderKey } from '../types'

type ProviderIcon = ComponentType<{
  size?: number
  className?: string
  'aria-hidden'?: boolean
}>

export interface LandingProvider {
  /** Vendor name. Brand literal, never translated. */
  label: string
  /**
   * Provider chip in the hero row: the design's brand fill with the vendor mark
   * on top. Google's fill is light, so it carries the multi-colour mark instead
   * of the white monochrome one.
   */
  chip: { bg: string; Icon: ProviderIcon }
  /**
   * Brand accent for the pricing-table row marker. This is vendor identity, not
   * theme palette, so it stays a literal in both light and dark.
   */
  dot: string
}

/**
 * Named imports, not `import * as` — this ships in the unauthenticated entry
 * bundle and the @lobehub/icons barrel is large.
 *
 * Each default export IS the Mono variant (the compound type is
 * `typeof Mono & { Avatar, Text, ... }`), so the chip marks render with
 * currentColor and one set covers both themes.
 */
export const LANDING_PROVIDERS: Record<LandingProviderKey, LandingProvider> = {
  openai: {
    label: 'OpenAI',
    chip: { bg: '#000000', Icon: OpenAI },
    dot: '#10a37f',
  },
  anthropic: {
    label: 'Anthropic',
    chip: { bg: '#c97a52', Icon: Anthropic },
    dot: '#d4793a',
  },
  google: {
    label: 'Google',
    chip: { bg: '#f1f3f4', Icon: Google.Color },
    dot: '#4285f4',
  },
  deepseek: {
    label: 'DeepSeek',
    chip: { bg: '#1a3c8f', Icon: DeepSeek },
    dot: '#1a56db',
  },
  meta: { label: 'Meta', chip: { bg: '#0082fb', Icon: Meta }, dot: '#0082fb' },
  alibaba: {
    label: 'Alibaba',
    chip: { bg: '#ff6a00', Icon: Alibaba },
    dot: '#ff6a00',
  },
  kimi: { label: 'Kimi', chip: { bg: '#5b4fd4', Icon: Kimi }, dot: '#6c5ce7' },
  zhipu: {
    label: 'Zhipu',
    chip: { bg: '#00a35a', Icon: Zhipu },
    dot: '#00b96b',
  },
  minimax: {
    label: 'MiniMax',
    chip: { bg: '#111827', Icon: Minimax },
    dot: '#1a1a2e',
  },
  doubao: {
    label: 'Doubao',
    chip: { bg: '#2c52e8', Icon: Doubao },
    dot: '#3051f1',
  },
  xai: { label: 'xAI', chip: { bg: '#111111', Icon: XAI }, dot: '#111111' },
}
