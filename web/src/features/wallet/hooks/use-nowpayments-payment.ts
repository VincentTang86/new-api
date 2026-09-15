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
import i18next from 'i18next'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'

import { requestNowPaymentsPayment, isApiSuccess } from '../api'
import { isSafeHttpCheckoutUrl } from '../lib/payment'

function getInvoiceUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  if ('invoice_url' in data && typeof data.invoice_url === 'string') {
    return data.invoice_url
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
 * Hook for the NOWPayments hosted-invoice flow (crypto).
 *
 * Same-tab redirect (window.location.href) rather than window.open: the
 * user-gesture context is lost across the await, so popups get blocked.
 */
export function useNowPaymentsPayment() {
  const [processing, setProcessing] = useState(false)

  const processNowPaymentsPayment = useCallback(async (topupAmount: number) => {
    setProcessing(true)

    try {
      const response = await requestNowPaymentsPayment({
        amount: Math.floor(topupAmount),
      })

      if (isApiSuccess(response)) {
        const invoiceUrl = getInvoiceUrl(response.data)

        if (invoiceUrl) {
          if (!isSafeHttpCheckoutUrl(invoiceUrl)) {
            toast.error(i18next.t('Invalid payment redirect URL'))
            return false
          }
          toast.success(i18next.t('Redirecting to payment page...'))
          window.location.href = invoiceUrl
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
  }, [])

  return { processing, processNowPaymentsPayment }
}
