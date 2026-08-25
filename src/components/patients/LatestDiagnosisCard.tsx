"use client";

import React from "react";
import { Tag } from "antd";
import { MedicineBoxOutlined, UserOutlined, CalendarOutlined } from "@ant-design/icons";
import type { PatientCourseDiagnosisSummaryItem } from "@/types/patient";

export interface LatestDiagnosisCardProps {
  latestPrimaryDiag?: PatientCourseDiagnosisSummaryItem | null;
  doctorName?: string | null;
  diagnosisDate?: string | null;
}

export const LatestDiagnosisCard: React.FC<LatestDiagnosisCardProps> = ({
  latestPrimaryDiag,
  doctorName,
  diagnosisDate,
}) => {
  const formattedDate = diagnosisDate
    ? new Intl.DateTimeFormat("vi-VN").format(new Date(diagnosisDate))
    : null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2">
          <MedicineBoxOutlined className="text-[#00897b] text-base" />
          <h3 className="text-base font-bold text-slate-800 m-0">Chẩn đoán chính gần nhất</h3>
        </div>
        {latestPrimaryDiag?.raw_code && (
          <Tag color="cyan" className="m-0 font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md border-teal-200 text-teal-800 bg-teal-50">
            {latestPrimaryDiag.raw_code}
          </Tag>
        )}
      </div>

      {/* Content */}
      {latestPrimaryDiag ? (
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100/80 space-y-2">
          <span className="font-bold text-slate-900 text-sm block">
            {latestPrimaryDiag.raw_text || latestPrimaryDiag.raw_code}
          </span>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1">
            {doctorName && (
              <span className="flex items-center gap-1">
                <UserOutlined className="text-slate-400 text-xs" />
                <span>Bác sĩ: <strong className="text-slate-700 font-medium">{doctorName}</strong></span>
              </span>
            )}
            {formattedDate && (
              <span className="flex items-center gap-1">
                <CalendarOutlined className="text-slate-400 text-xs" />
                <span>Ngày chẩn đoán: <strong className="text-slate-700 font-medium font-mono">{formattedDate}</strong></span>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-slate-400 italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          Chưa có chẩn đoán chính
        </div>
      )}
    </div>
  );
};
