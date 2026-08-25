"use client";

import React from "react";
import { Collapse, Tag } from "antd";
import {
  HistoryOutlined,
  CalendarOutlined,
  UserOutlined,
  MedicineBoxOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import type {
  PatientTreatmentCourseSummaryItem,
  CourseDiagnosisSummaryItem,
  CourseServiceOrderSummaryItem,
} from "@/types/patient";

export interface TreatmentHistoryAccordionProps {
  treatmentCourses: PatientTreatmentCourseSummaryItem[];
  activeCourseId?: string;
}

export const TreatmentHistoryAccordion: React.FC<TreatmentHistoryAccordionProps> = ({
  treatmentCourses,
}) => {
  if (!treatmentCourses || treatmentCourses.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5">
          <HistoryOutlined className="text-[#00897b] text-base" />
          <h3 className="text-base font-bold text-slate-800 m-0">Lịch sử điều trị</h3>
        </div>
        <div className="py-6 text-center text-xs text-slate-400 italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          Chưa có lịch sử điều trị trước đây.
        </div>
      </div>
    );
  }

  // Sort newest first by course_no descending
  const sortedCourses = [...treatmentCourses].sort((a, b) => b.course_no - a.course_no);

  const items = sortedCourses.map((course) => {
    const primaryDiag = course.course_diagnoses?.find(
      (d: CourseDiagnosisSummaryItem) => d.is_primary
    );
    const secondaryDiags =
      course.course_diagnoses?.filter(
        (d: CourseDiagnosisSummaryItem) => !d.is_primary
      ) || [];

    const isCompleted = course.status === "COMPLETED";
    const isCancelled = course.status === "CANCELLED";

    const dateRangeText = course.start_date
      ? `${new Intl.DateTimeFormat("vi-VN").format(new Date(course.start_date))}`
      : "—";

    const completedSessions = course.completed_session_count || 0;
    const plannedSessions = course.planned_session_count || 0;

    const header = (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full pr-2 py-0.5">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
          <span className="font-bold text-slate-900 text-xs sm:text-sm">
            Liệu trình {course.course_no}
          </span>
          <Tag
            color={isCompleted ? "success" : isCancelled ? "error" : "processing"}
            className="m-0 text-[11px] font-medium px-2 py-0.5 rounded-md"
          >
            {isCompleted ? "Hoàn thành" : isCancelled ? "Đã hủy" : "Đang điều trị"}
          </Tag>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="font-mono text-[11px] flex items-center gap-1">
            <CalendarOutlined className="text-slate-400 text-[11px]" />
            <span>{dateRangeText}</span>
          </span>
          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-mono text-[11px]">
            {completedSessions}/{plannedSessions} buổi
          </span>
        </div>
      </div>
    );

    return {
      key: course.id,
      label: header,
      children: (
        <div className="space-y-3.5 text-xs text-slate-700 pt-1 pb-1">
          {/* Bác sĩ phụ trách */}
          {course.doctor_name && (
            <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100/80">
              <UserOutlined className="text-slate-400 text-xs" />
              <span>
                Bác sĩ phụ trách:{" "}
                <strong className="text-slate-800 font-medium">
                  {course.doctor_name}
                </strong>
              </span>
            </div>
          )}

          {/* Chẩn đoán */}
          <div className="space-y-1.5">
            <span className="text-slate-400 font-semibold block text-[11px] flex items-center gap-1">
              <MedicineBoxOutlined className="text-slate-400 text-xs" />
              <span>Chẩn đoán</span>
            </span>

            {primaryDiag ? (
              <div className="bg-teal-50/60 p-2.5 rounded-lg border border-teal-100 flex items-start gap-2">
                <Tag color="cyan" className="m-0 font-mono text-[11px] font-bold shrink-0">
                  {primaryDiag.raw_code}
                </Tag>
                <span className="font-semibold text-slate-900 text-xs leading-relaxed">
                  {primaryDiag.raw_text || primaryDiag.raw_code} (Chính)
                </span>
              </div>
            ) : (
              <div className="text-slate-400 italic text-[11px]">
                Chưa ghi nhận chẩn đoán chính.
              </div>
            )}

            {secondaryDiags.length > 0 && (
              <div className="space-y-1 pl-1 pt-1">
                {secondaryDiags.map((d: CourseDiagnosisSummaryItem) => (
                  <div key={d.id} className="flex items-center gap-2 text-slate-600">
                    <Tag className="m-0 font-mono text-[10px] bg-slate-100 text-slate-700">
                      {d.raw_code}
                    </Tag>
                    <span className="text-[11px]">{d.raw_text || d.raw_code}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DVKT đã chỉ định */}
          {course.course_services && course.course_services.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              <span className="text-slate-400 font-semibold block text-[11px] flex items-center gap-1">
                <AppstoreOutlined className="text-slate-400 text-xs" />
                <span>DVKT đã chỉ định ({course.course_services.length} dịch vụ)</span>
              </span>

              <div className="space-y-1">
                {course.course_services.map((so: CourseServiceOrderSummaryItem) => (
                  <div
                    key={so.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80 border border-slate-100 text-xs"
                  >
                    <span className="font-medium text-slate-800 truncate pr-2">
                      {so.service_name || "Dịch vụ kỹ thuật"}
                    </span>
                    <span className="font-mono text-slate-500 font-medium shrink-0">
                      Thứ tự: {so.sequence_no}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : course.services && course.services.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              <span className="text-slate-400 font-semibold block text-[11px] flex items-center gap-1">
                <AppstoreOutlined className="text-slate-400 text-xs" />
                <span>DVKT đã chỉ định ({course.services.length} dịch vụ)</span>
              </span>

              <div className="space-y-1">
                {course.services.map((sName: string, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80 border border-slate-100 text-xs"
                  >
                    <span className="font-medium text-slate-800 truncate pr-2">
                      {sName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ),
    };
  });

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2">
          <HistoryOutlined className="text-[#00897b] text-base" />
          <h3 className="text-base font-bold text-slate-800 m-0">Lịch sử điều trị</h3>
        </div>
        <Tag
          color="cyan"
          className="m-0 font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md border-teal-200 text-teal-800 bg-teal-50"
        >
          {sortedCourses.length} liệu trình
        </Tag>
      </div>

      {/* Accordion List */}
      <Collapse
        accordion
        items={items}
        defaultActiveKey={[sortedCourses[0]?.id]}
        bordered={false}
        className="bg-transparent space-y-2 [&_.ant-collapse-item]:rounded-xl [&_.ant-collapse-item]:border [&_.ant-collapse-item]:border-slate-200/80 [&_.ant-collapse-item]:bg-white [&_.ant-collapse-item]:shadow-2xs [&_.ant-collapse-header]:p-3.5!"
      />
    </div>
  );
};
