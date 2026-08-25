"use client";

import React from "react";
import {
  ScheduleOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import type { PatientTreatmentCourseSummaryItem } from "@/types/patient";
import { SectionCard, SectionCardHeader } from "./SectionCard";

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
    <SectionCard>
      {/* Shared Section Header */}
      <SectionCardHeader
        icon={<InfoCircleOutlined />}
        title="Thông tin tóm tắt"
      />

      {/* 3 Balanced KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 items-center">
        {/* Tổng số liệu trình */}
        <div className="h-full min-h-[84px] bg-slate-50/80 hover:bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex items-center gap-3 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-teal-100/70 text-teal-700 flex items-center justify-center text-xl shrink-0 shadow-2xs">
            <ScheduleOutlined />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-500 font-medium block truncate">
              Tổng số liệu trình
            </span>
            <div className="text-xl font-bold text-slate-900 mt-0.5 flex items-baseline">
              {totalCourses}
              <span className="text-xs font-normal text-slate-500 ml-1.5">liệu trình</span>
            </div>
          </div>
        </div>

        {/* Tổng số buổi điều trị */}
        <div className="h-full min-h-[84px] bg-slate-50/80 hover:bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex items-center gap-3 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-blue-100/70 text-blue-700 flex items-center justify-center text-xl shrink-0 shadow-2xs">
            <CalendarOutlined />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-500 font-medium block truncate">
              Tổng số buổi điều trị
            </span>
            <div className="text-xl font-bold text-slate-900 mt-0.5 flex items-baseline">
              {totalPlannedSessions}
              <span className="text-xs font-normal text-slate-500 ml-1.5">buổi</span>
            </div>
          </div>
        </div>

        {/* Tổng số buổi đã hoàn tất */}
        <div className="h-full min-h-[84px] bg-slate-50/80 hover:bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex items-center gap-3 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center text-xl shrink-0 shadow-2xs">
            <CheckCircleOutlined />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-500 font-medium block truncate">
              Buổi đã hoàn tất
            </span>
            <div className="text-xl font-bold text-slate-900 mt-0.5 flex items-baseline">
              {totalCompletedSessions}
              <span className="text-xs font-normal text-slate-500 ml-1.5">buổi</span>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
};
