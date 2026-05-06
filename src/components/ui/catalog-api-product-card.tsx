import { Heart, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDisplayOriginalPrice, formatDisplayPrice, pickOffer } from '../../lib/catalog-pricing'
import { formatDate } from '../../lib/format'
import { useAppState } from '../../store/use-app-state'
import type { CatalogApiProduct } from '../../types'

function shortMeta(product: CatalogApiProduct, saleEnds: string | null) {
  const language =
    product.russianLanguageSupport === 'full'
      ? 'Полностью на русском'
      : product.russianLanguageSupport === 'subtitles'
        ? 'Русские субтитры'
        : null
  const parts = [
    product.platforms.slice(0, 2).join(' / '),
    language,
    saleEnds ? `до ${saleEnds}` : null,
  ].filter(Boolean)

  return parts.join(' • ')
}

function getStoreTypeLabel(product: CatalogApiProduct) {
  if (product.storeType === 'subscription') {
    return 'Подписка'
  }

  if (product.storeType === 'preorder') {
    return 'Предзаказ'
  }

  return 'Игра'
}

export function CatalogApiProductCard({ product }: { product: CatalogApiProduct }) {
  const { addToCart, cart, favorites, region, toggleFavorite } = useAppState()
  const isFavorite = favorites.includes(product.id)
  const isInCart = cart.some((item) => item.productId === product.id)
  const offer = pickOffer(product, region)
  const price = formatDisplayPrice(offer, region)
  const oldPrice = formatDisplayOriginalPrice(offer, region)
  const meta = shortMeta(product, formatDate(offer?.saleEndAt) ?? null)

  return (
    <article className="satin-panel shine-border card-hover group overflow-hidden rounded-[24px] border border-white/10 sm:rounded-[28px]">
      <div className="relative h-44 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_32%),linear-gradient(180deg,#191919_0%,#0a0a0a_100%)] sm:h-56">
        {product.coverUrl ? (
          <img
            src={product.coverUrl}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.05]"
          />
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_18%),linear-gradient(180deg,transparent_25%,rgba(0,0,0,0.85)_100%)]" />
        <div className="absolute left-3 top-3 flex max-w-[calc(100%-4.25rem)] flex-wrap gap-1.5 sm:left-4 sm:top-4 sm:gap-2">
          {offer?.discountPercent ? (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/12 px-2.5 py-1 text-[11px] text-emerald-300 sm:px-3 sm:text-xs">
              -{offer.discountPercent}%
            </span>
          ) : null}
          <span className="rounded-full border border-white/16 bg-black/45 px-2.5 py-1 text-[11px] text-white/70 sm:px-3 sm:text-xs">
            {region}
          </span>
          {product.russianLanguageSupport === 'full' || product.russianLanguageSupport === 'subtitles' ? (
            <span className="rounded-full border border-white/16 bg-black/45 px-2.5 py-1 text-[11px] text-white/70 sm:px-3 sm:text-xs">
              {product.russianLanguageSupport === 'full' ? 'RU FULL' : 'RU SUB'}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => toggleFavorite(product.id)}
          className={`absolute right-3 top-3 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border backdrop-blur-xl transition sm:right-4 sm:top-4 ${
            isFavorite
              ? 'border-white/20 bg-white text-black'
              : 'border-white/12 bg-black/35 text-white hover:border-white/20'
          }`}
          aria-label="Добавить в избранное"
        >
          <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="space-y-3.5 p-4 sm:space-y-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/8 px-2.5 py-1 text-xs text-white/55">
            {getStoreTypeLabel(product)}
          </span>
          {product.platforms.slice(0, 1).map((platform) => (
            <span key={platform} className="rounded-full border border-white/8 px-2.5 py-1 text-xs text-white/55">
              {platform}
            </span>
          ))}
        </div>

        <div>
          <Link to={`/product/${product.id}`} className="cursor-pointer">
            <h3 className="line-clamp-2 text-lg font-medium leading-snug text-white transition hover:text-white/82 sm:text-xl">{product.title}</h3>
          </Link>
          {meta ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/55">{meta}</p> : null}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xl font-semibold text-white">{price ?? 'Цена уточняется'}</div>
            {oldPrice && price !== oldPrice ? <div className="text-sm text-white/35 line-through">{oldPrice}</div> : null}
          </div>
          {isInCart ? (
            <Link
              to="/cart"
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-emerald-300/60 bg-emerald-400 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-emerald-300 sm:w-auto"
            >
              <ShoppingBag size={16} />
              Перейти в корзину
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => addToCart(product.id)}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2.5 text-sm text-white transition hover:border-white/20 hover:bg-white/12 sm:w-auto"
            >
            <ShoppingBag size={16} />
            В корзину
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
