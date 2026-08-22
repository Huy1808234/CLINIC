"use client";

import React from "react";
import Link from "next/link";
import type { ReceptionQueueItem } from "@/types/reception";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatTimeVN } from "@/utils/format-time";

export interface ReceptionQueueTableProps {
  items: ReceptionQueueItem[];
  onCheckInSession?: (courseId: string) => void;
}

export const ReceptionQueueTable: React.FC<ReceptionQueueTableProps> = ({
  items,
  onCheckInSession,
}) => {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-slate-900">Chưa Có Bệnh Nhân Tiếp Nhận Hôm Nay</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Nhấn &quot;Tiếp Nhận Khám Mới&quot; để đăng ký bệnh nhân mới hoặc tìm kiếm bệnh nhân tái khám.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Danh Sách Tiếp Nhận Trong Ngày ({items.length})
        </h3>
        <Badge variant="success">Hôm nay</Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
            <tr>
              <th className="py-3 px-4">Giờ Đến</th>
              <th className="py-3 px-4">Bệnh Nhân</th>
              <th className="py-3 px-4">Phân Loại</th>
              <th className="py-3 px-4">BHYT</th>
              <th className="py-3 px-4">Liệu Trình</th>
              <th className="py-3 px-4">Bác Sĩ</th>
              <th className="py-3 px-4 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {items.map((item) => {
              const arrivedTime = formatTimeVN(item.arrived_at.split("T")[1]?.slice(0, 5));
              const isNew = item.patient_relation_type === "NEW";

              return (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                    {arrivedTime}
                  </td>
                  <td className="py-3.5 px-4">
                    <Link
                      href={`/patients/${item.patient.id}`}
                      className="font-semibold text-teal-700 hover:underline block"
                    >
                      {item.patient.full_name}
                    </Link>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {item.patient.patient_code} {item.patient.phone ? `· ${item.patient.phone}` : ""}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {isNew ? (
                      <Badge variant="success" size="sm">Mới (Lần đầu)</Badge>
                    ) : (
                      <Badge variant="secondary" size="sm">Tái khám</Badge>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {item.patient.current_insurance ? (
                      <div>
                        <span className="font-mono font-semibold text-slate-800 text-[11px]">
                          {item.patient.current_insurance.card_number}
                        </span>
                        {item.patient.current_insurance.benefit_rate && (
                          <span className="ml-1.5 text-[10px] text-emerald-700 font-semibold">
                            ({item.patient.current_insurance.benefit_rate}%)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {item.active_course ? (
                      <div>
                        <Badge variant="default" size="sm">
                          LT{item.active_course.course_no} ({item.active_course.completed_session_count}/
                          {item.active_course.planned_session_count ?? "—"})
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Chưa tạo</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">
                    {item.active_course?.doctor_name || "—"}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {item.active_course && onCheckInSession && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onCheckInSession(item.active_course!.id)}
                        >
                          Điểm Danh
                        </Button>
                      )}
                      <Link href={`/patients/${item.patient.id}`}>
                        <Button size="sm" variant="ghost">
                          Hồ Sơ
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
