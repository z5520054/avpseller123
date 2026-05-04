import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CatalogApiProductCard } from '../components/ui/catalog-api-product-card'
import { ProductSkeleton } from '../components/ui/product-skeleton'
import { getCatalogList, getHomeBanners, getPsPlusPrices } from '../lib/catalog-api'
import { formatMoneyMinor } from '../lib/format'
import { makePsPlusProductId } from '../lib/ps-plus-cart'
import { useAppState } from '../store/use-app-state'
import type { CatalogApiProduct, HomeBanner, PsPlusPrice, Region } from '../types'

const SUBSCRIPTION_DURATIONS = [
  { label: '1 месяц', months: 1 },
  { label: '3 месяца', months: 3 },
  { label: '12 месяцев', months: 12 },
] as const

const SUBSCRIPTION_PLANS = [
  {
    tier: 'Essential',
    text: 'Ежемесячные игры, онлайн-мультиплеер, скидки и облачные сохранения.',
  },
  {
    tier: 'Extra',
    text: 'Все из Essential плюс каталог игр и Ubisoft+ Classics.',
  },
  {
    tier: 'Deluxe',
    text: 'Каталог игр, Classics Catalogue и пробные версии игр.',
  },
] as const

function regionToApi(region: Region) {
  return region === 'Turkey' ? 'turkey' : 'india'
}

function buildCatalogHref(category: 'deals' | 'subscriptions' | 'games' | 'preorders') {
  return `/catalog?category=${category}`
}

function ShelfHeading({ title, count, href }: { title: string; count?: number; href: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="font-display text-[clamp(2rem,3vw,3rem)] uppercase tracking-[0.04em] text-sheen">{title}</h2>
        {typeof count === 'number' ? (
          <p className="mt-2 text-sm text-white/48">Позиций в разделе: {count.toLocaleString('ru-RU')}</p>
        ) : null}
      </div>
      <Link to={href} className="quiet-button">
        Смотреть все
        <ArrowRight size={16} />
      </Link>
    </div>
  )
}

