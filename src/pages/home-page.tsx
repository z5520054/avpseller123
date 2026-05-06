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
    cardClass: 'border-white/28 bg-[radial-gradient(circle_at_74%_5%,rgba(255,255,255,.72),transparent_18%),linear-gradient(138deg,#f4f4f2_0%,#8f939b_42%,#15171b_100%)] text-white shadow-[0_0_0_1px_rgba(255,255,255,.28)_inset,0_0_26px_rgba(255,255,255,.16)]',
    badgeClass: 'border-white/45 bg-white/72 text-zinc-950',
    titleClass: 'text-white drop-shadow-[0_4px_12px_rgba(0,0,0,.46)]',
    bodyClass: 'text-white/88',
    priceClass: 'text-white',
    buttonClass: 'bg-gradient-to-b from-white to-[#dedede] text-black shadow-[0_0_20px_rgba(255,255,255,.22)] hover:brightness-105',
    symbolClass: 'right-3 top-10 h-32 w-32 rotate-[32deg] border-white/55 shadow-[0_0_24px_rgba(255,255,255,.2)]',
    waveClass: 'bg-[linear-gradient(145deg,transparent_0%,transparent_45%,rgba(255,255,255,.42)_48%,rgba(91,93,98,.72)_51%,transparent_62%)]',
    text: 'Ежемесячные игры, онлайн-мультиплеер, скидки и облачные сохранения.',
  },
  {
    tier: 'Extra',
    label: 'EXTRA',
    cardClass: 'border-[#c79a3f]/80 bg-[radial-gradient(circle_at_78%_10%,rgba(216,170,67,.26),transparent_24%),linear-gradient(138deg,#191714_0%,#0c0d10_44%,#16120b_100%)] text-white shadow-[0_0_0_1px_rgba(255,217,98,.16)_inset,0_0_24px_rgba(187,133,35,.24)]',
    badgeClass: 'border-[#e5ad34]/65 bg-black/18 text-[#ffe07a]',
    titleClass: 'bg-gradient-to-b from-[#ffe176] via-[#ffc43a] to-[#a66a15] bg-clip-text text-transparent drop-shadow-[0_4px_16px_rgba(255,175,28,.25)]',
    bodyClass: 'text-white/86',
    priceClass: 'text-[#ffd75d]',
    buttonClass: 'bg-gradient-to-b from-[#f1d37a] to-[#b37d1f] text-black shadow-[0_0_18px_rgba(191,140,42,.32)] hover:brightness-110',
    symbolClass: 'right-6 top-11 h-32 w-32 rotate-[17deg] border-[#d4aa54]/72 shadow-[0_0_22px_rgba(196,145,44,.26)]',
    waveClass: 'bg-[linear-gradient(145deg,transparent_0%,transparent_47%,rgba(199,146,41,.54)_50%,rgba(96,68,18,.68)_53%,transparent_66%)]',
    text: 'Все из Essential плюс каталог игр и Ubisoft+ Classics.',
  },
  {
    tier: 'Deluxe',
    label: 'DELUXE',
    cardClass: 'border-[#8d692e]/78 bg-[radial-gradient(circle_at_82%_18%,rgba(190,143,45,.12),transparent_25%),linear-gradient(138deg,#151516_0%,#090a0c_48%,#050505_100%)] text-white shadow-[0_0_0_1px_rgba(255,195,68,.1)_inset]',
    badgeClass: 'border-[#c58a26]/65 bg-black/18 text-[#ffe07a]',
    titleClass: 'bg-gradient-to-b from-[#ffe176] via-[#d99a25] to-[#8d5a16] bg-clip-text text-transparent',
    bodyClass: 'text-white/82',
    priceClass: 'text-[#d69b2a]',
    buttonClass: 'border border-[#a8792d]/82 bg-black/18 text-[#e5bd61] shadow-[0_0_14px_rgba(161,114,39,.2)] hover:bg-[#b98225] hover:text-black',
    symbolClass: 'right-5 top-11 h-28 w-28 rotate-[17deg] border-[#a87a30]/7 shadow-[0_0_18px_rgba(164,117,37,.18)]',
    waveClass: 'bg-[linear-gradient(145deg,transparent_0%,transparent_51%,rgba(152,106,31,.48)_54%,rgba(75,53,16,.54)_57%,transparent_72%)]',
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
    if (banners.length <= 1) return

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

  const visibleBanners = Array.from(
    { length: Math.min(4, banners.length) },
    (_, index) => banners[(activeIndex + index) % banners.length],
  )
  const animationClass =
    settings.animation === 'fade'
      ? 'animate-[fade-in_520ms_ease-out]'
      : settings.animation === 'lift'
        ? 'animate-[soft-lift_620ms_cubic-bezier(.2,.8,.2,1)]'
        : 'animate-[slide-in_560ms_cubic-bezier(.2,.8,.2,1)]'

  return (
    <section className="overflow-hidden rounded-[26px] border border-white/10 bg-black/30 p-2 shadow-[0_32px_90px_rgba(0,0,0,0.42)] sm:rounded-[34px] sm:p-3">
      <div key={`${activeIndex}-${settings.animation}`} className={`flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-4 [&::-webkit-scrollbar]:hidden ${animationClass}`}>
        {visibleBanners.map((banner) => (
          <Link
            key={banner.id}
            to={banner.linkUrl}
            className="group relative block aspect-[3/4] min-w-[72%] snap-start overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03] sm:min-w-0 sm:rounded-[26px]"
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

      {banners.length > 1 ? (
        <div className="flex gap-2 px-3 py-3 sm:px-5 sm:py-4">
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
        <div className={`grid gap-4 sm:gap-5 md:grid-cols-2 ${columns}`}>
          {Array.from({ length: 6 }).map((_, index) => (
            <ProductSkeleton key={index} />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className={`grid gap-4 sm:gap-5 md:grid-cols-2 ${columns}`}>
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

      <div className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:rounded-[28px] sm:px-5">
        <label className="flex min-w-0 flex-col gap-2 text-sm text-white/60 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-white/42">Сортировка</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as CatalogSort)
              setPage(1)
            }}
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none sm:w-auto sm:py-2.5"
          >
            {SORT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setFiltersOpen(true)} className="quiet-button w-full sm:w-auto">
          <SlidersHorizontal size={16} />
          Фильтр{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
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
          <div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
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
    <div className="fixed inset-0 z-[80] bg-black/70 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6" role="dialog" aria-modal="true">
      <div className="mx-auto max-h-[calc(100svh-2rem)] max-w-xl overflow-y-auto rounded-[24px] border border-white/10 bg-[#090909] p-4 shadow-2xl sm:max-h-[calc(100vh-3rem)] sm:rounded-[28px] sm:p-5">
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
    <section className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0b0b0c] px-4 py-6 shadow-[0_30px_110px_rgba(0,0,0,.56),0_0_70px_rgba(255,255,255,.045)_inset] sm:rounded-[30px] sm:px-7 lg:px-9 lg:py-9">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_2%_48%,rgba(255,255,255,.09),transparent_10%),radial-gradient(circle_at_92%_78%,rgba(180,132,43,.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,.045),transparent_42%)]" />
      <div className="pointer-events-none absolute left-10 top-28 h-px w-48 bg-gradient-to-r from-transparent via-white/42 to-transparent shadow-[0_0_14px_rgba(255,255,255,.2)]" />
      <div className="pointer-events-none absolute right-[22%] top-8 h-16 w-16 rotate-45 border-[11px] border-white/8 shadow-[0_0_22px_rgba(255,255,255,.08)]" />
      <div className="pointer-events-none absolute right-[34%] top-34 h-13 w-13 rotate-45 before:absolute before:left-1/2 before:top-0 before:h-full before:w-2.5 before:-translate-x-1/2 before:rounded-full before:bg-white/10 before:shadow-[0_0_14px_rgba(255,255,255,.12)] after:absolute after:left-0 after:top-1/2 after:h-2.5 after:w-full after:-translate-y-1/2 after:rounded-full after:bg-white/10 after:shadow-[0_0_14px_rgba(255,255,255,.12)]" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-56 w-[38rem] rounded-[100%] border-t-[18px] border-white/10 shadow-[0_-18px_34px_rgba(255,255,255,.06)]" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-5">
        <h2 className="max-w-4xl text-[clamp(1.45rem,8vw,3.15rem)] font-black uppercase leading-none tracking-[-0.05em] text-[#eef5ff] drop-shadow-[0_5px_0_rgba(255,255,255,.07)]">
          Подписки PS Plus
        </h2>
        <Link
          to={buildCatalogHref('subscriptions')}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-white/18 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(255,255,255,.06)_inset] transition hover:border-white/30 hover:bg-white/[0.08] sm:w-auto"
        >
          Смотреть все
          <ArrowRight size={18} />
        </Link>
      </div>

      <div className="-mx-1 mt-6 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mt-7 sm:gap-4 [&::-webkit-scrollbar]:hidden">
        {SUBSCRIPTION_DURATIONS.map((duration) => (
          <button
            key={duration.months}
            type="button"
            onClick={() => setActiveDuration(duration)}
            className={`min-w-32 shrink-0 cursor-pointer rounded-full border px-5 py-3 text-sm font-semibold transition duration-300 sm:min-w-36 sm:px-6 sm:text-base ${
              activeDuration.months === duration.months
                ? 'border-white/35 bg-white text-black shadow-[0_0_0_1px_rgba(255,255,255,.18)_inset,0_0_18px_rgba(255,255,255,.18)]'
                : 'border-white/10 bg-white/[0.035] text-white/58 hover:border-white/18 hover:text-white'
            }`}
          >
            {duration.label}
          </button>
        ))}
      </div>

      <div className="relative mt-6 grid gap-4 sm:mt-7 sm:gap-5 lg:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const price = prices.find((item) => item.tier === plan.tier && item.durationMonths === activeDuration.months)
          const canBuy = Boolean(price?.isActive && price.priceRubMinor !== null)
          const productId = makePsPlusProductId(region, plan.tier, activeDuration.months)
          const isInCart = cart.some((item) => item.productId === productId)

          return (
            <article key={plan.tier} className={`relative flex min-h-[300px] overflow-hidden rounded-[20px] border p-4 transition duration-300 hover:-translate-y-1 sm:min-h-[330px] sm:rounded-[22px] sm:p-5 ${plan.cardClass}`}>
              <div className={`pointer-events-none absolute inset-0 opacity-90 ${plan.waveClass}`} />
              <div className={`pointer-events-none absolute scale-75 rounded-[10px] border-[9px] opacity-80 ${plan.symbolClass}`} />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,.18),transparent_18%),linear-gradient(180deg,rgba(255,255,255,.06),transparent_35%)]" />
              <div className="relative flex h-full min-h-[288px] w-full flex-col">
                <div className={`inline-flex w-fit rounded-lg border px-3.5 py-1.5 text-base font-semibold ${plan.badgeClass}`}>PS Plus</div>
                <div className={`mt-9 text-[clamp(1.95rem,12vw,2.7rem)] font-black uppercase leading-none tracking-[-0.07em] sm:mt-11 sm:text-[clamp(2.1rem,3.15vw,3rem)] ${plan.titleClass}`}>
                  {plan.label}
                </div>
                <p className={`mt-4 max-w-sm text-base font-medium leading-6 ${plan.bodyClass}`}>{plan.text}</p>
                <div className={`mt-auto pt-8 text-[clamp(1.65rem,2.4vw,2.15rem)] font-black tracking-[-0.06em] ${plan.priceClass}`}>
                  {formatMoneyMinor(price?.priceRubMinor, 'RUB') ?? 'Цена не задана'}
                </div>
                {isInCart ? (
                  <Link
                    to="/cart"
                    className="mt-5 inline-flex w-full cursor-pointer justify-center rounded-full bg-emerald-400 px-5 py-3.5 text-base font-semibold text-black transition hover:bg-emerald-300"
                  >
                    Перейти в корзину
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={!canBuy}
                    onClick={() => addToCart(productId)}
                    className={`mt-5 inline-flex w-full cursor-pointer justify-center rounded-full px-5 py-3.5 text-base font-semibold transition duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${plan.buttonClass}`}
                  >
                    Выбрать
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
      <div className="relative mt-8 flex justify-center gap-5">
        <span className="h-1.5 w-12 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,.28)]" />
        <span className="h-1.5 w-12 rounded-full bg-white/18" />
        <span className="h-1.5 w-12 rounded-full bg-white/18" />
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
      getCatalogList({ region: targetRegion, tag: 'section:deals', discountedOnly: true, limit: 6, sort: 'sony' }),
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
          <Link to="/catalog" className="mt-6 inline-flex rounded-full bg-white px-7 py-3 text-sm font-semibold !text-black shadow-[0_10px_28px_rgba(255,255,255,.10)] transition hover:bg-zinc-100">
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
