"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import {
  ACHIEVEMENT_CODES,
  CATEGORY_ACHIEVEMENT,
  bumpAchievement,
  setAchievementProgress,
  type UnlockedAchievement,
} from "@/lib/achievements";
import { IdSchema, parse, requireUser } from "@/lib/server-guard";
import { calculateLevel, countQuestions } from "@/lib/gamification-logic";

export type CompleteLessonResult = {
  gainedXp: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  lastActiveDate: Date;
  /** true, если урок засчитан впервые (XP начислен), false — повтор. */
  firstCompletion: boolean;
  /** Достижения, разблокированные ИМЕННО этим завершением (для тоста). */
  unlockedAchievements: UnlockedAchievement[];
};

export async function completeLesson(
  lessonId: number,
): Promise<CompleteLessonResult> {
  const userId = await requireUser();
  lessonId = parse(IdSchema, lessonId);

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!lesson) {
    throw new Error(`Урок ${lessonId} не найден`);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error(`Пользователь ${userId} не найден`);
  }

  const existingProgress = await prisma.userLessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });

  const firstCompletion = !existingProgress?.isCompleted;
  const now = new Date();
  const oldLevel = user.level;

  // XP начисляем только при первом прохождении — иначе бесконечный фарм.
  // lastActiveDate обновляем всегда: ученик-таки занимался сегодня.
  const gainedXp = firstCompletion ? lesson.xpReward : 0;
  const newTotalXp = user.totalXp + gainedXp;
  const newLevel = calculateLevel(newTotalXp);

  const totalQuestions = countQuestions(lesson.content);

  const [, updated] = await prisma.$transaction([
    prisma.userLessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        answeredCount: totalQuestions,
        totalQuestions,
        isCompleted: true,
        completedAt: now,
      },
      update: {
        answeredCount: totalQuestions,
        totalQuestions,
        isCompleted: true,
        // completedAt выставляем только при первом завершении.
        ...(firstCompletion ? { completedAt: now } : {}),
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        totalXp: newTotalXp,
        level: newLevel,
        lastActiveDate: now,
      },
    }),
  ]);

  // Все правила вызываем последовательно — каждое возвращает карточку или
  // null, если ИМЕННО этот вызов его разблокировал. Идемпотентно: повторные
  // прохождения и одинаковые значения не «перевыдадут» уже открытое.
  // Сериализуем (не Promise.all), чтобы избежать гонок при одновременных
  // increment user.currency из разных bump'ов.
  const unlockedAchievements: UnlockedAchievement[] = [];
  const collect = (a: UnlockedAchievement | null) => {
    if (a) unlockedAchievements.push(a);
  };

  if (firstCompletion) {
    collect(await bumpAchievement(userId, ACHIEVEMENT_CODES.FIRST_LESSON));
  }

  // Считаем уроки прямо после транзакции — счётчик уже учитывает только что
  // завершённый. На повторных прохождениях значение не изменится — set-логика
  // в setAchievementProgress (max) не уронит прогресс.
  const completedLessons = await prisma.userLessonProgress.count({
    where: { userId, isCompleted: true },
  });

  collect(
    await setAchievementProgress(
      userId,
      ACHIEVEMENT_CODES.LESSONS_5,
      completedLessons,
    ),
  );
  collect(
    await setAchievementProgress(
      userId,
      ACHIEVEMENT_CODES.LESSONS_15,
      completedLessons,
    ),
  );
  collect(
    await setAchievementProgress(
      userId,
      ACHIEVEMENT_CODES.LEVEL_3,
      updated.level,
    ),
  );
  collect(
    await setAchievementProgress(
      userId,
      ACHIEVEMENT_CODES.LEVEL_6,
      updated.level,
    ),
  );
  // Категорийные ачивки: считаем уроки конкретной категории и ставим
  // как snapshot (set, а не bump) — повторное прохождение не сдвинет счётчик,
  // удаление урока из каталога мягко уменьшит локальный счёт, но накопленный
  // прогресс ачивки уже зафиксирован max'ом и не упадёт.
  const categoryCode = CATEGORY_ACHIEVEMENT[lesson.category.name];
  if (categoryCode) {
    const categoryCompleted = await prisma.userLessonProgress.count({
      where: {
        userId,
        isCompleted: true,
        lesson: { categoryId: lesson.category.id },
      },
    });
    collect(
      await setAchievementProgress(userId, categoryCode, categoryCompleted),
    );
  }

  revalidatePath("/learn");
  revalidatePath(`/lesson/${lessonId}`);

  return {
    gainedXp,
    totalXp: updated.totalXp,
    level: updated.level,
    leveledUp: updated.level > oldLevel,
    lastActiveDate: updated.lastActiveDate ?? now,
    firstCompletion,
    unlockedAchievements,
  };
}

/**
 * Засчитывает один правильный ответ — увеличивает счётчик,
 * но не выше totalQuestions. Используется QuestRunner для
 * пошагового прогресса в реальном времени.
 */
export async function recordCorrectAnswer(lessonId: number): Promise<void> {
  const userId = await requireUser();
  lessonId = parse(IdSchema, lessonId);

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return;

  const totalQuestions = countQuestions(lesson.content);
  if (totalQuestions === 0) return;

  const existing = await prisma.userLessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });

  // После первого прохождения счётчик уже на максимуме — не трогаем.
  if (existing?.isCompleted) return;

  const next = Math.min(totalQuestions, (existing?.answeredCount ?? 0) + 1);

  await prisma.userLessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      answeredCount: next,
      totalQuestions,
    },
    update: {
      answeredCount: next,
      totalQuestions,
    },
  });

  revalidatePath("/learn");
}
