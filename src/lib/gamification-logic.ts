// Чистая логика геймификации — без БД, без побочных эффектов, без "use server".
// Вынесена сюда из gamification.ts, чтобы её можно было покрыть юнит-тестами
// (файл с "use server" разрешает экспортировать только async-функции).
// Server action gamification.ts импортирует эти функции и применяет их к БД.

export const XP_PER_LEVEL = 100;

/** Уровень ученика из общего опыта. Уровень 1 — стартовый (0..99 XP). */
export function calculateLevel(totalXp: number): number {
  return Math.floor(totalXp / XP_PER_LEVEL) + 1;
}

// Кол-во полных календарных дней между двумя датами (UTC),
// чтобы расчёт стрика не зависел от часового пояса сервера.
export function fullDaysBetween(from: Date, to: Date): number {
  const fromDay = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const toDay = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((toDay - fromDay) / 86_400_000);
}

/**
 * Новое значение стрика после активности «сегодня» (now).
 * - первая активность вообще → 1;
 * - тот же день → стрик не меняется;
 * - следующий день → +1;
 * - пропуск (≥2 дня) → перезапуск в 1 (ученик-таки позанимался сегодня).
 */
export function nextStreak(
  lastActiveDate: Date | null,
  currentStreak: number,
  now: Date,
): number {
  if (lastActiveDate === null) return 1;

  const diff = fullDaysBetween(lastActiveDate, now);
  if (diff === 0) return currentStreak;
  if (diff === 1) return currentStreak + 1;
  return 1;
}

type LessonContent = {
  questions?: unknown[];
};

/** Сколько вопросов в JSON-контенте урока. Кривой JSON → 0 (без падения). */
export function countQuestions(content: string): number {
  try {
    const parsed = JSON.parse(content) as LessonContent;
    return Array.isArray(parsed.questions) ? parsed.questions.length : 0;
  } catch {
    return 0;
  }
}
