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
import { PricingPreviewAccordion } from './pricing-preview-accordion'
import { PricingPreviewTable } from './pricing-preview-table'

/**
 * `preview` is the home page's condensed table: an accent dot for the vendor,
 * a narrower name column, and rows under maintenance dimmed in place.
 * `catalogue` is the models & pricing page: brand chips, a wider name column,
 * and a detail link inside each expanded phone row.
 */
export type PricingListVariant = 'preview' | 'catalogue'

interface PricingModelListProps {
  rows: readonly LandingModelRow[]
  variant: PricingListVariant
}

/**
 * One responsive presentation of the catalogue: a nine-column table from `md`
 * up, a per-model accordion below it. Shared by both pages so they never drift.
 */
export function PricingModelList(props: PricingModelListProps) {
  const { t } = useTranslation()

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
