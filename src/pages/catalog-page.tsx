import { SlidersHorizontal, X } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CatalogApiProductCard } from '../components/ui/catalog-api-product-card'
import { CategoryPills } from '../components/ui/category-pills'
import { ProductSkeleton } from '../components/ui/product-skeleton'
import { SectionHeading } from '../components/ui/section-heading'
import { getCatalogFilters, getCatalogList, getPsPlusPrices } from '../lib/catalog-api'
import { formatMoneyMinor } from '../lib/format'
import { translateGenre } from '../lib/genre-translation'
import { makePsPlusProductId } from '../lib/ps-plus-cart'
import { useAppState } from '../store/use-app-state'
import type { CatalogApiProduct, PsPlusPrice, Region } from '../types'

const CATEGORY_OPTIONS = [
  { value: 'games', label: 'Игры PS Store' },
  { value: 'deals', label: 'Распродажа' },
  { value: 'preorders', label: 'Предзаказы' },
  { value: 'subscriptions', label: 'Подписки' },
]

const LANGUAGE_OPTIONS = [
  { value: '', label: 'Любой язык' },
  { value: 'ru_subtitles', label: 'Русские субтитры' },
  { value: 'ru_full', label: 'Полностью на русском' },
] as const

const SORT_OPTIONS = [
  { value: 'sony', label: 'По умолчанию' },
  { value: 'price_asc', label: 'Сначала дешевле' },
  { value: 'price_desc', label: 'Сначала дороже' },
  { value: 'release_desc', label: 'Сначала новинки' },
  { value: 'release_asc', label: 'Сначала старые' },
] as const

type CatalogSort = (typeof SORT_OPTIONS)[number]['value']

const SUBSCRIPTION_DURATIONS = [
  { value: 1, label: '1 месяц' },
  { value: 3, label: '3 месяца' },
  { value: 12, label: '12 месяцев' },
] as const

const SUBSCRIPTION_PLANS = [
  {
    tier: 'Essential',
    cardClass: 'bg-gradient-to-br from-zinc-100 via-white to-zinc-300 text-black',
    eyebrowClass: 'text-black/72',
    titleClass: 'text-black',
    bodyClass: 'text-black/64',
    chipClass: 'border-black/10 bg-black/[0.04] text-black/68',
    buttonClass: 'bg-black text-white hover:bg-black/82',
    description: 'Базовый доступ: ежемесячные игры, онлайн-мультиплеер, скидки и облачные сохранения.',
    benefits: ['Ежемесячные игры', 'Онлайн-мультиплеер', 'Эксклюзивные скидки', 'Облачные сохранения'],
  },
  {
    tier: 'Extra',
    cardClass: 'bg-gradient-to-br from-[#ffb000] via-[#ffc531] to-[#f39400] text-black',
    eyebrowClass: 'text-black/72',
    titleClass: 'text-black',
    bodyClass: 'text-black/70',
    chipClass: 'border-black/10 bg-black/[0.05] text-black/72',
    buttonClass: 'bg-black text-white hover:bg-black/82',
    description: 'Все из Essential плюс каталог игр и Ubisoft+ Classics.',
    benefits: ['Каталог игр', 'Ubisoft+ Classics', 'Ежемесячные игры', 'Онлайн-мультиплеер'],
  },
  {
    tier: 'Deluxe',
    cardClass: 'bg-gradient-to-br from-[#353535] via-[#252525] to-[#111] text-white',
    eyebrowClass: 'text-[#ffb000]',
    titleClass: 'text-[#ffb000]',
    bodyClass: 'text-[#ffb000]/76',
    chipClass: 'border-white/10 bg-black/18 text-white/70',
    buttonClass: 'bg-white text-black hover:bg-white/92',
    description: 'Максимальный план: каталог игр, Classics Catalogue и пробные версии игр.',
    benefits: ['Classics Catalogue', 'Пробные версии игр', 'Каталог игр', 'Ubisoft+ Classics'],
  },
] as const

const PAGE_SIZE = 24

function regionToApi(region: Region) {
  return region === 'Turkey' ? 'turkey' : 'india'
}

function mapCategoryToApi(category: string) {
  switch (category) {
    case 'games':
      return { tag: 'section:games', excludeTag: 'section:preorders' }
    case 'deals':
      return { tag: 'section:deals', excludeTag: 'section:preorders' }
    case 'preorders':
      return { tag: 'section:preorders' }
    default:
      return {}
  }
}


function normalizeSort(value: string | null): CatalogSort {
  return SORT_OPTIONS.some((item) => item.value === value) ? (value as CatalogSort) : 'sony'
}

function getCatalogHeading(category: string) {
  switch (category) {
    case 'deals':
      return 'Распродажа'
    case 'preorders':
      return 'Предзаказы'
    case 'subscriptions':
      return 'Подписки PS Plus'
    case 'games':
    default:
      return 'Каталог игр'
  }
}

