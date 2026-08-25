"use client";

import React from "react";

export interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({ children, className = "" }) => {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between h-full ${className}`}
    >
      {children}
    </div>
  );
};

export interface SectionCardHeaderProps {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  className?: string;
}

export const SectionCardHeader: React.FC<SectionCardHeaderProps> = ({
  icon,
  title,
  badge,
  className = "",
}) => {
  return (
    <div
      className={`flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4 shrink-0 min-h-[38px] ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[#00897b] text-base flex items-center">{icon}</span>
        <h3 className="text-base font-bold text-slate-800 m-0">{title}</h3>
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
    </div>
  );
};

export interface EmptyStatePanelProps {
  icon?: React.ReactNode;
  message: string;
  className?: string;
}

export const EmptyStatePanel: React.FC<EmptyStatePanelProps> = ({
  icon,
  message,
  className = "",
}) => {
  return (
    <div
      className={`min-h-[100px] py-6 px-4 text-center text-xs text-slate-400 italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 w-full ${className}`}
    >
      {icon && (
        <span className="text-slate-300 text-xl flex items-center justify-center">{icon}</span>
      )}
      <span>{message}</span>
    </div>
  );
};
