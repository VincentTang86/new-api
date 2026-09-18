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
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { cn } from '@/lib/utils'

import { getNowPaymentsPaymentDetail, isApiSuccess } from '../api'
import { describeCryptoCurrency, formatCryptoAmount } from '../lib'
import type { NowPaymentsPaymentDetail } from '../types'

/** How often to re-check the order while it is still awaiting funds. */
const POLL_INTERVAL_MS = 10_000

/**
 * Rules the user has to follow while the order is still payable. They are
 * consequences of how the order settles: a short transfer stays unsettled until
 * support reconciles it, and an expired order can no longer be credited.
 */
const CHECKOUT_NOTE_KEYS = [
  'We recommend staying on this page until the payment is completed',
  'Send the exact amount before the timer expires',
  "Payments below the amount due can't be processed",
  'Completed payments are non-refundable',
]

function formatCountdown(secondsLeft: number): string {
  const hours = String(Math.floor(secondsLeft / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, '0')
  const seconds = String(secondsLeft % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

/** Clipboard write plus the transient checkmark every copy button here shows. */
function useCopyAction() {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copy = useCallback(
    async (value: string) => {
      if (await copyToClipboard(value)) {
        setCopied(true)
        toast.success(t('Copied'))
        setTimeout(() => setCopied(false), 2000)
        return
      }
      toast.error(t('Copy failed'))
    },
    [t]
  )

  return { copied, copy }
}

function CopyRow(props: { label: string; value: string; mono?: boolean }) {
  const { t } = useTranslation()
  const { copied, copy } = useCopyAction()

  return (
    <div>
      <p className='text-muted-foreground mb-1.5 text-xs'>{props.label}</p>
      <div className='flex items-center gap-2'>
        <div
          title={props.value}
          className={cn(
            'bg-muted min-w-0 flex-1 truncate rounded-lg px-3 py-2 font-medium',
            props.mono ? 'font-mono text-xs' : 'text-[13px]'
          )}
        >
          {props.value}
        </div>
        <Button
          size='icon'
          variant='outline'
          className='hover:text-primary'
          onClick={() => void copy(props.value)}
          aria-label={t('Copy {{label}}', { label: props.label })}
        >
          {copied ? <Check className='size-4' /> : <Copy className='size-4' />}
        </Button>
      </div>
    </div>
  )
}

function CheckoutNotes(props: { paymentId: string }) {
  const { t } = useTranslation()
  const { copied, copy } = useCopyAction()

  return (
    <aside className='bg-muted/40 w-full max-w-[576px] rounded-[14px] border p-5 lg:mt-[48px] lg:max-w-[300px]'>
      <h2 className='text-[15px] font-semibold'>{t('Key things to note')}</h2>
      <div className='mt-4 space-y-4'>
        {CHECKOUT_NOTE_KEYS.map((note) => (
          <div key={note} className='flex gap-3'>
            <span aria-hidden='true' className='text-primary mt-0.5'>
              →
            </span>
            <p className='text-muted-foreground text-[13px] leading-[1.55]'>
              {t(note)}
            </p>
          </div>
        ))}
      </div>

      {props.paymentId && (
        <div className='mt-5 border-t pt-4'>
          <p className='text-muted-foreground text-xs'>{t('Payment ID')}</p>
          <div className='mt-1 flex items-center justify-between gap-3'>
            <code className='font-mono text-[13px] font-medium'>
              {props.paymentId}
            </code>
            <Button
              size='icon-sm'
              variant='ghost'
              className='hover:text-primary'
              onClick={() => void copy(props.paymentId)}
              aria-label={t('Copy {{label}}', { label: t('Payment ID') })}
            >
              {copied ? (
                <Check className='size-4' />
              ) : (
                <Copy className='size-4' />
              )}
            </Button>
          </div>
        </div>
      )}
    </aside>
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
export function CryptoCheckout(props: CryptoCheckoutProps) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<NowPaymentsPaymentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const fetchDetail = useCallback(async () => {
    const response = await getNowPaymentsPaymentDetail(props.tradeNo)
    if (isApiSuccess(response) && typeof response.data === 'object') {
      setDetail(response.data)
    } else {
      setNotFound(true)
    }
    setLoading(false)
  }, [props.tradeNo])

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
      className='hover:text-primary mb-5 w-fit'
      render={<Link to='/wallet' />}
    >
      <ArrowLeft className='mr-1.5 size-4' />
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
        <div className='mx-auto w-full max-w-[1110px]'>
          <div className='flex flex-col items-center gap-5 lg:grid lg:grid-cols-[minmax(0,576px)_300px] lg:items-start lg:justify-center lg:gap-10'>
            <section className='w-full max-w-[576px]'>
              {backToWallet}

              <Card className='gap-0 rounded-[14px] px-6 py-10 shadow-[0_4px_18px_rgba(17,24,39,0.055)] dark:shadow-none'>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <p className='text-muted-foreground text-sm'>
                      {t('Send exactly')}
                    </p>
                    <p className='mt-1 text-[30px] font-semibold tracking-[-0.8px]'>
                      {payAmountText} {meta.symbol}
                    </p>
                    <p className='text-muted-foreground mt-1 text-sm'>
                      {t('Credits {{amount}} on arrival', {
                        amount: `$${detail.topup_amount}`,
                      })}
                    </p>
                  </div>
                  <Badge
                    variant='secondary'
                    className='h-auto shrink-0 rounded-full px-3 py-1 text-[13px]'
                  >
                    {networkLabel}
                  </Badge>
                </div>

                {isPaid && (
                  <Alert className='mt-5 px-3 py-2.5'>
                    <Check className='size-4' />
                    <AlertDescription>
                      {t('Payment received. Your credits have been added.')}
                    </AlertDescription>
                  </Alert>
                )}

                {!isPending && !isPaid && (
                  <Alert variant='destructive' className='mt-5 px-3 py-2.5'>
                    <AlertTriangle className='size-4' />
                    <AlertDescription>
                      {t(
                        'This order is no longer payable. Please start a new topup.'
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {isPending && (
                  <>
                    <Alert variant='destructive' className='mt-5 px-3 py-2.5'>
                      <AlertTriangle className='size-4' />
                      <AlertDescription className='text-[13px] leading-[1.45]'>
                        {t('Send only {{symbol}} on {{network}}.', {
                          symbol: meta.symbol,
                          network: networkLabel,
                        })}
                      </AlertDescription>
                    </Alert>

                    {/* Dark modules on a white plate in both themes. The design
                        inverts the code in dark mode, but not every wallet app
                        scans an inverted QR and a failed scan here means a
                        mis-sent transfer. The padding is the quiet zone. */}
                    <div className='flex justify-center py-7'>
                      <div className='rounded-lg bg-white p-3'>
                        <QRCodeSVG
                          value={detail.pay_address}
                          size={202}
                          className='size-[188px] sm:size-[202px]'
                        />
                      </div>
                    </div>

                    <CopyRow
                      label={t('{{network}} address', {
                        network: networkLabel,
                      })}
                      value={detail.pay_address}
                      mono
                    />

                    <div className='mt-4'>
                      <CopyRow
                        label={t('Amount ({{symbol}})', {
                          symbol: meta.symbol,
                        })}
                        value={payAmountText}
                      />
                    </div>

                    {detail.extra_id && (
                      <div className='mt-4'>
                        <CopyRow
                          label={t('Memo / Tag (required)')}
                          value={detail.extra_id}
                          mono
                        />
                      </div>
                    )}

                    <div className='text-muted-foreground mt-5 flex items-center justify-between gap-4 border-t pt-4 text-sm'>
                      <span className='flex items-center gap-2'>
                        <Loader2 className='size-4 animate-spin' />
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

                <p className='text-muted-foreground mt-5 border-t pt-4 text-xs'>
                  {t('Order {{tradeNo}}', { tradeNo: detail.trade_no })}
                </p>
              </Card>
            </section>

            {isPending && <CheckoutNotes paymentId={detail.payment_id} />}
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
