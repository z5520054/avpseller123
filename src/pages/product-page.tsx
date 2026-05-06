import { Heart, ShoppingBag } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCatalogProduct, getCatalogProductDetail } from '../lib/catalog-api'
import { formatDisplayOriginalPrice, formatDisplayPrice, pickOffer } from '../lib/catalog-pricing'
import { formatDate, formatMoneyMinor } from '../lib/format'
import { translateGenre } from '../lib/genre-translation'
import { getRussianLanguageSupport, russianLanguageLabel } from '../lib/language-support'
import { useAppState } from '../store/use-app-state'
import type { CatalogApiProduct, CatalogApiProductDetail } from '../types'

type EditionPrice = CatalogApiProductDetail['editions'][number]['price']

function productSubtitle(product: CatalogApiProduct, detail: CatalogApiProductDetail | null) {
  const languageLabel = detail ? russianLanguageLabel(getRussianLanguageSupport(detail)) : null
  const parts = [
    detail?.publisherName,
    detail?.editionName,
    product.platforms.length > 0 ? product.platforms.join(' / ') : null,
    languageLabel && languageLabel !== 'Русский язык: Нет' ? languageLabel : null,
  ].filter(Boolean)

  return parts.join(' • ')
}

function mainImage(detail: CatalogApiProductDetail | null, product: CatalogApiProduct) {
  const candidates = [
    detail?.masterImageUrl,
    product.coverUrl,
    detail?.heroBackgroundUrl,
    detail?.media.find((item) => item.type === 'IMAGE' && item.role === 'GAMEHUB_COVER_ART')?.url,
    detail?.media.find((item) => item.type === 'IMAGE' && item.role === 'PORTRAIT_BANNER')?.url,
  ].filter(Boolean)

  return candidates[0] ?? null
}

function storeTypeLabel(product: CatalogApiProduct) {
  if (product.storeType === 'subscription') {
    return 'Подписка'
  }

  if (product.storeType === 'preorder') {
    return 'Предзаказ'
  }

  return 'Игра'
}

function roundRubMinorUpToNearestFive(value: number) {
  const rub = value / 100
  return Math.ceil(rub / 5) * 5 * 100
}

function tryMinorToRubMinor(value: number | null | undefined) {
  return value === null || value === undefined ? null : roundRubMinorUpToNearestFive(value * 3)
}

function formatEditionPrice(price: EditionPrice) {
  const sourceMinor = price.discountedPriceMinor ?? price.basePriceMinor

  if (price.currency === 'TRY') {
    return formatMoneyMinor(tryMinorToRubMinor(sourceMinor), 'RUB')
  }

  return formatMoneyMinor(sourceMinor, price.currency)
}


