import { useAppState } from '../../store/use-app-state'
import type { Region } from '../../types'

const regions: Region[] = ['Turkey', 'India']

export function RegionSwitch({ compact = false }: { compact?: boolean }) {
  const { region, setRegion } = useAppState()

  return (
    <div
      className={`inline-flex rounded-full border border-white/10 bg-white/6 p-1 ${
        compact ? 'text-xs' : 'text-sm'
      }`}
    >
      {regions.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setRegion(item)}
          className={`cursor-pointer rounded-full px-4 py-2 transition ${
            region === item ? 'bg-white text-black' : 'text-white/65 hover:text-white'
          }`}
        >
          {item === 'Turkey' ? 'Турция' : 'Индия'}
        </button>
      ))}
    </div>
  )
}
