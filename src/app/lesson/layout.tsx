import type { PropsWithChildren } from "react";

import { NoCopyZone } from "./no-copy-zone";

// Экран урока — полноэкранный (без сайдбара (main)-группы): шапка сверху,
// контент по центру, footer проверки снизу. NoCopyZone глушит копирование
// и контекстное меню на всём экране урока (защита от списывания).
const LessonLayout = ({ children }: PropsWithChildren) => {
  return (
    <div className="flex h-full flex-col">
      <NoCopyZone>{children}</NoCopyZone>
    </div>
  );
};

export default LessonLayout;
