# Эксплуатация

В инструкциях сначала приведены команды для Git Bash — это основной терминал
проекта. Ниже дан эквивалент для PowerShell. В Git Bash используются `npm` и
`npx`, в PowerShell — `npm.cmd` и `npx.cmd`.

## Пользователи и PIN

Создать ученика:

```bash
npm run create-user -- --name="Имя ученика" --pin=1234
```

PowerShell:

```powershell
npm.cmd run create-user -- --name="Имя ученика" --pin=1234
```

Создать наставника:

```bash
npm run create-user -- --name="Наставник" --pin=12345678 --admin
```

PowerShell:

```powershell
npm.cmd run create-user -- --name="Наставник" --pin=12345678 --admin
```

Сменить PIN:

```bash
npm run rotate-pin -- --name="Имя ученика" --pin=4321
```

PowerShell:

```powershell
npm.cmd run rotate-pin -- --name="Имя ученика" --pin=4321
```

При совпадающих именах используйте `--user-id=<uuid>`. PIN ученика содержит
ровно 4 цифры, PIN наставника — 8–10 цифр. Команды не выводят хеш PIN.

## Миграции

После изменения `prisma/schema.prisma` создайте отдельную миграцию и проверьте её
на тестовой среде. В production применяется только:

```bash
npx prisma migrate deploy
```

PowerShell:

```powershell
npx.cmd prisma migrate deploy
```

`prisma db push` не является production-процессом. Перед потенциально
разрушительной миграцией обязательно снимите резервную копию.

## Резервные копии

Создать локальный JSON-бэкап:

```bash
npm run backup
```

PowerShell:

```powershell
npm.cmd run backup
```

Файлы попадают в `backups/`, не коммитятся и содержат персональные данные.
Скрипт хранит последние 60 копий.

Сначала выполнить сухой прогон восстановления:

```bash
npm run restore
```

PowerShell:

```powershell
npm.cmd run restore
```

Реальная запись требует явного `--yes` и перезаписывает данные:

```bash
npm run restore -- --file backups/backup-YYYY-MM-DD.json --yes
```

PowerShell:

```powershell
npm.cmd run restore -- --file backups/backup-YYYY-MM-DD.json --yes
```

Предпочтительно сначала восстановить копию в отдельную схему через `--to`, затем
проверить число пользователей, уроков и записей прогресса.

## Мониторинг

- `/api/health` проверяет приложение и соединение с БД;
- Sentry получает серверные и клиентские ошибки при заданном DSN;
- Vercel Analytics и Speed Insights дают агрегированные показатели;
- Gitea Actions проверяет каждый push в `main` и pull request.

При инциденте запишите время, маршрут, затронутые профили и последнее изменение.
Не помещайте PIN, `.env` или содержимое production-бэкапа в issue и сообщения.

## Регулярные работы

Еженедельно:

- проверить ошибки Sentry;
- проверить успешность последнего CI;
- убедиться, что резервная копия создаётся;
- просмотреть неактивных учеников.

Ежемесячно:

- выполнить тестовое восстановление в отдельную схему;
- очистить старые попытки входа:

```bash
npm run cleanup-attempts
```

PowerShell:

```powershell
npm.cmd run cleanup-attempts
```

- проверить обновления зависимостей и `npm audit`;
- проверить список наставников и актуальность их доступа.

## Выпуск

Перед production-деплоем:

```bash
npm run check-env
npm run lint
npm test
npx tsc --noEmit
npm run build
```

PowerShell:

```powershell
npm.cmd run check-env
npm.cmd run lint
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run build
```

Изменение схемы требует проверенной миграции и свежего бэкапа. После выпуска
проверьте `/api/health`, вход ученика, открытие урока и административный guard.
