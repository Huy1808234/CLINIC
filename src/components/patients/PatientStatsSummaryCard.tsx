"use client";

import React from "react";
import {
  ScheduleOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import type { PatientTreatmentCourseSummaryItem } from "@/types/patient";

export interface PatientStatsSummaryCardProps {
  treatmentCourses: PatientTreatmentCourseSummaryItem[];
}

export const PatientStatsSummaryCard: React.FC<PatientStatsSummaryCardProps> = ({
  treatmentCourses,
}) => {
  const totalCourses = treatmentCourses.length;

  const totalPlannedSessions = treatmentCourses.reduce(
    (acc, c) => acc + (c.planned_session_count || 0),
    0
  );

  const totalCompletedSessions = treatmentCourses.reduce(
    (acc, c) => acc + (c.completed_session_count || 0),
    0
  );

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2">
          <InfoCircleOutlined className="text-[#00897b] text-base" />
          <h3 className="text-base font-bold text-slate-800 m-0">Thông tin tóm tắt</h3>
        </div>
      </div>

      {/* 3 KPI Tiles (Balanced Stack or Grid) */}
      <div className="space-y-2.5 flex-1 flex flex-col justify-center">
        {/* Tổng số liệu trình */}
        <div className="bg-slate-50/80 hover:bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200/70 flex items-center justify-between gap-3 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-teal-100/70 text-teal-700 flex items-center justify-center text-base shrink-0 shadow-2xs">
              <ScheduleOutlined />
            </div>
            <span className="text-xs text-slate-600 font-medium truncate">
              Tổng số liệu trình
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 shrink-0 font-mono">
            {totalCourses} <span className="text-xs font-normal text-slate-500 font-sans">liệu trình</span>
          </div>
        </div>

        {/* Tổng số buổi điều trị */}
        <div className="bg-slate-50/80 hover:bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200/70 flex items-center justify-between gap-3 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center text-base shrink-0 shadow-2xs">
              <CalendarOutlined />
            </div>
            <span className="text-xs text-slate-600 font-medium truncate">
              Tổng số buổi điều trị
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 shrink-0 font-mono">
            {totalPlannedSessions} <span className="text-xs font-normal text-slate-500 font-sans">buổi</span>
          </div>
        </div>

        {/* Tổng số buổi đã hoàn tất */}
        <div className="bg-slate-50/80 hover:bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200/70 flex items-center justify-between gap-3 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center text-base shrink-0 shadow-2xs">
              <CheckCircleOutlined />
            </div>
            <span className="text-xs text-slate-600 font-medium truncate">
              Buổi đã hoàn tất
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 shrink-0 font-mono">
            {totalCompletedSessions} <span className="text-xs font-normal text-slate-500 font-sans">buổi</span>
          </div>
        </div>
      </div>
    </div>
  );
};
