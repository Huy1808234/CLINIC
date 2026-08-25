"use client";

import React from "react";
import { Tag, Progress } from "antd";
import {
  ScheduleOutlined,
  CalendarOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { PatientTreatmentCourseSummaryItem } from "@/types/patient";

export interface CurrentCourseSummaryCardProps {
  currentCourse?: PatientTreatmentCourseSummaryItem | null;
}

export const CurrentCourseSummaryCard: React.FC<CurrentCourseSummaryCardProps> = ({
  currentCourse,
}) => {
  if (!currentCourse) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5">
          <ScheduleOutlined className="text-[#00897b] text-base" />
          <h3 className="text-base font-bold text-slate-800 m-0">Thông tin liệu trình hiện tại</h3>
        </div>
        <div className="py-6 text-center text-xs text-slate-400 italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          Chưa có liệu trình điều trị nào được khởi tạo.
        </div>
      </div>
    );
  }

  const completed = currentCourse.completed_session_count || 0;
  const planned = currentCourse.planned_session_count || 0;
  const progressPercent = planned > 0 ? Math.min(100, Math.round((completed / planned) * 100)) : 0;

  const startDateText = currentCourse.start_date
    ? new Intl.DateTimeFormat("vi-VN").format(new Date(currentCourse.start_date))
    : "—";

  const isCompleted = currentCourse.status === "COMPLETED";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2">
          <ScheduleOutlined className="text-[#00897b] text-base" />
          <h3 className="text-base font-bold text-slate-800 m-0">Liệu trình hiện tại</h3>
        </div>
        <Tag
          color={isCompleted ? "success" : "processing"}
          className="m-0 text-xs font-semibold px-2.5 py-0.5 rounded-md"
        >
          {isCompleted ? "Hoàn thành" : "Đang điều trị"}
        </Tag>
      </div>

      {/* Course Info */}
      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900 text-sm">
            Liệu trình {currentCourse.course_no}
          </span>
          <span className="text-slate-500 font-mono text-xs flex items-center gap-1">
            <CalendarOutlined className="text-slate-400 text-xs" />
            <span>Bắt đầu: {startDateText}</span>
          </span>
        </div>

        {/* Progress bar */}
        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Tiến độ buổi điều trị</span>
            <span className="font-bold text-slate-900 font-mono">
              {completed} / {planned} buổi ({progressPercent}%)
            </span>
          </div>
          <Progress
            percent={progressPercent}
            showInfo={false}
            strokeColor="#00897b"
            trailColor="#e2e8f0"
            size="small"
          />
        </div>

        {currentCourse.doctor_name && (
          <div className="text-slate-500 flex items-center gap-1.5 pt-1">
            <UserOutlined className="text-slate-400 text-xs" />
            <span>Bác sĩ phụ trách: <strong className="text-slate-700 font-medium">{currentCourse.doctor_name}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
};
