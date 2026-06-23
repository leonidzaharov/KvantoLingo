import { prisma } from "@/lib/db";

/**
 * Стабильные коды достижений. Используются в коде приложения как ссылка
 * на запись в таблице Achievement (через поле `code`). Никогда не меняем
 * существующее значение — иначе разорвём прогресс уже выданных юзерам ачивок.
 */
export const ACHIEVEMENT_CODES = {
  FIRST_LESSON: "first_lesson",
  LESSONS_5: "lessons_5",
  LESSONS_15: "lessons_15",
  LEVEL_3: "level_3",
  LEVEL_6: "level_6",
  STREAK_3: "streak_3",
  STREAK_7: "streak_7",
  FIRST_PURCHASE: "first_purchase",
  FULL_OUTFIT: "full_outfit",
  SCRATCH_DONE: "scratch_done",
  HTML_DONE: "html_done",
  JS_DONE: "js_done",
} as const;

/**
 * Соответствие name категории из БД → код ачивки за полное прохождение
 * этой категории. completeLesson по этой мапе понимает, какую категорийную
 * ачивку бампать после завершения урока. Если категории нет в мапе —
 * просто пропускаем (нейтрально к новым категориям).
 */
export const CATEGORY_ACHIEVEMENT: Record<string, AchievementCode> = {
  Scratch: ACHIEVEMENT_CODES.SCRATCH_DONE,
  HTML: ACHIEVEMENT_CODES.HTML_DONE,
  JavaScript: ACHIEVEMENT_CODES.JS_DONE,
};

export type AchievementCode =
  (typeof ACHIEVEMENT_CODES)[keyof typeof ACHIEVEMENT_CODES];

/**
 * Сериализуемая «карточка» достижения для клиента — то, что показывает
 * тост. Никаких prisma-типов: только примитивы, чтобы безопасно лететь
 * через границу server action → client.
 */
export type UnlockedAchievement = {
  code: string;
  title: string;
  description: string;
  icon: string | null;
  rewardCurrency: number;
};

export type AchievementDefinition = {
  code: AchievementCode;
  title: string;
  description: string;
  icon: string | null;
  /** При достижении progress >= targetValue достижение считается разблокированным. */
  targetValue: number;
  /** Сколько монет начислить юзеру при разблокировке. 0 — без награды. */
  rewardCurrency: number;
};

// Порядок ключей задаёт порядок отображения в Трофейной комнате —
// сверху-слева ранние/лёгкие, ниже — длинные и поздние.
const REGISTRY: Record<AchievementCode, AchievementDefinition> = {
  [ACHIEVEMENT_CODES.FIRST_LESSON]: {
    code: ACHIEVEMENT_CODES.FIRST_LESSON,
    title: "Первый урок завершён",
    description: "Закрыл свой первый квест в Цитадели.",
    icon: null,
    targetValue: 1,
    rewardCurrency: 25,
  },
  [ACHIEVEMENT_CODES.LESSONS_5]: {
    code: ACHIEVEMENT_CODES.LESSONS_5,
    title: "Подмастерье",
    description: "Пять уроков пройдено — рука уже не дрожит.",
    icon: null,
    targetValue: 5,
    rewardCurrency: 50,
  },
  [ACHIEVEMENT_CODES.LESSONS_15]: {
    code: ACHIEVEMENT_CODES.LESSONS_15,
    title: "Книжный знаток",
    description: "Пятнадцать свитков покорено.",
    icon: null,
    targetValue: 15,
    rewardCurrency: 100,
  },
  [ACHIEVEMENT_CODES.LEVEL_3]: {
    code: ACHIEVEMENT_CODES.LEVEL_3,
    title: "Третья ступень",
    description: "Достиг уровня 3.",
    icon: null,
    targetValue: 3,
    rewardCurrency: 75,
  },
  [ACHIEVEMENT_CODES.LEVEL_6]: {
    code: ACHIEVEMENT_CODES.LEVEL_6,
    title: "Магистр Цитадели",
    description: "Достиг уровня 6 — финальный ранг курса.",
    icon: null,
    targetValue: 6,
    rewardCurrency: 200,
  },
  [ACHIEVEMENT_CODES.STREAK_3]: {
    code: ACHIEVEMENT_CODES.STREAK_3,
    title: "Утренняя звезда",
    description: "Три дня подряд в Цитадели.",
    icon: null,
    targetValue: 3,
    rewardCurrency: 50,
  },
  [ACHIEVEMENT_CODES.STREAK_7]: {
    code: ACHIEVEMENT_CODES.STREAK_7,
    title: "Неугасимое пламя",
    description: "Семь дней подряд в Цитадели.",
    icon: null,
    targetValue: 7,
    rewardCurrency: 150,
  },
  [ACHIEVEMENT_CODES.FIRST_PURCHASE]: {
    code: ACHIEVEMENT_CODES.FIRST_PURCHASE,
    title: "Первый артефакт",
    description: "Купил предмет в лавке.",
    icon: null,
    targetValue: 1,
    rewardCurrency: 25,
  },
  [ACHIEVEMENT_CODES.FULL_OUTFIT]: {
    code: ACHIEVEMENT_CODES.FULL_OUTFIT,
    title: "Полный облик",
    description: "Снегирь экипирован во все слоты.",
    icon: null,
    targetValue: 1,
    rewardCurrency: 100,
  },
  // Категорийные: разблокируются после прохождения ВСЕХ уроков категории.
  // Целевые значения = плановый размер курса (Scratch 32 + HTML 8 + JS 16).
  // Если контент ещё не залит — ачивка просто капает прогрессом.
  [ACHIEVEMENT_CODES.SCRATCH_DONE]: {
    code: ACHIEVEMENT_CODES.SCRATCH_DONE,
    title: "Архитектор блоков",
    description: "Все уроки Scratch пройдены.",
    icon: null,
    targetValue: 32,
    rewardCurrency: 250,
  },
  [ACHIEVEMENT_CODES.HTML_DONE]: {
    code: ACHIEVEMENT_CODES.HTML_DONE,
    title: "Зодчий разметки",
    description: "Все уроки HTML пройдены.",
    icon: null,
    targetValue: 8,
    rewardCurrency: 200,
  },
  [ACHIEVEMENT_CODES.JS_DONE]: {
    code: ACHIEVEMENT_CODES.JS_DONE,
    title: "Колдун JavaScript",
    description: "Все уроки JavaScript пройдены.",
    icon: null,
    targetValue: 16,
    rewardCurrency: 300,
  },
};

