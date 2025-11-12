export default function Badge({ children, tone="default" }: { children: any; tone?: "default"|"ok"|"warn"|"fail"}) {
  const palette: Record<string,string> = {
    default: "bg-ink-800 text-ink-200",
    ok:      "bg-white text-black",
    warn:    "bg-ink-700 text-ink-100",
    fail:    "bg-black text-white border border-ink-600",
  };
  return <span className={`text-xs px-2 py-0.5 rounded ${palette[tone]}`}>{children}</span>;
}
