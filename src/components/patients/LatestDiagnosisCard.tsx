"use client";

import React from "react";
import { Tag } from "antd";
import { MedicineBoxOutlined, UserOutlined, CalendarOutlined } from "@ant-design/icons";
import type { PatientCourseDiagnosisSummaryItem } from "@/types/patient";
import { SectionCard, SectionCardHeader, EmptyStatePanel } from "./SectionCard";

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
    <SectionCard>
      {/* Shared Section Header */}
      <SectionCardHeader
        icon={<MedicineBoxOutlined />}
        title="Chẩn đoán chính gần nhất"
        badge={
          latestPrimaryDiag?.raw_code ? (
            <Tag
              color="cyan"
              className="m-0 font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md border-teal-200 text-teal-800 bg-teal-50"
            >
              {latestPrimaryDiag.raw_code}
            </Tag>
          ) : undefined
        }
      />

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center">
        {latestPrimaryDiag ? (
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/70 space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 shrink-0" />
              <span className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                {latestPrimaryDiag.raw_text || latestPrimaryDiag.raw_code}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-200/50">
              {doctorName && (
                <span className="flex items-center gap-1.5">
                  <UserOutlined className="text-slate-400 text-xs" />
                  <span>
                    Bác sĩ: <strong className="text-slate-700 font-medium">{doctorName}</strong>
                  </span>
                </span>
              )}
              {formattedDate && (
                <span className="flex items-center gap-1.5 sm:ml-auto">
                  <CalendarOutlined className="text-slate-400 text-xs" />
                  <span>
                    Ngày:{" "}
                    <strong className="text-slate-700 font-medium font-mono">{formattedDate}</strong>
                  </span>
                </span>
              )}
            </div>
          </div>
        ) : (
          <EmptyStatePanel
            icon={<MedicineBoxOutlined />}
            message="Chưa có chẩn đoán chính"
          />
        )}
      </div>
    </SectionCard>
  );
};
