"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { IdSchema, parse, requireAdmin } from "@/lib/server-guard";

const IdListSchema = z.array(IdSchema).max(200);

function refreshProgram() {
  revalidatePath("/courses");
  revalidatePath("/learn");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/lessons");
  revalidatePath("/lesson/[id]", "page");
}

export async function toggleCategoryPublication(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const id = parse(z.coerce.number().pipe(IdSchema), formData.get("id"));
  const isPublished = formData.get("isPublished") === "true";
  await prisma.category.update({ where: { id }, data: { isPublished } });
  refreshProgram();
}

export async function toggleLessonPublication(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const id = parse(z.coerce.number().pipe(IdSchema), formData.get("id"));
  const isPublished = formData.get("isPublished") === "true";
  await prisma.lesson.update({ where: { id }, data: { isPublished } });
  refreshProgram();
}

export type AccessFormState = { error?: string; success?: string } | null;

export async function saveCategoryGroups(
  _previous: AccessFormState,
  formData: FormData,
): Promise<AccessFormState> {
  await requireAdmin();
  const categoryId = parse(
    z.coerce.number().pipe(IdSchema),
    formData.get("categoryId"),
  );
  const groupIds = parse(
    IdListSchema,
    formData.getAll("groupId").map(Number),
  );
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { track: true },
  });
  if (!category) return { error: "Курс не найден" };

  const validGroups = await prisma.group.findMany({
    where: { id: { in: groupIds }, track: category.track },
    select: { id: true },
  });
  if (validGroups.length !== groupIds.length) {
    return { error: "Одна из групп не относится к направлению курса" };
  }

  const validIds = validGroups.map((group) => group.id);
  await prisma.$transaction([
    prisma.categoryGroupAssignment.deleteMany({ where: { categoryId } }),
    ...(validIds.length > 0
      ? [
          prisma.categoryGroupAssignment.createMany({
            data: validIds.map((groupId) => ({ categoryId, groupId })),
          }),
        ]
      : []),
    prisma.lessonGroupAssignment.deleteMany({
      where: {
        lesson: { categoryId },
        ...(validIds.length > 0 ? { groupId: { notIn: validIds } } : {}),
      },
    }),
  ]);
  refreshProgram();
  return { success: "Доступ групп сохранён" };
}

export async function saveLessonGroups(
  _previous: AccessFormState,
  formData: FormData,
): Promise<AccessFormState> {
  await requireAdmin();
  const lessonId = parse(
    z.coerce.number().pipe(IdSchema),
    formData.get("lessonId"),
  );
  const restricted = formData.get("restricted") === "true";
  const requestedIds = restricted
    ? parse(IdListSchema, formData.getAll("groupId").map(Number))
    : [];

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      category: {
        select: { groupAccess: { select: { groupId: true } } },
      },
    },
  });
  if (!lesson) return { error: "Урок не найден" };

  const allowedIds = new Set(
    lesson.category.groupAccess.map((item) => item.groupId),
  );
  if (requestedIds.some((id) => !allowedIds.has(id))) {
    return { error: "Урок можно назначить только группам его курса" };
  }
  if (restricted && requestedIds.length === 0) {
    return { error: "Выберите хотя бы одну группу или включите все группы курса" };
  }

  await prisma.$transaction([
    prisma.lessonGroupAssignment.deleteMany({ where: { lessonId } }),
    ...(requestedIds.length > 0
      ? [
          prisma.lessonGroupAssignment.createMany({
            data: requestedIds.map((groupId) => ({ lessonId, groupId })),
          }),
        ]
      : []),
  ]);
  refreshProgram();
  return { success: "Аудитория урока сохранена" };
}

export async function duplicateLesson(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = parse(z.coerce.number().pipe(IdSchema), formData.get("id"));
  const source = await prisma.lesson.findUnique({
    where: { id },
    include: { groupRestrictions: { select: { groupId: true } } },
  });
  if (!source) throw new Error("BAD_REQUEST");

  const copy = await prisma.$transaction(async (tx) => {
    await tx.lesson.updateMany({
      where: {
        categoryId: source.categoryId,
        sortOrder: { gt: source.sortOrder },
      },
      data: { sortOrder: { increment: 1 } },
    });
    return tx.lesson.create({
      data: {
        categoryId: source.categoryId,
        title: `${source.title} — копия`,
        content: source.content,
        xpReward: source.xpReward,
        coinReward: source.coinReward,
        sortOrder: source.sortOrder + 1,
        isPublished: false,
        groupRestrictions: {
          create: source.groupRestrictions.map(({ groupId }) => ({ groupId })),
        },
      },
      select: { id: true },
    });
  });
  refreshProgram();
  redirect(`/admin/lessons/${copy.id}`);
}

export async function duplicateCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = parse(z.coerce.number().pipe(IdSchema), formData.get("id"));
  const source = await prisma.category.findUnique({
    where: { id },
    include: {
      groupAccess: { select: { groupId: true } },
      lessons: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: { groupRestrictions: { select: { groupId: true } } },
      },
    },
  });
  if (!source) throw new Error("BAD_REQUEST");

  const copy = await prisma.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: {
        name: `${source.name} — копия`,
        icon: source.icon,
        track: source.track,
        isPublished: false,
        groupAccess: {
          create: source.groupAccess.map(({ groupId }) => ({ groupId })),
        },
      },
      select: { id: true },
    });
    for (const lesson of source.lessons) {
      await tx.lesson.create({
        data: {
          categoryId: category.id,
          title: lesson.title,
          content: lesson.content,
          xpReward: lesson.xpReward,
          coinReward: lesson.coinReward,
          sortOrder: lesson.sortOrder,
          isPublished: false,
          groupRestrictions: {
            create: lesson.groupRestrictions.map(({ groupId }) => ({ groupId })),
          },
        },
      });
    }
    return category;
  });
  refreshProgram();
  redirect(`/admin/categories/${copy.id}`);
}
