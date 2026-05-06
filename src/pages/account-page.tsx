import { Database, Gamepad2, Gift, LogOut, Mail, Plus, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppState } from '../store/use-app-state'

type ConsoleType = 'ps5' | 'ps4'
type AccountSection = 'account' | 'subscription' | 'purchases'
type PsPlusSubscription = 'essential' | 'extra' | 'deluxe'
type ActiveSubscription = PsPlusSubscription | 'ea-play'

const ACCOUNT_EMAIL_KEY = 'avp-account-email'
const ACCOUNT_CONSOLE_KEY = 'avp-account-console'
const ACCOUNT_PS_PLUS_SUBSCRIPTION_KEY = 'avp-account-ps-plus-subscription'
const ACCOUNT_PS_PLUS_END_KEY = 'avp-account-ps-plus-end'
const ACCOUNT_EA_PLAY_ENABLED_KEY = 'avp-account-ea-play-enabled'
const ACCOUNT_EA_PLAY_END_KEY = 'avp-account-ea-play-end'

const subscriptionOptions: Array<{
  id: ActiveSubscription
  eyebrow: string
  title: string
  tone: string
}> = [
  {
    id: 'essential',
    eyebrow: 'PS Plus',
    title: 'Essential',
    tone: 'from-zinc-100 via-slate-300 to-slate-500 text-black',
  },
  {
    id: 'extra',
    eyebrow: 'PS Plus',
    title: 'Extra',
    tone: 'from-yellow-200 via-amber-400 to-orange-500 text-black',
  },
  {
    id: 'deluxe',
    eyebrow: 'PS Plus',
    title: 'Deluxe',
    tone: 'from-[#141414] via-[#272018] to-amber-500 text-amber-200',
  },
  {
    id: 'ea-play',
    eyebrow: 'EA',
    title: 'EA Play',
    tone: 'from-[#071030] via-[#10205c] to-[#f24a5f] text-white',
  },
]

function isPsPlusSubscription(value: ActiveSubscription): value is PsPlusSubscription {
  return value !== 'ea-play'
}

function readVkProfile() {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem('avp-vkid-profile')
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function decodeJwtPayload(token: unknown) {
  if (typeof token !== 'string' || token.split('.').length < 2) {
    return null
  }

  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const decoded = window.atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))
    const json = decodeURIComponent(
      Array.from(decoded)
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )

    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function collectProfileSources(profile: Record<string, unknown> | null) {
  if (!profile) {
    return []
  }

  const sources: Record<string, unknown>[] = [profile]
  for (const key of ['user', 'user_info', 'profile', 'account', 'vk_user']) {
    const nested = profile[key]
    if (isRecord(nested)) {
      sources.push(nested)
    }
  }

  for (const key of ['id_token', 'idToken']) {
    const decoded = decodeJwtPayload(profile[key])
    if (decoded) {
      sources.push(decoded)
    }
  }

  return sources
}

function pickString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function getProfileName(profile: Record<string, unknown> | null) {
  for (const source of collectProfileSources(profile)) {
    const fullName = pickString(source, ['name', 'full_name', 'fullName', 'display_name', 'displayName'])
    if (fullName) {
      return fullName
    }

    const firstName = pickString(source, ['first_name', 'firstName', 'given_name', 'givenName'])
    const lastName = pickString(source, ['last_name', 'lastName', 'family_name', 'familyName'])
    const name = `${firstName} ${lastName}`.trim()
    if (name) {
      return name
    }
  }

  return 'Покупатель AVP Seller'
}

function getAvatar(profile: Record<string, unknown> | null) {
  for (const source of collectProfileSources(profile)) {
    const avatar = pickString(source, ['avatar', 'photo', 'photo_100', 'photo200', 'picture'])
    if (avatar) {
      return avatar
    }
  }

  return null
}

function AccountMenuButton({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center justify-between rounded-[20px] border px-4 py-4 text-left text-sm transition ${
        active
          ? 'border-white/26 bg-white text-black shadow-[0_18px_45px_rgba(255,255,255,.08)]'
          : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-white/18 hover:bg-white/[0.07]'
      }`}
    >
      <span className="flex items-center gap-3">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${
            active ? 'bg-black text-white' : 'bg-white/8 text-white/70'
          }`}
        >
          {icon}
        </span>
        {label}
      </span>
      <span className={active ? 'text-black/45' : 'text-white/30'}>›</span>
    </button>
  )
}

