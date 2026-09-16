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
import { useNavigate } from '@tanstack/react-router'
import i18next from 'i18next'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'

import { requestNowPaymentsPayment, isApiSuccess } from '../api'

function getTradeNo(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  if ('trade_no' in data && typeof data.trade_no === 'string') {
    return data.trade_no
  }

  return null
}

function getErrorMessage(message: string | undefined, data: unknown): string {
  if (typeof data === 'string' && data.trim()) {
    return data
  }

  return message || i18next.t('Payment request failed')
}

/**
 * Hook for the NOWPayments on-chain deposit flow (crypto).
 *
 * The backend creates the deposit address up front, so this navigates to our
 * own checkout route instead of redirecting to a hosted invoice page. Keeping
 * the user in-app is what lets them leave for a wallet and come back to the
 * same address.
 */
export function useNowPaymentsPayment() {
  const navigate = useNavigate()
  const [processing, setProcessing] = useState(false)

  const processNowPaymentsPayment = useCallback(
    async (topupAmount: number, payCurrency: string) => {
      setProcessing(true)

      try {
        const response = await requestNowPaymentsPayment({
          amount: Math.floor(topupAmount),
          pay_currency: payCurrency,
        })

        if (isApiSuccess(response)) {
          const tradeNo = getTradeNo(response.data)

          if (tradeNo) {
            await navigate({
              to: '/wallet/crypto-pay/$tradeNo',
              params: { tradeNo },
            })
            return true
          }
        }

        toast.error(getErrorMessage(response.message, response.data))
        return false
      } catch {
        toast.error(i18next.t('Payment request failed'))
        return false
      } finally {
        setProcessing(false)
      }
    },
    [navigate]
  )

  return { processing, processNowPaymentsPayment }
}
