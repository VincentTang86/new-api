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
import { LANDING_PROVIDERS } from '../../lib/providers'
import type { LandingProviderKey } from '../../types'

interface ProviderMarkProps {
  provider: LandingProviderKey
  /**
   * The home preview reduces the vendor to an accent dot; the catalogue page
   * gives it the full brand chip.
   */
  variant: 'dot' | 'chip'
}

/**
 * Vendor marker beside a model name. Decorative — the vendor is already
 * conveyed by the model name next to it, so it carries no accessible name.
 */
export function ProviderMark(props: ProviderMarkProps) {
  const provider = LANDING_PROVIDERS[props.provider]

  if (props.variant === 'dot') {
    return (
      <span
        aria-hidden
        className='inline-block size-2 shrink-0 rounded-full'
        style={{ backgroundColor: provider?.dot ?? 'currentColor' }}
      />
    )
  }

  return (
    <span
      aria-hidden
      className='flex size-7 shrink-0 items-center justify-center rounded'
      style={{ background: provider?.chip.bg }}
    >
      <provider.chip.Icon size={14} className='text-white' />
    </span>
  )
}