/**
 * Полный список определений достижений в порядке отображения. Используется
 * /achievements (Трофейная комната), чтобы показать в т.ч. ещё не открытые
 * ачивки — данные о прогрессе подмешиваются по `code` из таблицы Achievement.
 */
export const ACHIEVEMENT_LIST: ReadonlyArray<AchievementDefinition> =
  Object.values(REGISTRY);

/**
 * Общий движок применения прогресса. Идемпотентен после разблокировки.
 * `compute` решает, как сложить старое значение с новым: для счётчиков
 * (bumpAchievement) — `existing + delta`, для «не ниже планки»-метрик
 * (setAchievementProgress, например уровень/стрик) — `Math.max(existing, value)`.
 *
 * Возвращает карточку, только если ИМЕННО ЭТОТ вызов разблокировал — иначе null.
 */
async function applyAchievementProgress(
  userId: string,
  code: AchievementCode,
  compute: (existingProgress: number) => number,
): Promise<UnlockedAchievement | null> {
  const def = REGISTRY[code];

  // Регистрируем определение в БД (если ещё не было) и подтягиваем актуальный
  // targetValue/rewardCurrency из реестра — реестр всегда источник истины.
  const achievement = await prisma.achievement.upsert({
    where: { code: def.code },
    create: {
      code: def.code,
      title: def.title,
      description: def.description,
      icon: def.icon,
      targetValue: def.targetValue,
      rewardCurrency: def.rewardCurrency,
    },
    update: {
      title: def.title,
      description: def.description,
      icon: def.icon,
      targetValue: def.targetValue,
      rewardCurrency: def.rewardCurrency,
    },
  });

  return prisma.$transaction(async (tx) => {
    const existing = await tx.userAchievement.findUnique({
      where: {
        userId_achievementId: { userId, achievementId: achievement.id },
      },
    });

    if (existing?.isUnlocked) return null;

    const newProgress = Math.max(
      0,
      Math.min(achievement.targetValue, compute(existing?.progress ?? 0)),
    );
    const willUnlock = newProgress >= achievement.targetValue;
    const now = new Date();

    await tx.userAchievement.upsert({
      where: {
        userId_achievementId: { userId, achievementId: achievement.id },
      },
      create: {
        userId,
        achievementId: achievement.id,
        progress: newProgress,
        isUnlocked: willUnlock,
        unlockedAt: willUnlock ? now : null,
      },
      update: {
        progress: newProgress,
        isUnlocked: willUnlock,
        unlockedAt: willUnlock ? now : null,
      },
    });

    if (!willUnlock) return null;

    if (achievement.rewardCurrency > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { currency: { increment: achievement.rewardCurrency } },
      });
    }

    return {
      code: achievement.code,
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      rewardCurrency: achievement.rewardCurrency,
    };
  });
}

/**
 * Добавляет `delta` к прогрессу достижения для юзера. Идемпотентен после
 * разблокировки. Подходит для счётчиков событий: «купил предмет», «прошёл
 * урок» — тех, где каждый вызов добавляет ровно один шаг.
 */
export function bumpAchievement(
  userId: string,
  code: AchievementCode,
  delta: number = 1,
): Promise<UnlockedAchievement | null> {
  return applyAchievementProgress(userId, code, (existing) => existing + delta);
}

/**
 * Устанавливает прогресс в `value`, но никогда не уменьшает уже накопленное
 * (берёт max). Подходит для метрик с прыжками и откатами: уровень,
 * текущий стрик, количество пройденных уроков (если считаем от снапшота).
 *
 * Пример: стрик упал с 5 до 0 — STREAK_3 уже разблокирован, дальнейшие
 * вызовы не должны его «откатить». Также защищает от того, чтобы
 * новое значение случайно занизило прогресс.
 */
export function setAchievementProgress(
  userId: string,
  code: AchievementCode,
  value: number,
): Promise<UnlockedAchievement | null> {
  return applyAchievementProgress(userId, code, (existing) =>
    Math.max(existing, value),
  );
}
