import { z } from "zod";

// ============================================================
// Формат Lesson.content (JSON-строка в БД).
//
// Версия 2: { theory?: string, questions: [...] }
//   theory   — markdown-гайд, показывается перед вопросами;
//   questions — вопрос с вариантами (choice) или задание с кодом (code).
//
// Обратная совместимость: старые уроки хранят вопросы без поля type —
// такие считаются choice. Отсутствие theory = урок без теории.
// ============================================================

export const ChoiceQuestionSchema = z
  .object({
    type: z.literal("choice").optional(),
    prompt: z.string().trim().min(1).max(1000),
    options: z.array(z.string().trim().min(1).max(300)).min(2).max(8),
    correctIndex: z.number().int().min(0),
  })
  .refine((q) => q.correctIndex < q.options.length, {
    message: "correctIndex вне диапазона вариантов",
  });

export const CodeQuestionSchema = z.object({
  type: z.literal("code"),
  prompt: z.string().trim().min(1).max(3000),
  /** Код, с которого ученик начинает (может быть пустым). */
  starterCode: z.string().max(10000).default(""),
  /**
   * Ожидаемый вывод программы (stdout). Сверяется «мягко» — кавычки, лишние
   * пробелы, ё/е и пустые строки по краям прощаются (см. output-match.ts).
   */
  expectedOutput: z.string().min(1).max(3000),
  /**
   * Эталонное решение наставника (не показывается ученику). В админке кнопка
   * «Запустить решение» выполняет его и заполняет expectedOutput из вывода —
   * чтобы ожидаемый текст не набирался руками с опечатками.
   */
  referenceSolution: z.string().max(10000).default(""),
});

// code — первым: у него обязательный литерал type, промахнуться нельзя.
export const LessonQuestionSchema = z.union([
  CodeQuestionSchema,
  ChoiceQuestionSchema,
]);

export const LessonContentSchema = z.object({
  theory: z.string().max(50000).default(""),
  questions: z.array(LessonQuestionSchema).max(50).default([]),
});

export type ChoiceQuestion = z.infer<typeof ChoiceQuestionSchema>;
export type CodeQuestion = z.infer<typeof CodeQuestionSchema>;
export type LessonQuestion = z.infer<typeof LessonQuestionSchema>;
export type LessonContent = z.infer<typeof LessonContentSchema>;

/**
 * Разбор content из БД с защитой от битого JSON: на любой ошибке возвращаем
 * пустой урок, а не роняем страницу (так вёл себя и старый код).
 */
export function parseLessonContent(raw: string): LessonContent {
  try {
    const parsed = LessonContentSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    /* битый JSON */
  }
  return { theory: "", questions: [] };
}

/** Тип вопроса с учётом старого формата (нет type = choice). */
export function questionKind(q: LessonQuestion): "choice" | "code" {
  return q.type === "code" ? "code" : "choice";
}
