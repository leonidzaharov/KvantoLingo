import { defineConfig } from "vitest/config";

// Минимальный конфиг: гоняем юнит-тесты на чистую логику (без БД и Next).
// Тестовые файлы — рядом с кодом, с суффиксом .test.ts.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
