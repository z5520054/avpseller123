import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const VK_ID_APP_ID = 54580545
const VK_ID_REDIRECT_URL = 'https://avpseller.ru/'
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

export function AuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const widgetRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isOpen || !widgetRef.current) {
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
                setStatus('success')
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
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/72 px-4 backdrop-blur-xl">
      <div className="relative w-full max-w-[430px] rounded-[28px] border border-white/12 bg-[#f6f6f2] p-6 text-[#151515] shadow-[0_26px_90px_rgba(0,0,0,.62)] sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[14px] bg-[#ebeef3] text-[#6f7680] transition hover:bg-[#e0e5ec] hover:text-[#20242a]"
          aria-label="Закрыть авторизацию"
        >
          <X size={20} />
        </button>

        <div className="pr-12">
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#1b1b1b]">Авторизация</h2>
          <p className="mt-4 text-sm leading-6 text-[#7a7f86]">
            Войдите через VK ID, чтобы сохранять покупки, избранное и получать персональные предложения.
          </p>
        </div>

        <div className="mt-7 min-h-[126px]" ref={widgetRef} />

        {status === 'loading' ? (
          <div className="mt-4 rounded-[16px] bg-black/5 px-4 py-3 text-sm text-[#6f7680]">Загружаем VK ID...</div>
        ) : null}
        {message ? (
          <div
            className={`mt-4 rounded-[16px] px-4 py-3 text-sm ${
              status === 'success' ? 'bg-emerald-500/12 text-emerald-700' : 'bg-red-500/10 text-red-700'
            }`}
          >
            {message}
          </div>
        ) : null}
      </div>
    </div>
  )
}
