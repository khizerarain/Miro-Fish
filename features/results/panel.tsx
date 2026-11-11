import type { ReactNode } from "react";

export function Panel({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-eyebrow-caps">{eyebrow}</p>
          <h2 className="text-subheading font-medium">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
