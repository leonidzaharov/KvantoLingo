"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { LessonContentSchema } from "@/lib/lesson-content";
import { IdSchema, parse, requireAdmin } from "@/lib/server-guard";

export type LessonFormState = { error: string } | null;

const LessonFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Название не может быть пустым")
    .max(200, "Название длиннее 200 символов"),
  categoryId: z.coerce.number().pipe(IdSchema),
  xpReward: z.coerce.number().int().min(0).max(1000),
  coinReward: z.coerce.number().int().min(0).max(1000),
  sortOrder: z.coerce.number().int().min(0).max(100000),
});

function revalidateLessonPages() {
  revalidatePath("/learn");
  revalidatePath("/courses");
  revalidatePath("/admin/lessons");
}

/**
 * Создать или обновить урок (одна форма на оба случая: скрытое поле id
 * пустое → create). Контент приходит из конструктора формой в скрытом
 * поле contentJson и валидируется тем же zod-описанием, каким страница
 * урока его читает. Только для админа.
 */
export async function saveLesson(
  _prev: LessonFormState,
  formData: FormData,
): Promise<LessonFormState> {
  await requireAdmin();

  const fields = LessonFieldsSchema.safeParse({
    title: formData.get("title"),
    categoryId: formData.get("categoryId"),
    xpReward: formData.get("xpReward"),
    coinReward: formData.get("coinReward"),
    sortOrder: formData.get("sortOrder"),
  });
  if (!fields.success) {
    return {
      error: fields.error.issues[0]?.message ?? "Проверь поля формы",
    };
  }

  let contentParsed;
  try {
    contentParsed = LessonContentSchema.safeParse(
      JSON.parse(String(formData.get("contentJson") ?? "")),
    );
  } catch {
    return { error: "Контент урока повреждён — обнови страницу" };
  }
  if (!contentParsed.success) {
    return {
      error:
        "Проверь вопросы: " +
        (contentParsed.error.issues[0]?.message ?? "некорректный формат"),
    };
  }
  const content = contentParsed.data;
  if (content.questions.length === 0 && content.theory.trim() === "") {
    return { error: "Урок пустой: добавь теорию или хотя бы один вопрос" };
  }

  const rawId = String(formData.get("id") ?? "").trim();
  const id = rawId === "" ? null : parse(IdSchema, Number(rawId));
  const { sortOrder, categoryId } = fields.data;

  const data = {
    ...fields.data,
    content: JSON.stringify(content),
  };

  // Автосдвиг порядка ВНУТРИ категории (как у материалов «Интересного»):
  // если номер занят другим уроком, он и все после него съезжают на +1.
  const occupied = await prisma.lesson.findFirst({
    where: {
      categoryId,
      sortOrder,
      ...(id !== null && { NOT: { id } }),
    },
    select: { id: true },
  });

  const shift = occupied
    ? [
        prisma.lesson.updateMany({
          where: {
            categoryId,
            sortOrder: { gte: sortOrder },
            ...(id !== null && { NOT: { id } }),
          },
          data: { sortOrder: { increment: 1 } },
        }),
      ]
    : [];

  const write =
    id === null
      ? prisma.lesson.create({ data })
      : prisma.lesson.update({ where: { id }, data });

  await prisma.$transaction([...shift, write]);

  revalidateLessonPages();
  redirect("/admin/lessons");
}

/**
 * Удалить урок вместе с прогрессом учеников по нему (иначе FK не даст).
 * Кнопка в списке предупреждает наставника об этом через confirm.
 */
export async function deleteLesson(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = parse(z.coerce.number().pipe(IdSchema), formData.get("id"));

  await prisma.$transaction([
    prisma.userLessonProgress.deleteMany({ where: { lessonId: id } }),
    prisma.lesson.delete({ where: { id } }),
  ]);

  revalidateLessonPages();
}
