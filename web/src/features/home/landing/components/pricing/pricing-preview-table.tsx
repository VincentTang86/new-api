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

import type { LandingModelRow } from '../../types'
import type { PricingListVariant } from './pricing-model-list'
import { PricingPreviewRow } from './pricing-preview-row'

/**
 * Column order and tone are part of the design contract: our prices first in
 * indigo, the vendor list prices next in muted grey, then the derived savings
 * in emerald. The catalogue page trades context-column width for the model
 * name, which carries a brand chip there.
 */
const COLUMNS = [
  {
    key: 'model',
    label: 'Model',
    align: 'text-left',
    tone: 'text-gray-500',
    width: { preview: 'w-[22%]', catalogue: 'w-[24%]' },
  },
  {
    key: 'input',
    label: 'Input / 1M',
    align: 'text-right',
    tone: 'text-indigo-600',
    width: { preview: 'w-[11%]', catalogue: 'w-[11%]' },
  },
  {
    key: 'output',
    label: 'Output / 1M',
    align: 'text-right',
    tone: 'text-indigo-600',
    width: { preview: 'w-[11%]', catalogue: 'w-[11%]' },
  },
  {
    key: 'official-input',
    label: 'Official input / 1M',
    align: 'text-right',
    tone: 'text-gray-400',
    width: { preview: 'w-[11%]', catalogue: 'w-[11%]' },
  },
  {
    key: 'official-output',
    label: 'Official output / 1M',
    align: 'text-right',
    tone: 'text-gray-400',
    width: { preview: 'w-[11%]', catalogue: 'w-[11%]' },
  },
  {
    key: 'input-savings',
    label: 'Input savings',
    align: 'text-right',
    tone: 'text-emerald-600',
    width: { preview: 'w-[9%]', catalogue: 'w-[9%]' },
  },
  {
    key: 'output-savings',
    label: 'Output savings',
    align: 'text-right',
    tone: 'text-emerald-600',
    width: { preview: 'w-[9%]', catalogue: 'w-[9%]' },
  },
  {
    key: 'context',
    label: 'Context',
    align: 'text-right',
    tone: 'text-gray-500',
    width: { preview: 'w-[8%]', catalogue: 'w-[7%]' },
  },
  {
    key: 'detail',
    label: '',
    align: 'text-right',
    tone: 'text-gray-500',
    width: { preview: 'w-[8%]', catalogue: 'w-[7%]' },
  },
] as const

interface PricingPreviewTableProps {
  rows: readonly LandingModelRow[]
  variant: PricingListVariant
}

export function PricingPreviewTable(props: PricingPreviewTableProps) {
  const { t } = useTranslation()

  return (
    <div
      data-slot='pricing-table'
      className='hidden overflow-hidden rounded-md border border-gray-200 md:block'
    >
      <table className='w-full table-fixed text-sm'>
        <colgroup>
          {COLUMNS.map((column) => (
            <col key={column.key} className={column.width[props.variant]} />
          ))}
        </colgroup>
        <thead>
          <tr className='border-b border-gray-200 bg-gray-50'>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope='col'
                className={`px-4 py-3 text-xs font-medium tracking-wider uppercase ${column.align} ${column.tone}`}
              >
                {column.label ? t(column.label) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <PricingPreviewRow
              key={row.modelId}
              row={row}
              variant={props.variant}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
