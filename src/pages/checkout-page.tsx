import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AuthModal } from '../components/auth-modal'
import { useCartRecalculation } from '../hooks/use-cart-recalculation'
import { createOrder } from '../lib/catalog-api'
import { isAuthenticated as getIsAuthenticated } from '../lib/auth'
import { regionToApi } from '../lib/catalog-pricing'
import { formatMoneyMinor } from '../lib/format'
import { rememberOrder } from '../lib/order-history'
import { useAppState } from '../store/use-app-state'
import type { OrderRecord } from '../types'

const ACCOUNT_EMAIL_KEY = 'avp-account-email'

function formatTryMinor(value: number | null) {
  if (value === null) {
    return null
  }

  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value / 100)
}

export function CheckoutPage() {
  const { cart, region, clearCart } = useAppState()
  const { result, loading } = useCartRecalculation()
  const navigate = useNavigate()
  const [isAuthOpen, setIsAuthOpen] = useState(() => !getIsAuthenticated())
  const [isAuthenticated, setIsAuthenticated] = useState(() => getIsAuthenticated())
  const [email, setEmail] = useState(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    return window.localStorage.getItem(ACCOUNT_EMAIL_KEY) ?? ''
  })
  const [telegram, setTelegram] = useState('')
  const [comment, setComment] = useState('')
  const [needsNewAccount, setNeedsNewAccount] = useState(false)
  const [acceptedOffer, setAcceptedOffer] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<OrderRecord | null>(null)

  useEffect(() => {
    const syncAuthState = () => {
      const authenticated = getIsAuthenticated()
      setIsAuthenticated(authenticated)
      setIsAuthOpen(!authenticated)
    }

    syncAuthState()
    window.addEventListener('storage', syncAuthState)
    window.addEventListener('avp-auth-changed', syncAuthState)

    return () => {
      window.removeEventListener('storage', syncAuthState)
      window.removeEventListener('avp-auth-changed', syncAuthState)
    }
  }, [])

  if (!loading && cart.length === 0 && !order) {
    return <Navigate to="/cart" replace />
  }

  if (order) {
    return (
      <div className="page-shell section-space">
        <div className="satin-panel rounded-[36px] border border-white/10 px-6 py-16 text-center">
          <div className="font-display text-4xl text-sheen">Заказ создан</div>
          <p className="mt-4 text-sm text-white/56">
            Заказ #{order.id} сохранен со статусом <span className="text-white">{order.status}</span>.
          </p>
          <p className="mt-3 text-sm text-white/56">
            На email <span className="text-white">{order.email}</span> будет отправлена дальнейшая информация по оплате и выдаче.
          </p>
        </div>
      </div>
    )
  }

  const submitDisabled = !isAuthenticated || !acceptedOffer || submitting || loading || result.supported === false

  return (
    <div className="page-shell section-space">
      <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:gap-6">
        <form
          className="satin-panel rounded-[24px] border border-white/10 p-4 sm:rounded-[32px] sm:p-6"
          onSubmit={async (event) => {
            event.preventDefault()
            if (submitDisabled) return

            setSubmitting(true)
            setError(null)

            try {
              const created = await createOrder({
                email,
                region: regionToApi(region),
                acceptedOffer: true,
                comment: [
                  telegram ? `Telegram/MAX: ${telegram}` : null,
                  needsNewAccount ? 'Нужен новый аккаунт турецкого PS Store' : null,
                  comment || null,
                ].filter(Boolean).join('\n'),
                items: cart,
              })
              rememberOrder(created)
              clearCart()
              if (created.paymentConfirmationUrl) {
                window.location.href = created.paymentConfirmationUrl
                return
              }

              setOrder(created)
            } catch {
              setError('Не удалось создать заказ. Повторите попытку.')
            } finally {
              setSubmitting(false)
            }
          }}
        >
          <div className="font-display text-[2rem] leading-tight text-sheen sm:text-3xl">Оформление заказа</div>
          <p className="mt-3 text-sm leading-6 text-white/56">
            Вы покупаете коды пополнения. Этого хватит для оплаты выбранных товаров в PS Store.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-white/58">
              Email для получения чека
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-white/22"
                placeholder="name@email.com"
              />
            </label>
            <label className="text-sm text-white/58">
              Telegram/MAX для связи
              <input
                type="text"
                value={telegram}
                onChange={(event) => setTelegram(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-white/22"
                placeholder="@username"
              />
            </label>
            <label className="text-sm text-white/58 sm:col-span-2">
              Комментарий к заказу
              <textarea
                rows={5}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-white/22"
                placeholder="Укажите пожелания по выдаче или аккаунту"
              />
            </label>
          </div>

          <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/68 transition hover:border-white/18 hover:bg-white/[0.045]">
            <input
              checked={needsNewAccount}
              onChange={(event) => setNeedsNewAccount(event.target.checked)}
              type="checkbox"
              className="h-4 w-4 accent-white"
            />
            <span>Мне нужен новый аккаунт турецкого PS Store</span>
          </label>

          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/68 transition hover:border-white/18 hover:bg-white/[0.045]">
            <input
              checked={acceptedOffer}
              onChange={(event) => setAcceptedOffer(event.target.checked)}
              type="checkbox"
              required
              className="h-4 w-4 accent-white"
            />
            <span>Согласен с условиями Пользовательского соглашения и Политики конфиденциальности</span>
          </label>

          {result.supported === false ? (
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
              {result.message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitDisabled}
            className={`mt-6 inline-flex w-full justify-center rounded-full px-7 py-3 text-sm font-bold shadow-[0_10px_28px_rgba(255,255,255,.10)] transition sm:w-auto ${
              submitDisabled
                ? 'cursor-not-allowed bg-white/10 text-white/35 shadow-none'
                : 'cursor-pointer bg-white text-black hover:bg-zinc-100'
            }`}
          >
            {submitting ? 'Создание заказа...' : 'Перейти к оплате'}
          </button>
        </form>

        <aside className="satin-panel h-fit rounded-[24px] border border-white/10 p-5 sm:rounded-[30px] sm:p-6 lg:sticky lg:top-32">
          <div className="font-display text-3xl text-sheen">Ваш заказ</div>
          <div className="mt-5 space-y-4">
            {loading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />
                ))
              : result.sourceItems.map((item) => (
                  <div key={item.productId} className="flex items-start justify-between gap-4 text-sm text-white/62">
                    <div>
                      <div className="text-white">{item.product.title}</div>
                      <div className="mt-1">Количество: {item.quantity}</div>
                    </div>
                    <div>{formatMoneyMinor(item.linePriceRubMinor, 'RUB') ?? '—'}</div>
                  </div>
                ))}
          </div>

          {result.autoCodeItems.length > 0 ? (
            <div className="mt-6 border-t border-white/10 pt-6">
              <div className="text-sm uppercase tracking-[0.18em] text-white/48">Коды пополнения</div>
              <div className="mt-4 space-y-3 text-sm text-white/62">
                {result.autoCodeItems.map((item) => (
                  <div key={item.code} className="flex items-start justify-between gap-4">
                    <div>{item.nominalTry} TRY</div>
                    <div>{formatMoneyMinor(item.priceRubMinor, 'RUB')}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 border-t border-white/10 pt-6 text-white">
            <div className="flex items-center justify-between text-sm text-white/56">
              <span>Сумма игр</span>
              <span>{formatTryMinor(result.pricing.sourceTotalTryMinor)} TRY</span>
            </div>
            {result.pricing.theoreticalRemainderTryMinor !== null ? (
              <div className="mt-3 flex items-center justify-between text-sm text-white/56">
                <span>Остаток на аккаунте</span>
                <span>{formatTryMinor(result.pricing.theoreticalRemainderTryMinor)} TRY</span>
              </div>
            ) : null}
            <div className="mt-4 flex items-center justify-between text-lg text-white">
              <span>К оплате</span>
              <span>{formatMoneyMinor(result.pricing.payableRubMinor, 'RUB') ?? '—'}</span>
            </div>
          </div>
        </aside>
      </div>

      <AuthModal
        isOpen={isAuthOpen}
        isAuthenticated={isAuthenticated}
        onAuthenticated={() => {
          setIsAuthenticated(true)
          setIsAuthOpen(false)
        }}
        onClose={() => {
          if (isAuthenticated) {
            setIsAuthOpen(false)
          } else {
            navigate('/cart')
          }
        }}
      />
    </div>
  )
}
