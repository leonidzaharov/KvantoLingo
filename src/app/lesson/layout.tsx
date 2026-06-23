import type { PropsWithChildren } from "react";

// Экран урока — полноэкранный (без сайдбара (main)-группы): шапка сверху,
// контент по центру, footer проверки снизу.
const LessonLayout = ({ children }: PropsWithChildren) => {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-full w-full flex-col">{children}</div>
    </div>
  );
};

export default LessonLayout;
