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

import type { PricingRow } from '../../types'
import { PricingPreviewAccordion } from './pricing-preview-accordion'
import { PricingPreviewTable } from './pricing-preview-table'

/**
 * `preview` is the home page's condensed table: an accent dot for the vendor
 * and a narrower name column. `catalogue` is the models & pricing page: brand
 * chips, a wider name column, and a detail link inside each expanded phone row.
 */
export type PricingListVariant = 'preview' | 'catalogue'

interface PricingModelListProps {
  rows: readonly PricingRow[]
  variant: PricingListVariant
  /** The data is fetched live from /api/pricing, so surface its async states. */
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
}

const SKELETON_ROW_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6']

/**
 * One responsive presentation of the catalogue: a nine-column table from `md`
 * up, a per-model accordion below it. Shared by both pages so they never drift.
 * Owns the loading / error / empty states of the live pricing feed.
 */
export function PricingModelList(props: PricingModelListProps) {
  const { t } = useTranslation()

  if (props.isLoading) {
    return (
      <div className='overflow-hidden rounded-md border border-gray-200'>
        {SKELETON_ROW_KEYS.map((key) => (
          <div
            key={key}
            className='flex items-center gap-3 border-b border-gray-100 px-4 py-4 last:border-b-0'
          >
            <div className='size-7 shrink-0 animate-pulse rounded bg-gray-100' />
            <div className='h-4 w-40 animate-pulse rounded bg-gray-100' />
            <div className='ml-auto h-4 w-24 animate-pulse rounded bg-gray-100' />
          </div>
        ))}
      </div>
    )
  }

  if (props.isError) {
    return (
      <div className='rounded-md border border-dashed border-gray-200 px-4 py-12 text-center'>
        <p className='text-sm text-gray-500'>
          {t('Could not load models. Please try again.')}
        </p>
        {props.onRetry ? (
          <button
            type='button'
            onClick={props.onRetry}
            className='mt-3 text-xs text-indigo-600 transition-colors hover:text-indigo-800'
          >
            {t('Retry')}
          </button>
        ) : null}
      </div>
    )
  }

  if (props.rows.length === 0) {
    return (
      <p className='rounded-md border border-dashed border-gray-200 px-4 py-12 text-center text-sm text-gray-500'>
        {t('No models are available right now.')}
      </p>
    )
  }

  return (
    <>
      <PricingPreviewTable rows={props.rows} variant={props.variant} />
      <PricingPreviewAccordion rows={props.rows} variant={props.variant} />
    </>
  )
}
