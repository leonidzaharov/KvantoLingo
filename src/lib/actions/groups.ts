"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { IdSchema, parse, requireAdmin } from "@/lib/server-guard";

export type GroupFormState = { error: string } | null;

const GroupNameSchema = z
  .string()
  .trim()
  .min(1, "Название не может быть пустым")
  .max(32, "Название длиннее 32 символов");

const TrackSchema = z.enum(["intro", "advanced", "project"]);

function revalidateGroupPages() {
  revalidatePath("/"); // экран входа показывает группы
  revalidatePath("/admin/groups");
}

/** Создать группу (имя + направление). Только для админа. */
export async function createGroup(
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  await requireAdmin();

  const name = GroupNameSchema.safeParse(formData.get("name"));
  if (!name.success) {
    return { error: name.error.issues[0]?.message ?? "Некорректное название" };
  }
  const track = TrackSchema.safeParse(formData.get("track"));
  if (!track.success) {
    return { error: "Выбери направление" };
  }

  try {
    await prisma.group.create({
      data: { name: name.data, track: track.data },
    });
  } catch (err) {
    // P2002 — нарушение уникальности имени. Показываем человеческое
    // сообщение вместо страницы ошибки.
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return { error: `Группа «${name.data}» уже существует` };
    }
    throw err;
  }

  revalidateGroupPages();
  return null;
}

/**
 * Удалить группу. Только пустую: у группы с учениками кнопка в UI
 * недоступна, а здесь — вторая линия защиты (могли назначить ученика
 * в соседней вкладке).
 */
export async function deleteGroup(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = parse(z.coerce.number().pipe(IdSchema), formData.get("id"));

  const studentCount = await prisma.user.count({ where: { groupId: id } });
  if (studentCount > 0) {
    return;
  }
  await prisma.group.delete({ where: { id } });

  revalidateGroupPages();
}

const AssignSchema = z.object({
  userId: z.uuid(),
  groupId: IdSchema.nullable(),
});

/**
 * Назначить ученика в группу (или убрать из группы — groupId = null).
 * Вызывается селектом из списка учеников в /admin/groups.
 */
export async function assignStudentGroup(input: {
  userId: string;
  groupId: number | null;
}): Promise<void> {
  await requireAdmin();

  const { userId, groupId } = parse(AssignSchema, input);

  // update по несуществующим userId/groupId бросит Prisma-ошибку — это
  // нормально: так бывает только при рассинхроне вкладок.
  await prisma.user.update({
    where: { id: userId },
    data: { groupId },
  });

  revalidateGroupPages();
}
