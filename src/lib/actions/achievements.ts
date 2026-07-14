"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { IdSchema, parse, requireAdmin, requireUser } from "@/lib/server-guard";

export type AchievementFormState = { error: string } | null;

const AchievementFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Название не может быть пустым")
    .max(100, "Название длиннее 100 символов"),
  description: z
    .string()
    .trim()
    .min(1, "Описание не может быть пустым")
    .max(300, "Описание длиннее 300 символов"),
  // Эмодзи для карточки и витрины; пустое поле = дефолтный кубок.
  icon: z.string().trim().max(16, "Иконка — это 1–2 эмодзи").optional(),
  metric: z.enum([
    "lessons_completed",
    "category_completed",
    "level_reached",
    "perfect_lessons",
  ]),
  categoryId: z.coerce.number().int().positive().optional(),
  targetValue: z.coerce
    .number()
    .int("Цель — целое число")
    .min(1, "Цель — минимум 1")
    .max(10_000, "Цель слишком большая"),
  rewardCurrency: z.coerce
    .number()
    .int("Награда — целое число")
    .min(0, "Награда не может быть отрицательной")
    .max(10_000, "Награда слишком большая"),
  sortOrder: z.coerce.number().int("Порядок — целое число").default(0),
});

function revalidateAchievementPages() {
  revalidatePath("/achievements");
  revalidatePath("/admin/achievements");
  revalidatePath("/profile");
  revalidatePath("/leaderboard");
}

/**
 * Создать или обновить ачивку (одна форма на оба случая, как у курсов:
 * скрытое поле id пустое → create). Только для наставника.
 */
export async function saveAchievement(
  _prev: AchievementFormState,
  formData: FormData,
): Promise<AchievementFormState> {
  await requireAdmin();

  const fields = AchievementFieldsSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    icon: formData.get("icon"),
    metric: formData.get("metric"),
    categoryId: formData.get("categoryId") || undefined,
    targetValue: formData.get("targetValue") || 1,
    rewardCurrency: formData.get("rewardCurrency") || 0,
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!fields.success) {
    return {
      error: fields.error.issues[0]?.message ?? "Проверь поля формы",
    };
  }

  const isCategoryMetric = fields.data.metric === "category_completed";
  if (isCategoryMetric && !fields.data.categoryId) {
    return { error: "Для ачивки «курс пройден» нужно выбрать курс" };
  }

  const rawId = String(formData.get("id") ?? "").trim();
  const id = rawId === "" ? null : parse(IdSchema, Number(rawId));

  const data = {
    title: fields.data.title,
    description: fields.data.description,
    icon: fields.data.icon || null,
    metric: fields.data.metric,
    // categoryId имеет смысл только для category_completed — остальным чистим.
    categoryId: isCategoryMetric ? fields.data.categoryId! : null,
    // Для category_completed цель считается по живому числу уроков курса,
    // хранимое значение движок игнорирует — держим 1, чтобы не путать.
    targetValue: isCategoryMetric ? 1 : fields.data.targetValue,
    rewardCurrency: fields.data.rewardCurrency,
    isHidden: formData.get("isHidden") === "on",
    isActive: formData.get("isActive") === "on",
    sortOrder: fields.data.sortOrder,
  };

  if (id === null) {
    await prisma.achievement.create({ data });
  } else {
    await prisma.achievement.update({ where: { id }, data });
  }

  revalidateAchievementPages();
  redirect("/admin/achievements");
}

/**
 * Удалить ачивку. Cascade снесёт прогресс учеников по ней, а витрины
 * (showcaseAchievementId) очистятся через SetNull — уже выданные монеты
 * при этом не отбираются.
 */
export async function deleteAchievement(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = parse(z.coerce.number().pipe(IdSchema), formData.get("id"));

  await prisma.achievement.delete({ where: { id } });
  revalidateAchievementPages();
}

/**
 * Ученик выбирает ачивку-витрину — она показывается в профиле и рядом
 * с именем в лидерборде. Пустой id — убрать витрину. Выбрать можно
 * только СВОЮ открытую ачивку.
 */
export async function setShowcaseAchievement(
  formData: FormData,
): Promise<void> {
  const userId = await requireUser();

  const rawId = String(formData.get("achievementId") ?? "").trim();
  const achievementId =
    rawId === "" ? null : parse(z.coerce.number().pipe(IdSchema), rawId);

  if (achievementId !== null) {
    const owned = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId } },
      select: { isUnlocked: true },
    });
    if (!owned?.isUnlocked) {
      throw new Error("BAD_REQUEST");
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { showcaseAchievementId: achievementId },
  });

  revalidatePath("/achievements");
  revalidatePath("/profile");
  revalidatePath("/leaderboard");
}
