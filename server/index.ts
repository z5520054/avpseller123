import Fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from './config'
import { getDb } from './db'
import { registerCatalogRoutes } from './routes/catalog'
import { startScheduler } from './scheduler'
import { startManualParseWorker } from './services/manual-parse'

async function main() {
  getDb()

  const app = Fastify({ logger: true, bodyLimit: 12 * 1024 * 1024 })
  await app.register(cors, { origin: true })
  await registerCatalogRoutes(app)

  await app.listen({
    host: config.host,
    port: config.port,
  })

  if (config.schedulerEnabled) {
    startScheduler()
  } else {
    app.log.info('Automatic catalog scheduler is disabled. Use admin manual parsing tasks.')
  }

  startManualParseWorker()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
