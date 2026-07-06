import NextAuth, { CredentialsSignin } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "./auth.config";

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_FAILURES = 5;

// Отдельный код ошибки для rate-limit, чтобы фронт мог показать
// «Подожди 5 минут» вместо обобщённого «Неверный PIN». Для детского
// кружка приоритет UX > утечки факта блока: атакующий и так увидит
// блок по count'у на 6-м запросе.
class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "PIN Code",
      credentials: {
        userId: { label: "User ID", type: "text" },
        pin: { label: "PIN", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.userId || !credentials?.pin) {
          return null;
        }
        const userId = credentials.userId as string;
        const pin = credentials.pin as string;

        // Rate-limit: 5 неудачных за 15 минут блокируют дальнейшие попытки
        // до окна, даже если PIN внезапно правильный. Защищает 4-значный
        // PIN от полного перебора (10000 комбинаций без лимита — секунды).
        // Считаем ДО bcrypt.compare — иначе тратим ~100мс впустую.
        const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
        const recentFailures = await prisma.loginAttempt.count({
          where: {
            userId,
            succeeded: false,
            attemptedAt: { gte: windowStart },
          },
        });
        if (recentFailures >= RATE_LIMIT_MAX_FAILURES) {
          throw new RateLimitedError();
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          // Несуществующего userId намеренно не логируем: иначе атакующий
          // случайными id раздует таблицу. Реальный перебор PIN и так
          // упирается в лимит выше — для уже валидных юзеров.
          return null;
        }

        const isPasswordValid = await bcrypt.compare(pin, user.pinHash);

        // Логируем результат на best-effort: если запись упадёт (сетевой
        // сбой Supabase), не валим логин — успешный bcrypt уже подтвердил
        // личность. Без записи в худшем случае пропадёт один rate-limit-tick.
        try {
          await prisma.loginAttempt.create({
            data: { userId, succeeded: isPasswordValid },
          });
        } catch {
          /* noop */
        }

        if (!isPasswordValid) {
          return null;
        }

        // Отмечаем «последний раз заходил» — пригодится наставнику, чтобы
        // видеть, кто давно не появлялся. (Стрик убран сознательно: при
        // занятиях 2–3 раза в неделю серия дней всегда рвалась и только
        // демотивировала. Опора мотивации — XP/уровни/ачивки/монеты.)
        // Best-effort: если обновление упадёт, логин всё равно пройдёт.
        try {
          await prisma.user.update({
            where: { id: userId },
            data: { lastActiveDate: new Date() },
          });
        } catch {
          /* noop */
        }

        return {
          id: user.id,
          name: user.name,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60, // Время жизни сессии: 60 минут
  },
});
