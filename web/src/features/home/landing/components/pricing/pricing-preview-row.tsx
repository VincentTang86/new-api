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

import { cn } from '@/lib/utils'

import { LANDING_PRICE_PLACEHOLDER } from '../../lib/pricing'
import type { PricingRow } from '../../types'
import type { PricingListVariant } from './pricing-model-list'
import { ProviderMark } from './provider-mark'
import { SavingsText } from './savings-cell'

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
    <tr className='border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50'>
      <th scope='row' className='px-4 py-3.5 text-left font-normal'>
        <div className='flex items-center gap-2.5'>
          <ProviderMark
            provider={row.provider}
            label={row.vendorLabel}
            variant={props.variant === 'preview' ? 'dot' : 'chip'}
          />
          <div className='min-w-0'>
            <div className='truncate font-medium text-gray-900'>{row.name}</div>
            <div className='truncate font-mono text-xs text-gray-400'>
              {row.modelId}
            </div>
          </div>
        </div>
      </th>
      <td className='px-4 py-3.5 text-right font-mono font-medium text-indigo-700'>
        {frInput}
      </td>
      <td className='px-4 py-3.5 text-right font-mono font-medium text-indigo-700'>
        {frOutput}
      </td>
      <td
        className={cn(
          'px-4 py-3.5 text-right font-mono text-gray-400',
          row.officialInput !== LANDING_PRICE_PLACEHOLDER && 'line-through'
        )}
      >
        {row.officialInput}
      </td>
      <td
        className={cn(
          'px-4 py-3.5 text-right font-mono text-gray-400',
          row.officialOutput !== LANDING_PRICE_PLACEHOLDER && 'line-through'
        )}
      >
        {row.officialOutput}
      </td>
      <td className='px-4 py-3.5 text-right font-mono'>
        <SavingsText value={row.savingsInput} />
      </td>
      <td className='px-4 py-3.5 text-right font-mono'>
        <SavingsText value={row.savingsOutput} />
      </td>
      <td className='px-4 py-3.5 text-right font-mono text-gray-500'>
        {row.context}
      </td>
      <td className='px-4 py-3.5 text-right'>
        <Link
          to='/pricing/$modelId'
          params={{ modelId: row.modelId }}
          className='text-xs whitespace-nowrap text-indigo-600 transition-colors hover:text-indigo-800'
        >
          {t('Details →')}
        </Link>
      </td>
    </tr>
  )
}
