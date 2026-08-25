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
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2">
          <InfoCircleOutlined className="text-[#00897b] text-base" />
          <h3 className="text-base font-bold text-slate-800 m-0">Thông tin tóm tắt</h3>
        </div>
      </div>

      {/* 3 KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Tổng số liệu trình */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#00897b] flex items-center justify-center text-lg shrink-0">
            <ScheduleOutlined />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">
              Tổng số liệu trình
            </span>
            <span className="text-lg font-bold text-slate-900 mt-0.5 block">
              {totalCourses} <span className="text-xs font-normal text-slate-500">liệu trình</span>
            </span>
          </div>
        </div>

        {/* Tổng số buổi điều trị */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg shrink-0">
            <CalendarOutlined />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">
              Tổng số buổi điều trị
            </span>
            <span className="text-lg font-bold text-slate-900 mt-0.5 block">
              {totalPlannedSessions} <span className="text-xs font-normal text-slate-500">buổi</span>
            </span>
          </div>
        </div>

        {/* Tổng số buổi đã hoàn tất */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shrink-0">
            <CheckCircleOutlined />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">
              Buổi đã hoàn tất
            </span>
            <span className="text-lg font-bold text-slate-900 mt-0.5 block">
              {totalCompletedSessions} <span className="text-xs font-normal text-slate-500">buổi</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
