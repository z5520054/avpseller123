import { useState } from 'react'
import { getAdminBanners, getAdminPsPlusPrices, updateAdminBanners, updateAdminPsPlusPrices } from '../lib/catalog-api'
import type { HomeBanner, HomeBannerSettings, PsPlusDuration, PsPlusPrice, PsPlusTier } from '../types'

const TIERS: PsPlusTier[] = ['Essential', 'Extra', 'Deluxe']
const DURATIONS: PsPlusDuration[] = [1, 3, 12]
const TOKEN_STORAGE_KEY = 'avp-admin-token'
const DEFAULT_BANNER_SETTINGS: Pick<HomeBannerSettings, 'autoplayMs' | 'animation'> = {
  autoplayMs: 6000,
  animation: 'slide',
}

interface EditableBanner {
  id?: number
  title: string
  imageUrl?: string | null
  imageDataUrl?: string | null
  imagePositionX: number
  imagePositionY: number
  imageScale: number
  linkUrl: string
  sortOrder: number
  isActive: boolean
}

function rubFromMinor(value: number | null) {
  return value === null ? '' : String(Math.round(value / 100))
}

function minorFromRub(value: string) {
  const normalized = value.trim().replace(/\s+/g, '').replace(/[^\d,.]/g, '').replace(',', '.')
  if (!normalized) return null

  const rub = Number(normalized)
  return Number.isFinite(rub) && rub >= 0 ? Math.round(rub * 100) : null
}

function recordKey(tier: PsPlusTier, duration: PsPlusDuration) {
  return `${tier}:${duration}`
}

function getRecord(items: PsPlusPrice[], tier: PsPlusTier, duration: PsPlusDuration) {
  return items.find((item) => item.tier === tier && item.durationMonths === duration)
}

function bannerToEditable(item: HomeBanner): EditableBanner {
  return {
    id: item.id,
    title: item.title,
    imageUrl: item.imageUrl,
    imageDataUrl: null,
    imagePositionX: item.imagePositionX ?? 50,
    imagePositionY: item.imagePositionY ?? 50,
    imageScale: item.imageScale ?? 1,
    linkUrl: item.linkUrl,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
  }
}

