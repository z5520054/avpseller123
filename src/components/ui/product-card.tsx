import { Heart, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../../lib/format'
import { useAppState } from '../../store/use-app-state'
import type { Product } from '../../types'

export function ProductCard({
  product,
  featured = false,
  className = '',
}: {
  product: Product
  featured?: boolean
  className?: string
}) {
  const { addToCart, cart, favorites, toggleFavorite } = useAppState()
  const isFavorite = favorites.includes(product.id)
  const isInCart = cart.some((item) => item.productId === product.id)

  return (
    <article
      className={`satin-panel shine-border card-hover group overflow-hidden rounded-[28px] border border-white/10 ${
        featured ? 'lg:grid lg:grid-cols-[1.1fr_0.9fr]' : ''
      } ${className}`}
    >
      <div className={`relative overflow-hidden ${featured ? 'h-80 lg:h-full' : 'h-56'}`}>
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.05]"
        />
        <div className={`absolute inset-0 bg-gradient-to-br ${product.accent}`} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_18%),linear-gradient(180deg,transparent_25%,rgba(0,0,0,0.85)_100%)]" />
        <div className="absolute left-4 top-4 flex gap-2">
          {product.discount ? (
            <span className="rounded-full border border-white/16 bg-black/45 px-3 py-1 text-xs text-white">
              -{product.discount}%
            </span>
          ) : null}
          {!featured ? (
            <span className="rounded-full border border-white/16 bg-black/45 px-3 py-1 text-xs text-white/70">
              {product.region.join(' / ')}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => toggleFavorite(product.id)}
          className={`absolute right-4 top-4 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border backdrop-blur-xl transition ${
            isFavorite
              ? 'border-white/20 bg-white text-black'
              : 'border-white/12 bg-black/35 text-white hover:border-white/20'
          }`}
          aria-label="Добавить в избранное"
        >
          <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        {featured ? (
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.32em] text-white/52">Featured release</div>
              <div className="mt-2 max-w-xs text-2xl font-medium text-white">{product.title}</div>
            </div>
            <div className="hidden rounded-full border border-white/12 bg-black/35 px-4 py-2 text-xs text-white/72 sm:block">
              {product.region.join(' / ')}
            </div>
          </div>
        ) : null}
      </div>

      <div className={`space-y-4 p-5 ${featured ? 'flex flex-col justify-between p-6 lg:p-7' : ''}`}>
        <div className="flex flex-wrap gap-2">
          {product.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-full border border-white/8 px-2.5 py-1 text-xs text-white/55">
              {tag}
            </span>
          ))}
        </div>

        <div>
          {!featured ? (
            <Link to={`/product/${product.id}`} className="cursor-pointer">
              <h3 className="text-xl font-medium text-white transition hover:text-white/82">
                {product.title}
              </h3>
            </Link>
          ) : null}
          <p className={`leading-6 text-white/55 ${featured ? 'max-w-md text-base' : 'mt-2 line-clamp-2 text-sm'}`}>
            {product.subtitle}
          </p>
        </div>

        {featured ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {product.features.slice(0, 3).map((feature) => (
              <div key={feature} className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-xs leading-5 text-white/58">
                {feature}
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex items-end justify-between gap-4">
          <div>
            <div className={`${featured ? 'text-3xl' : 'text-xl'} font-semibold text-white`}>
              {formatPrice(product.price)}
            </div>
            {product.oldPrice ? (
              <div className="text-sm text-white/35 line-through">{formatPrice(product.oldPrice)}</div>
            ) : null}
          </div>
          {isInCart ? (
            <Link
              to="/cart"
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-emerald-300/60 bg-emerald-400 text-sm font-medium text-black transition hover:bg-emerald-300 ${
                featured ? 'px-5 py-3' : 'px-4 py-2'
              }`}
            >
              <ShoppingBag size={16} />
              Перейти в корзину
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => addToCart(product.id)}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/12 ${
                featured ? 'bg-white px-5 py-3 text-black hover:bg-white/92' : 'bg-white/8 px-4 py-2 text-white hover:border-white/20 hover:bg-white/12'
              } text-sm transition`}
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
