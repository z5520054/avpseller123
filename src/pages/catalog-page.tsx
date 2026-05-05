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
  { value: 'games', label: 'РРіСЂС‹ PS Store' },
  { value: 'deals', label: 'Р Р°СЃРїСЂРѕРґР°Р¶Р°' },
  { value: 'preorders', label: 'РџСЂРµРґР·Р°РєР°Р·С‹' },
  { value: 'subscriptions', label: 'РџРѕРґРїРёСЃРєРё' },
]

const LANGUAGE_OPTIONS = [
  { value: '', label: 'Р›СЋР±РѕР№ СЏР·С‹Рє' },
  { value: 'ru_subtitles', label: 'Р СѓСЃСЃРєРёРµ СЃСѓР±С‚РёС‚СЂС‹' },
  { value: 'ru_full', label: 'РџРѕР»РЅРѕСЃС‚СЊСЋ РЅР° СЂСѓСЃСЃРєРѕРј' },
] as const

const SORT_OPTIONS = [
  { value: 'sony', label: 'РџРѕ СѓРјРѕР»С‡Р°РЅРёСЋ' },
  { value: 'price_asc', label: 'РЎРЅР°С‡Р°Р»Р° РґРµС€РµРІР»Рµ' },
  { value: 'price_desc', label: 'РЎРЅР°С‡Р°Р»Р° РґРѕСЂРѕР¶Рµ' },
  { value: 'release_desc', label: 'РЎРЅР°С‡Р°Р»Р° РЅРѕРІРёРЅРєРё' },
  { value: 'release_asc', label: 'РЎРЅР°С‡Р°Р»Р° СЃС‚Р°СЂС‹Рµ' },
] as const

type CatalogSort = (typeof SORT_OPTIONS)[number]['value']

const SUBSCRIPTION_DURATIONS = [
  { value: 1, label: '1 РјРµСЃСЏС†' },
  { value: 3, label: '3 РјРµСЃСЏС†Р°' },
  { value: 12, label: '12 РјРµСЃСЏС†РµРІ' },
] as const

