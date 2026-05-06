import path from 'node:path'

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

function codeNominalsFromEnv(name: string, fallback: number[]) {
  const value = process.env[name]
  if (!value) {
    return fallback
  }

  const parsed = value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)

  return parsed.length > 0 ? parsed.sort((left, right) => left - right) : fallback
}

export const config = {
  dbPath: process.env.CATALOG_DB_PATH ?? path.resolve(process.cwd(), 'data', 'catalog.sqlite'),
  host: process.env.CATALOG_HOST ?? '127.0.0.1',
  port: numberFromEnv('CATALOG_PORT', 8787),
  turkeyRubRate: numberFromEnv('TURKEY_RUB_RATE', 3),
  turkeyTopUpCodeNominals: codeNominalsFromEnv(
    'TURKEY_TOP_UP_CODE_NOMINALS',
    [250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000],
  ),
  catalogSyncCron: process.env.CATALOG_SYNC_CRON ?? '0 3 * * *',
  priceSyncCron: process.env.PRICE_SYNC_CRON ?? '0 */6 * * *',
  productDetailsSyncCron: process.env.PRODUCT_DETAILS_SYNC_CRON ?? '30 4 * * *',
  schedulerEnabled: process.env.CATALOG_SCHEDULER_ENABLED === 'true',
  defaultProvider: process.env.CATALOG_PROVIDER ?? 'playstation-store',
  adminToken: process.env.ADMIN_TOKEN ?? '',
  staticUploadDir: process.env.STATIC_UPLOAD_DIR ?? path.resolve(process.cwd(), '..', 'current', 'uploads'),
  publicUploadBaseUrl: process.env.PUBLIC_UPLOAD_BASE_URL ?? '/uploads',
  sampleImportPath:
    process.env.SAMPLE_IMPORT_PATH ??
    path.resolve(process.cwd(), 'data', 'imports', 'playstation-store.sample.json'),
}
