"use client";

import React from "react";
import { Button, Tag } from "antd";
import {
  PlayCircleOutlined,
  ClockCircleOutlined,
  MedicineBoxOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { PatientReceptionSummaryItem } from "@/types/patient";

export interface CurrentVisitSummaryCardProps {
  recentReception?: PatientReceptionSummaryItem;
  isDoctor: boolean;
  onStartExam: () => void;
}

export const CurrentVisitSummaryCard: React.FC<CurrentVisitSummaryCardProps> = ({
  recentReception,
  isDoctor,
  onStartExam,
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
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <ClockCircleOutlined className="text-teal-600 text-base" />
          <h3 className="text-base font-bold text-slate-800 m-0">Buổi khám hiện tại</h3>
        </div>
        <Tag
          color="cyan"
          className="m-0 text-xs font-semibold px-2.5 py-0.5 rounded-full border-teal-200 text-teal-800 bg-teal-50"
        >
          Đang chờ khám
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
          <span className="text-slate-400 font-medium block text-[11px]">Nguồn tiếp nhận</span>
          <span className="font-semibold text-slate-800 mt-0.5 block text-[13px]">
            {recentReception?.reception_source || "Khám trực tiếp"}
          </span>
        </div>
        <div>
          <span className="text-slate-400 font-medium block text-[11px]">Tiếp nhận bởi</span>
          <span className="font-semibold text-slate-800 mt-0.5 block text-[13px] flex items-center gap-1">
            <UserOutlined className="text-slate-400 text-[11px]" />
            <span>{recentReception?.created_by_name || "Nhân viên tiếp đón"}</span>
          </span>
        </div>
      </div>

      {/* Symptoms & Reason for Visit */}
      <div className="space-y-3 text-xs">
        <div>
          <span className="text-slate-400 font-semibold block text-[11px] mb-1">
            Lý do đến khám
          </span>
          <div className="text-slate-800 font-medium bg-slate-50/50 p-3 rounded-lg border border-slate-100 text-[13px] leading-relaxed">
            {recentReception?.reason_for_visit || "Bệnh nhân đến khám theo nhu cầu."}
          </div>
        </div>

        {recentReception?.notes && (
          <div>
            <span className="text-slate-400 font-semibold block text-[11px] mb-1">
              Ghi chú triệu chứng tiếp nhận
            </span>
            <div className="text-slate-700 bg-slate-50/50 p-3 rounded-lg border border-slate-100 italic text-[12px]">
              {recentReception.notes}
            </div>
          </div>
        )}
      </div>

      {/* Start Examination Callout Banner */}
      <div className="bg-gradient-to-b from-teal-50/70 to-teal-50/20 border border-teal-100 rounded-xl p-5 text-center space-y-3">
        <div className="w-11 h-11 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mx-auto text-lg shadow-2xs">
          <MedicineBoxOutlined />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-sm font-bold text-slate-800 m-0">Bệnh nhân đã được tiếp nhận</h4>
          <p className="text-xs text-slate-500 m-0">
            Vui lòng xem lại thông tin hành chính và triệu chứng trước khi bắt đầu khám.
          </p>
        </div>

        {isDoctor ? (
          <div className="pt-1.5">
            <Button
              type="primary"
              size="large"
              icon={<PlayCircleOutlined />}
              onClick={onStartExam}
              className="bg-[#00897b] hover:bg-teal-700 font-bold px-7 h-10 text-xs rounded-xl shadow-xs border-0 inline-flex items-center justify-center gap-2"
            >
              Bắt đầu khám
            </Button>
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic pt-1">
            Chỉ Bác sĩ phụ trách mới có thể thực hiện khám và chỉ định lâm sàng.
          </div>
        )}
      </div>
    </div>
  );
};
