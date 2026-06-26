// Материалы для блока «Интересное».
//
// Пока это статичный типизованный список (см. PRODUCTION_READINESS / память):
// форма намеренно сделана «как таблица БД», чтобы позже перенести в Prisma-модель
// `Resource` почти копипастом, не теряя гибкости.
//
// Чтобы добавить материал — допиши объект в массив RESOURCES ниже.

export type ResourceType = "scratch" | "video" | "article" | "note";

export type Resource = {
  /** Стабильный id (для ключей в списке; в БД станет первичным ключом). */
  id: string;
  type: ResourceType;
  title: string;
  description?: string;
  /**
   * Смысл поля зависит от type:
   *   scratch — ID проекта Scratch (число из ссылки scratch.mit.edu/projects/<ID>)
   *   video   — ID видео YouTube (часть после `v=` в ссылке)
   *   article — полная внешняя ссылка (https://...)
   *   note    — не используется (текст кладём в body)
   */
  url?: string;
  /** Текст для type: "note" — твой комментарий/совет ученикам. */
  body?: string;
};

export const RESOURCES: Resource[] = [
  {
    id: "yt-iframe-demo",
    type: "video",
    title: "Как устроено встроенное видео",
    description: "Пример видео прямо на странице (замени на своё).",
    url: "M7lc1UVf-VE", // ← ID видео с YouTube (после v= в ссылке)
  },
  {
    id: "scratch-example",
    type: "scratch",
    title: "Проект Scratch внутри страницы",
    description: "Пример встроенного проекта Scratch (замени ID на свой).",
    url: "10128407", // ← ID проекта из ссылки scratch.mit.edu/projects/<ID>
  },
  {
    id: "scratch-site",
    type: "article",
    title: "Сайт Scratch",
    description: "Создавай свои игры и анимации онлайн.",
    url: "https://scratch.mit.edu",
  },
  {
    id: "note-vacation",
    type: "note",
    title: "Совет от наставника",
    body: "На каникулах не обязательно проходить уроки каждый день — лучше выбери один проект из «Интересного» и попробуй сделать что-то своё. Эксперименты важнее серий!",
  },
];
