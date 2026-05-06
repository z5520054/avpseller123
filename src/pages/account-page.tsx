import { Gift, Heart, Link as LinkIcon, ShoppingBag, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCatalogProductsByIds } from '../hooks/use-catalog-products-by-ids'
import { useAppState } from '../store/use-app-state'

function readVkProfile() {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem('avp-vkid-profile')
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

function getProfileName(profile: Record<string, unknown> | null) {
  const user = profile?.user as Record<string, unknown> | undefined
  const firstName = typeof user?.first_name === 'string' ? user.first_name : ''
  const lastName = typeof user?.last_name === 'string' ? user.last_name : ''
  const fullName = `${firstName} ${lastName}`.trim()

  return fullName || 'Покупатель AVP Seller'
}

function getAvatar(profile: Record<string, unknown> | null) {
  const user = profile?.user as Record<string, unknown> | undefined
  return typeof user?.avatar === 'string' ? user.avatar : null
}

export function AccountPage() {
  const { cart, favorites } = useAppState()
  const profile = readVkProfile()
  const avatar = getAvatar(profile)
  const cartIds = cart.map((item) => item.productId)
  const { products: cartProducts } = useCatalogProductsByIds(cartIds)
  const { products: favoriteProducts } = useCatalogProductsByIds(favorites.slice(0, 3))

  return (
    <div className="page-shell section-space">
      <section className="satin-panel overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(145deg,#242426_0%,#111113_52%,#080809_100%)] p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-18 w-18 items-center justify-center overflow-hidden rounded-[24px] border border-white/12 bg-white/8">
              {avatar ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="text-white/70" size={30} />
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-white/42">Личный кабинет</div>
              <h1 className="mt-2 font-display text-4xl text-sheen sm:text-5xl">{getProfileName(profile)}</h1>
              <p className="mt-3 text-sm leading-6 text-white/58">
                Базовый профиль подключён. Здесь будут храниться заказы, корзина, избранное и бонусы.
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-300/18 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-100">
            VK ID подключён
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="satin-panel rounded-[28px] border border-white/10 p-5">
          <ShoppingBag className="text-white/58" size={22} />
          <div className="mt-5 text-3xl font-semibold text-white">{cart.length}</div>
          <div className="mt-1 text-sm text-white/50">товаров в корзине</div>
        </div>
        <div className="satin-panel rounded-[28px] border border-white/10 p-5">
          <Heart className="text-white/58" size={22} />
          <div className="mt-5 text-3xl font-semibold text-white">{favorites.length}</div>
          <div className="mt-1 text-sm text-white/50">в избранном</div>
        </div>
        <div className="satin-panel rounded-[28px] border border-white/10 p-5">
          <Gift className="text-white/58" size={22} />
          <div className="mt-5 text-3xl font-semibold text-white">0 ₽</div>
          <div className="mt-1 text-sm text-white/50">бонусный баланс</div>
        </div>
        <div className="satin-panel rounded-[28px] border border-white/10 p-5">
          <LinkIcon className="text-white/58" size={22} />
          <div className="mt-5 text-3xl font-semibold text-white">1</div>
          <div className="mt-1 text-sm text-white/50">привязанный аккаунт</div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="satin-panel rounded-[30px] border border-white/10 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-3xl text-sheen">История заказов</h2>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/45">MVP</span>
          </div>
          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-white">Заказов пока нет</div>
            <p className="mt-2 text-sm leading-6 text-white/52">
              После оформления покупки здесь появятся номер заказа, статус оплаты и список купленных кодов.
            </p>
            <Link
              to="/catalog"
              className="mt-5 inline-flex cursor-pointer rounded-full bg-white px-6 py-3 text-sm font-semibold !text-black transition hover:bg-zinc-100"
            >
              Перейти в каталог
            </Link>
          </div>
        </div>

        <div className="satin-panel rounded-[30px] border border-white/10 p-5 sm:p-6">
          <h2 className="font-display text-3xl text-sheen">Сохранённая корзина</h2>
          <div className="mt-6 space-y-3">
            {cartProducts.length > 0 ? (
              cartProducts.slice(0, 4).map((product) => (
                <Link
                  key={product.id}
                  to={`/product/${product.id}`}
                  className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
                >
                  {product.coverUrl ? (
                    <img src={product.coverUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded-2xl bg-white/8" />
                  )}
                  <div className="min-w-0">
                    <div className="line-clamp-1 text-sm text-white">{product.title}</div>
                    <div className="mt-1 text-xs text-white/42">{product.platforms.join(' / ') || product.storeType}</div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/52">
                Корзина пока пустая.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="satin-panel rounded-[30px] border border-white/10 p-5 sm:p-6">
          <h2 className="font-display text-3xl text-sheen">Избранное</h2>
          <div className="mt-6 space-y-3">
            {favoriteProducts.length > 0 ? (
              favoriteProducts.map((product) => (
                <Link
                  key={product.id}
                  to={`/product/${product.id}`}
                  className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
                >
                  {product.coverUrl ? (
                    <img src={product.coverUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded-2xl bg-white/8" />
                  )}
                  <div className="min-w-0">
                    <div className="line-clamp-1 text-sm text-white">{product.title}</div>
                    <div className="mt-1 text-xs text-white/42">Быстрый доступ из кабинета</div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/52">
                Сохраняйте игры в избранное, чтобы вернуться к ним позже.
              </div>
            )}
          </div>
        </div>

        <div className="satin-panel rounded-[30px] border border-white/10 p-5 sm:p-6">
          <h2 className="font-display text-3xl text-sheen">Бонусы и скидки</h2>
          <div className="mt-6 rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-5">
            <div className="text-lg text-white">Персональная программа готовится</div>
            <p className="mt-2 text-sm leading-6 text-white/52">
              Позже сюда можно добавить промокоды, кешбэк, персональные скидки и уровни лояльности.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
