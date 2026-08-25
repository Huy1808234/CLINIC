"use client";

import React from "react";
import { Tag } from "antd";
import { MedicineBoxOutlined } from "@ant-design/icons";
import type { PatientHistorySummary } from "@/types/patient";

export interface CurrentCourseSummaryCardProps {
  currentCourse?: PatientHistorySummary["treatment_courses"][number] | null;
}

export const CurrentCourseSummaryCard: React.FC<CurrentCourseSummaryCardProps> = ({
  currentCourse,
}) => {
  if (!currentCourse) return null;

  const progressLabel = `${currentCourse.completed_session_count} / ${
    currentCourse.planned_session_count ?? "—"
  }`;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <MedicineBoxOutlined className="text-teal-600 text-base" />
          <h3 className="text-sm font-bold text-slate-800 m-0">Thông tin trong liệu trình hiện tại</h3>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-1">
          <span className="text-slate-400 font-medium block text-[11px]">Liệu trình</span>
          <div className="flex items-center gap-1.5">
            <Tag color="purple" className="m-0 font-bold text-xs px-2 py-0.5 rounded">
              LT{currentCourse.course_no}
            </Tag>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-medium block text-[11px]">Trạng thái</span>
          <div>
            <Tag
              color="cyan"
              className="m-0 text-xs font-semibold px-2 py-0.5 rounded-md border-teal-200 text-teal-800 bg-teal-50"
            >
              Đang điều trị
            </Tag>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-medium block text-[11px]">Bắt đầu</span>
          <span className="font-semibold text-slate-800 block font-mono text-[13px]">
            {currentCourse.start_date || "—"}
          </span>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-medium block text-[11px]">Buổi điều trị</span>
          <span className="font-semibold text-slate-800 block font-mono text-[13px]">
            {progressLabel}
          </span>
        </div>
      </div>
    </div>
  );
};
