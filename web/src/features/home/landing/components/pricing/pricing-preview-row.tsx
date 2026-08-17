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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { LANDING_PRICE_PLACEHOLDER } from '../../lib/pricing'
import type { PricingRow } from '../../types'
import type { PricingListVariant } from './pricing-model-list'
import { ProviderMark } from './provider-mark'
import { SavingsBadge } from './savings-cell'

interface PricingPreviewRowProps {
  row: PricingRow
  variant: PricingListVariant
}

export function PricingPreviewRow(props: PricingPreviewRowProps) {
  const { t } = useTranslation()
  const row = props.row

  // Per-request models bill by call, so the discounted price lives in the input
  // cell as "$X / call" and the output cell has no meaning.
  const frInput = row.isPerRequest
    ? t('{{price}} / call', { price: row.frInput })
    : row.frInput
  const frOutput = row.isPerRequest ? LANDING_PRICE_PLACEHOLDER : row.frOutput

  return (
    <tr className='border-b border-(--pd-border) transition-colors last:border-b-0 odd:bg-(--pd-surface) even:bg-(--pd-surface-alt) hover:bg-(--pd-accent-bg-hover)'>
      <th scope='row' className='px-6 py-4 text-left font-normal'>
        <div className='flex items-center gap-2.5'>
          <ProviderMark
            provider={row.provider}
            label={row.vendorLabel}
            variant={props.variant === 'preview' ? 'dot' : 'chip'}
          />
          <span className='truncate font-mono text-sm font-bold text-(--pd-ink-strong)'>
            {row.name}
          </span>
        </div>
      </th>
      <td className='px-6 py-4 text-right font-mono text-sm font-bold text-(--pd-ink)'>
        {frInput}
      </td>
      <td className='px-6 py-4 text-right font-mono text-sm font-bold text-(--pd-ink)'>
        {frOutput}
      </td>
      <td className='px-6 py-4 text-right font-mono text-sm text-(--pd-muted)'>
        {row.officialInput}
      </td>
      <td className='px-6 py-4 text-right font-mono text-sm text-(--pd-muted)'>
        {row.officialOutput}
      </td>
      <td className='px-6 py-4 text-right'>
        <SavingsBadge row={row} />
      </td>
      <td className='px-6 py-4 text-right'>
        <Link
          to='/pricing/$modelId'
          params={{ modelId: row.modelId }}
          className='pd-font-ui text-[13px] font-medium whitespace-nowrap text-(--pd-primary) transition-opacity hover:opacity-80'
        >
          {t('View →')}
        </Link>
      </td>
    </tr>
  )
}
