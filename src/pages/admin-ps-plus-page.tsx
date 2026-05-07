import { useEffect, useState } from 'react'
import {
  createAdminParseTask,
  createAdminProxy,
  cancelAdminParseTask,
  deleteAdminProxy,
  addAdminTopUpCodes,
  getAdminBanners,
  getAdminFulfillmentDashboard,
  getAdminFulfillmentOrders,
  getAdminParseProducts,
  getAdminParseTasks,
  getAdminProxies,
  getAdminPsPlusPrices,
  getAdminTopUpCodes,
  refreshAdminProduct,
  resumeAdminParseTask,
  testAdminProxy,
  toggleAdminProxy,
  updateAdminDenomination,
  updateAdminBanners,
  updateAdminFulfillmentMode,
  updateAdminPsPlusPrices,
} from '../lib/catalog-api'
import type {
  AdminFulfillmentDashboard,
  AdminParseProduct,
  AdminParseRegion,
  AdminParseTask,
  AdminParseType,
  AdminProxy,
  AdminTopUpCode,
  HomeBanner,
  HomeBannerSettings,
  PsPlusDuration,
  PsPlusPrice,
  PsPlusTier,
} from '../types'

const TIERS: PsPlusTier[] = ['Essential', 'Extra', 'Deluxe']
const DURATIONS: PsPlusDuration[] = [1, 3, 12]
const TOKEN_STORAGE_KEY = 'avp-admin-token'
type AdminSection = 'codes' | 'parsing' | 'pricing'

const ADMIN_SECTIONS: Array<{ id: AdminSection; label: string; description: string }> = [
  { id: 'codes', label: 'Работа с кодами', description: 'Выдача кодов, склад и заказы' },
  { id: 'parsing', label: 'Парсинг данных', description: 'Ручной парсинг PS Store и обновление товаров' },
  { id: 'pricing', label: 'Работа с ценами', description: 'Цены PS Plus и настройки витрины' },
]
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

const PARSE_TYPES: Array<{ value: AdminParseType; label: string }> = [
  { value: 'price', label: 'Цены' },
  { value: 'editions', label: 'Издания' },
  { value: 'images', label: 'Изображения' },
]

function formatTaskDate(value: string | null) {
  return value ? new Date(value).toLocaleString('ru-RU') : '—'
}

function formatRubMinor(value: number) {
  return `${Math.round(value / 100).toLocaleString('ru-RU')} ₽`
}

