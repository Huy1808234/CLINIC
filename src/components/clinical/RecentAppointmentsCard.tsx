"use client";

import React from "react";
import { Tag } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import type { PatientHistorySummary } from "@/types/patient";

export interface RecentAppointmentsCardProps {
  appointments: PatientHistorySummary["recent_appointments"];
}

export const RecentAppointmentsCard: React.FC<RecentAppointmentsCardProps> = ({
  appointments,
}) => {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2">
          <CalendarOutlined className="text-[#00897b] text-base" />
          <h3 className="text-base font-bold text-slate-800 m-0">Lịch hẹn gần đây</h3>
        </div>
        {appointments.length > 0 && (
          <span className="text-xs text-slate-400 font-medium font-mono">
            {appointments.length} lịch hẹn
          </span>
        )}
      </div>

      {/* Content */}
      {appointments.length === 0 ? (
        <div className="py-5 text-center text-xs text-slate-400 italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          Chưa có lịch hẹn gần đây.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2 px-2.5">Ngày</th>
                <th className="py-2 px-2.5">Giờ</th>
                <th className="py-2 px-2.5">Bác Sĩ</th>
                <th className="py-2 px-2.5 text-right">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {appointments.slice(0, 5).map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/50">
                  <td className="py-2 px-2.5 font-mono text-[11px]">{a.appointment_date}</td>
                  <td className="py-2 px-2.5 font-mono font-medium text-[11px]">
                    {a.scheduled_start_at.split("T")[1]?.slice(0, 5) || "—"}
                  </td>
                  <td className="py-2 px-2.5 truncate max-w-[100px] text-[11px]">
                    {a.doctor_name || "—"}
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <Tag
                      color={a.status === "COMPLETED" ? "success" : "default"}
                      className="m-0 text-[10px] font-medium"
                    >
                      {a.status === "COMPLETED" ? "Đã hoàn thành" : a.status}
                    </Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
