import {
  ButtonHTMLAttributes,
  ReactNode,
  cloneElement,
  isValidElement,
} from "react";

type Variant = "solid" | "ghost" | "outline";
type Size = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
  children?: ReactNode;
};

export default function Button({
  variant = "solid",
  size = "md",
  className = "",
  asChild = false,
  children,
  ...props
}: Props) {
  const base =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors " +
    "focus:outline-none focus:ring-1 focus:ring-ink-500 " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClass: Record<Size, string> = {
    sm: "text-[11px] px-2.5 py-1",
    md: "text-xs px-3 py-1.5",
  };

  const variantClass: Record<Variant, string> = {
    solid:
      "bg-ink-50 text-ink-950 border border-ink-400 hover:bg-ink-100 hover:border-ink-300",
    ghost:
      "bg-transparent text-ink-300 hover:text-ink-100 hover:bg-ink-900/40 border border-transparent",
    outline:
      "bg-transparent text-ink-100 border border-ink-700 hover:bg-ink-900/60",
  };

  const classes = `${base} ${sizeClass[size]} ${variantClass[variant]} ${className}`.trim();

  if (asChild && children && isValidElement(children)) {
    return cloneElement(children, {
      ...props,
      className: `${classes} ${children.props?.className || ""}`.trim(),
    });
  }

  return (
    <button {...props} className={classes}>
      {children}
    </button>
  );
}
