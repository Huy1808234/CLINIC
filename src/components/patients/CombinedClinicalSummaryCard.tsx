"use client";

import React from "react";
import { Tag } from "antd";
import {
  ScheduleOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  MedicineBoxOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type {
  PatientTreatmentCourseSummaryItem,
  PatientCourseDiagnosisSummaryItem,
} from "@/types/patient";
import { EmptyStatePanel } from "./SectionCard";

export interface CombinedClinicalSummaryCardProps {
  treatmentCourses: PatientTreatmentCourseSummaryItem[];
  latestPrimaryDiag?: PatientCourseDiagnosisSummaryItem | null;
  doctorName?: string | null;
  diagnosisDate?: string | null;
}

export const CombinedClinicalSummaryCard: React.FC<CombinedClinicalSummaryCardProps> = ({
  treatmentCourses,
  latestPrimaryDiag,
  doctorName,
  diagnosisDate,
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

  const formattedDate = diagnosisDate
    ? new Intl.DateTimeFormat("vi-VN").format(new Date(diagnosisDate))
    : null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs h-full flex flex-col justify-between">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-stretch">
        {/* LEFT HALF: THÔNG TIN TÓM TẮT (~55% or col-span-7) */}
        <div className="lg:col-span-7 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-100 pb-6 lg:pb-0 lg:pr-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 shrink-0 min-h-[36px]">
            <div className="flex items-center gap-2">
              <InfoCircleOutlined className="text-[#00897b] text-base" />
              <h3 className="text-base font-bold text-slate-800 m-0">Thông tin tóm tắt</h3>
            </div>
          </div>

          {/* 3 Horizontal Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 items-center">
            {/* Tổng số liệu trình */}
            <div className="h-full min-h-[76px] bg-slate-50/80 hover:bg-slate-50 p-3 rounded-xl border border-slate-200/70 flex flex-col justify-center transition-colors">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <ScheduleOutlined className="text-teal-700 text-sm" />
                <span className="text-[11px] font-medium truncate">Tổng số liệu trình</span>
              </div>
              <div className="text-lg font-bold text-slate-900 font-mono">
                {totalCourses}{" "}
                <span className="text-xs font-normal text-slate-500 font-sans">liệu trình</span>
              </div>
            </div>

            {/* Tổng số buổi điều trị */}
            <div className="h-full min-h-[76px] bg-slate-50/80 hover:bg-slate-50 p-3 rounded-xl border border-slate-200/70 flex flex-col justify-center transition-colors">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <CalendarOutlined className="text-blue-700 text-sm" />
                <span className="text-[11px] font-medium truncate">Tổng số buổi điều trị</span>
              </div>
              <div className="text-lg font-bold text-slate-900 font-mono">
                {totalPlannedSessions}{" "}
                <span className="text-xs font-normal text-slate-500 font-sans">buổi</span>
              </div>
            </div>

            {/* Buổi đã hoàn tất */}
            <div className="h-full min-h-[76px] bg-slate-50/80 hover:bg-slate-50 p-3 rounded-xl border border-slate-200/70 flex flex-col justify-center transition-colors">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <CheckCircleOutlined className="text-emerald-700 text-sm" />
                <span className="text-[11px] font-medium truncate">Buổi đã hoàn tất</span>
              </div>
              <div className="text-lg font-bold text-slate-900 font-mono">
                {totalCompletedSessions}{" "}
                <span className="text-xs font-normal text-slate-500 font-sans">buổi</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT HALF: CHẨN ĐOÁN CHÍNH GẦN NHẤT (~45% or col-span-5) */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 shrink-0 min-h-[36px]">
            <div className="flex items-center gap-2">
              <MedicineBoxOutlined className="text-[#00897b] text-base" />
              <h3 className="text-base font-bold text-slate-800 m-0">Chẩn đoán chính gần nhất</h3>
            </div>
            {latestPrimaryDiag?.raw_code && (
              <Tag
                color="cyan"
                className="m-0 font-mono text-xs font-semibold px-2 py-0.5 rounded-md border-teal-200 text-teal-800 bg-teal-50"
              >
                {latestPrimaryDiag.raw_code}
              </Tag>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col justify-center">
            {latestPrimaryDiag ? (
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 space-y-2.5">
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                  <span className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">
                    {latestPrimaryDiag.raw_text || latestPrimaryDiag.raw_code}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-1.5 border-t border-slate-200/50">
                  {doctorName && (
                    <span className="flex items-center gap-1">
                      <UserOutlined className="text-slate-400 text-xs" />
                      <span>
                        Bác sĩ: <strong className="text-slate-700 font-medium">{doctorName}</strong>
                      </span>
                    </span>
                  )}
                  {formattedDate && (
                    <span className="flex items-center gap-1">
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
                className="min-h-[76px] py-3.5"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
