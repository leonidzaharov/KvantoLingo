// ============================================================
// Разбор и нормализация полей формы материала «Интересного».
//
// Чистая логика без "use server" — чтобы её можно было покрыть
// vitest-тестами (см. resource-input.test.ts) и не тащить БД.
// Используется админкой (src/lib/actions/resources.ts).
// ============================================================

import { z } from "zod";

import type { ResourceType } from "@/generated/prisma";

// Наставник вставляет ссылку на видео как удобно — полную или уже ID.
// Приводим к 11-символьному ID, который ждёт iframe youtube-nocookie.
export function extractYouTubeId(raw: string): string | null {
  const input = raw.trim();
  if (/^[\w-]{11}$/.test(input)) {
    return input; // уже голый ID
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  let candidate: string | null = null;

  if (host === "youtu.be") {
    candidate = url.pathname.slice(1); // youtu.be/<id>
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    // youtube.com/watch?v=<id> | /shorts/<id> | /embed/<id> | /live/<id>
    const path = url.pathname.split("/").filter(Boolean);
    if (path[0] === "watch") {
      candidate = url.searchParams.get("v");
    } else if (["shorts", "embed", "live"].includes(path[0] ?? "")) {
      candidate = path[1] ?? null;
    }
  }

  return candidate && /^[\w-]{11}$/.test(candidate) ? candidate : null;
}

// То же для Scratch: принимаем ID проекта или ссылку scratch.mit.edu/projects/<ID>.
export function extractScratchId(raw: string): string | null {
  const input = raw.trim();
  if (/^\d{1,12}$/.test(input)) {
    return input;
  }

  const m = input.match(
    /^https:\/\/scratch\.mit\.edu\/projects\/(\d{1,12})(?:\/.*)?$/,
  );
  return m ? m[1] : null;
}

const BaseSchema = z.object({
  type: z.enum(["scratch", "video", "article", "note"]),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300),
  url: z.string().trim().max(2000),
  body: z.string().trim().max(2000),
  sortOrder: z.coerce.number().int().min(0).max(1_000_000),
});

// Что реально уйдёт в prisma.resource.create/update.
export type ResourceData = {
  type: ResourceType;
  title: string;
  description: string | null;
  url: string | null;
  body: string | null;
  sortOrder: number;
};

export type ParseResult =
  | { ok: true; data: ResourceData }
  | { ok: false; error: string };

/**
 * Валидирует сырые поля формы и нормализует их под конкретный тип:
 * video/scratch — ссылка сводится к ID для встраивания, article — полный
 * https-адрес, note — обязателен текст. Ошибки — готовые русские фразы
 * для показа под формой.
 */
export function parseResourceInput(raw: {
  type: unknown;
  title: unknown;
  description: unknown;
  url: unknown;
  body: unknown;
  sortOrder: unknown;
}): ParseResult {
  const parsed = BaseSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        "Проверь поля: нужен тип, заголовок до 120 символов и порядок — целое число.",
    };
  }
  const { type, title, description, url, body, sortOrder } = parsed.data;

  const base = {
    type,
    title,
    description: description || null,
    url: null as string | null,
    body: null as string | null,
    sortOrder,
  };

  switch (type) {
    case "video": {
      const id = extractYouTubeId(url);
      if (!id) {
        return {
          ok: false,
          error:
            "Не понял ссылку на видео. Вставь ссылку YouTube (youtube.com/watch?v=… или youtu.be/…) или сам ID видео.",
        };
      }
      return { ok: true, data: { ...base, url: id } };
    }

    case "scratch": {
      const id = extractScratchId(url);
      if (!id) {
        return {
          ok: false,
          error:
            "Не понял ссылку на проект Scratch. Вставь ссылку вида scratch.mit.edu/projects/12345 или сам номер проекта.",
        };
      }
      return { ok: true, data: { ...base, url: id } };
    }

    case "article": {
      let link: URL;
      try {
        link = new URL(url);
      } catch {
        return {
          ok: false,
          error: "Для ссылки нужен полный адрес, начинающийся с https://",
        };
      }
      if (link.protocol !== "https:") {
        return {
          ok: false,
          error: "Для ссылки нужен полный адрес, начинающийся с https://",
        };
      }
      return { ok: true, data: { ...base, url: link.toString() } };
    }

    case "note": {
      if (!body) {
        return { ok: false, error: "Для совета нужен текст." };
      }
      return { ok: true, data: { ...base, body } };
    }
  }
}
