import "server-only";

import type {
  ClassSessionPhase,
  LessonTaskSection,
} from "@/generated/prisma";
import { prisma } from "@/lib/db";

type PositionInput = {
  userId: string;
  lessonId: number;
  phase: ClassSessionPhase;
  questionIndex: number;
  totalQuestions: number;
  bonusTotalQuestions: number;
};

type AttemptInput = PositionInput & {
  section: LessonTaskSection;
  correct: boolean;
};

async function findActiveSession(userId: string, lessonId: number) {
  return prisma.classSession.findFirst({
    where: {
      lessonId,
      endedAt: null,
      group: { students: { some: { id: userId, isAdmin: false } } },
    },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
}

/** Обновляет только текущую позицию. Вызывается при смене экрана и heartbeat. */
export async function recordClassroomPosition({
  userId,
  lessonId,
  phase,
  questionIndex,
  totalQuestions,
  bonusTotalQuestions,
}: PositionInput): Promise<void> {
  const session = await findActiveSession(userId, lessonId);
  if (!session) return;

  const now = new Date();
  await prisma.sessionStudentProgress.upsert({
    where: {
      sessionId_userId: { sessionId: session.id, userId },
    },
    create: {
      sessionId: session.id,
      userId,
      phase,
      currentQuestionIndex: questionIndex,
      totalQuestions,
      bonusTotalQuestions,
      lastActivityAt: now,
    },
    update: {
      phase,
      currentQuestionIndex: questionIndex,
      totalQuestions,
      bonusTotalQuestions,
      lastActivityAt: now,
    },
  });
}

/**
 * Фиксирует результат одной проверки. Сохраняются только счётчики и номер
 * задачи — ответ ученика и его исходный код в аналитику не попадают.
 */
export async function recordClassroomAttempt({
  userId,
  lessonId,
  phase,
  questionIndex,
  totalQuestions,
  bonusTotalQuestions,
  section,
  correct,
}: AttemptInput): Promise<void> {
  const session = await findActiveSession(userId, lessonId);
  if (!session) return;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const key = {
      sessionId: session.id,
      userId,
      section,
      questionIndex,
    };
    const previous = await tx.sessionQuestionProgress.findUnique({
      where: { sessionId_userId_section_questionIndex: key },
      select: { isSolved: true },
    });
    const countWrong = !correct && !previous?.isSolved;

    await tx.sessionQuestionProgress.upsert({
      where: { sessionId_userId_section_questionIndex: key },
      create: {
        ...key,
        wrongAttempts: countWrong ? 1 : 0,
        isSolved: correct,
      },
      update: correct
        ? { isSolved: true }
        : countWrong
          ? { wrongAttempts: { increment: 1 } }
          : {},
    });

    const solvedCount = await tx.sessionQuestionProgress.count({
      where: {
        sessionId: session.id,
        userId,
        section,
        isSolved: true,
      },
    });
    const coreCompleted =
      section === "core" &&
      totalQuestions > 0 &&
      solvedCount >= totalQuestions;

    await tx.sessionStudentProgress.upsert({
      where: {
        sessionId_userId: { sessionId: session.id, userId },
      },
      create: {
        sessionId: session.id,
        userId,
        phase: coreCompleted ? "completed" : phase,
        currentQuestionIndex: questionIndex,
        answeredCount: section === "core" ? solvedCount : 0,
        totalQuestions,
        bonusAnsweredCount: section === "bonus" ? solvedCount : 0,
        bonusTotalQuestions,
        wrongAttempts: countWrong ? 1 : 0,
        lastActivityAt: now,
        completedAt: coreCompleted ? now : null,
      },
      update: {
        phase: coreCompleted ? "completed" : phase,
        currentQuestionIndex: questionIndex,
        ...(section === "core"
          ? { answeredCount: solvedCount }
          : { bonusAnsweredCount: solvedCount }),
        totalQuestions,
        bonusTotalQuestions,
        ...(countWrong
          ? { wrongAttempts: { increment: 1 } }
          : {}),
        lastActivityAt: now,
        ...(coreCompleted ? { completedAt: now } : {}),
      },
    });
  });
}

/** Нужен для уроков без обязательных задач и как финальная страховка. */
export async function markClassroomLessonCompleted({
  userId,
  lessonId,
  totalQuestions,
  bonusTotalQuestions,
}: Omit<PositionInput, "phase" | "questionIndex">): Promise<void> {
  const session = await findActiveSession(userId, lessonId);
  if (!session) return;

  const now = new Date();
  await prisma.sessionStudentProgress.upsert({
    where: {
      sessionId_userId: { sessionId: session.id, userId },
    },
    create: {
      sessionId: session.id,
      userId,
      phase: "completed",
      currentQuestionIndex: Math.max(0, totalQuestions - 1),
      answeredCount: totalQuestions,
      totalQuestions,
      bonusTotalQuestions,
      lastActivityAt: now,
      completedAt: now,
    },
    update: {
      phase: "completed",
      currentQuestionIndex: Math.max(0, totalQuestions - 1),
      answeredCount: totalQuestions,
      totalQuestions,
      bonusTotalQuestions,
      lastActivityAt: now,
      completedAt: now,
    },
  });
}