function BannerSlider() {
  const [banners, setBanners] = useState<HomeBanner[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    let active = true
    getHomeBanners()
      .then((response) => {
        if (active) setBanners(response.items)
      })
      .catch(() => {
        if (active) setBanners([])
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (banners.length <= 3) return

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length)
    }, 6000)

    return () => window.clearInterval(timer)
  }, [banners.length])

  if (banners.length === 0) {
    return (
      <section className="rounded-[34px] border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
        <div className="font-display text-4xl text-sheen">Баннеры не добавлены</div>
        <p className="mt-3 text-sm text-white/52">
          Добавьте баннеры в админке, чтобы заполнить верхний слайдер главной страницы.
        </p>
      </section>
    )
  }

  const visibleBanners = banners.length <= 3
    ? banners
    : Array.from({ length: 3 }, (_, index) => banners[(activeIndex + index) % banners.length])

  return (
    <section className="overflow-hidden rounded-[34px] border border-white/10 bg-black/30 p-3 shadow-[0_32px_90px_rgba(0,0,0,0.42)]">
      <div className="grid gap-3 md:grid-cols-3">
        {visibleBanners.map((banner) => (
          <Link
            key={banner.id}
            to={banner.linkUrl}
            className="group relative block h-[180px] overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.03] sm:h-[240px] lg:h-[320px]"
            aria-label={banner.title}
          >
            <img
              src={banner.imageUrl}
              alt={banner.title}
              className="h-full w-full object-cover transition duration-700"
              style={{
                objectPosition: `${banner.imagePositionX}% ${banner.imagePositionY}%`,
                transform: `scale(${banner.imageScale})`,
              }}
            />
            <div className="absolute inset-0 rounded-[26px] ring-1 ring-inset ring-white/8 transition group-hover:bg-white/[0.035]" />
          </Link>
        ))}
      </div>

      {banners.length > 3 ? (
        <div className="flex gap-2 px-5 py-4">
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-2 flex-1 rounded-full transition ${index === activeIndex ? 'bg-white' : 'bg-white/18 hover:bg-white/32'}`}
              aria-label={`Открыть баннер ${index + 1}: ${banner.title}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function Shelf({
  title,
  count,
  href,
  items,
  loading,
  emptyText,
  columns = 'xl:grid-cols-3',
}: {
  title: string
  count?: number
  href: string
  items: CatalogApiProduct[]
  loading: boolean
  emptyText: string
  columns?: string
}) {
  return (
    <section>
      <ShelfHeading title={title} count={count} href={href} />
      {loading ? (
        <div className={`grid gap-5 md:grid-cols-2 ${columns}`}>
          {Array.from({ length: 6 }).map((_, index) => (
            <ProductSkeleton key={index} />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className={`grid gap-5 md:grid-cols-2 ${columns}`}>
          {items.map((product) => (
            <CatalogApiProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-6 py-10 text-sm text-white/56">{emptyText}</div>
      )}
    </section>
  )
}

function SubscriptionPreview() {
  const { addToCart, cart, region } = useAppState()
  const [activeDuration, setActiveDuration] = useState<(typeof SUBSCRIPTION_DURATIONS)[number]>(SUBSCRIPTION_DURATIONS[0])
  const [prices, setPrices] = useState<PsPlusPrice[]>([])

  useEffect(() => {
    let active = true
    getPsPlusPrices(regionToApi(region))
      .then((response) => {
        if (active) setPrices(response.items)
      })
      .catch(() => {
        if (active) setPrices([])
      })

    return () => {
      active = false
    }
  }, [region])

  return (
    <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <ShelfHeading title="Подписки PS Plus" href={buildCatalogHref('subscriptions')} />
      <div className="flex flex-wrap gap-2">
        {SUBSCRIPTION_DURATIONS.map((duration) => (
          <button
            key={duration.months}
            type="button"
            onClick={() => setActiveDuration(duration)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              activeDuration.months === duration.months ? 'border-white/20 bg-white text-black' : 'border-white/10 text-white/68 hover:text-white'
            }`}
          >
            {duration.label}
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const price = prices.find((item) => item.tier === plan.tier && item.durationMonths === activeDuration.months)
          const canBuy = Boolean(price?.isActive && price.priceRubMinor !== null)
          const productId = makePsPlusProductId(region, plan.tier, activeDuration.months)
          const isInCart = cart.some((item) => item.productId === productId)

          return (
          <article key={plan.tier} className="rounded-[26px] border border-white/10 bg-black/20 p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-white/42">PlayStation Plus</div>
            <h3 className="mt-3 font-display text-3xl text-sheen">{plan.tier}</h3>
            <p className="mt-3 min-h-16 text-sm leading-6 text-white/56">{plan.text}</p>
            <div className="mt-4 text-2xl font-semibold text-white">
              {formatMoneyMinor(
                price?.priceRubMinor,
                'RUB',
              ) ?? 'Цена не задана'}
            </div>
            {isInCart ? (
              <Link
                to="/cart"
                className="mt-5 inline-flex w-full cursor-pointer justify-center rounded-full border border-emerald-300/60 bg-emerald-400 px-5 py-3 text-sm font-medium text-black transition hover:bg-emerald-300"
              >
                Перейти в корзину
              </Link>
            ) : (
              <button
                type="button"
                disabled={!canBuy}
                onClick={() => addToCart(productId)}
                className="mt-5 inline-flex w-full cursor-pointer justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/92 disabled:cursor-not-allowed disabled:opacity-40"
              >
              Выбрать
              </button>
            )}
          </article>
          )
        })}
      </div>
    </section>
  )
}

const initialState = {
  key: null as string | null,
  deals: [] as CatalogApiProduct[],
  games: [] as CatalogApiProduct[],
  preorders: [] as CatalogApiProduct[],
  totals: { deals: 0, games: 0, preorders: 0 },
  error: null as string | null,
}

export function HomePage() {
  const { region } = useAppState()
  const requestKey = region
  const [state, setState] = useState(initialState)

  useEffect(() => {
    let active = true
    const targetRegion = regionToApi(region)

    Promise.all([
      getCatalogList({ region: targetRegion, tag: 'section:deals', limit: 6, sort: 'sony' }),
      getCatalogList({ region: targetRegion, tag: 'section:games', limit: 6, sort: 'sony' }),
      getCatalogList({ region: targetRegion, tag: 'section:preorders', limit: 4, sort: 'sony' }),
    ])
      .then(([deals, games, preorders]) => {
        if (!active) return
        setState({
          key: requestKey,
          deals: deals.items,
          games: games.items,
          preorders: preorders.items,
          totals: { deals: deals.total, games: games.total, preorders: preorders.total },
          error: null,
        })
      })
      .catch(() => {
        if (active) setState({ ...initialState, key: requestKey, error: 'home-api-error' })
      })

    return () => {
      active = false
    }
  }, [region, requestKey])

  const loading = state.key !== requestKey
  const error = state.key === requestKey ? state.error : null
  const totals = state.key === requestKey ? state.totals : initialState.totals

  return (
    <div className="page-shell space-y-8 pb-10">
      <BannerSlider />

      {error ? (
        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
          <div className="font-display text-3xl text-white">Главная временно не получила данные каталога</div>
          <Link to="/catalog" className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-black">
            Открыть каталог
          </Link>
        </div>
      ) : (
        <>
          <Shelf title="Распродажа" count={totals.deals} href={buildCatalogHref('deals')} items={state.deals} loading={loading} emptyText="Раздел распродажи не вернул товары." />
          <SubscriptionPreview />
          <Shelf title="Игры PS Store" count={totals.games} href={buildCatalogHref('games')} items={state.games} loading={loading} emptyText="Каталог игр пока не пришел из API." />
          <Shelf
            title="Предзаказы"
            count={totals.preorders}
            href={buildCatalogHref('preorders')}
            items={state.preorders}
            loading={loading}
            emptyText="Предзаказы сейчас не вернулись из каталога."
            columns="xl:grid-cols-4"
          />
        </>
      )}
    </div>
  )
}
