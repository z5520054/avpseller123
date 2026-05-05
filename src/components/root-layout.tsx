import { Heart, LifeBuoy, Search, ShoppingBag, User, X } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import avpIconUrl from '../assets/avp-icon.png'
import { useAppState } from '../store/use-app-state'
import { RegionSwitch } from './ui/region-switch'

const navigation = [
  { label: 'Каталог', to: '/catalog', active: 'catalog' },
  { label: 'Подписки', to: '/catalog?category=subscriptions', active: 'subscriptions' },
  { label: 'Поддержка', to: '/support', active: 'support' },
]

export function RootLayout() {
  const { cartCount, favoritesCount, searchQuery, setSearchQuery } = useAppState()
  const location = useLocation()
  const category = new URLSearchParams(location.search).get('category')

  function isNavigationActive(active: string) {
    if (active === 'subscriptions') {
      return location.pathname === '/catalog' && category === 'subscriptions'
    }

    if (active === 'catalog') {
      return location.pathname === '/catalog' && category !== 'subscriptions'
    }

    return location.pathname === '/support'
  }

  return (
    <div className="min-h-screen pb-10 text-silver-300">
      <header className="page-shell sticky top-0 z-50 pt-4">
        <div className="header-shell grid gap-4 rounded-[30px] border border-white/10 px-4 py-4 sm:px-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <div className="flex items-center justify-between gap-4">
            <NavLink to="/" className="group inline-flex cursor-pointer items-center gap-3.5">
              <div className="header-brand-mark flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/12 transition group-hover:border-white/22">
                <img src={avpIconUrl} alt="AVP Seller" className="h-8 w-8 object-contain" />
              </div>
              <div>
                <div className="font-display text-xl leading-none tracking-[0.16em] text-sheen">
                  AVP SELLER
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/42">
                  Game market
                </div>
              </div>
            </NavLink>
            <div className="lg:hidden">
              <RegionSwitch compact />
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <nav className="flex flex-wrap gap-2 text-sm text-white/72">
              {navigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`header-nav-pill ${isNavigationActive(item.active) ? 'header-nav-pill-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <label className="header-search flex min-w-0 items-center gap-3 rounded-full border border-white/10 px-4 py-3 text-sm text-white/52 transition duration-300 ease-out focus-within:border-white/20 lg:max-w-[380px] lg:flex-1">
              <Search size={16} />
              <span className="sr-only">Поиск</span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск по товарам и подборкам"
                className="w-full bg-transparent text-white outline-none placeholder:text-white/35"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white/45 transition hover:bg-white/8 hover:text-white"
                  aria-label="Очистить поиск"
                >
                  <X size={15} />
                </button>
              ) : null}
            </label>
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <div className="hidden lg:block">
              <RegionSwitch compact />
            </div>
            <NavLink to="/favorites" className="header-icon-button" aria-label="Избранное">
              <Heart size={18} />
              {favoritesCount > 0 ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-black">
                  {favoritesCount}
                </span>
              ) : null}
            </NavLink>
            <NavLink to="/cart" className="header-icon-button" aria-label="Корзина">
              <ShoppingBag size={18} />
              {cartCount > 0 ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-black">
                  {cartCount}
                </span>
              ) : null}
            </NavLink>
            <button type="button" className="header-icon-button" aria-label="Профиль">
              <User size={18} />
            </button>
            <NavLink
              to="/support"
              className="header-icon-button hidden sm:inline-flex"
              aria-label="Поддержка"
            >
              <LifeBuoy size={18} />
            </NavLink>
          </div>
        </div>
      </header>

      <main className="pt-6">
        <Outlet />
      </main>
    </div>
  )
}