function CodeFulfillmentPanel({ token }: { token: string }) {
  const [dashboard, setDashboard] = useState<AdminFulfillmentDashboard | null>(null)
  const [codes, setCodes] = useState<AdminTopUpCode[]>([])
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([])
  const [selectedNominal, setSelectedNominal] = useState(250)
  const [codesText, setCodesText] = useState('')
  const [status, setStatus] = useState('Склад кодов готов.')

  async function load() {
    const cleanToken = token.trim()
    if (!cleanToken) return
    try {
      const [dashboardResponse, codesResponse, ordersResponse] = await Promise.all([
        getAdminFulfillmentDashboard(cleanToken),
        getAdminTopUpCodes(cleanToken, { status: 'all' }),
        getAdminFulfillmentOrders(cleanToken),
      ])
      setDashboard(dashboardResponse)
      setCodes(codesResponse.items)
      setOrders(ordersResponse.items as Array<Record<string, unknown>>)
      setSelectedNominal(dashboardResponse.denominations[0]?.nominal_try ?? 250)
    } catch (error) {
      setStatus(error instanceof Error ? `Не удалось загрузить склад: ${error.message}` : 'Не удалось загрузить склад.')
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadInitial() {
      const cleanToken = token.trim()
      if (!cleanToken) return
      try {
        const [dashboardResponse, codesResponse, ordersResponse] = await Promise.all([
          getAdminFulfillmentDashboard(cleanToken),
          getAdminTopUpCodes(cleanToken, { status: 'all' }),
          getAdminFulfillmentOrders(cleanToken),
        ])
        if (cancelled) return
        setDashboard(dashboardResponse)
        setCodes(codesResponse.items)
        setOrders(ordersResponse.items as Array<Record<string, unknown>>)
        setSelectedNominal(dashboardResponse.denominations[0]?.nominal_try ?? 250)
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? `Не удалось загрузить склад: ${error.message}` : 'Не удалось загрузить склад.')
        }
      }
    }
    void loadInitial()
    return () => {
      cancelled = true
    }
  }, [token])

  async function saveMode(mode: 'manual' | 'automatic') {
    await updateAdminFulfillmentMode(token.trim(), mode)
    setStatus(mode === 'automatic' ? 'Включена автоматическая выдача новых оплаченных заказов.' : 'Включена ручная выдача новых оплаченных заказов.')
    await load()
  }

  async function saveDenomination(nominalTry: number, priceRub: string, isActive: boolean) {
    const rub = Number(priceRub.replace(/\s+/g, '').replace(',', '.'))
    if (!Number.isFinite(rub) || rub < 0) {
      setStatus('Некорректная цена номинала.')
      return
    }

    await updateAdminDenomination(token.trim(), { nominalTry, priceRubMinor: Math.round(rub * 100), isActive })
    setStatus(`Номинал ${nominalTry} TL обновлен.`)
    await load()
  }

  async function addCodes() {
    const response = await addAdminTopUpCodes(token.trim(), { nominalTry: selectedNominal, codes: codesText })
    setCodesText('')
    setStatus(`Добавлено кодов: ${response.added}.`)
    await load()
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-black/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl text-sheen">Выдача кодов и склад</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
            Тестовая ЮKassa SBP создает оплату, webhook переводит заказ в paid и в автоматическом режиме берет коды из пула active.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="quiet-button">Обновить</button>
      </div>
      <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/58">{status}</div>

      {dashboard ? (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/38">Заказов сегодня</div>
              <div className="mt-3 text-3xl font-semibold text-white">{dashboard.ordersToday}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/38">Ожидают выдачи</div>
              <div className="mt-3 text-3xl font-semibold text-white">{dashboard.waitingOrders}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/38">Режим выдачи</div>
              <div className="mt-3 flex gap-2">
                {(['manual', 'automatic'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => void saveMode(mode)}
                    className={`rounded-full px-4 py-2 text-sm ${dashboard.mode === mode ? 'bg-white text-black' : 'border border-white/10 text-white/60'}`}
                  >
                    {mode === 'manual' ? 'Ручной' : 'Авто'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-white/40">
                <tr>
                  <th className="py-2">Номинал</th>
                  <th>Цена</th>
                  <th>Активен</th>
                  <th>Остаток active</th>
                  <th>Продано</th>
                  <th>Сохранить</th>
                </tr>
              </thead>
              <tbody className="text-white/64">
                {dashboard.denominations.map((item) => (
                  <DenominationRow key={item.nominal_try} item={item} onSave={saveDenomination} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-xl font-semibold text-white">Добавить коды</h3>
              <select value={selectedNominal} onChange={(event) => setSelectedNominal(Number(event.target.value))} className="mt-4 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none">
                {dashboard.denominations.map((item) => <option key={item.nominal_try} value={item.nominal_try}>{item.nominal_try} TL</option>)}
              </select>
              <textarea value={codesText} onChange={(event) => setCodesText(event.target.value)} rows={8} placeholder="Один код на строку" className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35" />
              <button type="button" onClick={() => void addCodes()} className="mt-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">Сохранить</button>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-xl font-semibold text-white">Пул кодов</h3>
              <div className="mt-4 max-h-[330px] overflow-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.16em] text-white/40">
                    <tr><th>ID</th><th>Номинал</th><th>Код</th><th>Статус</th><th>Заказ</th></tr>
                  </thead>
                  <tbody className="text-white/62">
                    {codes.map((code) => (
                      <tr key={code.id} className="border-t border-white/8">
                        <td className="py-2">{code.id}</td>
                        <td>{code.nominalTry} TL</td>
                        <td>{code.code}</td>
                        <td>{code.status}</td>
                        <td>{code.orderId ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-xl font-semibold text-white">Заказы</h3>
            <div className="mt-4 max-h-[360px] overflow-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.16em] text-white/40">
                  <tr><th>ID</th><th>Email</th><th>Статус</th><th>Оплата</th><th>Режим</th><th>Создан</th></tr>
                </thead>
                <tbody className="text-white/62">
                  {orders.map((order) => (
                    <tr key={String(order.id)} className="border-t border-white/8">
                      <td className="py-2 text-white">{String(order.id)}</td>
                      <td>{String(order.email ?? '—')}</td>
                      <td>{String(order.status ?? '—')}</td>
                      <td>{String(order.payment_status ?? '—')}</td>
                      <td>{String(order.fulfillment_mode ?? '—')}</td>
                      <td>{formatTaskDate(String(order.created_at ?? ''))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}

function DenominationRow({
  item,
  onSave,
}: {
  item: AdminFulfillmentDashboard['denominations'][number]
  onSave: (nominalTry: number, priceRub: string, isActive: boolean) => Promise<void>
}) {
  const [price, setPrice] = useState(String(Math.round(item.price_rub_minor / 100)))
  const [isActive, setIsActive] = useState(item.is_active === 1)

  return (
    <tr className="border-t border-white/8">
      <td className="py-3 text-white">{item.nominal_try} TL</td>
      <td>
        <input value={price} onChange={(event) => setPrice(event.target.value)} className="w-28 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" />
        <span className="ml-2 text-xs text-white/34">{formatRubMinor(item.price_rub_minor)}</span>
      </td>
      <td><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /></td>
      <td>{item.active_count}</td>
      <td>{item.sold_count}</td>
      <td>
        <button type="button" onClick={() => void onSave(item.nominal_try, price, isActive)} className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/70">Сохранить</button>
      </td>
    </tr>
  )
}

function ManualParsingPanel({ token }: { token: string }) {
  const [proxies, setProxies] = useState<AdminProxy[]>([])
  const [tasks, setTasks] = useState<AdminParseTask[]>([])
  const [products, setProducts] = useState<AdminParseProduct[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [parseRegion, setParseRegion] = useState<AdminParseRegion>('turkey')
  const [productRegion, setProductRegion] = useState<AdminParseRegion>('turkey')
  const [proxyId, setProxyId] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [manualStatus, setManualStatus] = useState('Ручной парсинг готов к работе.')
  const [loadingManual, setLoadingManual] = useState(false)
  const [newProxy, setNewProxy] = useState({
    name: '',
    type: 'http' as AdminProxy['type'],
    host: '',
    port: '8080',
    username: '',
    password: '',
    region: 'turkey' as 'turkey' | 'india',
    testBeforeSave: true,
  })

  async function loadManualData() {
    const cleanToken = token.trim()
    if (!cleanToken) return

    try {
      const [proxyResponse, taskResponse, productResponse] = await Promise.all([
        getAdminProxies(cleanToken),
        getAdminParseTasks(cleanToken),
        getAdminParseProducts(cleanToken, { region: productRegion, query: productQuery, limit: 30 }),
      ])
      setProxies(proxyResponse.items)
      setTasks(taskResponse.tasks)
      setProducts(productResponse.items)
    } catch (error) {
      setManualStatus(error instanceof Error ? `Не удалось загрузить ручной парсинг: ${error.message}` : 'Не удалось загрузить ручной парсинг.')
    }
  }

  useEffect(() => {
    let cancelled = false
    const cleanToken = token.trim()

    async function load() {
      if (!cleanToken) return

      try {
        const [proxyResponse, taskResponse, productResponse] = await Promise.all([
          getAdminProxies(cleanToken),
          getAdminParseTasks(cleanToken),
          getAdminParseProducts(cleanToken, { region: productRegion, query: productQuery, limit: 30 }),
        ])

        if (cancelled) return

        setProxies(proxyResponse.items)
        setTasks(taskResponse.tasks)
        setProducts(productResponse.items)
      } catch (error) {
        if (!cancelled) {
          setManualStatus(error instanceof Error ? `Не удалось загрузить ручной парсинг: ${error.message}` : 'Не удалось загрузить ручной парсинг.')
        }
      }
    }

    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [token, productRegion, productQuery])

  async function addProxy() {
    setLoadingManual(true)
    setManualStatus('Добавляю прокси...')
    try {
      await createAdminProxy(token.trim(), {
        ...newProxy,
        port: Number(newProxy.port),
      })
      setNewProxy({ name: '', type: 'http', host: '', port: '8080', username: '', password: '', region: 'turkey', testBeforeSave: true })
      setManualStatus('Прокси добавлен.')
      await loadManualData()
    } catch (error) {
      setManualStatus(error instanceof Error ? `Прокси не сохранён: ${error.message}` : 'Прокси не сохранён.')
    } finally {
      setLoadingManual(false)
    }
  }

  async function runProxyTest(id: number) {
    setLoadingManual(true)
    setManualStatus('Тестирую прокси...')
    try {
      const result = await testAdminProxy(token.trim(), id)
      setManualStatus(result.message)
      await loadManualData()
    } catch (error) {
      setManualStatus(error instanceof Error ? `Тест прокси не выполнен: ${error.message}` : 'Тест прокси не выполнен.')
    } finally {
      setLoadingManual(false)
    }
  }

  async function toggleProxyStatus(id: number) {
    await toggleAdminProxy(token.trim(), id)
    await loadManualData()
  }

  async function removeProxy(id: number) {
    await deleteAdminProxy(token.trim(), id)
    await loadManualData()
  }

  async function createTask(type: AdminParseType, selectedOnly: boolean) {
    setLoadingManual(true)
    setManualStatus('Создаю задачу парсинга...')
    try {
      const response = await createAdminParseTask(token.trim(), type, {
        region: parseRegion,
        productIds: selectedOnly ? selectedIds : null,
        proxyId: proxyId ? Number(proxyId) : null,
      })
      setManualStatus(`Задача #${response.taskId} создана. Товаров: ${response.totalItems}.`)
      setSelectedIds([])
      await loadManualData()
    } catch (error) {
      setManualStatus(error instanceof Error ? `Не удалось создать задачу: ${error.message}` : 'Не удалось создать задачу.')
    } finally {
      setLoadingManual(false)
    }
  }

  async function resumeTask(task: AdminParseTask) {
    setLoadingManual(true)
    setManualStatus(`Продолжаю задачу #${task.id} с позиции ${task.processed_items}/${task.total_items}...`)
    try {
      const response = await resumeAdminParseTask(token.trim(), task.id)
      setManualStatus(`Создана задача #${response.taskId} на остаток: ${response.remainingItems}. Пропущено уже обработанных: ${response.skippedItems}.`)
      await loadManualData()
    } catch (error) {
      setManualStatus(error instanceof Error ? `Не удалось продолжить задачу: ${error.message}` : 'Не удалось продолжить задачу.')
    } finally {
      setLoadingManual(false)
    }
  }

  async function cancelTask(task: AdminParseTask) {
    setLoadingManual(true)
    setManualStatus(`Cancelling task #${task.id}...`)
    try {
      await cancelAdminParseTask(token.trim(), task.id)
      setManualStatus(`Task #${task.id} cancelled. If it was running, the worker will stop before the next product.`)
      await loadManualData()
    } catch (error) {
      setManualStatus(error instanceof Error ? `Unable to cancel task: ${error.message}` : 'Unable to cancel task.')
    } finally {
      setLoadingManual(false)
    }
  }

  const activeProxies = proxies.filter((proxy) => proxy.status === 'active' && (parseRegion === 'all' || proxy.region === parseRegion))

  return (
    <section className="rounded-[28px] border border-white/10 bg-black/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl text-sheen">Ручной парсинг PS Store</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
            Задачи создаются только вручную из админки. Автоматический cron отключен. При 403 прокси помечается как banned, при 429 задача останавливается с ошибкой.
          </p>
        </div>
        <button type="button" onClick={() => void loadManualData()} className="quiet-button">
          Обновить статус
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/58">{manualStatus}</div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-white">Прокси</h3>
            <span className="text-sm text-white/42">{proxies.length} шт.</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" placeholder="Название" value={newProxy.name} onChange={(event) => setNewProxy((current) => ({ ...current, name: event.target.value }))} />
            <select className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={newProxy.type} onChange={(event) => setNewProxy((current) => ({ ...current, type: event.target.value as AdminProxy['type'] }))}>
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="socks5">SOCKS5</option>
            </select>
            <input className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" placeholder="Host" value={newProxy.host} onChange={(event) => setNewProxy((current) => ({ ...current, host: event.target.value }))} />
            <input className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" placeholder="Port" inputMode="numeric" value={newProxy.port} onChange={(event) => setNewProxy((current) => ({ ...current, port: event.target.value }))} />
            <input className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" placeholder="Логин" value={newProxy.username} onChange={(event) => setNewProxy((current) => ({ ...current, username: event.target.value }))} />
            <input className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" placeholder="Пароль" type="password" value={newProxy.password} onChange={(event) => setNewProxy((current) => ({ ...current, password: event.target.value }))} />
            <select className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={newProxy.region} onChange={(event) => setNewProxy((current) => ({ ...current, region: event.target.value as 'turkey' | 'india' }))}>
              <option value="turkey">Turkey</option>
              <option value="india">India</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-white/58">
              <input type="checkbox" checked={newProxy.testBeforeSave} onChange={(event) => setNewProxy((current) => ({ ...current, testBeforeSave: event.target.checked }))} />
              Тест перед сохранением
            </label>
          </div>
          <button type="button" onClick={() => void addProxy()} disabled={loadingManual} className="mt-3 rounded-full bg-white px-5 py-3 text-sm font-semibold !text-black disabled:opacity-50">
            Добавить прокси
          </button>

          <div className="mt-5 space-y-3">
            {proxies.map((proxy) => (
              <div key={proxy.id} className="rounded-2xl border border-white/10 bg-black/24 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{proxy.name}</div>
                    <div className="mt-1 text-xs text-white/45">{proxy.type.toUpperCase()} {proxy.host}:{proxy.port} · {proxy.region}</div>
                    <div className="mt-1 text-xs text-white/45">Ответ: {proxy.last_response_time_ms ? `${proxy.last_response_time_ms}ms` : '—'} · HTTP {proxy.last_http_code ?? '—'} · ошибок {proxy.error_count}</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs ${proxy.status === 'active' ? 'bg-emerald-400 text-black' : proxy.status === 'banned' ? 'bg-red-500/20 text-red-100' : 'bg-white/10 text-white/56'}`}>{proxy.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void runProxyTest(proxy.id)} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70">Тест</button>
                  <button type="button" onClick={() => void toggleProxyStatus(proxy.id)} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70">{proxy.status === 'active' ? 'Выключить' : 'Включить'}</button>
                  <button type="button" onClick={() => void removeProxy(proxy.id)} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70">Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <h3 className="text-xl font-semibold text-white">Парсинг</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-sm text-white/50">
              Регион
              <select className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={parseRegion} onChange={(event) => setParseRegion(event.target.value as AdminParseRegion)}>
                <option value="turkey">Turkey</option>
                <option value="india">India</option>
                <option value="all">All</option>
              </select>
            </label>
            <label className="text-sm text-white/50 md:col-span-2">
              Прокси
              <select className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={proxyId} onChange={(event) => setProxyId(event.target.value)}>
                <option value="">Автовыбор активного</option>
                {activeProxies.map((proxy) => (
                  <option key={proxy.id} value={proxy.id}>{proxy.name} ({proxy.host}:{proxy.port})</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {PARSE_TYPES.map((item) => (
              <button key={item.value} type="button" onClick={() => void createTask(item.value, false)} disabled={loadingManual} className="rounded-full bg-white px-4 py-3 text-sm font-semibold !text-black disabled:opacity-50">
                Все {item.label}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
              <input className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" placeholder="Поиск товара" value={productQuery} onChange={(event) => setProductQuery(event.target.value)} />
              <select className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={productRegion} onChange={(event) => setProductRegion(event.target.value as AdminParseRegion)}>
                <option value="turkey">Turkey</option>
                <option value="india">India</option>
                <option value="all">All</option>
              </select>
            </div>
            <div className="mt-3 max-h-[430px] overflow-y-auto pr-1">
              {products.map((product) => (
                <label key={product.id} className="mt-2 grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm">
                  <input type="checkbox" checked={selectedIds.includes(product.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} />
                  <span className="min-w-0">
                    <span className="block truncate text-white">{product.title}</span>
                    <span className="block truncate text-xs text-white/40">{product.source_key} · editions {product.editions_count ?? 0}</span>
                  </span>
                  <span className="text-xs text-white/42">#{product.id}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/54">
              <span>Выбрано: {selectedIds.length}</span>
              <button type="button" onClick={() => setSelectedIds(products.map((item) => item.id))} className="rounded-full border border-white/10 px-3 py-1.5">Выбрать все</button>
              <button type="button" onClick={() => setSelectedIds([])} className="rounded-full border border-white/10 px-3 py-1.5">Снять</button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {PARSE_TYPES.map((item) => (
                <button key={item.value} type="button" onClick={() => void createTask(item.value, true)} disabled={loadingManual || selectedIds.length === 0} className="rounded-full border border-white/10 px-4 py-3 text-sm text-white disabled:opacity-40">
                  Выбранные {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-xl font-semibold text-white">Последние задачи</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-white/40">
              <tr>
                <th className="py-2">#</th>
                <th>Тип</th>
                <th>Регион</th>
                <th>Статус</th>
                <th>Обработано</th>
                <th>Создана</th>
                <th>Ошибка</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody className="text-white/64">
              {tasks.map((task) => {
                const canCancel = task.status === 'pending' || task.status === 'running'
                const canResume = task.processed_items > 0
                  && task.processed_items < task.total_items
                  && task.status !== 'pending'
                  && task.status !== 'running'

                return (
                  <tr key={task.id} className="border-t border-white/8">
                    <td className="py-3 text-white">{task.id}</td>
                    <td>{task.type}</td>
                    <td>{task.region}</td>
                    <td>{task.status}</td>
                    <td>
                      <span>{task.processed_items}/{task.total_items}</span>
                      {task.processed_items < task.total_items ? (
                        <span className="ml-2 text-xs text-white/38">осталось {task.total_items - task.processed_items}</span>
                      ) : null}
                    </td>
                    <td>{formatTaskDate(task.created_at)}</td>
                    <td className="max-w-xs truncate text-red-200/70">{task.error_message ?? '—'}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                      {canCancel ? (
                        <button
                          type="button"
                          onClick={() => void cancelTask(task)}
                          disabled={loadingManual}
                          className="rounded-full border border-red-300/30 bg-red-400/12 px-4 py-2 text-xs font-semibold text-red-100 disabled:opacity-45"
                        >
                          Cancel
                        </button>
                      ) : null}
                      {canResume ? (
                        <button
                          type="button"
                          onClick={() => void resumeTask(task)}
                          disabled={loadingManual}
                          className="rounded-full border border-emerald-300/30 bg-emerald-400/12 px-4 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-45"
                        >
                          Продолжить
                        </button>
                      ) : !canCancel ? (
                        <span className="text-white/28">—</span>
                      ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export function AdminPsPlusPage() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) ?? '')
  const [region, setRegion] = useState<'turkey' | 'india'>('turkey')
  const [authenticated, setAuthenticated] = useState(false)
  const [adminSection, setAdminSection] = useState<AdminSection>('codes')
  const [pricesItems, setPricesItems] = useState<PsPlusPrice[]>([])
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [active, setActive] = useState<Record<string, boolean>>({})
  const [banners, setBanners] = useState<EditableBanner[]>([])
  const [bannerSettings, setBannerSettings] = useState(DEFAULT_BANNER_SETTINGS)
  const [refreshProductValue, setRefreshProductValue] = useState('')
  const [refreshLocale, setRefreshLocale] = useState<'auto' | 'en-tr' | 'en-in'>('auto')
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

  async function refreshProduct() {
    const cleanToken = token.trim()
    const value = refreshProductValue.trim()
    if (!value) {
      setStatus('Введите ID товара или source key PS Store.')
      return
    }

    const productId = /^\d+$/.test(value) ? Number(value) : undefined
    const sourceKey = productId ? undefined : value
    setLoading(true)
    setStatus('Обновляю товар из PS Store...')

    try {
      const result = await refreshAdminProduct(cleanToken, {
        productId,
        sourceKey,
        locale: refreshLocale === 'auto' ? undefined : refreshLocale,
      })
      setStatus(
        `Товар обновлен: #${result.productId}, locale ${result.locale}, изданий ${result.editions}, карточек версий ${result.editionProducts}, цен версий ${result.editionOffers}.`,
      )
    } catch (error) {
      setStatus(error instanceof Error ? `Не удалось обновить товар: ${error.message}` : 'Не удалось обновить товар.')
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

            <div className="grid gap-3 lg:grid-cols-3">
              {ADMIN_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setAdminSection(section.id)}
                  className={`rounded-[24px] border p-4 text-left transition ${
                    adminSection === section.id
                      ? 'border-white/22 bg-white text-black'
                      : 'border-white/10 bg-black/20 text-white hover:border-white/18 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="text-base font-semibold">{section.label}</div>
                  <div className={`mt-2 text-sm ${adminSection === section.id ? 'text-black/55' : 'text-white/46'}`}>
                    {section.description}
                  </div>
                </button>
              ))}
            </div>

            {adminSection === 'codes' ? <CodeFulfillmentPanel token={token} /> : null}

            {adminSection === 'parsing' ? (
              <>
                <ManualParsingPanel token={token} />

            <section className="rounded-[28px] border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-3xl text-sheen">Обновить товар вручную</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
                    Введите ID товара на сайте, например 4505, или source key PS Store. Обновляются описание, языки, изображения, версии/издания и цены версий.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshProduct()}
                  disabled={loading}
                  className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50"
                >
                  Обновить
                </button>
              </div>
              <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_180px]">
                <input
                  value={refreshProductValue}
                  onChange={(event) => setRefreshProductValue(event.target.value)}
                  placeholder="ID товара или source key, например 4505"
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                />
                <select
                  value={refreshLocale}
                  onChange={(event) => setRefreshLocale(event.target.value as 'auto' | 'en-tr' | 'en-in')}
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="auto">Auto region</option>
                  <option value="en-tr">Turkey</option>
                  <option value="en-in">India</option>
                </select>
              </div>
            </section>
              </>
            ) : null}

            {adminSection === 'pricing' ? (
              <>
            <section className="rounded-[28px] border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-3xl text-sheen">Баннеры главной</h2>
                  <p className="mt-2 text-sm text-white/50">
                    Картинка показывается в слайдере главной в вертикальном формате 3:4. На desktop одновременно видно 4 баннера. Ссылка может вести на раздел, например /catalog?category=deals, или на игру /product/8.
                  </p>
                  <div className="mt-4 grid gap-3 rounded-2xl border border-white/8 bg-black/20 p-3 sm:grid-cols-2">
                    <label className="text-xs uppercase tracking-[0.18em] text-white/42">
                      Автопрокрутка, мс
                      <input
                        type="number"
                        min="500"
                        max="60000"
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
                  <div key={banner.id ?? `new-${index}`} className="grid gap-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-[260px_1fr]">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-white/38">
                        <span>Preview 3:4</span>
                        <span>Desktop 4 in row</span>
                      </div>
                      <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                      {banner.imageDataUrl || banner.imageUrl ? (
                        <img
                          src={banner.imageDataUrl ?? banner.imageUrl ?? ''}
                          alt={banner.title || 'Баннер'}
                          className="h-full w-full object-cover"
                          style={{
                            objectPosition: `${banner.imagePositionX}% ${banner.imagePositionY}%`,
                            transform: `scale(${banner.imageScale})`,
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-4 text-center text-xs text-white/36">Нет изображения 3:4</div>
                      )}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-white/42">
                        Рекомендуемый размер: 900x1200 или 1200x1600. Если картинка широкая, настройте X/Y и Scale.
                      </p>
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
              </>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
