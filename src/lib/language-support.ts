export type RussianLanguageSupport = 'none' | 'subtitles' | 'full' | 'unknown'

function hasRussian(values: string[]) {
  return values.some((value) => {
    const normalized = value.trim().toLowerCase()
    return normalized === 'ru' || normalized.startsWith('ru_') || normalized.includes('russian') || normalized.includes('рус')
  })
}

export function getRussianLanguageSupport(input: {
  spokenLanguages?: string[] | null
  screenLanguages?: string[] | null
}): RussianLanguageSupport {
  const spoken = input.spokenLanguages ?? []
  const screen = input.screenLanguages ?? []

  if (spoken.length === 0 && screen.length === 0) {
    return 'unknown'
  }

  const hasRussianVoice = hasRussian(spoken)
  const hasRussianScreen = hasRussian(screen)

  if (hasRussianVoice && hasRussianScreen) {
    return 'full'
  }

  if (hasRussianScreen) {
    return 'subtitles'
  }

  return 'none'
}

export function russianLanguageLabel(support: RussianLanguageSupport) {
  switch (support) {
    case 'full':
      return 'Полностью на русском'
    case 'subtitles':
      return 'Русские субтитры'
    case 'none':
      return 'Русский язык: Нет'
    default:
      return null
  }
}
