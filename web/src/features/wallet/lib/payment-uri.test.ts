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
import { describe, expect, test } from 'vitest'

import { describeCryptoCurrency } from './crypto-currencies'
import { buildErc20PaymentUri, toTokenBaseUnits } from './payment-uri'

const BSC_USDT = '0x55d398326f99059fF775485246999027B3197955'
const DEPOSIT = '0xbfa3a1eC1dce8Ab7962f350d41Cffc3934c390A8'

describe('toTokenBaseUnits', () => {
  test.each([
    ['2', 18, '2000000000000000000'],
    ['9.98674154', 18, '9986741540000000000'],
    ['0.5', 6, '500000'],
    ['10', 6, '10000000'],
    // Surplus zeros carry no value, so they are not a precision loss.
    ['1.50', 1, '15'],
    ['0.000001', 6, '1'],
  ])('%s with %i decimals → %s', (amount, decimals, expected) => {
    expect(toTokenBaseUnits(amount, decimals)).toBe(expected)
  })

  test('refuses to round away digits the token cannot carry', () => {
    // Truncating would encode a short payment, which stays unsettled until
    // support reconciles it — the very failure this QR exists to prevent.
    expect(toTokenBaseUnits('0.0000001', 6)).toBeNull()
    expect(toTokenBaseUnits('1.234', 2)).toBeNull()
  })

  test.each([['0'], ['0.00'], [''], ['abc'], ['1e18'], ['-1'], ['1,5']])(
    'rejects %j',
    (amount) => {
      expect(toTokenBaseUnits(amount, 18)).toBeNull()
    }
  )
})

describe('buildErc20PaymentUri', () => {
  const complete = {
    contract: BSC_USDT,
    chainId: 56,
    decimals: 18,
    address: DEPOSIT,
    amountText: '9.98674154',
  }

  test('encodes contract, chain, recipient and base-unit amount', () => {
    expect(buildErc20PaymentUri(complete)).toBe(
      `ethereum:${BSC_USDT}@56/transfer?address=${DEPOSIT}&uint256=9986741540000000000`
    )
  })

  test('keeps address case so EIP-55 checksums survive', () => {
    const uri = buildErc20PaymentUri(complete)
    expect(uri).toContain(BSC_USDT)
    expect(uri).toContain(DEPOSIT)
  })

  test.each([
    ['no contract (non-EVM chain or older order)', { contract: '' }],
    ['no chain id', { chainId: undefined }],
    ['unknown decimals', { decimals: 0 }],
    ['contract that is not an EVM address', { contract: 'TXYZabc' }],
    ['deposit address that is not an EVM address', { address: 'EQabc' }],
    [
      'amount finer than the token allows',
      { amountText: '1.0000000000000000001' },
    ],
    ['zero amount', { amountText: '0' }],
  ])('falls back to the plain address QR with %s', (_, override) => {
    // Any gap in the inputs must yield no URI at all rather than a URI that
    // points at the wrong token, chain or amount.
    expect(buildErc20PaymentUri({ ...complete, ...override })).toBeNull()
  })
})

describe('chain ids on accepted tickers', () => {
  test.each([
    ['usdterc20', 1],
    ['usdc', 1],
    ['usdtbsc', 56],
    ['usdcbsc', 56],
    ['usdtarb', 42161],
    ['usdcarb', 42161],
    ['usdtmatic', 137],
    ['usdcmatic', 137],
  ])('%s → chain %i', (ticker, chainId) => {
    expect(describeCryptoCurrency(ticker).chainId).toBe(chainId)
  })

  test.each([['usdtton'], ['usdcalgo'], ['usdttrc20'], ['usdtsol']])(
    '%s has no EVM chain id',
    (ticker) => {
      expect(describeCryptoCurrency(ticker).chainId).toBeUndefined()
    }
  )
})
