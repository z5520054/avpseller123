import fs from 'node:fs'
import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { config } from '../config'
import { getDb } from '../db'

export interface HomeBanner {
  id: number
  title: string
  imageUrl: string
  imagePositionX: number
  imagePositionY: number
  imageScale: number
  linkUrl: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type HomeBannerAnimation = 'slide' | 'fade' | 'lift'

export interface HomeBannerSettings {
  autoplayMs: number
  animation: HomeBannerAnimation
  updatedAt: string
}

export interface HomeBannerInput {
  id?: number
  title: string
  imageUrl?: string | null
  imageDataUrl?: string | null
  imagePositionX?: number
  imagePositionY?: number
  imageScale?: number
  linkUrl: string
  sortOrder: number
  isActive: boolean
}

export interface HomeBannerSettingsInput {
  autoplayMs: number
  animation: HomeBannerAnimation
}

function nowIso() {
  return new Date().toISOString()
}

function mapRow(row: Record<string, unknown>): HomeBanner {
  return {
    id: Number(row.id),
    title: String(row.title),
    imageUrl: String(row.image_url),
    imagePositionX: Number(row.image_position_x ?? 50),
    imagePositionY: Number(row.image_position_y ?? 50),
    imageScale: Number(row.image_scale ?? 1),
    linkUrl: String(row.link_url),
    sortOrder: Number(row.sort_order),
    isActive: Number(row.is_active) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapSettingsRow(row: Record<string, unknown>): HomeBannerSettings {
  const animation = String(row.animation)
  return {
    autoplayMs: Number(row.autoplay_ms),
    animation: animation === 'fade' || animation === 'lift' ? animation : 'slide',
    updatedAt: String(row.updated_at),
  }
}

function saveDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i)
  if (!match) {
    throw new Error('Unsupported banner image format')
  }

  const extension = match[1].toLowerCase().replace('jpeg', 'jpg')
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error('Banner image is too large')
  }

  const folder = path.join(config.staticUploadDir, 'banners')
  fs.mkdirSync(folder, { recursive: true })
  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`
  fs.writeFileSync(path.join(folder, filename), buffer)

  return `${config.publicUploadBaseUrl}/banners/${filename}`
}

export class HomeBannersService {
  private db: DatabaseSync

  constructor(db = getDb()) {
    this.db = db
  }

  list(options: { activeOnly?: boolean } = {}) {
    const where = options.activeOnly ? 'WHERE is_active = 1' : ''
    return this.db
      .prepare(
        `
        SELECT *
        FROM home_banners
        ${where}
        ORDER BY sort_order ASC, id DESC
        `,
      )
      .all()
      .map((row) => mapRow(row as Record<string, unknown>))
  }

  getSettings() {
    const row = this.db.prepare('SELECT * FROM home_banner_settings WHERE id = 1').get() as
      | Record<string, unknown>
      | undefined

    if (row) {
      return mapSettingsRow(row)
    }

    const timestamp = nowIso()
    this.db
      .prepare(
        `
        INSERT INTO home_banner_settings (id, autoplay_ms, animation, updated_at)
        VALUES (1, 6000, 'slide', ?)
        `,
      )
      .run(timestamp)

    return {
      autoplayMs: 6000,
      animation: 'slide' as const,
      updatedAt: timestamp,
    }
  }

  replaceMany(items: HomeBannerInput[]) {
    const timestamp = nowIso()
    this.db.exec('BEGIN')
    try {
      const keepIds: number[] = []
      for (const item of items) {
        const imageUrl = item.imageDataUrl ? saveDataUrl(item.imageDataUrl) : item.imageUrl
        if (!imageUrl) {
          throw new Error('Banner image is required')
        }
        const imagePositionX = Math.min(100, Math.max(0, Math.round(item.imagePositionX ?? 50)))
        const imagePositionY = Math.min(100, Math.max(0, Math.round(item.imagePositionY ?? 50)))
        const imageScale = Math.min(2, Math.max(1, Number(item.imageScale ?? 1)))

        if (item.id) {
          this.db
            .prepare(
              `
              UPDATE home_banners
              SET title = ?, image_url = ?, image_position_x = ?, image_position_y = ?, image_scale = ?, link_url = ?, sort_order = ?, is_active = ?, updated_at = ?
              WHERE id = ?
              `,
            )
            .run(item.title, imageUrl, imagePositionX, imagePositionY, imageScale, item.linkUrl, item.sortOrder, item.isActive ? 1 : 0, timestamp, item.id)
          keepIds.push(item.id)
        } else {
          const inserted = this.db
            .prepare(
              `
              INSERT INTO home_banners (title, image_url, image_position_x, image_position_y, image_scale, link_url, sort_order, is_active, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              RETURNING id
              `,
            )
            .get(item.title, imageUrl, imagePositionX, imagePositionY, imageScale, item.linkUrl, item.sortOrder, item.isActive ? 1 : 0, timestamp, timestamp) as {
            id: number
          }
          keepIds.push(inserted.id)
        }
      }

      if (keepIds.length > 0) {
        const placeholders = keepIds.map(() => '?').join(',')
        this.db.prepare(`DELETE FROM home_banners WHERE id NOT IN (${placeholders})`).run(...keepIds)
      } else {
        this.db.prepare('DELETE FROM home_banners').run()
      }

      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }

    return this.list()
  }

  updateSettings(input: HomeBannerSettingsInput) {
    const autoplayMs = Math.min(30000, Math.max(2000, Math.round(input.autoplayMs)))
    const animation = input.animation === 'fade' || input.animation === 'lift' ? input.animation : 'slide'
    const timestamp = nowIso()

    this.db
      .prepare(
        `
        INSERT INTO home_banner_settings (id, autoplay_ms, animation, updated_at)
        VALUES (1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          autoplay_ms = excluded.autoplay_ms,
          animation = excluded.animation,
          updated_at = excluded.updated_at
        `,
      )
      .run(autoplayMs, animation, timestamp)

    return this.getSettings()
  }
}
