import { getProvider } from '../providers'
import { CatalogRepository } from './catalog-repository'
import type { SyncMode } from '../types'

export async function runCatalogSync(options: { providerName: string; mode: SyncMode }) {
  const repository = new CatalogRepository()
  const provider = getProvider(options.providerName)
  const syncRunId = repository.startSyncRun(provider.name, options.mode)

  try {
    const products = await provider.fetchProducts({ mode: options.mode })
    let importedOffers = 0

    for (const product of products) {
      const result = repository.upsertProduct(product)
      importedOffers += result.importedOffers
    }

    repository.finishSyncRun(syncRunId, 'success', {
      products: products.length,
      offers: importedOffers,
    })

    return { products: products.length, offers: importedOffers }
  } catch (error) {
    repository.finishSyncRun(
      syncRunId,
      'failed',
      { products: 0, offers: 0 },
      error instanceof Error ? error.message : String(error),
    )
    throw error
  }
}
