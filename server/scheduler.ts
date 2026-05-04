import cron from 'node-cron'
import { config } from './config'
import { runCatalogSync } from './services/catalog-sync'
import { runProductDetailSync } from './services/product-detail-sync'

const runningJobs = new Set<string>()

async function runExclusive(name: string, job: () => Promise<unknown>) {
  if (runningJobs.has(name)) {
    console.warn(`[scheduler] ${name} skipped because previous run is still active`)
    return
  }

  runningJobs.add(name)
  try {
    await job()
  } finally {
    runningJobs.delete(name)
  }
}

export function startScheduler() {
  cron.schedule(config.catalogSyncCron, async () => {
    await runExclusive('full catalog sync', async () => {
      try {
        await runCatalogSync({ providerName: config.defaultProvider, mode: 'full' })
      } catch (error) {
        console.error('[scheduler] full catalog sync failed', error)
      }
    })
  })

  cron.schedule(config.priceSyncCron, async () => {
    await runExclusive('price sync', async () => {
      try {
        await runCatalogSync({ providerName: config.defaultProvider, mode: 'prices' })
      } catch (error) {
        console.error('[scheduler] price sync failed', error)
      }
    })
  })

  cron.schedule(config.productDetailsSyncCron, async () => {
    await runExclusive('product detail sync', async () => {
      try {
        await runProductDetailSync({ providerName: config.defaultProvider })
      } catch (error) {
        console.error('[scheduler] product detail sync failed', error)
      }
    })
  })
}
