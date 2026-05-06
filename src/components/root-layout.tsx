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
    <div className="min-h-screen pb-24 text-silver-300 lg:pb-10">
      <header className="page-shell sticky top-0 z-50 pt-2 sm:pt-4">
        <div className="header-shell grid gap-3 rounded-[24px] border border-white/10 px-3 py-3 sm:rounded-[30px] sm:px-6 sm:py-4 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <div className="flex items-center justify-between gap-4">
            <NavLink to="/" className="group inline-flex cursor-pointer items-center gap-3.5">
              <div className="header-brand-mark flex h-10 w-10 items-center justify-center rounded-[15px] border border-white/12 transition group-hover:border-white/22 sm:h-12 sm:w-12 sm:rounded-[18px]">
                <img src={avpIconUrl} alt="AVP Seller" className="h-7 w-7 object-contain sm:h-8 sm:w-8" />
              </div>
              <div>
                <div className="font-display text-base leading-none tracking-[0.13em] text-sheen sm:text-xl sm:tracking-[0.16em]">
                  AVP SELLER
                </div>
                <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/42 sm:text-[11px] sm:tracking-[0.2em]">
                  Game market
                </div>
              </div>
            </NavLink>
            <div className="lg:hidden">
              <RegionSwitch compact />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <nav className="hidden min-w-0 gap-2 text-sm text-white/72 lg:flex">
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

            <label className="header-search flex min-w-0 items-center gap-2 rounded-full border border-white/10 px-3 py-2.5 text-sm text-white/52 transition duration-300 ease-out focus-within:border-white/20 sm:gap-3 sm:px-4 sm:py-3 lg:max-w-[380px] lg:flex-1">
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

          <div className="hidden items-center justify-between gap-1.5 sm:justify-end sm:gap-2 lg:flex">
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

      <main className="pt-3 sm:pt-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 rounded-[24px] border border-white/10 bg-[#171719]/95 px-2 py-2 shadow-[0_18px_50px_rgba(0,0,0,.55)] backdrop-blur-2xl lg:hidden">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={`flex min-h-12 flex-col items-center justify-center rounded-[18px] px-1 text-[10px] font-medium transition ${
              isNavigationActive(item.active) ? 'bg-white text-black' : 'text-white/64'
            }`}
          >
            {item.label}
          </NavLink>
        ))}
        <NavLink
          to="/favorites"
          className={({ isActive }) => `relative flex min-h-12 flex-col items-center justify-center rounded-[18px] px-1 text-[10px] font-medium transition ${isActive ? 'bg-white text-black' : 'text-white/64'}`}
        >
          <Heart size={18} />
          <span>Избранное</span>
          {favoritesCount > 0 ? (
            <span className="absolute right-2 top-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold text-black">
              {favoritesCount}
            </span>
          ) : null}
        </NavLink>
        <NavLink
          to="/cart"
          className={({ isActive }) => `relative flex min-h-12 flex-col items-center justify-center rounded-[18px] px-1 text-[10px] font-medium transition ${isActive ? 'bg-white text-black' : 'text-white/64'}`}
        >
          <ShoppingBag size={18} />
          <span>Корзина</span>
          {cartCount > 0 ? (
            <span className="absolute right-2 top-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold text-black">
              {cartCount}
            </span>
          ) : null}
        </NavLink>
      </nav>
    </div>
  )
}
