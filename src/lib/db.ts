import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL не задан. См. .env.example — приложение больше не падает на SQLite.",
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Схема Postgres. В обычной жизни не задана → public (прод и локальный dev).
// E2E-тесты поднимают приложение на отдельной схеме (DATABASE_SCHEMA=e2e),
// чтобы прогоны не писали в живые данные учеников.
const databaseSchema = process.env.DATABASE_SCHEMA;

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(
    { connectionString: databaseUrl },
    databaseSchema ? { schema: databaseSchema } : undefined,
  );
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
