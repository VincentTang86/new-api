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
import { useState, useEffect } from 'react'

import { getNowPaymentsCurrencies, isApiSuccess } from '../api'
import type { NowPaymentsCurrency } from '../types'

/**
 * Load the coins accepted for crypto topup at a given amount.
 *
 * The per-chain minimums come from NOWPayments and depend on the amount, so
 * this refetches whenever the amount changes while the picker is open. The
 * selection resets to the first chain that can actually clear its minimum.
 */
export function useNowPaymentsCurrencies(enabled: boolean, amount: number) {
  const [currencies, setCurrencies] = useState<NowPaymentsCurrency[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState('')

  useEffect(() => {
    if (!enabled || amount <= 0) {
      return
    }

    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        const response = await getNowPaymentsCurrencies(amount)
        if (cancelled) {
          return
        }

        const list =
          isApiSuccess(response) && Array.isArray(response.data)
            ? response.data
            : []
        setCurrencies(list)
        setSelected(list.find((item) => item.available)?.ticker ?? '')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, amount])

  return { currencies, loading, selected, setSelected }
}