const SUBSCRIPTION_PLANS = [
  {
    tier: 'Essential',
    description: 'Р‘Р°Р·РѕРІС‹Р№ РґРѕСЃС‚СѓРї: РµР¶РµРјРµСЃСЏС‡РЅС‹Рµ РёРіСЂС‹, РѕРЅР»Р°Р№РЅ-РјСѓР»СЊС‚РёРїР»РµРµСЂ, СЃРєРёРґРєРё Рё РѕР±Р»Р°С‡РЅС‹Рµ СЃРѕС…СЂР°РЅРµРЅРёСЏ.',
    benefits: ['Р•Р¶РµРјРµСЃСЏС‡РЅС‹Рµ РёРіСЂС‹', 'РћРЅР»Р°Р№РЅ-РјСѓР»СЊС‚РёРїР»РµРµСЂ', 'Р­РєСЃРєР»СЋР·РёРІРЅС‹Рµ СЃРєРёРґРєРё', 'РћР±Р»Р°С‡РЅС‹Рµ СЃРѕС…СЂР°РЅРµРЅРёСЏ'],
  },
  {
    tier: 'Extra',
    description: 'Р’СЃРµ РёР· Essential РїР»СЋСЃ РєР°С‚Р°Р»РѕРі РёРіСЂ Рё Ubisoft+ Classics.',
    benefits: ['РљР°С‚Р°Р»РѕРі РёРіСЂ', 'Ubisoft+ Classics', 'Р•Р¶РµРјРµСЃСЏС‡РЅС‹Рµ РёРіСЂС‹', 'РћРЅР»Р°Р№РЅ-РјСѓР»СЊС‚РёРїР»РµРµСЂ'],
  },
  {
    tier: 'Deluxe',
    description: 'РњР°РєСЃРёРјР°Р»СЊРЅС‹Р№ РїР»Р°РЅ: РєР°С‚Р°Р»РѕРі РёРіСЂ, Classics Catalogue Рё РїСЂРѕР±РЅС‹Рµ РІРµСЂСЃРёРё РёРіСЂ.',
    benefits: ['Classics Catalogue', 'РџСЂРѕР±РЅС‹Рµ РІРµСЂСЃРёРё РёРіСЂ', 'РљР°С‚Р°Р»РѕРі РёРіСЂ', 'Ubisoft+ Classics'],
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


function normalizeSort(value: string | null): CatalogSort {
  return SORT_OPTIONS.some((item) => item.value === value) ? (value as CatalogSort) : 'sony'
}

function getCatalogHeading(category: string) {
  switch (category) {
    case 'deals':
      return 'Р Р°СЃРїСЂРѕРґР°Р¶Р°'
    case 'preorders':
      return 'РџСЂРµРґР·Р°РєР°Р·С‹'
    case 'subscriptions':
      return 'РџРѕРґРїРёСЃРєРё PS Plus'
    case 'games':
    default:
      return 'РљР°С‚Р°Р»РѕРі РёРіСЂ'
  }
}

function getCatalogDescription(category: string, total: number) {
  if (category === 'subscriptions') {
    return 'Р’С‹Р±РµСЂРёС‚Рµ СѓСЂРѕРІРµРЅСЊ РїРѕРґРїРёСЃРєРё Рё СЃСЂРѕРє: Essential, Extra РёР»Рё Deluxe РЅР° 1, 3 РёР»Рё 12 РјРµСЃСЏС†РµРІ.'
  }

  return `РќР°Р№РґРµРЅРѕ ${total.toLocaleString('ru-RU')} РїРѕР·РёС†РёР№`
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
            <div className="mt-5 text-sm text-white/46">РЎСЂРѕРє: {duration} РјРµСЃ.</div>
            <div className="mt-4 text-2xl font-semibold text-white">
              {formatMoneyMinor(
                price?.priceRubMinor,
                'RUB',
              ) ?? 'Р¦РµРЅР° РЅРµ Р·Р°РґР°РЅР°'}
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
                className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-400 px-5 py-3 text-sm font-medium text-black transition hover:bg-emerald-300"
              >
                РџРµСЂРµР№С‚Рё РІ РєРѕСЂР·РёРЅСѓ
              </Link>
            ) : (
              <button
                type="button"
                disabled={!canBuy}
                onClick={() => addToCart(productId)}
                className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/92 disabled:cursor-not-allowed disabled:opacity-40"
              >
              Р’С‹Р±СЂР°С‚СЊ
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
        eyebrow="РљР°С‚Р°Р»РѕРі"
        title={getCatalogHeading(category)}
        description={getCatalogDescription(category, total)}
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <CategoryPills
          values={CATEGORY_OPTIONS.map((item) => item.label)}
          activeValue={CATEGORY_OPTIONS.find((item) => item.value === category)?.label ?? 'РРіСЂС‹ PS Store'}
          onChange={(nextLabel) => setCategory(CATEGORY_OPTIONS.find((item) => item.label === nextLabel)?.value ?? 'games')}
        />
      </div>

      {isSubscriptions ? (
        <SubscriptionChooser />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-4">
            <label className="flex min-w-[260px] items-center gap-3 text-sm text-white/60">
              <span className="text-white/42">РЎРѕСЂС‚РёСЂРѕРІРєР°</span>
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
              Р¤РёР»СЊС‚СЂ{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
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
              <div className="font-display text-3xl text-white">РљР°С‚Р°Р»РѕРі РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРµРЅ</div>
              <p className="mt-3 text-sm text-white/56">API РЅРµ РІРµСЂРЅСѓР» С‚РѕРІР°СЂС‹. РџРѕРІС‚РѕСЂРёС‚Рµ Р·Р°РїСЂРѕСЃ С‡СѓС‚СЊ РїРѕР·Р¶Рµ.</p>
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
                  РќР°Р·Р°Рґ
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
                  Р’РїРµСЂРµРґ
                </button>
              </div>
            </>
          ) : (
            <div className="satin-panel rounded-[32px] border border-white/10 px-6 py-12 text-center">
              <div className="font-display text-3xl text-white">РќРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ</div>
              <p className="mt-3 text-sm text-white/56">РџРѕРїСЂРѕР±СѓР№С‚Рµ РґСЂСѓРіРѕР№ Р·Р°РїСЂРѕСЃ, СЂРµРіРёРѕРЅ РёР»Рё СЂР°Р·РґРµР» РєР°С‚Р°Р»РѕРіР°.</p>
              <button type="button" onClick={() => setCategory('games')} className="mt-6 quiet-button">
                РЎР±СЂРѕСЃРёС‚СЊ С„РёР»СЊС‚СЂС‹
              </button>
            </div>
          )}
        </>
      )}

      {filtersOpen ? (
        <div className="fixed inset-0 z-[80] bg-black/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="mx-auto max-w-xl rounded-[28px] border border-white/10 bg-[#090909] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div className="font-display text-3xl text-white">Р¤РёР»СЊС‚СЂ</div>
              <button type="button" onClick={() => setFiltersOpen(false)} className="header-icon-button">
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <div className="mb-3 text-sm uppercase tracking-[0.18em] text-white/42">РџР»Р°С‚С„РѕСЂРјР°</div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => updateFilter('platform', '')} className={`rounded-full border px-4 py-2 text-sm ${!platform ? 'border-white/20 bg-white text-black' : 'border-white/10 text-white/68'}`}>
                    Р’СЃРµ
                  </button>
                  {filters.platforms.map((item) => (
                    <button key={item} type="button" onClick={() => updateFilter('platform', item)} className={`rounded-full border px-4 py-2 text-sm ${platform === item ? 'border-white/20 bg-white text-black' : 'border-white/10 text-white/68'}`}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm uppercase tracking-[0.18em] text-white/42">РЇР·С‹Рє</div>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_OPTIONS.map((item) => (
                    <button key={item.value} type="button" onClick={() => updateFilter('language', item.value)} className={`rounded-full border px-4 py-2 text-sm ${language === item.value ? 'border-white/20 bg-white text-black' : 'border-white/10 text-white/68'}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm uppercase tracking-[0.18em] text-white/42">Р–Р°РЅСЂ</div>
                <select
                  value={genre}
                  onChange={(event) => updateFilter('genre', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="">Р’СЃРµ Р¶Р°РЅСЂС‹</option>
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
                РЎР±СЂРѕСЃРёС‚СЊ
              </button>
              <button type="button" onClick={() => setFiltersOpen(false)} className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black">
                РџСЂРёРјРµРЅРёС‚СЊ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
