#!/usr/bin/env node
// ============================================================
// Сид материалов блока «Интересное» (таблица Resource).
//
// Безопасный и идемпотентный: НЕ чистит каталог уроков (в отличие от
// prisma/seed.ts). Если в таблице Resource уже есть записи — выходит,
// ничего не дублируя. Нужен один раз, чтобы наполнить только что
// созданную таблицу стартовым контентом (раньше он был статичным
// списком в src/app/(main)/interesting/resources.ts).
//
// Запуск: node scripts/seed-resources.mjs
// Принудительно (дописать поверх существующих): RESOURCE_SEED_FORCE=1 node scripts/seed-resources.mjs
// ============================================================

import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/index.js";

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("❌ Задайте DIRECT_URL или DATABASE_URL в .env");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

// Стартовые материалы. sortOrder задаёт порядок на странице (меньше — выше).
const RESOURCES = [
  {
    type: "video",
    title: "Как устроено встроенное видео",
    description: "Пример видео прямо на странице (замени на своё).",
    url: "M7lc1UVf-VE", // ID видео YouTube (после v= в ссылке)
    sortOrder: 0,
  },
  {
    type: "scratch",
    title: "Проект Scratch внутри страницы",
    description: "Пример встроенного проекта Scratch (замени ID на свой).",
    url: "10128407", // ID проекта из ссылки scratch.mit.edu/projects/<ID>
    sortOrder: 1,
  },
  {
    type: "article",
    title: "Сайт Scratch",
    description: "Создавай свои игры и анимации онлайн.",
    url: "https://scratch.mit.edu",
    sortOrder: 2,
  },
  {
    type: "note",
    title: "Совет от наставника",
    body: "На каникулах не обязательно проходить уроки каждый день — лучше выбери один проект из «Интересного» и попробуй сделать что-то своё. Эксперименты важнее серий!",
    sortOrder: 3,
  },
];

async function main() {
  const existing = await prisma.resource.count();
  if (existing > 0 && process.env.RESOURCE_SEED_FORCE !== "1") {
    console.log(
      `ℹ️  В таблице Resource уже ${existing} записей — пропускаю сид ` +
        `(RESOURCE_SEED_FORCE=1 чтобы всё равно добавить).`,
    );
    return;
  }

  await prisma.resource.createMany({ data: RESOURCES });
  console.log(`✅ Добавлено материалов: ${RESOURCES.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Ошибка сида материалов:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
