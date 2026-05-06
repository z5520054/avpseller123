import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const VK_ID_APP_ID = 54580545
const VK_ID_REDIRECT_URL = import.meta.env.VITE_VK_ID_REDIRECT_URL || 'https://avpseller.ru/'
const VK_ID_SDK_URL = 'https://unpkg.com/@vkid/sdk@2/dist-sdk/umd/index.js'

interface VkIdWidget {
  on: (eventName: string, callback: (payload: unknown) => void) => VkIdWidget
}

interface VkIdSdk {
  Config: {
    init: (input: {
      app: number
      redirectUrl: string
      responseMode: string
      source: string
      scope: string
    }) => void
  }
  ConfigResponseMode: {
    Callback: string
  }
  ConfigSource: {
    LOWCODE: string
  }
  WidgetEvents: {
    ERROR: string
  }
  OneTapInternalEvents: {
    LOGIN_SUCCESS: string
  }
  OneTap: new () => {
    render: (input: { container: HTMLElement; showAlternativeLogin: boolean }) => VkIdWidget
  }
  Auth: {
    exchangeCode: (code: string, deviceId: string) => Promise<unknown>
  }
}

declare global {
  interface Window {
    VKIDSDK?: VkIdSdk
  }
}

let vkSdkPromise: Promise<void> | null = null

function loadVkIdSdk() {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }

  if (window.VKIDSDK) {
    return Promise.resolve()
  }

  if (!vkSdkPromise) {
    vkSdkPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-vkid-sdk="true"]')
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('VK ID SDK load failed')), { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = VK_ID_SDK_URL
      script.async = true
      script.dataset.vkidSdk = 'true'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('VK ID SDK load failed'))
      document.head.appendChild(script)
    })
  }

  return vkSdkPromise
}

export function AuthModal({
  isOpen,
  isAuthenticated,
  onAuthenticated,
  onClose,
}: {
  isOpen: boolean
  isAuthenticated: boolean
  onAuthenticated: (profile: unknown) => void
  onClose: () => void
}) {
  const widgetRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isOpen || isAuthenticated || !widgetRef.current) {
      return
    }

    let cancelled = false
    const container = widgetRef.current
    container.innerHTML = ''
    setStatus('loading')
    setMessage('')

    loadVkIdSdk()
      .then(() => {
        if (cancelled || !window.VKIDSDK || !container) {
          return
        }

        const VKID = window.VKIDSDK
        VKID.Config.init({
          app: VK_ID_APP_ID,
          redirectUrl: VK_ID_REDIRECT_URL,
          responseMode: VKID.ConfigResponseMode.Callback,
          source: VKID.ConfigSource.LOWCODE,
          scope: '',
        })

        const oneTap = new VKID.OneTap()
        oneTap
          .render({
            container,
            showAlternativeLogin: true,
          })
          .on(VKID.WidgetEvents.ERROR, (error: unknown) => {
            console.error('VK ID widget error', error)
            setStatus('error')
            setMessage('Не удалось открыть VK ID. Попробуйте ещё раз.')
          })
          .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload: unknown) => {
            const data = payload as { code?: string; device_id?: string }
            if (!data.code || !data.device_id) {
              setStatus('error')
              setMessage('VK ID не вернул код авторизации.')
              return
            }

            VKID.Auth.exchangeCode(data.code, data.device_id)
              .then((data: unknown) => {
                window.localStorage.setItem('avp-vkid-profile', JSON.stringify(data))
                onAuthenticated(data)
                setStatus('success')
                window.setTimeout(onClose, 700)
                setMessage('Авторизация через VK ID выполнена.')
              })
              .catch((error: unknown) => {
                console.error('VK ID auth error', error)
                setStatus('error')
                setMessage('VK ID вернул ошибку авторизации.')
              })
          })

        setStatus('idle')
      })
      .catch((error: unknown) => {
        console.error(error)
        setStatus('error')
        setMessage('Не удалось загрузить VK ID SDK.')
      })

    return () => {
      cancelled = true
      container.innerHTML = ''
    }
  }, [isAuthenticated, isOpen, onAuthenticated, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/72 px-4 backdrop-blur-xl">
      <div className="relative w-full max-w-[430px] overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(145deg,#262628_0%,#111113_48%,#080809_100%)] p-6 text-white shadow-[0_26px_90px_rgba(0,0,0,.72)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.18),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(255,255,255,0.08),transparent_34%)]" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[14px] border border-white/10 bg-white/8 text-white/58 transition hover:bg-white/12 hover:text-white"
          aria-label="Закрыть авторизацию"
        >
          <X size={20} />
        </button>

        <div className="relative z-10 pr-12">
          <h2 className="font-display text-3xl tracking-[-0.04em] text-white">Авторизация</h2>
          <p className="mt-4 text-sm leading-6 text-white/58">
            Войдите через VK ID, чтобы сохранять покупки, избранное и получать персональные предложения.
          </p>
        </div>

        {isAuthenticated ? (
          <div className="relative z-10 mt-7 rounded-[20px] border border-emerald-300/18 bg-emerald-400/10 p-5">
            <div className="text-base font-semibold text-emerald-100">Вы авторизованы через VK ID</div>
            <p className="mt-2 text-sm leading-6 text-white/58">
              Профиль подключён. Можно закрыть это окно и продолжить покупки.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/88"
            >
              Продолжить
            </button>
          </div>
        ) : (
          <div className="relative z-10 mt-7 min-h-[126px] rounded-[20px] border border-white/10 bg-black/20 p-3" ref={widgetRef} />
        )}

        {status === 'loading' ? (
          <div className="relative z-10 mt-4 rounded-[16px] bg-white/8 px-4 py-3 text-sm text-white/60">Загружаем VK ID...</div>
        ) : null}
        {message ? (
          <div
            className={`relative z-10 mt-4 rounded-[16px] px-4 py-3 text-sm ${
              status === 'success' ? 'bg-emerald-400/12 text-emerald-200' : 'bg-red-400/10 text-red-200'
            }`}
          >
            {message}
          </div>
        ) : null}
      </div>
    </div>
  )
}
