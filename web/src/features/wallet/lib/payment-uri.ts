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

const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/

/**
 * Convert a decimal token amount to its integer base-unit string, e.g. `"0.5"`
 * with 6 decimals → `"500000"`.
 *
 * Pure string arithmetic on purpose: going through a float would introduce
 * rounding, and a rounded-down amount is a short payment that NOWPayments
 * leaves unsettled until support reconciles it. For the same reason an amount
 * with more precision than the token can carry is refused (`null`) rather
 * than truncated, unless the surplus digits are all zero.
 */
export function toTokenBaseUnits(
  amountText: string,
  decimals: number
): string | null {
  if (!Number.isInteger(decimals) || decimals < 0) {
    return null
  }
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amountText.trim())
  if (!match) {
    return null
  }
  const whole = match[1]
  const fraction = match[2] ?? ''
  if (/[1-9]/.test(fraction.slice(decimals))) {
    return null
  }
  const units = (whole + fraction.slice(0, decimals).padEnd(decimals, '0'))
    // Keep a single digit for zero so the result is always a valid integer.
    .replace(/^0+(?=\d)/, '')
  return units === '0' ? null : units
}

export interface Erc20PaymentUriParams {
  /** ERC-20 contract of the token being paid, as NOWPayments reports it. */
  contract: string
  /** EIP-155 chain id; undefined for non-EVM chains. */
  chainId: number | undefined
  /** Token decimals; 0 when unknown. */
  decimals: number
  /** Deposit address for the order. */
  address: string
  /** Amount due as a decimal string, exactly as NOWPayments expects it. */
  amountText: string
}

/**
 * Build an EIP-681 `transfer` URI that wallets can scan to prefill the token,
 * network, recipient and amount:
 *
 *   ethereum:<contract>@<chainId>/transfer?address=<recipient>&uint256=<units>
 *
 * Returns `null` whenever any input is missing or malformed. The checkout page
 * then falls back to the plain-address QR, which every wallet understands, so
 * an incomplete order can never produce a QR that sends to the wrong place.
 * Addresses are passed through unchanged: EIP-55 checksums depend on case.
 */
export function buildErc20PaymentUri(
  params: Erc20PaymentUriParams
): string | null {
  const { contract, chainId, decimals, address, amountText } = params
  if (!chainId || !Number.isInteger(chainId) || chainId <= 0) {
    return null
  }
  if (
    !EVM_ADDRESS_PATTERN.test(contract) ||
    !EVM_ADDRESS_PATTERN.test(address)
  ) {
    return null
  }
  const units = toTokenBaseUnits(amountText, decimals)
  if (units === null || decimals === 0) {
    return null
  }
  return `ethereum:${contract}@${chainId}/transfer?address=${address}&uint256=${units}`
}
