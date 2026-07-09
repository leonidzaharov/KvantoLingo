import type { NextConfig } from "next";

// Content-Security-Policy — пока в режиме Report-Only: браузер НЕ блокирует
// ресурсы, а только пишет нарушения в консоль. Это безопасная «фаза 1»:
// обкатываем политику на живом проде, смотрим, что она ловит лишнего, и лишь
// потом переключаем на строгий Content-Security-Policy (в идеале — с nonce
// через middleware, тогда можно убрать 'unsafe-inline' у скриптов).
//
// Что учтено: инлайн-скрипты Next ('unsafe-inline'), Pyodide с jsdelivr +
// WebAssembly ('wasm-unsafe-eval'), blob-worker'ы JS-раннера (worker-src blob:),
// картинки уроков из Supabase Storage, телеметрия Vercel и Sentry.
const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://cdn.jsdelivr.net https://*.supabase.co https://vitals.vercel-insights.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "manifest-src 'self'",
];

// Заголовки безопасности — применяются ко ВСЕМ ответам (source "/(.*)").
// Это «непробиваемый» набор: он не ломает работу сайта, но закрывает
// типовые атаки.
const securityHeaders = [
  // CSP пока только наблюдает (Report-Only), см. коммент выше.
  {
    key: "Content-Security-Policy-Report-Only",
    value: cspDirectives.join("; "),
  },
  // Только HTTPS на 2 года вперёд (+ поддомены). Защита от downgrade/MITM.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  // Запрет встраивать сайт в чужой <iframe> — антикликджекинг.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Браузер не «угадывает» тип файла по содержимому — защита от подмены MIME.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Сколько реферера отдавать при переходах: свой origin целиком, чужим — только домен.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Глушим доступ к камере/микрофону/гео/Topics — сайту для детей это не нужно.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Разрешаем браузеру заранее резолвить DNS внешних ссылок — мелкий плюс к скорости.
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
