"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { parseLessonContent } from "@/lib/lesson-content";
import {
  advanceAchievements,
  type UnlockedAchievement,
} from "@/lib/achievements";
import { computeLessonRewards } from "@/lib/achievements-logic";
import { IdSchema, parse, requireUser } from "@/lib/server-guard";
import { calculateLevel, countQuestions } from "@/lib/gamification-logic";

export type CompleteLessonResult = {
  gainedXp: number;
  /** Монет начислено этим прохождением (0 при повторе). Тратятся офлайн. */
  gainedCoins: number;
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
  opts?: { perfect?: boolean },
): Promise<CompleteLessonResult> {
  const userId = await requireUser();
  lessonId = parse(IdSchema, lessonId);
  // Клиентский флаг «прошёл без единой ошибки» — как и весь ход урока,
  // доверяем клиенту (школьный проект). Строгое === true отсекает мусор.
  const perfect = opts?.perfect === true;

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

  const now = new Date();

  // Награды считает чистая функция (achievements-logic.ts, покрыта тестами):
  // XP и монеты платим только за первое прохождение — иначе бесконечный фарм.
  // lastActiveDate обновляем всегда: ученик-таки занимался сегодня.
  const {
    firstCompletion,
    gainedXp,
    gainedCoins,
    newTotalXp,
    newLevel,
    leveledUp,
  } = computeLessonRewards(
    lesson,
    user,
    existingProgress?.isCompleted ?? false,
    calculateLevel,
  );

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
        // increment, а не абсолютное значение: ачивки ниже тоже начисляют
        // монеты инкрементом — так никто ничьё начисление не затрёт.
        currency: { increment: gainedCoins },
        lastActiveDate: now,
      },
    }),
  ]);

  // Метрики считаем прямо после транзакции — счётчики уже учитывают только
  // что завершённый урок. На повторных прохождениях значения не изменятся —
  // set-логика движка (max) не уронит накопленный прогресс.
  const [completedLessons, categoryCompletedLessons] = await Promise.all([
    prisma.userLessonProgress.count({
      where: { userId, isCompleted: true },
    }),
    prisma.userLessonProgress.count({
      where: {
        userId,
        isCompleted: true,
        lesson: { categoryId: lesson.category.id },
      },
    }),
  ]);

  const unlockedAchievements = await advanceAchievements(userId, {
    completedLessons,
    level: updated.level,
    categoryId: lesson.category.id,
    categoryCompletedLessons,
    // Перфект засчитываем только при первом прохождении — иначе фарм
    // «пересдачами» уже выученного урока.
    perfectDelta: firstCompletion && perfect ? 1 : 0,
  });

  revalidatePath("/learn");
  revalidatePath(`/lesson/${lessonId}`);

  return {
    gainedXp,
    gainedCoins,
    totalXp: updated.totalXp,
    level: updated.level,
    leveledUp,
    lastActiveDate: updated.lastActiveDate ?? now,
    firstCompletion,
    unlockedAchievements,
  };
}

/**
 * Проверяет ответ на вопрос с вариантами. Правильный индекс живёт ТОЛЬКО
 * здесь, на сервере: в браузер уходит контент без ответов (см.
 * sanitizeLessonContent), поэтому подсмотреть их через F12 больше нельзя.
 */
export async function checkAnswer(
  lessonId: number,
  questionIndex: number,
  optionIndex: number,
): Promise<boolean> {
  await requireUser();
  lessonId = parse(IdSchema, lessonId);
  questionIndex = parse(z.number().int().min(0).max(49), questionIndex);
  optionIndex = parse(z.number().int().min(0).max(7), optionIndex);

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { content: true },
  });
  if (!lesson) return false;

  const question = parseLessonContent(lesson.content).questions[questionIndex];
  if (!question || question.type === "code") return false;

  return question.correctIndex === optionIndex;
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
