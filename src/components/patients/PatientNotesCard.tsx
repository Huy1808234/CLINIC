"use client";

import React from "react";
import { FormOutlined } from "@ant-design/icons";
import { SectionCard, SectionCardHeader, EmptyStatePanel } from "./SectionCard";

export interface PatientNotesCardProps {
  notes?: string | null;
}

export const PatientNotesCard: React.FC<PatientNotesCardProps> = ({ notes }) => {
  return (
    <SectionCard>
      {/* Shared Section Header */}
      <SectionCardHeader icon={<FormOutlined />} title="Ghi chú" />

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center">
        {notes && notes.trim() ? (
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/70 text-xs text-slate-700 leading-relaxed italic">
            {notes}
          </div>
        ) : (
          <EmptyStatePanel
            icon={<FormOutlined />}
            message="Chưa có ghi chú lâm sàng bổ sung."
          />
        )}
      </div>
    </SectionCard>
  );
};
