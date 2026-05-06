import { Cloud, Crown, Disc3, Gamepad2, Globe2, ShieldCheck, SlidersHorizontal, Timer, X } from 'lucide-react'
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
    cardClass: 'border-[#73a7ff]/70 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,.98),rgba(215,221,238,.92)_28%,rgba(70,78,103,.9)_100%)] text-white shadow-[0_0_0_1px_rgba(255,255,255,.22)_inset,0_0_32px_rgba(75,132,255,.46)]',
    eyebrowClass: 'text-slate-950/72',
    titleClass: 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.42)]',
    bodyClass: 'text-white/92 drop-shadow-[0_1px_3px_rgba(0,0,0,.55)]',
    chipClass: 'border-white/16 bg-white/12 text-white shadow-[0_1px_0_rgba(255,255,255,.12)_inset]',
    iconClass: 'bg-white/88 text-slate-700',
    buttonClass: 'border border-white/70 bg-white text-slate-950 shadow-[0_0_22px_rgba(91,142,255,.55)] hover:bg-white/90',
    railClass: 'bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,.14)_48%,rgba(255,255,255,.36)_50%,transparent_66%)]',
    glyphClass: 'border-white/22 text-white/22',
    description: 'Базовый доступ: ежемесячные игры, онлайн-мультиплеер, скидки и облачные сохранения.',
    benefits: ['Ежемесячные игры', 'Онлайн-мультиплеер', 'Эксклюзивные скидки', 'Облачные сохранения'],
  },
  {
    tier: 'Extra',
    cardClass: 'border-[#ffc83d]/80 bg-[radial-gradient(circle_at_60%_-10%,rgba(255,218,98,.55),transparent_32%),linear-gradient(135deg,#231c0b_0%,#11100c_38%,#181510_100%)] text-white shadow-[0_0_0_1px_rgba(255,230,140,.2)_inset,0_0_34px_rgba(255,185,35,.44)]',
    eyebrowClass: 'text-[#ffd15a]',
    titleClass: 'text-[#ffc533] drop-shadow-[0_0_14px_rgba(255,191,45,.18)]',
    bodyClass: 'text-white/88',
    chipClass: 'border-[#ffc533]/16 bg-black/28 text-white shadow-[0_1px_0_rgba(255,255,255,.08)_inset]',
    iconClass: 'bg-[#ffc533] text-black shadow-[0_0_18px_rgba(255,197,51,.36)]',
    buttonClass: 'bg-gradient-to-b from-[#ffe278] to-[#f5ad18] text-black shadow-[0_0_24px_rgba(255,199,45,.48)] hover:brightness-110',
    railClass: 'bg-[radial-gradient(circle_at_62%_12%,rgba(255,216,82,.42),transparent_24%),linear-gradient(135deg,transparent_0%,transparent_48%,rgba(255,192,38,.78)_50%,transparent_67%)]',
    glyphClass: 'border-[#ffd05a]/34 text-[#ffd05a]/28',
    description: 'Все из Essential плюс каталог игр и Ubisoft+ Classics.',
    benefits: ['Каталог игр', 'Ubisoft+ Classics', 'Ежемесячные игры', 'Онлайн-мультиплеер'],
  },
  {
    tier: 'Deluxe',
    cardClass: 'border-[#c79628]/48 bg-[linear-gradient(135deg,#17181d_0%,#090a0e_50%,#07070a_100%)] text-white shadow-[0_0_0_1px_rgba(255,202,82,.11)_inset]',
    eyebrowClass: 'text-[#ffb000]',
    titleClass: 'text-[#ffb000]',
    bodyClass: 'text-white/86',
    chipClass: 'border-white/10 bg-white/[0.035] text-white/76',
    iconClass: 'bg-[#ffb000] text-black shadow-[0_0_16px_rgba(255,176,0,.32)]',
    buttonClass: 'border border-[#ffbd32]/78 bg-black text-white shadow-[0_0_18px_rgba(255,180,28,.22)] hover:bg-[#ffb000] hover:text-black',
    railClass: 'bg-[linear-gradient(135deg,transparent_0%,transparent_54%,rgba(255,181,39,.62)_56%,transparent_75%)]',
    glyphClass: 'border-[#ffb000]/18 text-[#ffb000]/16',
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
      return { tag: 'section:games', excludeTag: 'section:preorders', discountedOnly: false }
    case 'deals':
      return { tag: 'section:deals', excludeTag: 'section:preorders', discountedOnly: true }
    case 'preorders':
      return { tag: 'section:preorders', discountedOnly: false }
    default:
      return { discountedOnly: false }
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

function getSubscriptionBenefitIcon(benefit: string) {
  if (benefit.includes('Classics')) return Crown
  if (benefit.includes('Ubisoft')) return Disc3
  if (benefit.includes('Онлайн')) return Globe2
  if (benefit.includes('скид')) return ShieldCheck
  if (benefit.includes('Облач')) return Cloud
  if (benefit.includes('Проб')) return Timer
  return Gamepad2
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
    <div className="relative overflow-hidden rounded-[24px] border border-white/8 bg-[#070b14] p-3 shadow-[0_18px_70px_rgba(0,0,0,.42)] sm:rounded-[28px] sm:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(61,112,255,.12),transparent_28%),radial-gradient(circle_at_70%_10%,rgba(255,184,41,.1),transparent_26%)]" />
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden">
        {SUBSCRIPTION_DURATIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setDuration(item.value)}
            className={`shrink-0 cursor-pointer rounded-full border px-5 py-3 text-sm font-medium transition duration-300 sm:px-6 ${
              duration === item.value
                ? 'border-[#6ea0ff]/80 bg-[#10182a] text-white shadow-[0_0_0_1px_rgba(255,255,255,.14)_inset,0_0_24px_rgba(69,122,255,.72)]'
                : 'border-white/8 bg-white/[0.045] text-white/44 hover:border-white/14 hover:bg-white/[0.07] hover:text-white/72'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative mt-5 grid gap-4 lg:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const price = prices.find((item) => item.tier === plan.tier && item.durationMonths === duration)
          const canBuy = Boolean(price?.isActive && price.priceRubMinor !== null)
          const productId = makePsPlusProductId(region, plan.tier, duration)
          const isInCart = cart.some((item) => item.productId === productId)

          return (
            <article key={plan.tier} className={`relative flex min-h-[480px] overflow-hidden rounded-[18px] border p-4 transition duration-300 hover:-translate-y-1 sm:min-h-[575px] sm:p-5 ${plan.cardClass}`}>
              <div className={`pointer-events-none absolute inset-0 opacity-80 ${plan.railClass}`} />
              <div className="pointer-events-none absolute -right-8 top-6 h-28 w-28 rounded-full border opacity-80" />
              <div className={`pointer-events-none absolute right-10 top-8 h-12 w-12 rotate-45 border ${plan.glyphClass}`} />
              <div className={`pointer-events-none absolute right-4 top-20 h-16 w-16 rounded-full border ${plan.glyphClass}`} />
              <div className="relative flex h-full w-full flex-col">
                <div className={`text-xs font-semibold uppercase tracking-[0.24em] ${plan.eyebrowClass}`}>PlayStation Plus</div>
                <h3 className={`mt-6 text-[clamp(2.45rem,14vw,3.5rem)] font-semibold leading-none tracking-[-0.06em] sm:mt-7 sm:text-[clamp(3rem,5vw,4.15rem)] ${plan.titleClass}`}>{plan.tier}</h3>
                <p className={`mt-5 min-h-20 text-sm font-medium leading-6 ${plan.bodyClass}`}>{plan.description}</p>
                <div className={`mt-auto pt-9 text-sm font-medium ${plan.bodyClass}`}>Срок: {duration} мес.</div>
                <div className={`mt-2 text-3xl font-extrabold tracking-[-0.04em] ${plan.titleClass}`}>
                  {formatMoneyMinor(
                    price?.priceRubMinor,
                    'RUB',
                  ) ?? 'Цена не задана'}
                </div>
                <div className="mt-5 space-y-2.5">
                  {plan.benefits.map((benefit) => {
                    const Icon = getSubscriptionBenefitIcon(benefit)

                    return (
                      <div key={benefit} className={`flex items-center gap-3 rounded-full border px-3 py-2.5 text-sm ${plan.chipClass}`}>
                        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${plan.iconClass}`}>
                          <Icon size={17} strokeWidth={2.1} />
                        </span>
                        <span>{benefit}</span>
                      </div>
                    )
                  })}
                </div>
                {isInCart ? (
                  <Link
                    to="/cart"
                    className="mt-6 inline-flex w-full cursor-pointer items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-400 px-5 py-4 text-sm font-semibold text-black transition hover:bg-emerald-300"
                  >
                    Перейти в корзину
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={!canBuy}
                    onClick={() => addToCart(productId)}
                    className={`mt-6 inline-flex w-full cursor-pointer items-center justify-center rounded-full px-5 py-4 text-sm font-semibold transition duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${plan.buttonClass}`}
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
      discountedOnly: mapped.discountedOnly,
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
    <div className="page-shell pb-8 sm:pb-10 lg:pb-12">
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
          <div className="mb-5 flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:rounded-[28px] sm:px-5">
            <label className="flex min-w-0 flex-col gap-2 text-sm text-white/60 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-white/42">Сортировка</span>
              <select
                value={sort}
                onChange={(event) => updateFilter('sort', event.target.value)}
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
          ) : error ? (
            <div className="satin-panel rounded-[32px] border border-white/10 px-6 py-12 text-center">
              <div className="font-display text-3xl text-white">Каталог временно недоступен</div>
              <p className="mt-3 text-sm text-white/56">API не вернул товары. Повторите запрос чуть позже.</p>
            </div>
          ) : items.length > 0 ? (
            <>
              <div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
                {items.map((product) => (
                  <CatalogApiProductCard key={product.id} product={product} />
                ))}
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-center">
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
        <div className="fixed inset-0 z-[80] bg-black/70 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6" role="dialog" aria-modal="true">
          <div className="mx-auto max-h-[calc(100svh-2rem)] max-w-xl overflow-y-auto rounded-[24px] border border-white/10 bg-[#090909] p-4 shadow-2xl sm:max-h-[calc(100vh-3rem)] sm:rounded-[28px] sm:p-5">
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
