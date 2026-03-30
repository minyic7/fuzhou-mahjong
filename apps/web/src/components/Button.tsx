import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "gold";
  size?: "sm" | "md" | "lg";
}

const variantStyles: Record<
  NonNullable<ButtonProps["variant"]>,
  React.CSSProperties
> = {
  primary: {
    background: "var(--color-bg-button)",
    color: "var(--color-text-primary)",
    border: "1px solid var(--color-bg-button-hover)",
  },
  secondary: {
    background: "transparent",
    color: "var(--color-text-secondary)",
    border: "1px solid var(--color-gold-border)",
  },
  danger: {
    background: "rgba(255, 82, 82, 0.15)",
    color: "var(--color-error)",
    border: "1px solid rgba(255, 82, 82, 0.3)",
  },
  gold: {
    background: "var(--color-bg-button)",
    color: "var(--color-text-primary)",
    border: "2px solid var(--color-gold-border-hover)",
  },
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, React.CSSProperties> =
  {
    sm: { padding: "8px 14px", fontSize: 13, minHeight: 36 },
    md: { padding: "12px 20px", fontSize: 15, minHeight: 44 },
    lg: { padding: "14px 24px", fontSize: 18, fontWeight: 600, minHeight: 48 },
  };

export function Button({
  variant = "primary",
  size = "md",
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      style={{
        borderRadius: "var(--radius-md)",
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...rest}
    />
  );
}
