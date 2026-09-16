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
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, Check, Copy, Loader2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { copyToClipboard } from '@/lib/copy-to-clipboard'

import { getNowPaymentsPaymentDetail, isApiSuccess } from '../api'
import { describeCryptoCurrency, formatCryptoAmount } from '../lib'
import type { NowPaymentsPaymentDetail } from '../types'

/** How often to re-check the order while it is still awaiting funds. */
const POLL_INTERVAL_MS = 10_000

function formatCountdown(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (await copyToClipboard(value)) {
      setCopied(true)
      toast.success(t('Copied'))
      setTimeout(() => setCopied(false), 2000)
      return
    }
    toast.error(t('Copy failed'))
  }

  return (
    <div className='grid gap-1.5'>
      <span className='text-muted-foreground text-xs'>{label}</span>
      <div className='flex items-start gap-2'>
        <code className='bg-muted min-w-0 flex-1 rounded-md px-2.5 py-2 text-sm break-all'>
          {value}
        </code>
        <Button
          size='icon'
          variant='outline'
          onClick={() => void handleCopy()}
          aria-label={t('Copy')}
        >
          {copied ? (
            <Check className='h-4 w-4' />
          ) : (
            <Copy className='h-4 w-4' />
          )}
        </Button>
      </div>
    </div>
  )
}

interface CryptoCheckoutProps {
  tradeNo: string
}

/**
 * On-chain deposit page for a NOWPayments topup order.
 *
 * Lives on its own route rather than inside the confirmation dialog because
 * paying means leaving for a wallet app: the user has to be able to come back,
 * refresh, or reopen the order from their topup history and still find the same
 * address.
 */
export function CryptoCheckout({ tradeNo }: CryptoCheckoutProps) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<NowPaymentsPaymentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const fetchDetail = useCallback(async () => {
    const response = await getNowPaymentsPaymentDetail(tradeNo)
    if (isApiSuccess(response) && typeof response.data === 'object') {
      setDetail(response.data)
    } else {
      setNotFound(true)
    }
    setLoading(false)
  }, [tradeNo])

  useEffect(() => {
    void fetchDetail()
  }, [fetchDetail])

  // Funds arrive out of band, so poll until the order leaves the pending state.
  useEffect(() => {
    if (!detail || detail.status !== 'pending') {
      return
    }
    const timer = setInterval(() => void fetchDetail(), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [detail, fetchDetail])

  useEffect(() => {
    if (!detail?.expires_at) {
      setSecondsLeft(0)
      return
    }
    const tick = () =>
      setSecondsLeft(
        Math.max(0, detail.expires_at - Math.floor(Date.now() / 1000))
      )
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [detail?.expires_at])

  const backToWallet = (
    <Button
      variant='ghost'
      size='sm'
      className='w-fit'
      render={<Link to='/wallet' />}
    >
      <ArrowLeft className='mr-1.5 h-4 w-4' />
      {t('Back to Credits')}
    </Button>
  )

  if (loading) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Crypto payment')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto w-full max-w-xl'>
            <Skeleton className='h-96 w-full' />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  if (notFound || !detail) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Crypto payment')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-xl flex-col gap-4'>
            <Alert>
              <AlertDescription>{t('Order not found')}</AlertDescription>
            </Alert>
            {backToWallet}
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  const meta = describeCryptoCurrency(detail.pay_currency)
  const networkLabel = meta.network || detail.network || detail.pay_currency
  const payAmountText = formatCryptoAmount(detail.pay_amount)
  const isPending = detail.status === 'pending'
  const isPaid = detail.status === 'success'

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Crypto payment')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-xl flex-col gap-4'>
          {backToWallet}

          <Card>
            <CardContent className='flex flex-col gap-5 p-5 sm:p-6'>
              <div className='flex items-start justify-between gap-3'>
                <div className='grid gap-1'>
                  <span className='text-muted-foreground text-sm'>
                    {t('Send exactly')}
                  </span>
                  <span className='text-3xl font-semibold'>
                    {payAmountText} {meta.symbol}
                  </span>
                  <span className='text-muted-foreground text-sm'>
                    {t('Credits {{amount}} on arrival', {
                      amount: `$${detail.topup_amount}`,
                    })}
                  </span>
                </div>
                <Badge variant='secondary' className='shrink-0 text-sm'>
                  {networkLabel}
                </Badge>
              </div>

              {isPaid && (
                <Alert>
                  <Check className='h-4 w-4' />
                  <AlertDescription>
                    {t('Payment received. Your credits have been added.')}
                  </AlertDescription>
                </Alert>
              )}

              {!isPending && !isPaid && (
                <Alert variant='destructive'>
                  <AlertTriangle className='h-4 w-4' />
                  <AlertDescription>
                    {t(
                      'This order is no longer payable. Please start a new topup.'
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {isPending && (
                <>
                  <Alert variant='destructive'>
                    <AlertTriangle className='h-4 w-4' />
                    <AlertDescription>
                      {meta.evmAddress
                        ? t(
                            'Send only {{symbol}} on {{network}}. This address looks identical across EVM chains — funds sent on any other network are not credited automatically.',
                            { symbol: meta.symbol, network: networkLabel }
                          )
                        : t('Send only {{symbol}} on {{network}}.', {
                            symbol: meta.symbol,
                            network: networkLabel,
                          })}
                    </AlertDescription>
                  </Alert>

                  <div className='flex justify-center'>
                    <div className='rounded-lg bg-white p-3'>
                      <QRCodeSVG value={detail.pay_address} size={180} />
                    </div>
                  </div>

                  <CopyRow
                    label={t('{{network}} address', { network: networkLabel })}
                    value={detail.pay_address}
                  />

                  <CopyRow
                    label={t('Amount ({{symbol}})', { symbol: meta.symbol })}
                    value={payAmountText}
                  />

                  {detail.extra_id && (
                    <CopyRow
                      label={t('Memo / Tag (required)')}
                      value={detail.extra_id}
                    />
                  )}

                  <div className='text-muted-foreground flex items-center justify-between border-t pt-4 text-sm'>
                    <span className='flex items-center gap-1.5'>
                      <Loader2 className='h-3.5 w-3.5 animate-spin' />
                      {t('Waiting for your transfer')}
                    </span>
                    {secondsLeft > 0 && (
                      <span>
                        {t('Expires in {{time}}', {
                          time: formatCountdown(secondsLeft),
                        })}
                      </span>
                    )}
                  </div>
                </>
              )}

              <p className='text-muted-foreground border-t pt-4 text-xs'>
                {t('Order {{tradeNo}}', { tradeNo: detail.trade_no })}
              </p>
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
