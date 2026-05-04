export function CategoryPills({
  values,
  activeValue,
  onChange,
}: {
  values: string[]
  activeValue: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition ${
            activeValue === value
              ? 'border-white/20 bg-white text-black'
              : 'border-white/10 bg-white/4 text-white/64 hover:border-white/16 hover:text-white'
          }`}
        >
          {value}
        </button>
      ))}
    </div>
  )
}
