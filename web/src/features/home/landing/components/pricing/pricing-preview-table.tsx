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

import type { PricingBenchmark, PricingRow } from '../../types'
import type { PricingListVariant } from './pricing-model-list'
import { PricingPreviewRow } from './pricing-preview-row'

interface PricingPreviewTableProps {
  rows: readonly PricingRow[]
  variant: PricingListVariant
  benchmark: PricingBenchmark
}

/**
 * Desktop pricing table from the design: a 16px-radius card opened by a 2px
 * brand-gradient bar, FR prices bold, the benchmark columns muted, and the
 * combined savings pill before the detail link. Column order is part of the
 * design contract.
 */
export function PricingPreviewTable(props: PricingPreviewTableProps) {
  const { t } = useTranslation()

  // Full header phrases are dedicated i18n keys — concatenating a prefix onto
  // t('Input / 1M') breaks in locales whose existing translation already
  // carries a brand prefix, and word order differs per language anyway.
  const benchInputLabel =
    props.benchmark === 'official'
      ? t('Official Input / 1M')
      : t('OpenRouter Input / 1M')
  const benchOutputLabel =
    props.benchmark === 'official'
      ? t('Official Output / 1M')
      : t('OpenRouter Output / 1M')

  const columns = [
    {
      key: 'model',
      label: t('Model'),
      align: 'text-left',
      width: 'w-[24%]',
    },
    {
      key: 'fr-input',
      label: t('FR Input / 1M'),
      align: 'text-right',
      width: 'w-[12%]',
    },
    {
      key: 'fr-output',
      label: t('FR Output / 1M'),
      align: 'text-right',
      width: 'w-[12%]',
    },
    {
      key: 'bench-input',
      label: benchInputLabel,
      align: 'text-right',
      width: 'w-[13%]',
    },
    {
      key: 'bench-output',
      label: benchOutputLabel,
      align: 'text-right',
      width: 'w-[13%]',
    },
    {
      key: 'savings',
      label: t('Savings'),
      align: 'text-right',
      width: 'w-[18%]',
    },
    {
      key: 'detail',
      label: '',
      align: 'text-right',
      width: 'w-[8%]',
    },
  ] as const

  return (
    <div
      data-slot='pricing-table'
      className='hidden overflow-hidden rounded-2xl border border-(--pd-border) shadow-[0px_10px_24px_0px_rgba(0,0,0,0.04)] md:block'
    >
      <div
        aria-hidden='true'
        className='h-0.5 w-full bg-linear-to-r from-(--pd-gradient-from) to-(--pd-gradient-to)'
      />
      <table className='w-full table-fixed text-sm'>
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} className={column.width} />
          ))}
        </colgroup>
        <thead>
          <tr className='border-b border-(--pd-border) bg-(--pd-table-head)'>
            {columns.map((column) => (
              <th
                key={column.key}
                scope='col'
                className={`px-4 py-4 text-xs font-extrabold text-(--pd-muted) ${column.align}`}
              >
                {column.label || null}
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
