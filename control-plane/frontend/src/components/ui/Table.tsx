import { PropsWithChildren } from "react";

export function Table({ children }: PropsWithChildren) {
  return <div className="overflow-x-auto border border-ink-800 rounded-xl2">
    <table className="min-w-full text-sm">{children}</table>
  </div>;
}
export function THead({ children }: PropsWithChildren) {
  return <thead className="bg-ink-900 text-ink-300">
    <tr className="[&>th]:text-left [&>th]:px-3 [&>th]:py-2">{children}</tr>
  </thead>;
}
export function TBody({ children }: PropsWithChildren) {
  return <tbody className="[&>tr]:border-t [&>tr]:border-ink-800 [&>td]:px-3 [&>td]:py-2">{children}</tbody>;
}
