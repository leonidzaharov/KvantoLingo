import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseLessonContent } from "@/lib/lesson-content";

import { QuestRunner } from "./QuestRunner";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LessonPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  const userId = session.user.id;

  const { id } = await params;
  const lessonId = Number.parseInt(id, 10);
  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    notFound();
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, title: true, content: true },
  });
  if (!lesson) {
    notFound();
  }

  // Разбор и валидация контента (теория + задания) — в общем модуле,
  // тем же zod-описанием, каким админка его сохраняет.
  const parsed = parseLessonContent(lesson.content);

  // Первое попадание на урок создаёт строку прогресса → на /learn урок
  // становится «текущим». alreadyCompleted различает зачёт и тренировку.
  const progress = await prisma.userLessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, totalQuestions: parsed.questions.length },
    update: { totalQuestions: parsed.questions.length },
  });

  return (
    <QuestRunner
      lessonId={lesson.id}
      title={lesson.title}
      content={parsed}
      alreadyCompleted={progress.isCompleted}
    />
  );
}
