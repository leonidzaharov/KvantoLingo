import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { parseLessonContent } from "@/lib/lesson-content";
import { requireAdminOr404 } from "@/lib/server-guard";

import { LessonForm } from "../lesson-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditLessonPage({ params }: PageProps) {
  await requireAdminOr404();

  const { id } = await params;
  const lessonId = Number.parseInt(id, 10);
  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    notFound();
  }

  const [lesson, categories] = await Promise.all([
    prisma.lesson.findUnique({ where: { id: lessonId } }),
    prisma.category.findMany({
      orderBy: { id: "asc" },
      include: {
        lessons: {
          orderBy: { sortOrder: "desc" },
          take: 1,
          select: { sortOrder: true },
        },
      },
    }),
  ]);
  if (!lesson) {
    notFound();
  }

  return (
    <div className="px-3">
      <div className="mx-auto flex w-full max-w-[720px] flex-col">
        <h1 className="my-6 text-2xl font-bold text-neutral-700">
          Урок · {lesson.title}
        </h1>
        <LessonForm
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            nextSortOrder: (c.lessons[0]?.sortOrder ?? -1) + 1,
          }))}
          lesson={{
            id: lesson.id,
            title: lesson.title,
            categoryId: lesson.categoryId,
            xpReward: lesson.xpReward,
            coinReward: lesson.coinReward,
            sortOrder: lesson.sortOrder,
            content: parseLessonContent(lesson.content),
          }}
        />
      </div>
    </div>
  );
}
