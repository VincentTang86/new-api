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
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useModelDetailsDrawer } from '@/features/pricing/hooks/use-model-details-drawer'

import { LANDING_PRICE_PLACEHOLDER } from '../../lib/pricing'
import type { PricingBenchmark, PricingRow } from '../../types'
import type { PricingListVariant } from './pricing-model-list'
import { ProviderMark } from './provider-mark'
import { SavingsBadge } from './savings-cell'

interface PricingPreviewAccordionProps {
  rows: readonly PricingRow[]
  variant: PricingListVariant
  benchmark: PricingBenchmark
}

/**
 * Seven columns cannot fit a phone. Below `md` each model collapses to a row
 * that expands into the same figures as a two-column grid.
 */
export function PricingPreviewAccordion(props: PricingPreviewAccordionProps) {
  const { t } = useTranslation()
  const { openModel } = useModelDetailsDrawer()
  const panelIdPrefix = useId()
  const [openId, setOpenId] = useState<string | null>(null)

  // Full header phrases are dedicated i18n keys; see the table's comment.
  const benchInputLabel =
    props.benchmark === 'official'
      ? t('Official Input / 1M')
      : t('OpenRouter Input / 1M')
  const benchOutputLabel =
    props.benchmark === 'official'
      ? t('Official Output / 1M')
      : t('OpenRouter Output / 1M')

  return (
    <div
      data-slot='pricing-accordion'
      className='overflow-hidden rounded-2xl border border-(--pd-border) md:hidden'
    >
      {props.rows.map((row) => {
        const isOpen = openId === row.modelId
        const panelId = `${panelIdPrefix}-${row.modelId}`
        const Chevron = isOpen ? ChevronUp : ChevronDown
        const frInput = row.isPerRequest
          ? t('{{price}} / call', { price: row.frInput })
          : row.frInput
        const frOutput = row.isPerRequest
          ? LANDING_PRICE_PLACEHOLDER
          : row.frOutput
        return (
          <div
            key={row.modelId}
            className='border-b border-(--pd-border-soft) last:border-b-0'
          >
            <button
              type='button'
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenId(isOpen ? null : row.modelId)}
              className='flex w-full items-center justify-between px-4 py-3.5 text-left'
            >
              <span className='flex min-w-0 items-center gap-2.5'>
                <ProviderMark
                  provider={row.provider}
                  label={row.vendorLabel}
                  variant={props.variant === 'preview' ? 'dot' : 'chip'}
                />
                <span className='truncate font-mono text-sm font-bold text-(--pd-ink-strong)'>
                  {row.name}
                </span>
              </span>
              <Chevron size={14} className='text-(--pd-faint)' aria-hidden />
            </button>
            {isOpen && (
              <div
                id={panelId}
                className='bg-(--pd-surface-alt) px-4 pb-4 text-sm'
              >
                <dl className='grid grid-cols-2 gap-3'>
                  <div>
                    <dt className='mb-1 text-xs text-(--pd-muted-2)'>
                      {t('FR Input / 1M')}
                    </dt>
                    <dd className='font-mono font-bold text-(--pd-ink)'>
                      {frInput}
                    </dd>
                  </div>
                  <div>
                    <dt className='mb-1 text-xs text-(--pd-muted-2)'>
                      {t('FR Output / 1M')}
                    </dt>
                    <dd className='font-mono font-bold text-(--pd-ink)'>
                      {frOutput}
                    </dd>
                  </div>
                  <div>
                    <dt className='mb-1 text-xs text-(--pd-muted-2)'>
                      {benchInputLabel}
                    </dt>
                    <dd className='font-mono text-(--pd-muted)'>
                      {row.officialInput}
                    </dd>
                  </div>
                  <div>
                    <dt className='mb-1 text-xs text-(--pd-muted-2)'>
                      {benchOutputLabel}
                    </dt>
                    <dd className='font-mono text-(--pd-muted)'>
                      {row.officialOutput}
                    </dd>
                  </div>
                  <div className='col-span-2'>
                    <dt className='mb-1 text-xs text-(--pd-muted-2)'>
                      {t('Savings')}
                    </dt>
                    <dd>
                      <SavingsBadge row={row} />
                    </dd>
                  </div>
                </dl>
                {/* Tapping the row itself expands it — seven columns of
                 * figures are the point of the panel on a phone — so the
                 * details drawer opens from this button instead. */}
                <button
                  type='button'
                  onClick={() => openModel(row.modelId)}
                  className='mt-3 inline-block cursor-pointer text-[13px] font-medium text-(--pd-primary) transition-opacity hover:opacity-80'
                >
                  {t('View →')}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
