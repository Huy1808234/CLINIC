import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "secondary" | "purple";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  className = "",
  variant = "default",
  size = "md",
  children,
  ...props
}) => {
  const baseStyles = "inline-flex items-center font-medium rounded-md whitespace-nowrap transition-colors";

  const sizeStyles = {
    sm: "px-1.5 py-0.5 text-[11px] leading-none",
    md: "px-2 py-0.5 text-xs",
  };

  const variantStyles = {
    default: "bg-teal-50 text-teal-700 border border-teal-200",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border border-amber-200",
    danger: "bg-red-50 text-red-700 border border-red-200",
    info: "bg-sky-50 text-sky-700 border border-sky-200",
    secondary: "bg-slate-100 text-slate-700 border border-slate-200",
    purple: "bg-purple-50 text-purple-700 border border-purple-200",
  };

  return (
    <span className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
};
