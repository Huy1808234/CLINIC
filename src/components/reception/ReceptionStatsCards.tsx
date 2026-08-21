import React from "react";
import type { ReceptionStats } from "@/types/reception";

export interface ReceptionStatsCardsProps {
  stats: ReceptionStats;
}

export const ReceptionStatsCards: React.FC<ReceptionStatsCardsProps> = ({ stats }) => {
  const cards = [
    {
      label: "Tổng Tiếp Nhận Hôm Nay",
      value: stats.total_today,
      sub: "Bệnh nhân đã điểm danh",
      icon: (
        <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      bg: "bg-teal-50",
    },
    {
      label: "Bệnh Nhân Mới",
      value: stats.new_patients_today,
      sub: "Tạo hồ sơ lần đầu",
      icon: (
        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
      bg: "bg-emerald-50",
    },
    {
      label: "Bệnh Nhân Cũ (Tái Khám)",
      value: stats.returning_patients_today,
      sub: "Tiếp tục liệu trình",
      icon: (
        <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      bg: "bg-sky-50",
    },
    {
      label: "Chờ Khám & Điều Trị",
      value: stats.waiting_exam_count + stats.in_treatment_count,
      sub: `${stats.waiting_exam_count} chờ khám · ${stats.in_treatment_count} đang điều trị`,
      icon: (
        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className={`p-3 rounded-xl ${c.bg}`}>{c.icon}</div>
          <div>
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{c.value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{c.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
