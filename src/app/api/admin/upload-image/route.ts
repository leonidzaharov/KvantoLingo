import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { rateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/server-guard";

// ============================================================
// Загрузка картинок для теории уроков в Supabase Storage.
//
// POST multipart/form-data с полем file. Только для наставника.
// Файл кладётся в публичный бакет BUCKET, в ответ уходит { url } —
// редактор подставляет её в markdown как ![](url).
//
// Ходим через service_role-ключ (server-only, в браузер не попадает),
// поэтому RLS-политики на бакет настраивать не нужно.
// ============================================================

const BUCKET = "lesson-images";
const MAX_SIZE = 5 * 1024 * 1024; // 5 МБ

// SVG сознательно не принимаем: в отличие от растровых форматов он может
// содержать скрипты и по прямой ссылке исполняется браузером.
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export async function POST(request: Request): Promise<Response> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return Response.json({ error: "Нет доступа" }, { status: 403 });
  }

  // Не больше 30 загрузок в минуту на наставника — с запасом для реальной
  // работы, но отсекает случайный цикл/спам.
  if (!rateLimit(`upload:${userId}`, 30, 60_000)) {
    return Response.json(
      { error: "Слишком много загрузок подряд. Подожди минуту." },
      { status: 429 },
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json(
      {
        error:
          "Supabase Storage не настроен: заполни SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env",
      },
      { status: 500 },
    );
  }

  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Нет файла в запросе" }, { status: 400 });
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return Response.json(
      { error: "Можно только картинки: PNG, JPEG, GIF или WebP" },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE) {
    return Response.json(
      { error: "Картинка больше 5 МБ — сожми её" },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const path = `${Date.now()}-${randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    // Ссылки уникальные и никогда не перезаписываются — кэшируем навсегда.
    cacheControl: "31536000",
  });
  if (error) {
    return Response.json(
      {
        error: `Supabase не принял файл: ${error.message}. Проверь, что бакет «${BUCKET}» создан и публичный.`,
      },
      { status: 502 },
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return Response.json({ url: data.publicUrl });
}
