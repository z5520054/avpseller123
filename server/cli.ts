import { runCatalogSync } from './services/catalog-sync'
import { runProductDetailSync } from './services/product-detail-sync'
import type { SyncMode } from './types'

async function main() {
  const [, , command, ...rest] = process.argv

  const providerIndex = rest.indexOf('--provider')
  const modeIndex = rest.indexOf('--mode')
  const limitIndex = rest.indexOf('--limit')

  const providerName = providerIndex >= 0 ? rest[providerIndex + 1] : 'playstation-store'

  let result
  if (command === 'sync') {
    const mode = (modeIndex >= 0 ? rest[modeIndex + 1] : 'full') as SyncMode
    result = await runCatalogSync({ providerName, mode })
  } else if (command === 'details') {
    const limit = limitIndex >= 0 ? Number(rest[limitIndex + 1]) : undefined
    result = await runProductDetailSync({ providerName, limit: Number.isFinite(limit) ? limit : undefined })
  } else {
    throw new Error('Supported commands: "sync", "details"')
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
