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

import { formatInputPrice, formatOutputPrice } from '../../lib/pricing'
import type { LandingModelRow } from '../../types'
import type { PricingListVariant } from './pricing-model-list'
import { ProviderMark } from './provider-mark'
import { SavingsCell } from './savings-cell'

interface PricingPreviewRowProps {
  row: LandingModelRow
  variant: PricingListVariant
}

export function PricingPreviewRow(props: PricingPreviewRowProps) {
  const { t } = useTranslation()
  const row = props.row
  // The home preview dims models under maintenance in place; the catalogue
  // page lists every model at full weight.
  const isDimmed = props.variant === 'preview' && row.status === 'maintenance'

  return (
    <tr
      className={cn(
        'border-b border-gray-100 transition-colors last:border-b-0',
        isDimmed ? 'opacity-60' : 'hover:bg-gray-50'
      )}
    >
      <th scope='row' className='px-4 py-3.5 text-left font-normal'>
        <div className='flex items-center gap-2.5'>
          <ProviderMark
            provider={row.provider}
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
        {formatInputPrice(row.inputPrice)}
      </td>
      <td className='px-4 py-3.5 text-right font-mono font-medium text-indigo-700'>
        {formatOutputPrice(row.outputPrice)}
      </td>
      <td className='px-4 py-3.5 text-right font-mono text-gray-400 line-through'>
        {formatInputPrice(row.officialInputPrice)}
      </td>
      <td className='px-4 py-3.5 text-right font-mono text-gray-400 line-through'>
        {formatOutputPrice(row.officialOutputPrice)}
      </td>
      <td className='px-4 py-3.5 text-right font-mono'>
        <SavingsCell
          ourPrice={row.inputPrice}
          officialPrice={row.officialInputPrice}
        />
      </td>
      <td className='px-4 py-3.5 text-right font-mono'>
        <SavingsCell
          ourPrice={row.outputPrice}
          officialPrice={row.officialOutputPrice}
        />
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
