import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [], // Мы добавим провайдеры в auth.ts, чтобы избежать импорта bcrypt на Edge-runtime
  pages: {
    signIn: "/",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      // Защищенные маршруты
      const isProtected = ['/lesson', '/achievements', '/learn', '/courses', '/leaderboard', '/profile'].some(route =>
        nextUrl.pathname.startsWith(route)
      );

      if (isProtected) {
          if (isLoggedIn) return true; // Доступ разрешен
          return false; // Редирект на страницу входа
        }
        return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
