import { PropsWithChildren, ReactNode } from "react";

export function Card({
  children,
  className = "",
}: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={`
        border border-ink-800
        bg-ink-950/70
        rounded-xl
        shadow-[0_0_0_1px_rgba(0,0,0,0.5)]
        ${className}
      `}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  aside,
}: {
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-ink-800">
      <div className="min-w-0">
        <h3 className="text-xs font-semibold tracking-[0.08em] uppercase text-ink-200">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-[11px] text-ink-500 truncate">
            {description}
          </p>
        )}
      </div>
      {aside && <div className="flex items-center gap-2 shrink-0">{aside}</div>}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={`
        px-4 py-3
        text-xs text-ink-100
        space-y-3
        ${className}
      `}
    >
      {children}
    </div>
  );
}
