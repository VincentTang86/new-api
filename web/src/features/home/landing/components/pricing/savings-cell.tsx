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
import { useTranslation } from 'react-i18next'

import { LANDING_PRICE_PLACEHOLDER } from '../../lib/pricing'
import type { PricingRow } from '../../types'

interface SavingsBadgeProps {
  row: PricingRow
}

/**
 * The design's combined savings pill: "In 20% · Out 20%" on the success tint.
 * Per-request rows carry a single figure; when no honest claim exists for the
 * selected benchmark the cell degrades to a muted dash. The percentages are
 * computed in build-pricing-rows.
 */
export function SavingsBadge(props: SavingsBadgeProps) {
  const { t } = useTranslation()
  const row = props.row

  const hasInput = row.savingsInput !== LANDING_PRICE_PLACEHOLDER
  const hasOutput =
    !row.isPerRequest && row.savingsOutput !== LANDING_PRICE_PLACEHOLDER

  let label = ''
  if (row.isPerRequest) {
    if (hasInput) label = row.savingsInput
  } else if (hasInput && hasOutput) {
    label = t('In {{in}} · Out {{out}}', {
      in: row.savingsInput,
      out: row.savingsOutput,
    })
  } else if (hasInput) {
    label = t('In {{in}}', { in: row.savingsInput })
  } else if (hasOutput) {
    label = t('Out {{out}}', { out: row.savingsOutput })
  }

  if (!label) {
    return (
      <span className='text-(--pd-faint)'>{LANDING_PRICE_PLACEHOLDER}</span>
    )
  }

  return (
    <span className='inline-flex rounded-md bg-(--pd-success-bg) px-2 py-1 text-xs font-bold whitespace-nowrap text-(--pd-success)'>
      {label}
    </span>
  )
}
