import type { ReactNode } from "react";

export function AdminPageHeader({
  title,
  subtitle,
  actions,
  className = "",
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur ${className}`.trim()}
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold leading-tight text-foreground">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
