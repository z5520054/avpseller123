import { ArrowRight, SlidersHorizontal, X } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CatalogApiProductCard } from '../components/ui/catalog-api-product-card'
import { ProductSkeleton } from '../components/ui/product-skeleton'
import { getCatalogFilters, getCatalogList, getHomeBanners, getPsPlusPrices } from '../lib/catalog-api'
import { formatMoneyMinor } from '../lib/format'
import { translateGenre } from '../lib/genre-translation'
import { makePsPlusProductId } from '../lib/ps-plus-cart'
import { useAppState } from '../store/use-app-state'
import type { CatalogApiProduct, HomeBanner, HomeBannerSettings, PsPlusPrice, Region } from '../types'

const PAGE_SIZE = 24

const SUBSCRIPTION_DURATIONS = [
  { label: '1 месяц', months: 1 },
  { label: '3 месяца', months: 3 },
  { label: '12 месяцев', months: 12 },
] as const

const SUBSCRIPTION_PLANS = [
  {
    tier: 'Essential',
    label: 'ESSENTIAL',
    tone: 'from-zinc-100 via-white to-zinc-300',
    textTone: 'text-black',
    text: 'Ежемесячные игры, онлайн-мультиплеер, скидки и облачные сохранения.',
  },
  {
    tier: 'Extra',
    label: 'EXTRA',
    tone: 'from-[#ffb000] via-[#ffc531] to-[#f39400]',
    textTone: 'text-black',
    text: 'Все из Essential плюс каталог игр и Ubisoft+ Classics.',
  },
  {
    tier: 'Deluxe',
    label: 'DELUXE',
    tone: 'from-[#222] via-[#353535] to-[#111]',
    textTone: 'text-[#ffb000]',
    text: 'Каталог игр, Classics Catalogue и пробные версии игр.',
  },
] as const

const SORT_OPTIONS = [
  { value: 'sony', label: 'По умолчанию' },
  { value: 'price_asc', label: 'Сначала дешевле' },
  { value: 'price_desc', label: 'Сначала дороже' },
  { value: 'release_desc', label: 'Сначала новинки' },
  { value: 'release_asc', label: 'Сначала старые' },
] as const

