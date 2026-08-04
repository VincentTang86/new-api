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
import { LANDING_PRICE_PLACEHOLDER } from '../../lib/pricing'

interface SavingsTextProps {
  /** Pre-formatted savings string from the adapter, or the placeholder dash. */
  value: string
}

/**
 * Renders a savings figure in the accent colour, or a muted dash when there is
 * nothing to claim. The percentage itself is computed in build-pricing-rows.
 */
export function SavingsText(props: SavingsTextProps) {
  if (props.value === LANDING_PRICE_PLACEHOLDER) {
    return <span className='text-gray-400'>{LANDING_PRICE_PLACEHOLDER}</span>
  }
  return <span className='font-medium text-emerald-600'>{props.value}</span>
}
