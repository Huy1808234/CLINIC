"use client";

import React from "react";
import { Tag } from "antd";
import {
  ClockCircleOutlined,
  UserOutlined,
  CompassOutlined,
} from "@ant-design/icons";
import type { PatientReceptionSummaryItem } from "@/types/patient";

export interface CurrentVisitCardProps {
  recentReception?: PatientReceptionSummaryItem;
}

export const CurrentVisitCard: React.FC<CurrentVisitCardProps> = ({
  recentReception,
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
  );
};
