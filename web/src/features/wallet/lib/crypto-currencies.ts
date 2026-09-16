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
}

const CRYPTO_CURRENCY_META: Record<string, CryptoCurrencyMeta> = {
  usdterc20: { symbol: 'USDT', network: 'Ethereum', evmAddress: true },
  usdtbsc: { symbol: 'USDT', network: 'BSC', evmAddress: true },
  usdtarb: { symbol: 'USDT', network: 'Arbitrum One', evmAddress: true },
  usdtmatic: { symbol: 'USDT', network: 'Polygon', evmAddress: true },
  usdtton: { symbol: 'USDT', network: 'TON', evmAddress: false },
  usdttrc20: { symbol: 'USDT', network: 'Tron', evmAddress: false },
  usdtsol: { symbol: 'USDT', network: 'Solana', evmAddress: false },
  usdc: { symbol: 'USDC', network: 'Ethereum', evmAddress: true },
  usdcbsc: { symbol: 'USDC', network: 'BSC', evmAddress: true },
  usdcarb: { symbol: 'USDC', network: 'Arbitrum One', evmAddress: true },
  usdcmatic: { symbol: 'USDC', network: 'Polygon', evmAddress: true },
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
