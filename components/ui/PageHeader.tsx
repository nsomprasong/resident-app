import type { ReactNode } from "react";

type PageHeaderProps = {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
};

export function PageHeader({
  icon,
  eyebrow,
  title,
  description,
  meta,
  actions,
  toolbar,
}: PageHeaderProps) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-surface to-secondary/10 shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary shadow-sm">
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">{eyebrow}</p>
            <h1 className="mt-1 text-3xl font-semibold text-foreground">{title}</h1>
            {description ? (
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            ) : null}
            {meta ? <div className="mt-2 text-xs text-muted-foreground">{meta}</div> : null}
          </div>
        </div>
        {actions ? (
          <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
      {toolbar ? (
        <div className="border-t border-border bg-surface/80 px-4 py-4 sm:px-6">
          {toolbar}
        </div>
      ) : null}
    </section>
  );
}
