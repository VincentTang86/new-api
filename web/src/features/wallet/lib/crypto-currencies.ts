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

/**
 * Display metadata for NOWPayments tickers.
 *
 * The accepted tickers come from a backend setting, so this map is a lookup for
 * presentation only — an unmapped ticker still renders, just without a network
 * label. Keep it in sync with Coins Settings on the NOWPayments dashboard.
 */
export interface CryptoCurrencyMeta {
  /** Token symbol shown as the primary label, e.g. USDT */
  symbol: string
  /** Chain the token lives on, shown as the secondary label */
  network: string
  /**
   * Whether the chain uses EVM-style `0x` addresses. Those addresses are
   * indistinguishable across chains, so sending on the wrong one produces a
   * wrong-asset deposit that NOWPayments does not credit automatically.
   */
  evmAddress: boolean
  /**
   * EIP-155 chain id, set only for EVM chains. Goes into the EIP-681 payment
   * URI so a scanning wallet switches to the right network before it sends.
   * Keyed by our own ticker rather than NOWPayments' network string because
   * the tickers are the fixed whitelist we send them.
   */
  chainId?: number
}

const ETHEREUM = 1
const BSC = 56
const POLYGON = 137
const ARBITRUM_ONE = 42161

const CRYPTO_CURRENCY_META: Record<string, CryptoCurrencyMeta> = {
  usdterc20: {
    symbol: 'USDT',
    network: 'Ethereum',
    evmAddress: true,
    chainId: ETHEREUM,
  },
  usdtbsc: { symbol: 'USDT', network: 'BSC', evmAddress: true, chainId: BSC },
  usdtarb: {
    symbol: 'USDT',
    network: 'Arbitrum One',
    evmAddress: true,
    chainId: ARBITRUM_ONE,
  },
  usdtmatic: {
    symbol: 'USDT',
    network: 'Polygon',
    evmAddress: true,
    chainId: POLYGON,
  },
  usdtton: { symbol: 'USDT', network: 'TON', evmAddress: false },
  usdttrc20: { symbol: 'USDT', network: 'Tron', evmAddress: false },
  usdtsol: { symbol: 'USDT', network: 'Solana', evmAddress: false },
  usdc: {
    symbol: 'USDC',
    network: 'Ethereum',
    evmAddress: true,
    chainId: ETHEREUM,
  },
  usdcbsc: { symbol: 'USDC', network: 'BSC', evmAddress: true, chainId: BSC },
  usdcarb: {
    symbol: 'USDC',
    network: 'Arbitrum One',
    evmAddress: true,
    chainId: ARBITRUM_ONE,
  },
  usdcmatic: {
    symbol: 'USDC',
    network: 'Polygon',
    evmAddress: true,
    chainId: POLYGON,
  },
  usdcalgo: { symbol: 'USDC', network: 'Algorand', evmAddress: false },
  usdcsol: { symbol: 'USDC', network: 'Solana', evmAddress: false },
}

export function describeCryptoCurrency(ticker: string): CryptoCurrencyMeta {
  return (
    CRYPTO_CURRENCY_META[ticker.toLowerCase()] ?? {
      symbol: ticker.toUpperCase(),
      network: '',
      evmAddress: false,
    }
  )
}

/**
 * Format a stablecoin amount without trailing noise. NOWPayments can return
 * more precision than the token actually needs, and a padded `20.00000000`
 * reads worse than `20` on the confirmation dialog.
 */
export function formatCryptoAmount(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '0'
  }
  return String(Number(amount.toFixed(8)))
}
