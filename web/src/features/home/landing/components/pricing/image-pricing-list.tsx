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

import { useOpenModelDetails } from '@/features/pricing/hooks/use-model-details-drawer'

import { LANDING_PRICE_PLACEHOLDER } from '../../lib/pricing'
import type { ImagePricingRow, PricingBenchmark } from '../../types'
import { PricingListStatus } from './pricing-model-list'
import { ModelName } from './model-name'
import { ProviderMark } from './provider-mark'

interface ImagePricingListProps {
  rows: readonly ImagePricingRow[]
  /** Which benchmark the comparison column shows; names its header. */
  benchmark: PricingBenchmark
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
}

/**
 * The Image tab's catalogue, from the design: model, the gateway's "from"
 * price per image, the vendor's list price for the same size, and the saving.
 * A five-column table from `md` up, a per-model accordion below it.
 */
export function ImagePricingList(props: ImagePricingListProps) {
  const { t } = useTranslation()
  const openModel = useOpenModelDetails()
  const panelIdPrefix = useId()
  const [openId, setOpenId] = useState<string | null>(null)

  if (props.isLoading || props.isError || props.rows.length === 0) {
    return (
      <PricingListStatus
        isLoading={props.isLoading}
        isError={props.isError}
        isEmpty={props.rows.length === 0}
        onRetry={props.onRetry}
      />
    )
  }

  const benchmarkLabel =
    props.benchmark === 'official' ? t('Official Price') : t('OpenRouter Price')

  // "from" prices: the cheapest listed size, stated as such so a larger
  // image is never mistaken for that figure.
  const fromPrice = (price: string) =>
    price === LANDING_PRICE_PLACEHOLDER
      ? price
      : t('from ~{{price}} / image', { price })

  const savingsBadge = (row: ImagePricingRow) =>
    row.savings === LANDING_PRICE_PLACEHOLDER ? (
      <span className='text-(--pd-faint)'>{LANDING_PRICE_PLACEHOLDER}</span>
    ) : (
      <span className='inline-flex rounded-md bg-(--pd-success-bg) px-2 py-1 text-xs font-bold whitespace-nowrap text-(--pd-success)'>
        {row.savings}
      </span>
    )

  const columns = [
    { key: 'model', label: t('Model'), align: 'text-left', width: 'w-[36%]' },
    {
      key: 'fr-price',
      label: t('FR Price'),
      align: 'text-left',
      width: 'w-[20%]',
    },
    {
      key: 'bench-price',
      label: benchmarkLabel,
      align: 'text-left',
      width: 'w-[20%]',
    },
    {
      key: 'savings',
      label: t('Savings'),
      align: 'text-left',
      width: 'w-[14%]',
    },
    { key: 'detail', label: '', align: 'text-right', width: 'w-[10%]' },
  ] as const

  return (
    <>
      <div
        data-slot='image-pricing-table'
        className='hidden overflow-hidden rounded-2xl border border-(--pd-border) shadow-[0px_10px_24px_0px_rgba(0,0,0,0.04)] md:block'
      >
        <div
          aria-hidden='true'
          className='h-0.5 w-full bg-linear-to-r from-(--pd-gradient-from) to-(--pd-gradient-to)'
        />
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[760px] table-fixed text-sm'>
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
                <tr
                  key={row.modelId}
                  onClick={() => openModel(row.modelId)}
                  className='cursor-pointer border-b border-(--pd-border) bg-(--pd-surface) transition-colors last:border-b-0 hover:bg-(--pd-accent-bg-hover)'
                >
                  <th scope='row' className='px-6 py-3.5 text-left font-normal'>
                    <div className='flex items-center gap-2.5'>
                      <ProviderMark
                        provider={row.provider}
                        label={row.vendorLabel}
                        variant='chip'
                      />
                      <ModelName
                        name={row.name}
                        className='font-mono text-[13px] font-bold text-(--pd-ink-strong)'
                      />
                    </div>
                  </th>
                  <td className='px-6 py-3.5 font-mono text-[13px] font-bold text-(--pd-ink)'>
                    {fromPrice(row.frPrice)}
                  </td>
                  <td className='px-6 py-3.5 font-mono text-[13px] text-(--pd-muted)'>
                    {fromPrice(row.benchmarkPrice)}
                  </td>
                  <td className='px-6 py-3.5'>{savingsBadge(row)}</td>
                  <td className='px-6 py-3.5 text-right'>
                    <button
                      type='button'
                      onClick={(event) => {
                        event.stopPropagation()
                        openModel(row.modelId)
                      }}
                      className='pd-font-ui cursor-pointer text-[13px] font-medium whitespace-nowrap text-(--pd-primary) transition-opacity hover:opacity-80'
                    >
                      {t('View →')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div
        data-slot='image-pricing-accordion'
        className='overflow-hidden rounded-2xl border border-(--pd-border) md:hidden'
      >
        {props.rows.map((row) => {
          const isOpen = openId === row.modelId
          const panelId = `${panelIdPrefix}-${row.modelId}`
          const Chevron = isOpen ? ChevronUp : ChevronDown
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
                    variant='chip'
                  />
                  <ModelName
                    name={row.name}
                    className='font-mono text-sm font-bold text-(--pd-ink-strong)'
                  />
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
                        {t('FR Price')}
                      </dt>
                      <dd className='font-mono font-bold text-(--pd-ink)'>
                        {fromPrice(row.frPrice)}
                      </dd>
                    </div>
                    <div>
                      <dt className='mb-1 text-xs text-(--pd-muted-2)'>
                        {benchmarkLabel}
                      </dt>
                      <dd className='font-mono text-(--pd-muted)'>
                        {fromPrice(row.benchmarkPrice)}
                      </dd>
                    </div>
                    <div className='col-span-2'>
                      <dt className='mb-1 text-xs text-(--pd-muted-2)'>
                        {t('Savings')}
                      </dt>
                      <dd>{savingsBadge(row)}</dd>
                    </div>
                  </dl>
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
    </>
  )
}