type CatalogSort = (typeof SORT_OPTIONS)[number]['value']

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
          <p className="mt-2 text-sm text-white/48">Найдено {count.toLocaleString('ru-RU')} позиций</p>
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
  const [settings, setSettings] = useState<HomeBannerSettings>({
    autoplayMs: 6000,
    animation: 'slide',
    updatedAt: new Date(0).toISOString(),
  })
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    let active = true
    getHomeBanners()
      .then((response) => {
        if (!active) return
        setBanners(response.items)
        setSettings(response.settings)
      })
      .catch(() => {
        if (!active) return
        setBanners([])
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (banners.length <= 3) return

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length)
    }, settings.autoplayMs)

    return () => window.clearInterval(timer)
  }, [banners.length, settings.autoplayMs])

  if (banners.length === 0) {
    return (
      <section className="rounded-[34px] border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
        <div className="font-display text-4xl text-sheen">Баннеры не добавлены</div>
        <p className="mt-3 text-sm text-white/52">Добавьте баннеры в админке, чтобы заполнить верхний слайдер главной страницы.</p>
      </section>
    )
  }

  const visibleBanners = banners.length <= 3
    ? banners
    : Array.from({ length: 3 }, (_, index) => banners[(activeIndex + index) % banners.length])
  const animationClass =
    settings.animation === 'fade'
      ? 'animate-[fade-in_520ms_ease-out]'
      : settings.animation === 'lift'
        ? 'animate-[soft-lift_620ms_cubic-bezier(.2,.8,.2,1)]'
        : 'animate-[slide-in_560ms_cubic-bezier(.2,.8,.2,1)]'

  return (
    <section className="overflow-hidden rounded-[34px] border border-white/10 bg-black/30 p-3 shadow-[0_32px_90px_rgba(0,0,0,0.42)]">
      <div key={`${activeIndex}-${settings.animation}`} className={`grid gap-3 md:grid-cols-3 ${animationClass}`}>
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

function SearchResults() {
  const { region, searchQuery } = useAppState()
  const query = useDeferredValue(searchQuery.trim())
  const [sort, setSort] = useState<CatalogSort>('sony')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [platform, setPlatform] = useState('')
  const [language, setLanguage] = useState<'ru_subtitles' | 'ru_full' | ''>('')
  const [genre, setGenre] = useState('')
  const [filters, setFilters] = useState<{ platforms: string[]; genres: string[] }>({ platforms: [], genres: [] })
  const [state, setState] = useState<{
    key: string | null
    items: CatalogApiProduct[]
    total: number
    error: string | null
  }>({ key: null, items: [], total: 0, error: null })
  const requestKey = JSON.stringify({ query, sort, page, region, platform, language, genre })

  useEffect(() => {
    getCatalogFilters()
      .then((response) => {
        setFilters({
          platforms: response.platforms.filter((item) => item === 'PS4' || item === 'PS5'),
          genres: response.genres,
        })
      })
      .catch(() => setFilters({ platforms: ['PS4', 'PS5'], genres: [] }))
  }, [])

  useEffect(() => {
    let active = true
    getCatalogList({
      query,
      region: regionToApi(region),
      platform: platform || undefined,
      language: language || undefined,
      genre: genre || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      sort,
    })
      .then((response) => {
        if (!active) return
        setState({ key: requestKey, items: response.items, total: response.total, error: null })
      })
      .catch(() => {
        if (!active) return
        setState({ key: requestKey, items: [], total: 0, error: 'search-error' })
      })

    return () => {
      active = false
    }
  }, [genre, language, page, platform, query, region, requestKey, sort])

  const loading = state.key !== requestKey
  const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  const activeFilterCount = [platform, language, genre].filter(Boolean).length

  return (
    <section className="space-y-6">
      <div>
        <div className="inline-flex rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.32em] text-white/42">
          Поиск
        </div>
        <h1 className="mt-4 font-display text-4xl text-sheen sm:text-5xl">Поиск по каталогу</h1>
        <p className="mt-3 text-sm text-white/56">
          Найдено {loading ? '...' : state.total.toLocaleString('ru-RU')} позиций по запросу <span className="text-white">"{query}"</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-4">
        <label className="flex min-w-[260px] items-center gap-3 text-sm text-white/60">
          <span className="text-white/42">Сортировка</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as CatalogSort)
              setPage(1)
            }}
            className="rounded-2xl border border-white/10 bg-black px-4 py-2.5 text-sm text-white outline-none"
          >
            {SORT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setFiltersOpen(true)} className="quiet-button">
          <SlidersHorizontal size={16} />
          Фильтр{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProductSkeleton key={index} />
          ))}
        </div>
      ) : state.error ? (
        <div className="satin-panel rounded-[32px] border border-white/10 px-6 py-12 text-center text-white/58">
          Поиск временно недоступен. Повторите запрос чуть позже.
        </div>
      ) : state.items.length > 0 ? (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {state.items.map((product) => (
              <CatalogApiProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-full border border-white/10 px-5 py-3 text-sm text-white transition hover:border-white/18 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-35"
            >
              Назад
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-full border border-white/10 px-5 py-3 text-sm text-white transition hover:border-white/18 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-35"
            >
              Вперед
            </button>
          </div>
        </>
      ) : (
        <div className="satin-panel rounded-[32px] border border-white/10 px-6 py-12 text-center">
          <div className="font-display text-3xl text-white">Ничего не найдено</div>
          <p className="mt-3 text-sm text-white/56">Попробуйте другой запрос или снимите фильтры.</p>
        </div>
      )}

      {filtersOpen ? (
        <FilterDialog
          platform={platform}
          language={language}
          genre={genre}
          filters={filters}
          setPlatform={setPlatform}
          setLanguage={setLanguage}
          setGenre={setGenre}
          setPage={setPage}
          onClose={() => setFiltersOpen(false)}
          onReset={() => {
            setPlatform('')
            setLanguage('')
            setGenre('')
            setPage(1)
          }}
        />
      ) : null}
    </section>
  )
}