async function readFileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function AdminPsPlusPage() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) ?? '')
  const [region, setRegion] = useState<'turkey' | 'india'>('turkey')
  const [authenticated, setAuthenticated] = useState(false)
  const [pricesItems, setPricesItems] = useState<PsPlusPrice[]>([])
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [active, setActive] = useState<Record<string, boolean>>({})
  const [banners, setBanners] = useState<EditableBanner[]>([])
  const [bannerSettings, setBannerSettings] = useState(DEFAULT_BANNER_SETTINGS)
  const [status, setStatus] = useState('Введите admin token для входа.')
  const [loading, setLoading] = useState(false)

  function hydratePrices(nextItems: PsPlusPrice[]) {
    setPricesItems(nextItems)
    setPrices(Object.fromEntries(nextItems.map((item) => [recordKey(item.tier, item.durationMonths), rubFromMinor(item.priceRubMinor)])))
    setActive(Object.fromEntries(nextItems.map((item) => [recordKey(item.tier, item.durationMonths), item.isActive])))
  }

  async function loadAdminData(nextRegion = region) {
    const cleanToken = token.trim()
    if (!cleanToken) {
      setStatus('Нужен admin token.')
      return
    }

    setLoading(true)
    setStatus('Загружаю админку...')
    localStorage.setItem(TOKEN_STORAGE_KEY, cleanToken)

    try {
      const [priceResponse, bannerResponse] = await Promise.all([
        getAdminPsPlusPrices(nextRegion, cleanToken),
        getAdminBanners(cleanToken),
      ])
      hydratePrices(priceResponse.items)
      setBanners(bannerResponse.items.map(bannerToEditable))
      setBannerSettings({
        autoplayMs: bannerResponse.settings.autoplayMs,
        animation: bannerResponse.settings.animation,
      })
      setAuthenticated(true)
      setStatus('Данные загружены.')
    } catch {
      setAuthenticated(false)
      setStatus('Не удалось войти. Проверьте токен.')
    } finally {
      setLoading(false)
    }
  }

  async function switchRegion(nextRegion: 'turkey' | 'india') {
    setRegion(nextRegion)
    if (authenticated) {
      await loadAdminData(nextRegion)
    }
  }

  async function savePrices() {
    const cleanToken = token.trim()
    setLoading(true)
    setStatus('Сохраняю цены PS Plus...')

    try {
      const response = await updateAdminPsPlusPrices(cleanToken, {
        region,
        items: TIERS.flatMap((tier) =>
          DURATIONS.map((duration) => ({
            tier,
            durationMonths: duration,
            priceRubMinor: minorFromRub(prices[recordKey(tier, duration)] ?? ''),
            isActive: active[recordKey(tier, duration)] ?? true,
          })),
        ),
      })
      hydratePrices(response.items)
      setStatus('Цены PS Plus сохранены.')
    } catch (error) {
      setStatus(error instanceof Error ? `Не удалось сохранить цены: ${error.message}` : 'Не удалось сохранить цены.')
    } finally {
      setLoading(false)
    }
  }

  async function saveBanners() {
    const cleanToken = token.trim()
    setLoading(true)
    setStatus('Сохраняю баннеры...')

    try {
      const response = await updateAdminBanners(cleanToken, { items: banners, settings: bannerSettings })
      setBanners(response.items.map(bannerToEditable))
      setBannerSettings({
        autoplayMs: response.settings.autoplayMs,
        animation: response.settings.animation,
      })
      setStatus('Баннеры сохранены.')
    } catch (error) {
      setStatus(error instanceof Error ? `Не удалось сохранить баннеры: ${error.message}` : 'Не удалось сохранить баннеры.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-shell section-space">
      <section className="satin-panel rounded-[34px] border border-white/10 p-5 sm:p-6">
        <div className="border-b border-white/8 pb-6">
          <div className="inline-flex rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.32em] text-white/42">
            Admin
          </div>
          <h1 className="mt-4 font-display text-4xl text-sheen sm:text-5xl">Админ-панель</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/56">
            Управление баннерами главной страницы и ручными ценами PS Plus.
          </p>
        </div>

        {!authenticated ? (
          <div className="mx-auto mt-8 max-w-xl rounded-[30px] border border-white/10 bg-black/24 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-white/42">Закрытый вход</div>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Admin token"
              type="password"
              className="mt-5 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
              onKeyDown={(event) => {
                if (event.key === 'Enter') void loadAdminData()
              }}
            />
            <button
              type="button"
              onClick={() => void loadAdminData()}
              disabled={loading}
              className="mt-3 w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50"
            >
              Войти
            </button>
            <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/58">{status}</div>
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/58">{status}</div>

            <section className="rounded-[28px] border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-3xl text-sheen">Баннеры главной</h2>
                  <p className="mt-2 text-sm text-white/50">
                    Картинка показывается в слайдере. Ссылка может вести на раздел, например /catalog?category=deals, или на игру /product/8.
                  </p>
                  <div className="mt-4 grid gap-3 rounded-2xl border border-white/8 bg-black/20 p-3 sm:grid-cols-2">
                    <label className="text-xs uppercase tracking-[0.18em] text-white/42">
                      Автопрокрутка, мс
                      <input
                        type="number"
                        min="2000"
                        max="30000"
                        step="500"
                        value={bannerSettings.autoplayMs}
                        onChange={(event) => setBannerSettings((current) => ({ ...current, autoplayMs: Number(event.target.value) || 6000 }))}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="text-xs uppercase tracking-[0.18em] text-white/42">
                      Анимация
                      <select
                        value={bannerSettings.animation}
                        onChange={(event) => setBannerSettings((current) => ({ ...current, animation: event.target.value as HomeBannerSettings['animation'] }))}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                      >
                        <option value="slide">Slide</option>
                        <option value="fade">Fade</option>
                        <option value="lift">Lift</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setBanners((current) => [...current, { title: '', linkUrl: '/catalog', imagePositionX: 50, imagePositionY: 50, imageScale: 1, sortOrder: current.length, isActive: true }])}
                    className="quiet-button"
                  >
                    Добавить баннер
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveBanners()}
                    disabled={loading}
                    className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50"
                  >
                    Сохранить баннеры
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {banners.length === 0 ? (
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-8 text-sm text-white/52">
                    Баннеров пока нет. Добавьте первый баннер, загрузите изображение и укажите ссылку.
                  </div>
                ) : null}

                {banners.map((banner, index) => (
                  <div key={banner.id ?? `new-${index}`} className="grid gap-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-[220px_1fr]">
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                      {banner.imageDataUrl || banner.imageUrl ? (
                        <img
                          src={banner.imageDataUrl ?? banner.imageUrl ?? ''}
                          alt={banner.title || 'Баннер'}
                          className="h-36 w-full object-cover"
                          style={{
                            objectPosition: `${banner.imagePositionX}% ${banner.imagePositionY}%`,
                            transform: `scale(${banner.imageScale})`,
                          }}
                        />
                      ) : (
                        <div className="flex h-36 items-center justify-center px-4 text-center text-xs text-white/36">Нет изображения</div>
                      )}
                    </div>
                    <div className="grid gap-3">
                      <input
                        value={banner.title}
                        onChange={(event) => setBanners((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, title: event.target.value } : item)))}
                        placeholder="Название баннера"
                        className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
                      />
                      <input
                        value={banner.linkUrl}
                        onChange={(event) => setBanners((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, linkUrl: event.target.value } : item)))}
                        placeholder="/catalog?category=deals или /product/8"
                        className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
                      />
                      <div className="grid gap-3 rounded-2xl border border-white/8 bg-black/20 p-3 md:grid-cols-3">
                        <label className="text-xs uppercase tracking-[0.18em] text-white/42">
                          X: {banner.imagePositionX}%
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={banner.imagePositionX}
                            onChange={(event) => setBanners((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, imagePositionX: Number(event.target.value) } : item)))}
                            className="mt-2 w-full"
                          />
                        </label>
                        <label className="text-xs uppercase tracking-[0.18em] text-white/42">
                          Y: {banner.imagePositionY}%
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={banner.imagePositionY}
                            onChange={(event) => setBanners((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, imagePositionY: Number(event.target.value) } : item)))}
                            className="mt-2 w-full"
                          />
                        </label>
                        <label className="text-xs uppercase tracking-[0.18em] text-white/42">
                          Scale: {banner.imageScale.toFixed(2)}
                          <input
                            type="range"
                            min="1"
                            max="2"
                            step="0.05"
                            value={banner.imageScale}
                            onChange={(event) => setBanners((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, imageScale: Number(event.target.value) } : item)))}
                            className="mt-2 w-full"
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="text-xs uppercase tracking-[0.18em] text-white/42">
                          Порядок
                          <input
                            type="number"
                            value={banner.sortOrder}
                            onChange={(event) => setBanners((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, sortOrder: Number(event.target.value) || 0 } : item)))}
                            className="mt-1 block w-28 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                          />
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-white/58">
                          <input
                            type="checkbox"
                            checked={banner.isActive}
                            onChange={(event) => setBanners((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, isActive: event.target.checked } : item)))}
                          />
                          Активен
                        </label>
                        <label className="inline-flex cursor-pointer rounded-full border border-white/10 px-4 py-2 text-sm text-white/68 hover:text-white">
                          Загрузить изображение
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={async (event) => {
                              const file = event.target.files?.[0]
                              if (!file) return
                              const imageDataUrl = await readFileDataUrl(file)
                              setBanners((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, imageDataUrl } : item)))
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setBanners((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/62 hover:text-white"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-3xl text-sheen">Цены PS Plus</h2>
                <div className="flex flex-wrap gap-2">
                  {(['turkey', 'india'] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => void switchRegion(item)}
                      className={`rounded-full border px-4 py-2 text-sm ${region === item ? 'border-white/20 bg-white text-black' : 'border-white/10 text-white/68'}`}
                    >
                      {item === 'turkey' ? 'Турция' : 'Индия'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void savePrices()}
                    disabled={loading}
                    className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50"
                  >
                    Сохранить цены
                  </button>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[760px] border-separate border-spacing-y-3 text-left">
                  <thead className="text-xs uppercase tracking-[0.18em] text-white/42">
                    <tr>
                      <th className="px-3 py-2">Тариф</th>
                      {DURATIONS.map((duration) => (
                        <th key={duration} className="px-3 py-2">
                          {duration} мес.
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIERS.map((tier) => (
                      <tr key={tier}>
                        <td className="rounded-l-2xl border-y border-l border-white/8 bg-white/[0.03] px-3 py-3 text-lg text-white">{tier}</td>
                        {DURATIONS.map((duration, index) => {
                          const record = getRecord(pricesItems, tier, duration)
                          const fieldKey = recordKey(tier, duration)
                          return (
                            <td key={fieldKey} className={`border-y border-white/8 bg-white/[0.03] px-3 py-3 ${index === DURATIONS.length - 1 ? 'rounded-r-2xl border-r' : ''}`}>
                              <div className="flex items-center gap-3">
                                <input
                                  value={prices[fieldKey] ?? ''}
                                  onChange={(event) => setPrices((current) => ({ ...current, [fieldKey]: event.target.value }))}
                                  inputMode="decimal"
                                  placeholder="₽"
                                  className="w-32 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none"
                                />
                                <label className="flex items-center gap-2 text-xs text-white/52">
                                  <input
                                    type="checkbox"
                                    checked={active[fieldKey] ?? true}
                                    onChange={(event) => setActive((current) => ({ ...current, [fieldKey]: event.target.checked }))}
                                  />
                                  активно
                                </label>
                              </div>
                              {record ? <div className="mt-2 text-xs text-white/34">Обновлено: {new Date(record.updatedAt).toLocaleString('ru-RU')}</div> : null}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  )
}
