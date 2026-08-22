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
    // Column shares follow the design's fixed track, with the model column
    // widened: at the design's 18% it cut model ids mid-name from ~22
    // characters up (`deepseek-v4-flash-0731`), while the price and savings
    // columns carry right-aligned figures far narrower than their share. The
    // four price columns stay equal, which is what keeps the longest benchmark
    // header — Vietnamese "OpenRouter Đầu vào / 1M" — on one line. Names longer
    // than the wider column still truncate; the row's tooltip carries them.
    {
      key: 'model',
      label: t('Model'),
      align: 'text-left',
      width: 'w-[26%]',
    },
    {
      key: 'fr-input',
      label: t('FR Input / 1M'),
      align: 'text-right',
      width: 'w-[13.5%]',
    },
    {
      key: 'fr-output',
      label: t('FR Output / 1M'),
      align: 'text-right',
      width: 'w-[13.5%]',
    },
    {
      key: 'bench-input',
      label: benchInputLabel,
      align: 'text-right',
      width: 'w-[13.5%]',
    },
    {
      key: 'bench-output',
      label: benchOutputLabel,
      align: 'text-right',
      width: 'w-[13.5%]',
    },
    {
      key: 'savings',
      label: t('Savings'),
      align: 'text-right',
      width: 'w-[14%]',
    },
    {
      key: 'detail',
      label: '',
      align: 'text-right',
      width: 'w-[6%]',
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
      {/* Headers never wrap; below the width where the longest locale's
       * headers still fit on one line, the table scrolls sideways instead of
       * breaking the row rhythm. That width is what the minimum encodes: at
       * 1160px the price columns are 156px, enough for the 149px Vietnamese
       * benchmark header to clear the one beside it. */}
      <div className='overflow-x-auto'>
        <table className='w-full min-w-[1160px] table-fixed text-sm'>
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
                  className={`px-6 py-[18px] text-xs font-extrabold whitespace-nowrap text-(--pd-muted) ${column.align}`}
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
    </div>
  )
}
