import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "ghost" | "outline";
  size?: "sm" | "md";
};
export default function Button({ variant="solid", size="md", className="", ...props }: Props) {
  const base = "rounded-md transition-all duration-150";
  const sizes = {
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-4 py-2",
  }[size];
  const variants = {
    solid:  "bg-white text-black hover:bg-ink-100",
    ghost:  "bg-transparent text-white hover:bg-ink-900 border border-transparent",
    outline:"bg-transparent text-white border border-ink-600 hover:border-ink-400",
  }[variant];
  return <button {...props} className={`${base} ${sizes} ${variants} ${className}`} />;
}
