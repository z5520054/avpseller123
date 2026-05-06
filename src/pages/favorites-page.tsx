import { Link } from 'react-router-dom'
import { CatalogApiProductCard } from '../components/ui/catalog-api-product-card'
import { ProductSkeleton } from '../components/ui/product-skeleton'
import { useCatalogProductsByIds } from '../hooks/use-catalog-products-by-ids'
import { useAppState } from '../store/use-app-state'

export function FavoritesPage() {
  const { favorites } = useAppState()
  const { products, loading } = useCatalogProductsByIds(favorites)

  return (
    <div className="page-shell section-space">
      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProductSkeleton key={index} />
          ))}
        </div>
      ) : products.length > 0 ? (
        <>
          <h1 className="mb-6 font-display text-4xl text-sheen sm:text-5xl">Избранное</h1>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <CatalogApiProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      ) : (
        <div className="satin-panel rounded-[28px] border border-white/10 px-5 py-12 text-center sm:rounded-[36px] sm:px-6 sm:py-16">
          <div className="font-display text-3xl text-sheen sm:text-4xl">Избранное пусто</div>
          <p className="mt-4 text-sm text-white/56">
            Сохраняйте интересные позиции, чтобы быстро вернуться к ним позже.
          </p>
          <Link
            to="/catalog"
            className="mt-6 inline-flex cursor-pointer rounded-full bg-white px-7 py-3 text-sm font-semibold !text-black shadow-[0_10px_28px_rgba(255,255,255,.10)] transition hover:bg-zinc-100"
          >
            Открыть каталог
          </Link>
        </div>
      )}
    </div>
  )
}
