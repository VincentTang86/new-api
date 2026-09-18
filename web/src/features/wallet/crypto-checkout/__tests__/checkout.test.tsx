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
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { CryptoCheckout } from '..'
import type { NowPaymentsPaymentDetail } from '../../types'

const getNowPaymentsPaymentDetail = vi.hoisted(() => vi.fn())

vi.mock('@/features/wallet/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/wallet/api')>()),
  getNowPaymentsPaymentDetail,
}))

/** Frozen so the countdown a test asserts on cannot drift with the clock. */
const NOW_MS = 1_800_000_000_000

function buildDetail(
  overrides: Partial<NowPaymentsPaymentDetail> = {}
): NowPaymentsPaymentDetail {
  return {
    trade_no: 'NOWPAY-1-1789722549004-IYHCgu',
    payment_id: '5343310398',
    status: 'pending',
    topup_amount: 2,
    money: 2,
    pay_currency: 'usdtbsc',
    pay_amount: 2,
    pay_address: '0xbfa3a1eC1dce8Ab7962f350d41Cffc3934c390A8',
    network: 'BSC',
    extra_id: '',
    // 02:15:30 out.
    expires_at: Math.floor(NOW_MS / 1000) + 8130,
    create_time: Math.floor(NOW_MS / 1000),
    contract: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 18,
    pay_amount_text: '2',
    ...overrides,
  }
}

async function renderCheckout(detail: NowPaymentsPaymentDetail) {
  getNowPaymentsPaymentDetail.mockResolvedValue({
    message: 'success',
    data: detail,
  })

  const rootRoute = createRootRoute()
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => <CryptoCheckout tradeNo={detail.trade_no} />,
      }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/wallet',
        component: () => null,
      }),
    ]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  await act(async () => {
    render(<RouterProvider router={router as never} />)
  })
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
})

describe('CryptoCheckout', () => {
  test('counts an over-an-hour window down in hours, minutes and seconds', async () => {
    await renderCheckout(buildDetail())

    expect(document.body.textContent).toContain('Expires in 02:15:30')
  })

  test('shows every payment rule and the payment id while the order is payable', async () => {
    await renderCheckout(buildDetail())

    for (const note of [
      'We recommend staying on this page until the payment is completed',
      'Send the exact amount before the timer expires',
      "Payments below the amount due can't be processed",
      'Completed payments are non-refundable',
    ]) {
      expect(screen.getByText(note)).toBeInTheDocument()
    }
    expect(screen.getByText('5343310398')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Copy Payment ID' })
    ).toBeInTheDocument()
  })

  test('drops the payment rules once the order is settled', async () => {
    await renderCheckout(buildDetail({ status: 'success' }))

    expect(screen.queryByText('Key things to note')).not.toBeInTheDocument()
    expect(screen.queryByText('5343310398')).not.toBeInTheDocument()
    expect(
      screen.getByText('Payment received. Your credits have been added.')
    ).toBeInTheDocument()
  })

  test('keeps the address on screen without a payment id', async () => {
    await renderCheckout(buildDetail({ payment_id: '' }))

    expect(
      screen.getByText('0xbfa3a1eC1dce8Ab7962f350d41Cffc3934c390A8')
    ).toBeInTheDocument()
    expect(screen.getByText('Key things to note')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Copy Payment ID' })
    ).not.toBeInTheDocument()
  })

  test('offers an amount-prefilled QR behind a tab that defaults to the plain address', async () => {
    await renderCheckout(buildDetail())

    expect(screen.getByRole('tab', { name: 'Address' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(
      screen.queryByText(
        'Scanning this code prefills the token and amount in wallets that support it.'
      )
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'With amount' }))

    expect(
      screen.getByText(
        'Scanning this code prefills the token and amount in wallets that support it.'
      )
    ).toBeInTheDocument()
  })

  test('shows only the plain address QR when the order has no token contract', async () => {
    // Non-EVM chains and orders created before the contract was recorded must
    // render exactly as before rather than offer a QR that cannot be built.
    await renderCheckout(buildDetail({ pay_currency: 'usdtton', contract: '' }))

    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(
      screen.getByText('0xbfa3a1eC1dce8Ab7962f350d41Cffc3934c390A8')
    ).toBeInTheDocument()
  })
})
