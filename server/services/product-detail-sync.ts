import { getProvider } from '../providers'
import { CatalogRepository } from './catalog-repository'

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
  delayMs = 0,
) {
  const results: R[] = []
  let index = 0

  function sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  async function runWorker() {
    while (index < items.length) {
      const currentIndex = index
      index += 1
      results[currentIndex] = await worker(items[currentIndex])
      if (delayMs > 0) {
        await sleep(delayMs)
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => runWorker())
  await Promise.all(workers)
  return results
}

export async function runProductDetailSync(options: { providerName: string; limit?: number }) {
  const repository = new CatalogRepository()
  const provider = getProvider(options.providerName)

  if (!provider.fetchProductDetail) {
    throw new Error(`Provider ${provider.name} does not support product detail enrichment`)
  }

  const products = repository.listProductsForDetailEnrichment(options.limit)
  const syncRunId = repository.startSyncRun(provider.name, 'details')
  const concurrency = Number(process.env.PRODUCT_DETAIL_CONCURRENCY ?? '4')
  const delayMs = Number(process.env.PRODUCT_DETAIL_DELAY_MS ?? '0')
  const retries = Math.max(1, Number(process.env.PRODUCT_DETAIL_RETRIES ?? '2'))
  const errors: string[] = []
  let importedProducts = 0
  let importedEditionProducts = 0
  let importedEditionOffers = 0

  await mapWithConcurrency(products, concurrency, async (product) => {
    try {
      let detail
      let lastError: unknown
      for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
          detail = await provider.fetchProductDetail!(product.source_key, product.locale)
          break
        } catch (error) {
          lastError = error
          if (attempt < retries) {
            await new Promise((resolve) => {
              setTimeout(resolve, 750 * attempt)
            })
          }
        }
      }

      if (!detail) {
        throw lastError instanceof Error ? lastError : new Error(String(lastError))
      }

      repository.upsertProductDetail(product.id, detail)
      const editionStats = repository.upsertEditionProductsFromDetail(product.id, detail)
      importedEditionProducts += editionStats.products
      importedEditionOffers += editionStats.offers
      importedProducts += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${product.source_key}: ${message}`)
    }
    return true
  }, delayMs)

  repository.finishSyncRun(
    syncRunId,
    errors.length > 0 ? 'failed' : 'success',
    { products: importedProducts + importedEditionProducts, offers: importedEditionOffers },
    errors.length > 0 ? errors.slice(0, 20).join('\n') : undefined,
  )

  return {
    products: importedProducts + importedEditionProducts,
    detailProducts: importedProducts,
    editionProducts: importedEditionProducts,
    offers: importedEditionOffers,
    failed: errors.length,
    errors: errors.slice(0, 20),
  }
}
