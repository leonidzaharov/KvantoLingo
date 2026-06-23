import { z } from "zod";

import { auth } from "@/auth";

/**
 * Достаёт userId из текущей сессии. Бросает UNAUTHORIZED, если её нет.
 * Используется в Server Actions вместо ручного `await auth()` — гарантия,
 * что **никакой экшен не принимает userId аргументом**: только из сессии.
 */
export async function requireUser(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user.id;
}

/**
 * Runtime-валидация аргументов Server Action. RPC-канал Next.js пропускает
 * любую сериализуемую полезную нагрузку — без zod ничто не мешает клиенту
 * послать `itemId = NaN` или `"DROP TABLE"`. Бросаем BAD_REQUEST, фронт ловит.
 */
export function parse<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) {
    throw new Error("BAD_REQUEST");
  }
  return r.data;
}

// Общие схемы — реиспользуемые id-валидаторы.
export const IdSchema = z.number().int().positive().max(1_000_000);
