"use client";

import React from "react";
import { Collapse, Tag } from "antd";
import { HistoryOutlined, UserOutlined } from "@ant-design/icons";
import type { PatientHistorySummary } from "@/types/patient";

export interface TreatmentHistoryAccordionProps {
  treatmentCourses: PatientHistorySummary["treatment_courses"];
  activeCourseId?: string;
}

export const TreatmentHistoryAccordion: React.FC<TreatmentHistoryAccordionProps> = ({
  treatmentCourses,
  activeCourseId,
}) => {
  // Sort courses newest first by course_no descending
  const sortedCourses = [...treatmentCourses].sort((a, b) => b.course_no - a.course_no);

  const getStatusTag = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <Tag color="success" className="m-0 text-[10px] font-semibold px-2 py-0.2 rounded-md">
            Hoàn tất
          </Tag>
        );
      case "ACTIVE":
        return (
          <Tag
            color="cyan"
            className="m-0 text-[10px] font-semibold px-2 py-0.2 rounded-md border-teal-200 text-teal-800 bg-teal-50"
          >
            Đang điều trị
          </Tag>
        );
      case "PAUSED":
        return (
          <Tag color="warning" className="m-0 text-[10px] font-semibold px-2 py-0.2 rounded-md">
            Tạm ngưng
          </Tag>
        );
      case "PLANNED":
        return (
          <Tag color="blue" className="m-0 text-[10px] font-semibold px-2 py-0.2 rounded-md">
            Kế hoạch
          </Tag>
        );
      default:
        return <Tag color="default" className="m-0 text-[10px]">{status}</Tag>;
    }
  };

  const collapseItems = sortedCourses.map((course) => {
    const isCurrent = course.id === activeCourseId;
    const progressLabel = `${course.completed_session_count}/${course.planned_session_count ?? "—"} buổi`;

    return {
      key: course.id,
      label: (
        <div className="flex items-center justify-between w-full pr-2 text-xs py-0.5">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isCurrent ? "bg-teal-500 ring-4 ring-teal-100" : "bg-slate-300"
              }`}
            />
            <span className="font-bold text-slate-800 text-[13px]">
              Liệu trình LT{course.course_no}
            </span>
            {getStatusTag(course.status)}
          </div>
          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
            <span>{course.start_date}</span>
            <span>·</span>
            <span className="font-semibold text-slate-700">{progressLabel}</span>
          </div>
        </div>
      ),
      children: (
        <div className="space-y-3 text-xs pt-1 text-slate-700">
          {/* Doctor & Progress */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Bác sĩ phụ trách</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                <UserOutlined className="text-slate-400 text-[10px]" />
                <span>{course.doctor_name || "Chưa phân công"}</span>
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Tiến độ điều trị</span>
              <span className="font-semibold text-slate-800 mt-0.5 block font-mono">
                {course.completed_session_count} buổi đã thực hiện
                {course.planned_session_count ? ` / ${course.planned_session_count} buổi dự kiến` : ""}
              </span>
            </div>
          </div>

          {/* Diagnoses */}
          <div>
            <span className="text-[11px] text-slate-400 font-medium block mb-1">
              Chẩn đoán ghi nhận:
            </span>
            {course.diagnoses && course.diagnoses.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {course.diagnoses.map((d, i) => (
                  <Tag key={i} color="blue" className="m-0 text-xs font-mono">
                    {d}
                  </Tag>
                ))}
              </div>
            ) : (
              <span className="text-slate-400 italic">Chưa có chẩn đoán.</span>
            )}
          </div>

          {/* Prescribed DVKT */}
          <div>
            <span className="text-[11px] text-slate-400 font-medium block mb-1">
              Dịch vụ kỹ thuật chỉ định:
            </span>
            {course.services && course.services.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {course.services.map((s, i) => (
                  <Tag key={i} color="purple" className="m-0 text-xs font-medium">
                    {s}
                  </Tag>
                ))}
              </div>
            ) : (
              <span className="text-slate-400 italic">Chưa có chỉ định DVKT.</span>
            )}
          </div>
        </div>
      ),
    };
  });

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3.5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <HistoryOutlined className="text-teal-600 text-base" />
          <h3 className="text-sm font-bold text-slate-800 m-0">Lịch sử điều trị</h3>
        </div>
        <span className="text-xs text-slate-400 font-medium font-mono">
          {treatmentCourses.length} liệu trình
        </span>
      </div>

      {sortedCourses.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-400">
          Chưa có liệu trình điều trị trước đó.
        </div>
      ) : (
        <Collapse
          accordion={true}
          size="small"
          className="bg-slate-50/40 rounded-xl border border-slate-200"
          items={collapseItems}
        />
      )}
    </div>
  );
};