function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[28px] border border-white/8 bg-white/[0.04] ${className}`} />
}

export function ProductPage() {
  const { productId } = useParams()
  const numericId = Number(productId)
  const invalidId = !Number.isFinite(numericId)
  const { addToCart, cart, favorites, region, toggleFavorite } = useAppState()
  const [requestState, setRequestState] = useState<{
    productId: number | null
    product: CatalogApiProduct | null
    detail: CatalogApiProductDetail | null
    error: string | null
  }>({
    productId: null,
    product: null,
    detail: null,
    error: null,
  })

  useEffect(() => {
    if (invalidId) {
      return
    }

    let active = true

    Promise.all([getCatalogProduct(numericId), getCatalogProductDetail(numericId)])
      .then(([productResponse, detailResponse]) => {
        if (!active) {
          return
        }

        setRequestState({
          productId: numericId,
          product: productResponse,
          detail: detailResponse,
          error: null,
        })
      })
      .catch(() => {
        if (!active) {
          return
        }

        setRequestState({
          productId: numericId,
          product: null,
          detail: null,
          error: 'not-found',
        })
      })

    return () => {
      active = false
    }
  }, [invalidId, numericId])

  const product = requestState.productId === numericId ? requestState.product : null
  const detail = requestState.productId === numericId ? requestState.detail : null
  const error = requestState.productId === numericId ? requestState.error : null
  const loading = !invalidId && requestState.productId !== numericId
  const offer = useMemo(() => (product ? pickOffer(product, region) : null), [product, region])
  const image = useMemo(() => (product ? mainImage(detail, product) : null), [detail, product])
  const isFavorite = product ? favorites.includes(product.id) : false
  const isInCart = product ? cart.some((item) => item.productId === product.id) : false

  if (loading) {
    return (
      <div className="page-shell section-space">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <SkeletonBlock className="h-[560px]" />
          <SkeletonBlock className="h-[720px]" />
        </div>
      </div>
    )
  }

  if (invalidId || error || !product) {
    return (
      <div className="page-shell section-space">
        <div className="satin-panel rounded-[32px] border border-white/10 px-6 py-12 text-center">
          <div className="font-display text-3xl text-white">Карточка товара не найдена</div>
          <p className="mt-3 text-sm text-white/56">
            Для этого SKU еще нет данных или товар недоступен в текущем каталоге.
          </p>
          <Link
            to="/catalog"
            className="mt-6 inline-flex rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm text-white transition hover:border-white/20 hover:bg-white/12"
          >
            Вернуться в каталог
          </Link>
        </div>
      </div>
    )
  }

  const currentPrice = formatDisplayPrice(offer, region)
  const oldPrice = formatDisplayOriginalPrice(offer, region)
  const discountPercent = offer?.discountPercent ?? null
  const releaseLabel = formatDate(detail?.releaseDate ?? product.releaseDate)
  const saleEnds = formatDate(detail?.saleEndAt ?? offer?.saleEndAt)
  const subtitle = productSubtitle(product, detail)
  const russianSupport = detail ? getRussianLanguageSupport(detail) : 'unknown'
  const russianLabel = russianLanguageLabel(russianSupport)

  return (
    <div className="page-shell section-space">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_34%),#050505] sm:rounded-[32px]">
          {image ? (
            <img src={image} alt={product.title} className="h-[320px] w-full object-contain p-3 sm:h-[460px] sm:p-5 lg:h-[560px]" />
          ) : (
            <div className="flex h-[320px] items-center justify-center text-white/28 sm:h-[460px] lg:h-[560px]">Нет изображения</div>
          )}
        </div>

        <div className="satin-panel rounded-[24px] border border-white/10 p-4 sm:rounded-[32px] sm:p-6 lg:p-8">
          <div className="text-xs uppercase tracking-[0.24em] text-white/42">{storeTypeLabel(product)}</div>
          <h1 className="mt-4 font-display text-[2.15rem] leading-tight text-sheen sm:text-5xl">{product.title}</h1>
          {subtitle ? <p className="mt-4 text-base leading-7 text-white/60">{subtitle}</p> : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {product.platforms.map((platform) => (
              <span key={platform} className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/64">
                {platform}
              </span>
            ))}
            {russianLabel ? (
              <span className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/64">
                {russianLabel}
              </span>
            ) : null}
          </div>

          <div className="mt-8 rounded-[24px] border border-white/10 bg-black/20 p-4 sm:rounded-[28px] sm:p-5">
            <div className="text-3xl font-semibold text-white sm:text-4xl">{currentPrice ?? 'Цена уточняется'}</div>
            {discountPercent && oldPrice && currentPrice !== oldPrice ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-base">
                <span className="text-white/34 line-through">{oldPrice}</span>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/12 px-3 py-1 text-xs text-emerald-300">
                  -{discountPercent}%
                </span>
              </div>
            ) : null}
            <div className="mt-3 space-y-1 text-sm text-white/55">
              {releaseLabel ? <div>Релиз: {releaseLabel}</div> : null}
              <div>Регион каталога: {region}</div>
              {saleEnds ? <div>Скидка до: {saleEnds}</div> : null}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {isInCart ? (
              <Link
                to="/cart"
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-emerald-300/60 bg-emerald-400 px-6 py-3 text-sm font-medium text-black transition hover:bg-emerald-300"
              >
                <ShoppingBag size={16} />
                Перейти в корзину
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => addToCart(product.id)}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-white/92"
              >
              <ShoppingBag size={16} />
              Добавить в корзину
              </button>
            )}
            <button
              type="button"
              onClick={() => toggleFavorite(product.id)}
              className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm transition ${
                isFavorite
                  ? 'border-white/20 bg-white text-black'
                  : 'border-white/12 bg-white/8 text-white hover:border-white/20 hover:bg-white/12'
              }`}
            >
              <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
              В избранное
            </button>
          </div>

          {detail?.genres.length ? (
            <div className="mt-8">
              <div className="text-sm uppercase tracking-[0.24em] text-white/38">Жанры</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.genres.map((genre) => (
                  <span key={genre} className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/64">
                    {translateGenre(genre)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {detail?.editions.length ? (
            <div className="mt-8">
              <div className="text-sm uppercase tracking-[0.24em] text-white/38">Версии игры</div>
              <div className="mt-4 space-y-3">
                {detail.editions.map((edition) => {
                  const price = formatEditionPrice(edition.price)
                  const isCurrent = edition.sourceKey === product.sourceKey || edition.productId === product.id
                  const className = `block w-full rounded-[24px] border p-4 text-left transition ${
                    isCurrent
                      ? 'border-white/24 bg-white/[0.08]'
                      : 'border-white/10 bg-black/20 hover:border-white/18 hover:bg-white/[0.04]'
                  }`
                  const content = (
                    <>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
                        <div>
                          <div className="text-lg font-medium text-white">{edition.editionName || edition.title}</div>
                          <div className="mt-1 text-sm text-white/45">{edition.title}</div>
                        </div>
                        <div className="text-left text-lg font-semibold text-white sm:text-right">{price ?? '???? ??????????'}</div>
                      </div>
                      {edition.price.discountPercent ? (
                        <div className="mt-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/12 px-3 py-1 text-xs text-emerald-300">
                          -{edition.price.discountPercent}%
                        </div>
                      ) : null}
                      {isCurrent ? <div className="mt-2 text-sm text-white/42">Текущая версия</div> : null}
                    </>
                  )

                  if (!edition.productId || isCurrent) {
                    return (
                      <div key={edition.sourceKey} className={className}>
                        {content}
                      </div>
                    )
                  }

                  return (
                    <Link key={edition.sourceKey} to={`/product/${edition.productId}`} className={className}>
                      {content}
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : null}

          {detail?.longDescription ? (
            <div className="mt-8">
              <div className="text-sm uppercase tracking-[0.24em] text-white/38">Описание</div>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-white/62">{detail.longDescription}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
