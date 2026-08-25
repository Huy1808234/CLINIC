"use client";

import React from "react";
import { FormOutlined } from "@ant-design/icons";

export interface PatientNotesCardProps {
  notes?: string | null;
}

export const PatientNotesCard: React.FC<PatientNotesCardProps> = ({ notes }) => {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2">
          <FormOutlined className="text-[#00897b] text-base" />
          <h3 className="text-base font-bold text-slate-800 m-0">Ghi chú</h3>
        </div>
      </div>

      {/* Content */}
      {notes && notes.trim() ? (
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100/80 text-xs text-slate-700 leading-relaxed italic">
          {notes}
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-slate-400 italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          Chưa có ghi chú lâm sàng bổ sung.
        </div>
      )}
    </div>
  );
};
