"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { parseResourceInput } from "@/lib/resource-input";
import { IdSchema, parse, requireAdmin } from "@/lib/server-guard";

// Состояние формы для useActionState: null — ещё не отправляли/успех,
// { error } — что показать под формой. Успех заканчивается redirect'ом,
// поэтому «успешного» состояния у формы нет.
export type ResourceFormState = { error: string } | null;

/**
 * Создать или обновить материал «Интересного» (одна форма на оба случая:
 * скрытое поле id пустое → create, иначе → update). Только для админа.
 */
export async function saveResource(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  await requireAdmin();

  const parsed = parseResourceInput({
    type: formData.get("type"),
    title: formData.get("title"),
    description: formData.get("description"),
    url: formData.get("url"),
    body: formData.get("body"),
    sortOrder: formData.get("sortOrder"),
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const rawId = String(formData.get("id") ?? "").trim();
  if (rawId === "") {
    await prisma.resource.create({ data: parsed.data });
  } else {
    const id = parse(IdSchema, Number(rawId));
    // update по несуществующему id бросит Prisma-ошибку — это нормально:
    // так бывает только если материал удалили в соседней вкладке.
    await prisma.resource.update({ where: { id }, data: parsed.data });
  }

  revalidatePath("/interesting");
  revalidatePath("/admin/resources");
  redirect("/admin/resources");
}

/** Удалить материал. Только для админа. Вызывается формой из списка. */
export async function deleteResource(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = parse(
    z.coerce.number().pipe(IdSchema),
    formData.get("id"),
  );
  await prisma.resource.delete({ where: { id } });

  revalidatePath("/interesting");
  revalidatePath("/admin/resources");
}
