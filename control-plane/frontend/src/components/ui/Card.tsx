import { PropsWithChildren, ReactNode } from "react";

export function Card({ children, className="" }: PropsWithChildren<{className?: string}>) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-ink-800">
      <h3 className="text-sm font-medium tracking-wide">{title}</h3>
      {aside}
    </div>
  );
}

export function CardBody({ children, className="" }: PropsWithChildren<{className?: string}>) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
