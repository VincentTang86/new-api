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

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { describeCryptoCurrency, formatCryptoAmount } from '../lib'
import type { NowPaymentsCurrency } from '../types'

interface CryptoCurrencyPickerProps {
  currencies: NowPaymentsCurrency[]
  selected: string
  onSelect: (ticker: string) => void
  loading: boolean
  disabled?: boolean
}

/**
 * Coin + chain picker for the crypto checkout.
 *
 * Chains whose minimum the current topup cannot clear stay visible but
 * unselectable with the threshold spelled out — hiding them leaves the user
 * wondering why the chain they expected is missing.
 */
export function CryptoCurrencyPicker({
  currencies,
  selected,
  onSelect,
  loading,
  disabled = false,
}: CryptoCurrencyPickerProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className='grid grid-cols-2 gap-2'>
        {['a', 'b', 'c', 'd'].map((key) => (
          <Skeleton key={key} className='h-14 w-full' />
        ))}
      </div>
    )
  }

  if (currencies.length === 0) {
    return (
      <p className='text-muted-foreground text-sm'>
        {t('No coins are available for crypto payment right now.')}
      </p>
    )
  }

  return (
    <div className='grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1'>
      {currencies.map((currency) => {
        const meta = describeCryptoCurrency(currency.ticker)
        const isSelected = currency.ticker === selected
        const isDisabled = disabled || !currency.available

        return (
          <button
            key={currency.ticker}
            type='button'
            onClick={() => onSelect(currency.ticker)}
            disabled={isDisabled}
            aria-pressed={isSelected}
            className={cn(
              'flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              isSelected
                ? 'border-primary ring-primary/30 ring-2'
                : 'hover:border-muted-foreground/40',
              isDisabled && 'cursor-not-allowed opacity-50'
            )}
          >
            <span className='text-sm font-semibold'>{meta.symbol}</span>
            <span className='text-muted-foreground text-xs'>
              {meta.network || currency.ticker.toUpperCase()}
            </span>
            {!currency.available && currency.min_amount !== undefined && (
              <span className='text-muted-foreground text-[11px]'>
                {t('Min {{amount}}', {
                  amount: formatCryptoAmount(currency.min_amount),
                })}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