export function AccountPage() {
  const { cart, favorites } = useAppState()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Record<string, unknown> | null>(() => readVkProfile())
  const [activeSection, setActiveSection] = useState<AccountSection>('account')
  const [email, setEmail] = useState(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    return window.localStorage.getItem(ACCOUNT_EMAIL_KEY) ?? ''
  })
  const [consoleType, setConsoleType] = useState<ConsoleType>(() => {
    if (typeof window === 'undefined') {
      return 'ps5'
    }

    return (window.localStorage.getItem(ACCOUNT_CONSOLE_KEY) as ConsoleType | null) ?? 'ps5'
  })
  const [activePsPlusSubscription, setActivePsPlusSubscription] = useState<PsPlusSubscription>(() => {
    if (typeof window === 'undefined') {
      return 'essential'
    }

    const saved = window.localStorage.getItem(ACCOUNT_PS_PLUS_SUBSCRIPTION_KEY) as PsPlusSubscription | null
    return saved === 'extra' || saved === 'deluxe' || saved === 'essential' ? saved : 'essential'
  })
  const [psPlusEndDate, setPsPlusEndDate] = useState(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    return window.localStorage.getItem(ACCOUNT_PS_PLUS_END_KEY) ?? ''
  })
  const [isEaPlayEnabled, setIsEaPlayEnabled] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.localStorage.getItem(ACCOUNT_EA_PLAY_ENABLED_KEY) === 'true'
  })
  const [eaPlayEndDate, setEaPlayEndDate] = useState(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    return window.localStorage.getItem(ACCOUNT_EA_PLAY_END_KEY) ?? ''
  })
  const avatar = getAvatar(profile)

  useEffect(() => {
    window.localStorage.setItem(ACCOUNT_EMAIL_KEY, email)
  }, [email])

  useEffect(() => {
    window.localStorage.setItem(ACCOUNT_CONSOLE_KEY, consoleType)
  }, [consoleType])

  useEffect(() => {
    window.localStorage.setItem(ACCOUNT_PS_PLUS_SUBSCRIPTION_KEY, activePsPlusSubscription)
  }, [activePsPlusSubscription])

  useEffect(() => {
    window.localStorage.setItem(ACCOUNT_PS_PLUS_END_KEY, psPlusEndDate)
  }, [psPlusEndDate])

  useEffect(() => {
    window.localStorage.setItem(ACCOUNT_EA_PLAY_ENABLED_KEY, String(isEaPlayEnabled))
  }, [isEaPlayEnabled])

  useEffect(() => {
    window.localStorage.setItem(ACCOUNT_EA_PLAY_END_KEY, eaPlayEndDate)
  }, [eaPlayEndDate])

  function handleLogout() {
    window.localStorage.removeItem('avp-vkid-profile')
    setProfile(null)
    navigate('/')
  }

  function handleSubscriptionSelect(id: ActiveSubscription) {
    if (isPsPlusSubscription(id)) {
      setActivePsPlusSubscription(id)
      return
    }

    setIsEaPlayEnabled((current) => !current)
  }

  return (
    <div className="page-shell section-space">
      <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.16),transparent_34%),linear-gradient(145deg,#222224_0%,#101012_54%,#070708_100%)] p-4 shadow-[0_28px_100px_rgba(0,0,0,.48)] sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.04),transparent)]" />

        <div className="relative grid gap-5 lg:grid-cols-[310px_1fr]">
          <aside className="space-y-3 lg:sticky lg:top-32 lg:self-start">
            <div className="rounded-[28px] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[18px] border border-white/12 bg-white/8">
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={24} className="text-white/72" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="line-clamp-1 text-base font-medium text-white">{getProfileName(profile)}</div>
                  <div className="mt-1 text-xs text-white/42">{profile ? 'VK ID подключён' : 'Гость'}</div>
                </div>
              </div>
            </div>

            <AccountMenuButton
              active={activeSection === 'account'}
              icon={<UserRound size={16} />}
              label="Ваш аккаунт"
              onClick={() => setActiveSection('account')}
            />
            <AccountMenuButton
              active={activeSection === 'subscription'}
              icon={<ShieldCheck size={16} />}
              label="Активная подписка"
              onClick={() => setActiveSection('subscription')}
            />
            <AccountMenuButton
              active={activeSection === 'purchases'}
              icon={<Database size={16} />}
              label="История покупок"
              onClick={() => setActiveSection('purchases')}
            />
          </aside>

          <div className="space-y-4">
            {activeSection === 'account' ? (
              <>
            <div className="grid gap-4 xl:grid-cols-3">
              <Link
                to="/cart"
                className="block rounded-[28px] border border-white/10 bg-white/[0.045] p-5 transition hover:border-white/20 hover:bg-white/[0.07]"
              >
                <div className="text-xs uppercase tracking-[0.2em] text-white/38">Корзина</div>
                <div className="mt-4 text-3xl font-semibold text-white">{cart.length}</div>
                <div className="mt-1 text-sm text-white/48">сохранённых позиций</div>
              </Link>
              <Link
                to="/favorites"
                className="block rounded-[28px] border border-white/10 bg-white/[0.045] p-5 transition hover:border-white/20 hover:bg-white/[0.07]"
              >
                <div className="text-xs uppercase tracking-[0.2em] text-white/38">Избранное</div>
                <div className="mt-4 text-3xl font-semibold text-white">{favorites.length}</div>
                <div className="mt-1 text-sm text-white/48">товаров в списке</div>
              </Link>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-white/38">Бонусы</div>
                <div className="mt-4 text-3xl font-semibold text-white">0 ₽</div>
                <div className="mt-1 text-sm text-white/48">баланс программы</div>
              </div>
            </div>

            <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.035))] p-5 sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="font-display text-3xl text-sheen sm:text-4xl">Аккаунты для быстрого входа</h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/52">
                    Подключённый аккаунт используется для сохранения корзины, избранного и будущей истории заказов.
                  </p>
                </div>
                {profile ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white/60 transition hover:border-white/18 hover:text-white"
                  >
                    <LogOut size={16} />
                    Выйти из аккаунта
                  </button>
                ) : (
                  <Link
                    to="/"
                    className="inline-flex cursor-pointer rounded-full bg-white px-5 py-2.5 text-sm font-semibold !text-black transition hover:bg-zinc-100"
                  >
                    Войти
                  </Link>
                )}
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-[16px] border border-white/10 bg-black/24 px-3 py-2 text-sm text-white">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[#0077ff] text-xs font-bold text-white">
                    VK
                  </span>
                  {getProfileName(profile)}
                </div>
              </div>

              <div className="mt-7 border-t border-white/10 pt-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Добавить ещё</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-white/46">
                      Позже сюда можно добавить Яндекс ID или Google, чтобы пользователю было проще входить на сайт.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 text-sm text-white/45 transition hover:bg-white/[0.07]">
                      <span className="font-bold text-[#ff3d32]">Я</span>
                      <Plus size={15} />
                    </button>
                    <button className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 text-sm text-white/45 transition hover:bg-white/[0.07]">
                      <span className="font-bold text-white">G</span>
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
              <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-5 sm:p-7">
                <div className="grid gap-5 sm:grid-cols-[1fr_280px] sm:items-center">
                  <div>
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/10 bg-black/20 text-white/62">
                      <Mail size={18} />
                    </div>
                    <h2 className="mt-5 text-xl font-semibold text-white">E-mail для чека</h2>
                    <p className="mt-2 text-sm leading-6 text-white/48">
                      Сайт запомнит адрес и будет подставлять его при оформлении заказа.
                    </p>
                  </div>
                  <label className="block">
                    <span className="sr-only">E-mail для чека</span>
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      type="email"
                      placeholder="Введите E-mail"
                      className="w-full rounded-[20px] border border-white/10 bg-black/22 px-5 py-4 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-white/22"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-5 sm:p-7">
                <h2 className="text-xl font-semibold text-white">Моя приставка</h2>
                <p className="mt-2 text-sm leading-6 text-white/48">
                  Выбор поможет подбирать игры и издания под вашу PlayStation.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {([
                    ['ps5', 'PlayStation 5'],
                    ['ps4', 'PlayStation 4'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setConsoleType(value)}
                      className={`cursor-pointer rounded-[22px] border p-4 text-center transition ${
                        consoleType === value
                          ? 'border-white/38 bg-white text-black shadow-[0_18px_45px_rgba(255,255,255,.08)]'
                          : 'border-white/10 bg-black/18 text-white/58 hover:border-white/20'
                      }`}
                    >
                      <Gamepad2 className="mx-auto" size={26} />
                      <div className="mt-3 text-sm font-medium">{label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

              </>
            ) : null}

            {activeSection === 'subscription' ? (
              <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.035))] p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-white/38">Раздел кабинета</div>
                    <h1 className="mt-3 font-display text-4xl text-sheen">Активная подписка</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/52">
                      Выберите свою действующую подписку и укажите дату окончания. Так мы сможем показывать актуальный статус в кабинете.
                    </p>
                  </div>
                  <Gift size={22} className="text-white/38" />
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {subscriptionOptions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSubscriptionSelect(item.id)}
                      className={`group cursor-pointer rounded-[26px] border p-3 text-left transition ${
                        (isPsPlusSubscription(item.id) && activePsPlusSubscription === item.id) || (item.id === 'ea-play' && isEaPlayEnabled)
                          ? 'border-white/42 bg-white/[0.08] shadow-[0_18px_55px_rgba(255,255,255,.08)]'
                          : 'border-white/10 bg-black/16 hover:border-white/22 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className={`relative h-28 overflow-hidden rounded-[20px] bg-gradient-to-br ${item.tone} p-4`}>
                        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full border border-current/25" />
                        <div className="absolute bottom-3 right-4 text-4xl font-black opacity-18">+</div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{item.eyebrow}</div>
                        <div className="mt-8 text-2xl font-black uppercase tracking-[-0.04em]">{item.title}</div>
                      </div>
                      <div className="mt-4 text-center text-sm text-white/58">{item.eyebrow}</div>
                      <div className="mt-1 text-center text-base font-semibold text-white">{item.title}</div>
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
                  <div className="rounded-[24px] border border-white/10 bg-black/18 p-5">
                    <div className="text-sm uppercase tracking-[0.18em] text-white/38">Текущий выбор</div>
                    <div className="mt-3 text-2xl font-semibold text-white">
                      {subscriptionOptions.find((item) => item.id === activePsPlusSubscription)?.eyebrow}{' '}
                      {subscriptionOptions.find((item) => item.id === activePsPlusSubscription)?.title}
                    </div>
                    {isEaPlayEnabled ? <div className="mt-2 text-base font-medium text-white/78">+ EA Play</div> : null}
                    <p className="mt-2 text-sm leading-6 text-white/48">
                      Essential, Extra и Deluxe взаимоисключаются. EA Play можно добавить отдельно вместе с одной PS Plus подпиской.
                    </p>
                  </div>

                  <label className="rounded-[24px] border border-white/10 bg-black/18 p-5">
                    <span className="block text-sm uppercase tracking-[0.18em] text-white/38">Дата окончания</span>
                    <input
                      type="date"
                      value={psPlusEndDate}
                      onChange={(event) => setPsPlusEndDate(event.target.value)}
                      className="mt-4 w-full rounded-[18px] border border-white/10 bg-black/28 px-4 py-3 text-sm text-white outline-none [color-scheme:dark] focus:border-white/24"
                    />
                    <span className="mt-3 block text-sm text-white/48">
                      {psPlusEndDate ? `PS Plus активна до ${psPlusEndDate}` : 'Укажите дату окончания PS Plus'}
                    </span>
                  </label>
                </div>

                {isEaPlayEnabled ? (
                  <label className="mt-4 block rounded-[24px] border border-white/10 bg-black/18 p-5">
                    <span className="block text-sm uppercase tracking-[0.18em] text-white/38">Дата окончания EA Play</span>
                    <input
                      type="date"
                      value={eaPlayEndDate}
                      onChange={(event) => setEaPlayEndDate(event.target.value)}
                      className="mt-4 w-full rounded-[18px] border border-white/10 bg-black/28 px-4 py-3 text-sm text-white outline-none [color-scheme:dark] focus:border-white/24"
                    />
                    <span className="mt-3 block text-sm text-white/48">
                      {eaPlayEndDate ? `EA Play активна до ${eaPlayEndDate}` : 'Укажите дату окончания EA Play'}
                    </span>
                  </label>
                ) : null}
              </section>
            ) : null}

            {activeSection === 'purchases' ? (
              <section className="min-h-[520px] p-2 sm:p-4">
                <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white">История покупок</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-white/58">
                  Все ваши заказы, ключи и данные об аккаунте будут храниться здесь.
                </p>
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
