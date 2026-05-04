import { Link } from 'react-router-dom'

const footerLinks = [
  'О магазине',
  'Контакты',
  'Поддержка',
  'Пользовательское соглашение',
  'Политика конфиденциальности',
]

export function Footer() {
  return (
    <footer className="page-shell mt-10">
      <div className="satin-panel rounded-[28px] border border-white/10 px-6 py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <div className="font-display text-2xl tracking-[0.2em] text-sheen">PIXEL SILK</div>
            <p className="mt-3 text-sm leading-6 text-white/58">
              Премиальный storefront для цифровых товаров console gaming: подписки, игры,
              пополнения и подборки по регионам Turkey и India.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-white/66 sm:grid-cols-2 lg:grid-cols-5">
            {footerLinks.map((link) => (
              <Link key={link} to="/support" className="cursor-pointer transition hover:text-white">
                {link}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
