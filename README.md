# Кванториум

Учебная веб-платформа для занятий по программированию. Ученик выбирает свой
профиль, проходит уроки и кодовые задания, получает XP, монеты и достижения.
Наставник управляет группами, курсами, уроками, материалами и достижениями через
встроенную админку.

## Текущее состояние

Проект уже используется как полноценная небольшая LMS:

- группы разделены на вводное, углублённое и проектное направления;
- ученики входят по профилю и четырёхзначному PIN;
- наставники входят через `/mentor` и имеют отдельные административные права;
- уроки поддерживают теорию, вопросы с вариантами ответа и кодовые задания на
  Python и JavaScript;
- прогресс, XP, уровни, монеты и достижения хранятся в PostgreSQL;
- контент, группы и достижения редактируются без изменения исходного кода;
- включены CSP с nonce, rate limit входа, Sentry, резервные копии и CI;
- критическая бизнес-логика покрыта Vitest, основной путь ученика — Playwright.

Актуальная дорожная карта находится в [docs/ROADMAP.md](docs/ROADMAP.md).

## Стек

- Next.js 16.2.9, App Router, React 19, TypeScript;
- Tailwind CSS 4;
- Auth.js / NextAuth 5 с Credentials provider;
- PostgreSQL (Supabase) и Prisma 7;
- Pyodide для Python и изолированный Web Worker для JavaScript;
- Vitest, Playwright, ESLint;
- Sentry, Vercel Analytics и Speed Insights;
- Vercel для production, Gitea Actions для CI.

Версии намеренно закреплены в `package.json` и `package-lock.json`. Перед
изменением Next.js API необходимо читать документацию установленной версии в
`node_modules/next/dist/docs/`.

## Быстрый запуск

Требования: Node.js 20+, npm и доступная PostgreSQL-база.

### Git Bash (основной вариант)

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev
```

### PowerShell

```powershell
npm.cmd ci
npx.cmd prisma generate
npx.cmd prisma migrate deploy
npm.cmd run dev
```

Приложение откроется по адресу `http://localhost:3000`.

В Git Bash используйте обычные `npm` и `npx`. В PowerShell используются
`npm.cmd` и `npx.cmd`: это работает даже при политике, запрещающей запуск
`npm.ps1`.

### Переменные окружения

Создайте локальный `.env`. Файл содержит секреты и не коммитится.

| Переменная | Обязательна | Назначение |
| --- | --- | --- |
| `DATABASE_URL` | да | PostgreSQL через runtime/pooler |
| `DIRECT_URL` | да | прямое соединение для миграций и обслуживания |
| `AUTH_SECRET` | да | подпись сессий Auth.js |
| `SUPABASE_URL` | для загрузки изображений | адрес проекта Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | для загрузки изображений | серверный ключ Storage, только backend |
| `NEXT_PUBLIC_SENTRY_DSN` | нет | отправка ошибок в Sentry |

Проверка конфигурации:

```bash
npm run check-env
```

PowerShell:

```powershell
npm.cmd run check-env
```

## Команды

Git Bash:

```bash
npm run dev          # сервер разработки
npm run build        # production-сборка
npm run lint         # ESLint
npm test             # unit-тесты
npm run test:e2e     # Playwright с отдельной схемой PostgreSQL
npm run backup       # локальная резервная копия БД
npm run restore      # сухой прогон восстановления
```

PowerShell:

```powershell
npm.cmd run dev          # сервер разработки
npm.cmd run build        # production-сборка
npm.cmd run lint         # ESLint
npm.cmd test             # unit-тесты
npm.cmd run test:e2e     # Playwright с отдельной схемой PostgreSQL
npm.cmd run backup       # локальная резервная копия БД
npm.cmd run restore      # сухой прогон восстановления
```

Перед push локальный хук проверяет lint и TypeScript. Подключить его один раз:

```bash
git config core.hooksPath .githooks
```

Эта Git-команда одинакова в Git Bash и PowerShell.

## Карта документации

- [Архитектура](docs/ARCHITECTURE.md) — границы системы, маршруты, данные и
  правила разработки.
- [Руководство наставника](docs/MENTOR_GUIDE.md) — ежедневная работа с группами
  и контентом.
- [Учебный контент](docs/CONTENT_GUIDE.md) — устройство уроков, публикация и
  seed-файлы.
- [Эксплуатация](docs/OPERATIONS.md) — пользователи, PIN, миграции, бэкапы,
  мониторинг и инциденты.
- [Дорожная карта](docs/ROADMAP.md) — последовательность следующих вех.
- [Архитектурные решения](docs/decisions/README.md) — почему система устроена
  именно так.
- [Референсные ассеты](docs/REFERENCE_ASSETS.md) — лицензирование и правила
  использования локальных визуальных материалов.
- [Архив](docs/archive/README.md) — исторические планы, не являющиеся
  актуальными инструкциями.

## Правила безопасности

- Не коммитьте `.env`, резервные копии, PIN или данные учеников.
- Не запускайте `prisma/seed.ts` на рабочей базе без осознанного
  `SEED_FORCE=1`: seed очищает каталог уроков.
- Не запускайте восстановление с `--yes`, пока сухой прогон не показал
  правильную базу и схему.
- Любая Server Action должна заново проверять сессию, роль и входные данные.
- Скрытая кнопка или маршрут не являются контролем доступа: права проверяются
  сервером.
