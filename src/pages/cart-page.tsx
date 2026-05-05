import { Minus, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatMoneyMinor } from '../lib/format'
import { useCartRecalculation } from '../hooks/use-cart-recalculation'
import { useAppState } from '../store/use-app-state'

function formatTryMinor(value: number | null) {
  if (value === null) {
    return null
  }

  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value / 100)
}

export function CartPage() {
  const { cart, changeQuantity, removeFromCart, region } = useAppState()
  const { result, loading, error } = useCartRecalculation()

  if (!loading && cart.length === 0) {
    return (
      <div className="page-shell section-space">
        <div className="satin-panel rounded-[36px] border border-white/10 px-6 py-16 text-center">
          <div className="font-display text-4xl text-sheen">Корзина пока пуста</div>
          <p className="mt-4 text-sm text-white/56">Добавьте игры, подписки или предзаказы из каталога.</p>
          <Link
            to="/catalog"
            className="mt-6 inline-flex cursor-pointer rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-white/92"
          >
            Перейти в каталог
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell section-space">
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="satin-panel h-40 animate-pulse rounded-[28px] border border-white/10" />
              ))
            : result.sourceItems.map((item) => (
                <div
                  key={item.product.id}
                  className="satin-panel grid gap-4 rounded-[28px] border border-white/10 p-4 sm:grid-cols-[120px_1fr_auto]"
                >
                  {item.product.coverUrl ? (
                    <img src={item.product.coverUrl} alt={item.product.title} className="h-28 w-full rounded-2xl object-cover sm:w-30" />
                  ) : (
                    <div className="h-28 rounded-2xl bg-white/[0.03]" />
                  )}
                  <div>
                    <div className="text-xl text-white">{item.product.title}</div>
                    <div className="mt-2 text-sm text-white/56">
                      {item.product.platforms.join(' / ') || item.product.storeType}
                    </div>
                    <div className="mt-4 text-sm text-white/72">
                      {formatMoneyMinor(item.unitPriceRubMinor, 'RUB') ?? 'Цена уточняется'}
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-3 sm:items-end">
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1">
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.product.id, item.quantity - 1)}
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-white/72 transition hover:bg-white/10 hover:text-white"
                        aria-label="Уменьшить количество"
                      >
                        <Minus size={16} />
                      </button>
                      <div className="min-w-10 text-center text-sm text-white">{item.quantity}</div>
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.product.id, item.quantity + 1)}
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-white/72 transition hover:bg-white/10 hover:text-white"
                        aria-label="Увеличить количество"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product.id)}
                      className="inline-flex cursor-pointer items-center gap-2 text-sm text-white/48 transition hover:text-white"
                    >
                      <Trash2 size={14} />
                      Удалить
                    </button>
                  </div>
                </div>
              ))}

          {!loading && result.autoCodeItems.length > 0 ? (
            <div className="satin-panel rounded-[28px] border border-white/10 p-5">
              <div className="text-sm uppercase tracking-[0.18em] text-white/58">Автоматически добавленные коды</div>
              <div className="mt-4 space-y-3">
                {result.autoCodeItems.map((item) => (
                  <div key={item.code} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                    <div>
                      <div className="text-white">{item.title}</div>
                      <div className="mt-1 text-sm text-white/48">Номинал: {item.nominalTry} TRY</div>
                    </div>
                    <div className="text-white">{formatMoneyMinor(item.priceRubMinor, 'RUB')}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!loading && result.message ? (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-4 text-sm leading-6 text-white/68">
              {result.message}
              {result.pricing.theoreticalRemainderTryMinor !== null ? (
                <div className="mt-2 text-white/92">
                  После активации кодов на вашем аккаунте останется{' '}
                  <span className="font-medium">{formatTryMinor(result.pricing.theoreticalRemainderTryMinor)} TRY</span>.
                </div>
              ) : null}
            </div>
          ) : null}

          {!loading && error ? (
            <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
              Не удалось пересчитать корзину. Повторите попытку.
            </div>
          ) : null}
        </div>

        <aside className="satin-panel h-fit rounded-[30px] border border-white/10 p-6">
          <div className="font-display text-3xl text-sheen">Итого</div>
          <div className="mt-6 flex items-center justify-between text-sm text-white/56">
            <span>Регион</span>
            <span>{region}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-white/56">
            <span>Товары</span>
            <span>{formatTryMinor(result.pricing.sourceTotalTryMinor)} TRY</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-white/56">
            <span>Коды пополнения</span>
            <span>{formatMoneyMinor(result.pricing.topUpTotalRubMinor, 'RUB') ?? '—'}</span>
          </div>
          <div className="mt-6 border-t border-white/10 pt-6">
            <div className="flex items-center justify-between text-lg text-white">
              <span>К оплате</span>
              <span>{formatMoneyMinor(result.pricing.payableRubMinor, 'RUB') ?? '—'}</span>
            </div>
          </div>
          <Link
            to="/checkout"
            className="mt-6 inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-950 shadow-[0_0_18px_rgba(255,255,255,.12)] transition hover:bg-white/92"
          >
            Оформить заказ
          </Link>
        </aside>
      </div>
    </div>
  )
}
