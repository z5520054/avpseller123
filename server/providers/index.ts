import type { CatalogProvider } from '../types'
import { PlayStationStoreProvider } from './playstation-store.provider'
import { SampleJsonProvider } from './sample-json.provider'

const providers = new Map<string, CatalogProvider>([
  ['sample-json', new SampleJsonProvider()],
  ['playstation-store', new PlayStationStoreProvider()],
])

export function getProvider(name: string): CatalogProvider {
  const provider = providers.get(name)
  if (!provider) {
    throw new Error(`Unknown provider: ${name}`)
  }

  return provider
}
