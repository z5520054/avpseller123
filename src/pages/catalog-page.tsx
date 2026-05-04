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
    description: 'Базовый доступ: ежемесячные игры, онлайн-мультиплеер, скидки и облачные сохранения.',
    benefits: ['Ежемесячные игры', 'Онлайн-мультиплеер', 'Эксклюзивные скидки', 'Облачные сохранения'],
  },
  {
    tier: 'Extra',
    description: 'Все из Essential плюс каталог игр и Ubisoft+ Classics.',
    benefits: ['Каталог игр', 'Ubisoft+ Classics', 'Ежемесячные игры', 'Онлайн-мультиплеер'],
  },
  {
    tier: 'Deluxe',
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
      return { tag: 'section:games' }
    case 'deals':
      return { tag: 'section:deals' }
    case 'preorders':
      return { tag: 'section:preorders' }
    default:
      return {}
  }
}

function getTitle(category: string, region: Region) {
  switch (category) {
    case 'games':
      return `Каталог игр PS Store для ${region}`
    case 'deals':
      return `Распродажа PS Store для ${region}`
    case 'preorders':
      return `Предзаказы PS Store для ${region}`
    case 'subscriptions':
      return 'Подписки PS Plus'
    default:
      return `Каталог PlayStation Store для ${region}`
  }
}

function normalizeSort(value: string | null): CatalogSort {
  return SORT_OPTIONS.some((item) => item.value === value) ? (value as CatalogSort) : 'sony'
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
          <article key={plan.tier} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-white/42">PlayStation Plus</div>
            <h3 className="mt-3 font-display text-3xl text-sheen">{plan.tier}</h3>
            <p className="mt-3 min-h-20 text-sm leading-6 text-white/56">{plan.description}</p>
            <div className="mt-5 text-sm text-white/46">Срок: {duration} мес.</div>
            <div className="mt-4 text-2xl font-semibold text-white">
              {formatMoneyMinor(
                price?.priceRubMinor,
                'RUB',
              ) ?? 'Цена не задана'}
            </div>
            <div className="mt-5 space-y-2">
              {plan.benefits.map((benefit) => (
                <div key={benefit} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-sm text-white/68">
                  {benefit}
                </div>
              ))}
            </div>
            {isInCart ? (
              <Link
                to="/cart"
                className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-400 px-5 py-3 text-sm font-medium text-black shadow-[0_0_32px_rgba(52,211,153,0.48)] transition hover:bg-emerald-300"
              >
                Перейти в корзину
              </Link>
            ) : (
              <button
                type="button"
                disabled={!canBuy}
                onClick={() => addToCart(productId)}
                className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/92 disabled:cursor-not-allowed disabled:opacity-40"
              >
              Выбрать
              </button>
            )}
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
        title={getTitle(category, region)}
        description={
          isSubscriptions
            ? 'Выберите уровень подписки и срок: Essential, Extra или Deluxe на 1, 3 или 12 месяцев.'
            : `Сейчас в выдаче ${total.toLocaleString('ru-RU')} позиций. Free-товары исключены из каталога.`
        }
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
