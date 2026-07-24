"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { IdSchema, parse, requireAdmin } from "@/lib/server-guard";

export type CategoryFormState = { error: string } | null;

const CategoryFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Название не может быть пустым")
    .max(100, "Название длиннее 100 символов"),
  // Эмодзи-иконка на карточке курса; пустое поле = дефолтная 📚.
  icon: z.string().trim().max(16, "Иконка — это 1–2 эмодзи").optional(),
  track: z.enum(["intro", "advanced", "project"]),
});

function revalidateCategoryPages() {
  revalidatePath("/courses");
  revalidatePath("/learn");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/lessons");
}

/**
 * Создать или обновить курс-модуль (одна форма на оба случая, как у уроков:
 * скрытое поле id пустое → create). Только для наставника.
 */
export async function saveCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();

  const fields = CategoryFieldsSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon"),
    track: formData.get("track"),
  });
  if (!fields.success) {
    return {
      error: fields.error.issues[0]?.message ?? "Проверь поля формы",
    };
  }

  const rawId = String(formData.get("id") ?? "").trim();
  const id = rawId === "" ? null : parse(IdSchema, Number(rawId));

  const data = {
    name: fields.data.name,
    icon: fields.data.icon || null,
    track: fields.data.track,
  };

  if (id === null) {
    const created = await prisma.category.create({ data });
    revalidateCategoryPages();
    redirect(`/admin/categories/${created.id}`);
  } else {
    await prisma.$transaction([
      prisma.category.update({ where: { id }, data }),
      prisma.categoryGroupAssignment.deleteMany({
        where: { categoryId: id, group: { track: { not: data.track } } },
      }),
      prisma.lessonGroupAssignment.deleteMany({
        where: {
          lesson: { categoryId: id },
          group: { track: { not: data.track } },
        },
      }),
    ]);
  }

  revalidateCategoryPages();
  redirect("/admin/categories");
}

/** Удалить курс, его уроки и прогресс по этим урокам одной транзакцией. */
export async function deleteCategory(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = parse(z.coerce.number().pipe(IdSchema), formData.get("id"));

  await prisma.$transaction([
    prisma.userLessonProgress.deleteMany({
      where: { lesson: { categoryId: id } },
    }),
    prisma.lesson.deleteMany({ where: { categoryId: id } }),
    prisma.category.delete({ where: { id } }),
  ]);
  revalidateCategoryPages();
}