function getCatalogDescription(category: string, total: number) {
  if (category === 'subscriptions') {
    return 'Выберите уровень подписки и срок: Essential, Extra или Deluxe на 1, 3 или 12 месяцев.'
  }

  return `Найдено ${total.toLocaleString('ru-RU')} позиций`
}

function SubscriptionChooser() {
  const { addToCart, cart, region } = useAppState()
  const [duration, setDuration] = useState<(typeof SUBSCRIPTION_DURATIONS)[number]['value']>(1)
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
    <div className="satin-panel rounded-[32px] border border-white/10 p-5 sm:p-6">
      <div className="flex flex-wrap gap-2">
        {SUBSCRIPTION_DURATIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setDuration(item.value)}
            className={`rounded-full border px-5 py-3 text-sm transition ${
              duration === item.value
                ? 'border-white/20 bg-white text-black'
                : 'border-white/10 bg-white/[0.04] text-white/68 hover:border-white/18 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const price = prices.find((item) => item.tier === plan.tier && item.durationMonths === duration)
          const canBuy = Boolean(price?.isActive && price.priceRubMinor !== null)
          const productId = makePsPlusProductId(region, plan.tier, duration)
          const isInCart = cart.some((item) => item.productId === productId)

          return (
            <article key={plan.tier} className={`relative flex min-h-[420px] overflow-hidden rounded-[28px] border border-white/10 p-5 ${plan.cardClass}`}>
              <div className="absolute inset-0 opacity-20 mix-blend-overlay [background:radial-gradient(circle_at_22%_18%,white,transparent_30%),linear-gradient(125deg,transparent_0%,rgba(255,255,255,.6)_45%,transparent_62%)]" />
              <div className="relative flex h-full w-full flex-col">
                <div className={`text-xs font-semibold uppercase tracking-[0.22em] ${plan.eyebrowClass}`}>PlayStation Plus</div>
                <h3 className={`mt-5 font-display text-[clamp(2.35rem,4vw,4rem)] leading-none tracking-[-0.055em] ${plan.titleClass}`}>{plan.tier}</h3>
                <p className={`mt-5 min-h-20 text-sm font-medium leading-6 ${plan.bodyClass}`}>{plan.description}</p>
                <div className={`mt-auto pt-6 text-sm font-medium ${plan.bodyClass}`}>Срок: {duration} мес.</div>
                <div className={`mt-3 text-2xl font-extrabold ${plan.titleClass}`}>
                  {formatMoneyMinor(
                    price?.priceRubMinor,
                    'RUB',
                  ) ?? 'Цена не задана'}
                </div>
                <div className="mt-5 space-y-2">
                  {plan.benefits.map((benefit) => (
                    <div key={benefit} className={`rounded-2xl border px-3 py-2 text-sm ${plan.chipClass}`}>
                      {benefit}
                    </div>
                  ))}
                </div>
                {isInCart ? (
                  <Link
                    to="/cart"
                    className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-400 px-5 py-3 text-sm font-medium text-black transition hover:bg-emerald-300"
                  >
                    Перейти в корзину
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={!canBuy}
                    onClick={() => addToCart(productId)}
                    className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${plan.buttonClass}`}
                  >
                    Выбрать
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

export function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const { region, searchQuery } = useAppState()
  const deferredQuery = useDeferredValue(searchQuery)
  const category = params.get('category') ?? 'games'
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const platform = params.get('platform') ?? ''
  const language = params.get('language') ?? ''
  const genre = params.get('genre') ?? ''
  const sort = normalizeSort(params.get('sort'))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<{ platforms: string[]; genres: string[] }>({ platforms: [], genres: [] })
  const requestKey = JSON.stringify({ category, query: deferredQuery, page, region, platform, language, genre, sort })
  const [requestState, setRequestState] = useState<{
    key: string | null
    items: CatalogApiProduct[]
    total: number
    error: string | null
  }>({
    key: null,
    items: [],
    total: 0,
    error: null,
  })

  useEffect(() => {
    getCatalogFilters()
      .then((response) => {
        setFilters({
          platforms: response.platforms.filter((item) => item === 'PS4' || item === 'PS5'),
          genres: response.genres,
        })
      })
      .catch(() => {
        setFilters({ platforms: ['PS4', 'PS5'], genres: [] })
      })
  }, [])

  useEffect(() => {
    if (category === 'subscriptions') return

    let active = true
    const mapped = mapCategoryToApi(category)

    getCatalogList({
      query: deferredQuery || undefined,
      region: regionToApi(region),
      platform: platform || undefined,
      language: language === 'ru_subtitles' || language === 'ru_full' ? language : undefined,
      genre: genre || undefined,
      tag: mapped.tag,
      excludeTag: mapped.excludeTag,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      sort,
    })
      .then((response) => {
        if (!active) return
        setRequestState({
          key: requestKey,
          items: response.items,
          total: response.total,
          error: null,
        })
      })
      .catch(() => {
        if (!active) return
        setRequestState({
          key: requestKey,
          items: [],
          total: 0,
          error: 'catalog-error',
        })
      })

    return () => {
      active = false
    }
  }, [category, deferredQuery, genre, language, page, platform, region, requestKey, sort])

  const isSubscriptions = category === 'subscriptions'
  const items = requestState.key === requestKey ? requestState.items : []
  const total = requestState.key === requestKey ? requestState.total : 0
  const error = requestState.key === requestKey ? requestState.error : null
  const loading = !isSubscriptions && requestState.key !== requestKey
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const activeFilterCount = [platform, language, genre].filter(Boolean).length

  function updateFilter(name: string, value: string) {
    const next = new URLSearchParams(params)
    next.delete('page')
    if (value) {
      next.set(name, value)
    } else {
      next.delete(name)
    }
    setParams(next)
  }

  function setCategory(nextCategory: string) {
    const next = new URLSearchParams()
    next.set('category', nextCategory)
    setParams(next)
  }

  return (
    <div className="page-shell section-space">
      <SectionHeading
        eyebrow="Каталог"
        title={getCatalogHeading(category)}
        description={getCatalogDescription(category, total)}
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <CategoryPills
          values={CATEGORY_OPTIONS.map((item) => item.label)}
          activeValue={CATEGORY_OPTIONS.find((item) => item.value === category)?.label ?? 'Игры PS Store'}
          onChange={(nextLabel) => setCategory(CATEGORY_OPTIONS.find((item) => item.label === nextLabel)?.value ?? 'games')}
        />
      </div>

      {isSubscriptions ? (
        <SubscriptionChooser />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-4">
            <label className="flex min-w-[260px] items-center gap-3 text-sm text-white/60">
              <span className="text-white/42">Сортировка</span>
              <select
                value={sort}
                onChange={(event) => updateFilter('sort', event.target.value)}
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
          ) : error ? (
            <div className="satin-panel rounded-[32px] border border-white/10 px-6 py-12 text-center">
              <div className="font-display text-3xl text-white">Каталог временно недоступен</div>
              <p className="mt-3 text-sm text-white/56">API не вернул товары. Повторите запрос чуть позже.</p>
            </div>
          ) : items.length > 0 ? (
            <>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {items.map((product) => (
                  <CatalogApiProductCard key={product.id} product={product} />
                ))}
              </div>

              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    const next = new URLSearchParams(params)
                    const value = Math.max(1, page - 1)
                    if (value === 1) {
                      next.delete('page')
                    } else {
                      next.set('page', String(value))
                    }
                    setParams(next)
                  }}
                  className="rounded-full border border-white/10 px-5 py-3 text-sm text-white transition hover:border-white/18 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Назад
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => {
                    const next = new URLSearchParams(params)
                    next.set('page', String(page + 1))
                    setParams(next)
                  }}
                  className="rounded-full border border-white/10 px-5 py-3 text-sm text-white transition hover:border-white/18 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Вперед
                </button>
              </div>
            </>
          ) : (
            <div className="satin-panel rounded-[32px] border border-white/10 px-6 py-12 text-center">
              <div className="font-display text-3xl text-white">Ничего не найдено</div>
              <p className="mt-3 text-sm text-white/56">Попробуйте другой запрос, регион или раздел каталога.</p>
              <button type="button" onClick={() => setCategory('games')} className="mt-6 quiet-button">
                Сбросить фильтры
              </button>
            </div>
          )}
        </>
      )}

      {filtersOpen ? (
        <div className="fixed inset-0 z-[80] bg-black/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="mx-auto max-w-xl rounded-[28px] border border-white/10 bg-[#090909] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div className="font-display text-3xl text-white">Фильтр</div>
              <button type="button" onClick={() => setFiltersOpen(false)} className="header-icon-button">
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <div className="mb-3 text-sm uppercase tracking-[0.18em] text-white/42">Платформа</div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => updateFilter('platform', '')} className={`rounded-full border px-4 py-2 text-sm ${!platform ? 'border-white/20 bg-white text-black' : 'border-white/10 text-white/68'}`}>
                    Все
                  </button>
                  {filters.platforms.map((item) => (
                    <button key={item} type="button" onClick={() => updateFilter('platform', item)} className={`rounded-full border px-4 py-2 text-sm ${platform === item ? 'border-white/20 bg-white text-black' : 'border-white/10 text-white/68'}`}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm uppercase tracking-[0.18em] text-white/42">Язык</div>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_OPTIONS.map((item) => (
                    <button key={item.value} type="button" onClick={() => updateFilter('language', item.value)} className={`rounded-full border px-4 py-2 text-sm ${language === item.value ? 'border-white/20 bg-white text-black' : 'border-white/10 text-white/68'}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm uppercase tracking-[0.18em] text-white/42">Жанр</div>
                <select
                  value={genre}
                  onChange={(event) => updateFilter('genre', event.target.value)}
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
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams()
                  next.set('category', category)
                  setParams(next)
                }}
                className="rounded-full border border-white/12 px-5 py-3 text-sm text-white transition hover:border-white/20"
              >
                Сбросить
              </button>
              <button type="button" onClick={() => setFiltersOpen(false)} className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black">
                Применить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
