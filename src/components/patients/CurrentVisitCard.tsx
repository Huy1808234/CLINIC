"use client";

import React from "react";
import { Tag, Button } from "antd";
import {
  ClockCircleOutlined,
  UserOutlined,
  CompassOutlined,
  PlayCircleOutlined,
  MedicineBoxOutlined,
  CheckCircleOutlined,
  UpOutlined,
} from "@ant-design/icons";
import type {
  PatientReceptionSummaryItem,
  PatientTreatmentCourseSummaryItem,
} from "@/types/patient";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";
import { DoctorCurrentExamWorkspace } from "@/components/clinical/DoctorCurrentExamWorkspace";

export interface CurrentVisitCardProps {
  recentReception?: PatientReceptionSummaryItem;
  currentCourse?: PatientTreatmentCourseSummaryItem | null;
  diagnosesCatalog?: DiagnosisCatalogItem[];
  servicesCatalog?: ServiceCatalogItem[];
  isDoctor?: boolean;
  isExamStarted?: boolean;
  onStartExam?: () => void;
  onCollapseExam?: () => void;
}

export const CurrentVisitCard: React.FC<CurrentVisitCardProps> = ({
  recentReception,
  currentCourse,
  diagnosesCatalog = [],
  servicesCatalog = [],
  isDoctor = false,
  isExamStarted = false,
  onStartExam,
  onCollapseExam,
}) => {
  const arrivalTime = recentReception?.arrived_at || recentReception?.registered_at;
  const formattedTime = arrivalTime
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(arrivalTime))
    : "Hôm nay";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5 h-full flex flex-col justify-between">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <ClockCircleOutlined className="text-[#00897b] text-base" />
            <h3 className="text-base font-bold text-slate-800 m-0">Buổi khám hiện tại</h3>
          </div>
          <Tag
            color="cyan"
            className="m-0 text-xs font-semibold px-2.5 py-0.5 rounded-md border-teal-200 text-teal-800 bg-teal-50"
          >
            {isExamStarted ? "Đang khám" : "Đang chờ khám"}
          </Tag>
        </div>

        {/* Intake / Reception Metadata Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
          <div>
            <span className="text-slate-400 font-medium block text-[11px]">Thời gian tiếp nhận</span>
            <span className="font-semibold text-slate-800 mt-0.5 block font-mono text-[13px]">
              {formattedTime}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-medium block text-[11px] flex items-center gap-1">
              <CompassOutlined className="text-slate-400 text-[11px]" />
              <span>Nguồn tiếp nhận</span>
            </span>
            <span className="font-semibold text-slate-800 mt-0.5 block text-[13px]">
              {recentReception?.reception_source || "Khám trực tiếp"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-medium block text-[11px] flex items-center gap-1">
              <UserOutlined className="text-slate-400 text-[11px]" />
              <span>Tiếp nhận bởi</span>
            </span>
            <span className="font-semibold text-slate-800 mt-0.5 block text-[13px]">
              {recentReception?.created_by_name || "Nhân viên tiếp đón"}
            </span>
          </div>
        </div>

        {/* Lý do đến khám & Ghi chú triệu chứng ban đầu */}
        <div className="space-y-3 text-xs">
          <div>
            <span className="text-slate-400 font-semibold block text-[11px] mb-1">
              Lý do đến khám
            </span>
            <div className="text-slate-800 font-medium bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-[13px] leading-relaxed">
              {recentReception?.reason_for_visit || "Bệnh nhân đến khám theo nhu cầu."}
            </div>
          </div>

          {recentReception?.notes && (
            <div>
              <span className="text-slate-400 font-semibold block text-[11px] mb-1">
                Ghi chú triệu chứng ban đầu
              </span>
              <div className="text-slate-700 bg-slate-50/50 p-3 rounded-xl border border-slate-100 italic text-[12px] leading-relaxed">
                {recentReception.notes}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Integrated Start Examination Area */}
      <div className="pt-2 border-t border-slate-100 mt-4">
        {!isExamStarted ? (
          <div className="rounded-xl border border-teal-100 bg-gradient-to-b from-teal-50/60 via-teal-50/20 to-transparent p-5 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100/80 text-[#00897b] flex items-center justify-center mx-auto text-lg shadow-2xs">
              <MedicineBoxOutlined />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-slate-800 m-0">Bệnh nhân đã được tiếp nhận</h4>
              <p className="text-xs text-slate-500 m-0 max-w-md mx-auto leading-relaxed">
                Vui lòng xem lại thông tin hành chính, lý do khám và bấm Bắt đầu khám để tiến hành chẩn đoán và chỉ định điều trị.
              </p>
            </div>

            {isDoctor ? (
              <div className="pt-1.5">
                <Button
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  onClick={onStartExam}
                  className="bg-[#00897b] hover:bg-teal-700 font-bold px-8 h-10 text-xs rounded-xl shadow-xs border-0 inline-flex items-center justify-center gap-2"
                >
                  Bắt đầu khám
                </Button>
              </div>
            ) : (
              <div className="pt-1.5 text-xs text-slate-400 italic">
                Chỉ Bác sĩ phụ trách mới có quyền thực hiện khám và chỉ định điều trị.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-teal-200/80 bg-teal-50/60 p-3.5 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#00897b] text-white flex items-center justify-center text-xs font-bold">
                  <CheckCircleOutlined />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 m-0">Đang trong quá trình khám</h4>
                  <p className="text-[11px] text-teal-800 m-0">
                    Nhập chẩn đoán, chọn gợi ý DVKT TT06 và thiết lập kế hoạch điều trị.
                  </p>
                </div>
              </div>

              {onCollapseExam && (
                <Button
                  size="small"
                  type="text"
                  icon={<UpOutlined />}
                  onClick={onCollapseExam}
                  className="text-xs text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  Thu gọn
                </Button>
              )}
            </div>

            {currentCourse ? (
              <DoctorCurrentExamWorkspace
                currentCourse={currentCourse}
                diagnosesCatalog={diagnosesCatalog}
                servicesCatalog={servicesCatalog}
                isDoctor={isDoctor}
              />
            ) : (
              <div className="rounded-xl border border-slate-200/80 bg-white p-6 text-center text-xs text-slate-400">
                Bệnh nhân chưa có liệu trình điều trị nào được khởi tạo.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
