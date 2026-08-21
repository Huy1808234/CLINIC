"use client";

import React from "react";
import type { DeduplicationMatchResult } from "@/types/patient";
import { Button } from "@/components/ui/Button";

export interface DeduplicationBannerProps {
  matchResult: DeduplicationMatchResult;
  onUseExisting: () => void;
  onDismiss: () => void;
}

export const DeduplicationBanner: React.FC<DeduplicationBannerProps> = ({
  matchResult,
  onUseExisting,
  onDismiss,
}) => {
  if (!matchResult.matched_patient_id || !matchResult.existing_patient) {
    return null;
  }

  const patient = matchResult.existing_patient;
  const isExact = !matchResult.requires_merge_review;

  return (
    <div
      className={`p-4 rounded-xl border mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isExact
          ? "bg-teal-50 border-teal-200 text-teal-900"
          : "bg-amber-50 border-amber-200 text-amber-900"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg ${
            isExact ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2">
            {isExact ? "Đã Tìm Thấy Hồ Sơ Bệnh Nhân Khớp" : "Cảnh Báo Trùng Lặp Hồ Sơ (Cần Xác Minh)"}
            <span className="text-xs px-2 py-0.5 rounded-full bg-white font-mono font-medium shadow-xs">
              {Math.round(matchResult.confidence_score * 100)}% khớp
            </span>
          </h4>
          <p className="text-xs mt-1 text-slate-700">
            <strong>{patient.full_name}</strong> ({patient.patient_code}) — SĐT: {patient.phone || "—"} | CCCD: {patient.citizen_id || "—"}
            {patient.birth_year ? ` | Năm sinh: ${patient.birth_year}` : ""}
          </p>
          <ul className="text-[11px] text-slate-500 mt-1 list-disc list-inside">
            {matchResult.match_reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
        <Button size="sm" variant="primary" onClick={onUseExisting}>
          Sử Dụng Hồ Sơ Này
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Bỏ Qua
        </Button>
      </div>
    </div>
  );
};
