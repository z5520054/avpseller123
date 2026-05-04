const GENRE_TRANSLATIONS: Record<string, string> = {
  Action: 'Экшен',
  Adult: 'Для взрослых',
  Adventure: 'Приключения',
  Arcade: 'Аркада',
  'Brain Training': 'Тренировка мозга',
  Casual: 'Казуальные',
  'Driving/Racing': 'Гонки',
  Educational: 'Обучающие',
  Family: 'Для всей семьи',
  Fighting: 'Файтинг',
  Fitness: 'Фитнес',
  Horror: 'Хоррор',
  'Music/Rhythm': 'Музыка и ритм',
  Party: 'Для компании',
  Puzzle: 'Головоломки',
  Quiz: 'Викторины',
  'Role Playing Games': 'Ролевые игры',
  Shooter: 'Шутеры',
  Simulation: 'Симуляция',
  Simulator: 'Симулятор',
  Sport: 'Спорт',
  Strategy: 'Стратегия',
  Unique: 'Уникальные',
}

export function translateGenre(genre: string) {
  return GENRE_TRANSLATIONS[genre] ?? genre
}
