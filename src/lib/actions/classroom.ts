"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { canAccessLesson } from "@/lib/course-access";
import {
  recordClassroomAttempt,
  recordClassroomPosition,
} from "@/lib/classroom-progress";
import { parseLessonContent } from "@/lib/lesson-content";
import {
  IdSchema,
  parse,
  requireAdmin,
  requireUser,
} from "@/lib/server-guard";

const PhaseSchema = z.enum(["theory", "tasks", "bonus"]);
const SectionSchema = z.enum(["core", "bonus"]);
const QuestionIndexSchema = z.number().int().min(0).max(49);

export async function startClassSession(formData: FormData): Promise<void> {
  await requireAdmin();
  const groupId = parse(
    z.coerce.number().pipe(IdSchema),
    formData.get("groupId"),
  );
  const lessonId = parse(
    z.coerce.number().pipe(IdSchema),
    formData.get("lessonId"),
  );

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      isPublished: true,
      groupRestrictions: { select: { groupId: true } },
      category: {
        select: {
          isPublished: true,
          groupAccess: { select: { groupId: true } },
        },
      },
    },
  });
  if (!lesson?.isPublished || !lesson.category.isPublished) {
    throw new Error("Сначала опубликуйте курс и урок");
  }
  const courseGroups = new Set(
    lesson.category.groupAccess.map((item) => item.groupId),
  );
  const restrictedGroups = new Set(
    lesson.groupRestrictions.map((item) => item.groupId),
  );
  if (
    !courseGroups.has(groupId) ||
    (restrictedGroups.size > 0 && !restrictedGroups.has(groupId))
  ) {
    throw new Error("Урок не назначен выбранной группе");
  }

  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    await tx.classSession.updateMany({
      where: { groupId, endedAt: null },
      data: { endedAt: now },
    });
    return tx.classSession.create({
      data: { groupId, lessonId },
      select: { id: true },
    });
  });

  redirect(`/admin/activity?sessionId=${created.id}`);
}

export async function endClassSession(formData: FormData): Promise<void> {
  await requireAdmin();
  const sessionId = parse(
    z.coerce.number().pipe(IdSchema),
    formData.get("sessionId"),
  );
  await prisma.classSession.updateMany({
    where: { id: sessionId, endedAt: null },
    data: { endedAt: new Date() },
  });
  redirect("/admin/activity");
}

/** Heartbeat позиции ученика. Не создаёт данные, если активного занятия нет. */
export async function reportLessonPosition(
  lessonId: number,
  phase: "theory" | "tasks" | "bonus",
  questionIndex: number,
): Promise<void> {
  const userId = await requireUser();
  lessonId = parse(IdSchema, lessonId);
  phase = parse(PhaseSchema, phase);
  questionIndex = parse(QuestionIndexSchema, questionIndex);
  if (!(await canAccessLesson(userId, lessonId))) return;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { content: true },
  });
  if (!lesson) return;
  const content = parseLessonContent(lesson.content);

  await recordClassroomPosition({
    userId,
    lessonId,
    phase,
    questionIndex,
    totalQuestions: content.questions.length,
    bonusTotalQuestions: content.bonusQuestions.length,
  });
}

/** Телеметрия проверки кодового задания, которое выполняется в браузере. */
export async function recordCodeAttempt(
  lessonId: number,
  section: "core" | "bonus",
  questionIndex: number,
  correct: boolean,
): Promise<void> {
  const userId = await requireUser();
  lessonId = parse(IdSchema, lessonId);
  section = parse(SectionSchema, section);
  questionIndex = parse(QuestionIndexSchema, questionIndex);
  correct = parse(z.boolean(), correct);
  if (!(await canAccessLesson(userId, lessonId))) return;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { content: true },
  });
  if (!lesson) return;
  const content = parseLessonContent(lesson.content);
  const questions =
    section === "bonus" ? content.bonusQuestions : content.questions;
  if (questions[questionIndex]?.type !== "code") return;

  await Promise.all([
    recordClassroomAttempt({
      userId,
      lessonId,
      phase: section === "bonus" ? "bonus" : "tasks",
      questionIndex,
      totalQuestions: content.questions.length,
      bonusTotalQuestions: content.bonusQuestions.length,
      section,
      correct,
    }),
    ...(!correct && section === "core"
      ? [
          prisma.userLessonProgress.upsert({
            where: { userId_lessonId: { userId, lessonId } },
            create: {
              userId,
              lessonId,
              totalQuestions: content.questions.length,
              wrongAttempts: 1,
            },
            update: { wrongAttempts: { increment: 1 } },
          }),
        ]
      : []),
  ]);
}