function FilterDialog({
  platform,
  language,
  genre,
  filters,
  setPlatform,
  setLanguage,
  setGenre,
  setPage,
  onClose,
  onReset,
}: {
  platform: string
  language: '' | 'ru_subtitles' | 'ru_full'
  genre: string
  filters: { platforms: string[]; genres: string[] }
  setPlatform: (value: string) => void
  setLanguage: (value: '' | 'ru_subtitles' | 'ru_full') => void
  setGenre: (value: string) => void
  setPage: (value: number) => void
  onClose: () => void
  onReset: () => void
}) {
  function updateFilter(callback: () => void) {
    callback()
    setPage(1)
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto max-w-xl rounded-[28px] border border-white/10 bg-[#090909] p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div className="font-display text-3xl text-white">Фильтр</div>
          <button type="button" onClick={onClose} className="header-icon-button">
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <div className="mb-3 text-sm uppercase tracking-[0.18em] text-white/42">Платформа</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => updateFilter(() => setPlatform(''))} className={`rounded-full border px-4 py-2 text-sm ${!platform ? 'border-white/20 bg-white text-black' : 'border-white/10 text-white/68'}`}>
                Все
              </button>
              {filters.platforms.map((item) => (
                <button key={item} type="button" onClick={() => updateFilter(() => setPlatform(item))} className={`rounded-full border px-4 py-2 text-sm ${platform === item ? 'border-white/20 bg-white text-black' : 'border-white/10 text-white/68'}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm uppercase tracking-[0.18em] text-white/42">Язык</div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '', label: 'Любой язык' },
                { value: 'ru_subtitles', label: 'Русские субтитры' },
                { value: 'ru_full', label: 'Полностью на русском' },
              ].map((item) => (
                <button key={item.value} type="button" onClick={() => updateFilter(() => setLanguage(item.value as '' | 'ru_subtitles' | 'ru_full'))} className={`rounded-full border px-4 py-2 text-sm ${language === item.value ? 'border-white/20 bg-white text-black' : 'border-white/10 text-white/68'}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm uppercase tracking-[0.18em] text-white/42">Жанр</div>
            <select
              value={genre}
              onChange={(event) => updateFilter(() => setGenre(event.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none"
            >
              <option value="">Все жанры</option>
              {filters.genres.map((item) => (
                <option key={item} value={item}>
                  {translateGenre(item)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onReset} className="rounded-full border border-white/12 px-5 py-3 text-sm text-white transition hover:border-white/20">
            Сбросить
          </button>
          <button type="button" onClick={onClose} className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black">
            Применить
          </button>
        </div>
      </div>
    </div>
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
            <article key={plan.tier} className={`relative overflow-hidden rounded-[28px] bg-gradient-to-br ${plan.tone} p-5 text-black`}>
              <div className="absolute inset-0 opacity-20 mix-blend-overlay [background:radial-gradient(circle_at_25%_20%,white,transparent_28%),linear-gradient(120deg,transparent_0%,rgba(255,255,255,.6)_45%,transparent_60%)]" />
              <div className="relative min-h-[250px]">
                <div className={`text-sm font-semibold tracking-[-0.03em] ${plan.textTone}`}>PS Plus</div>
                <div className={`mt-7 text-[clamp(2.8rem,6vw,5.2rem)] font-black leading-none tracking-[-0.08em] ${plan.textTone}`}>
                  {plan.label}
                </div>
                <p className={`mt-5 max-w-sm text-sm font-medium leading-6 ${plan.textTone} opacity-70`}>{plan.text}</p>
                <div className={`mt-6 text-3xl font-black ${plan.textTone}`}>
                  {formatMoneyMinor(price?.priceRubMinor, 'RUB') ?? 'Цена не задана'}
                </div>
                {isInCart ? (
                  <Link
                    to="/cart"
                    className="mt-5 inline-flex w-full cursor-pointer justify-center rounded-full border border-emerald-500/60 bg-emerald-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300"
                  >
                    Перейти в корзину
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={!canBuy}
                    onClick={() => addToCart(productId)}
                    className="mt-5 inline-flex w-full cursor-pointer justify-center rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/82 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Выбрать
                  </button>
                )}
              </div>
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
  const { region, searchQuery } = useAppState()
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

  if (searchQuery.trim()) {
    return (
      <div className="page-shell space-y-8 pb-10">
        <SearchResults />
      </div>
    )
  }

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
