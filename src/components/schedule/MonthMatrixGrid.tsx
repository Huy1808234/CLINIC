"use client";

import React from "react";
import type { MonthMatrixData, MonthMatrixCell } from "@/types/schedule";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface MonthMatrixGridProps {
  matrixData: MonthMatrixData;
  onCellClick?: (cell: MonthMatrixCell, patientName: string, day: number) => void;
  onAutoScheduleClick?: (doctorId: string) => void;
}

export const MonthMatrixGrid: React.FC<MonthMatrixGridProps> = ({
  matrixData,
  onCellClick,
  onAutoScheduleClick,
}) => {
  const days = Array.from({ length: matrixData.days_in_month }, (_, i) => i + 1);

  // Status background and text styles
  const getCellStatusStyle = (status: MonthMatrixCell["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100";
      case "IN_TREATMENT":
      case "IN_EXAM":
        return "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100";
      case "CHECKED_IN":
        return "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100";
      case "NO_SHOW":
      case "CANCELLED":
        return "bg-rose-50 text-rose-800 border-rose-200 line-through opacity-70";
      case "RESCHEDULED":
        return "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100";
      case "PLANNED":
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100";
    }
  };

  return (
    <div className="space-y-8">
      {matrixData.doctor_blocks.map((doctorBlock) => (
        <div
          key={doctorBlock.doctor_id}
          className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden"
        >
          {/* Doctor Block Header */}
          <div className="bg-slate-50/80 px-6 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {doctorBlock.doctor_code.slice(0, 3)}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{doctorBlock.doctor_name}</h3>
                <p className="text-[11px] text-slate-500">
                  {doctorBlock.patient_rows.length} bệnh nhân trong tháng · {doctorBlock.total_appointments} lịch hẹn
                </p>
              </div>
            </div>

            {onAutoScheduleClick && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAutoScheduleClick(doctorBlock.doctor_id)}
              >
                <svg className="w-3.5 h-3.5 mr-1.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Xếp Lịch Tự Động
              </Button>
            )}
          </div>

          {/* Matrix Grid Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-4 sticky left-0 z-20 bg-slate-100 min-w-[200px] border-r border-slate-200 shadow-xs">
                    Bệnh Nhân / Liệu Trình
                  </th>
                  <th className="py-2.5 px-3 sticky left-[200px] z-20 bg-slate-100 min-w-[80px] border-r border-slate-200 text-center shadow-xs">
                    Thẻ / Tag
                  </th>
                  {days.map((day) => (
                    <th
                      key={day}
                      className="py-2 px-1 text-center min-w-[54px] max-w-[60px] border-r border-slate-200 font-mono text-[11px]"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {doctorBlock.patient_rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={days.length + 2}
                      className="py-8 text-center text-xs text-slate-400 italic"
                    >
                      Chưa có lịch điều trị cho bác sĩ này trong tháng {matrixData.month_str}
                    </td>
                  </tr>
                ) : (
                  doctorBlock.patient_rows.map((row) => (
                    <tr key={row.treatment_course_id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Patient Name Sticky Column */}
                      <td className="py-2.5 px-4 sticky left-0 z-10 bg-white border-r border-slate-200">
                        <span className="font-semibold text-slate-900 block truncate max-w-[180px]">
                          {row.patient_name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-400 font-mono">{row.patient_code}</span>
                          <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1 rounded">
                            LT{row.course_no}
                          </span>
                        </div>
                      </td>

                      {/* Tags Sticky Column */}
                      <td className="py-2.5 px-2 sticky left-[200px] z-10 bg-white border-r border-slate-200 text-center">
                        {row.tags && row.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {row.tags.map((tag, idx) => (
                              <Badge key={idx} variant="purple" size="sm">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[10px]">—</span>
                        )}
                      </td>

                      {/* Day 1..31 Cells */}
                      {days.map((day) => {
                        const cell = row.cells[day];
                        if (!cell) {
                          return (
                            <td
                              key={day}
                              className="py-2 px-1 text-center border-r border-slate-100 text-slate-200"
                            >
                              ·
                            </td>
                          );
                        }

                        return (
                          <td key={day} className="p-0.5 border-r border-slate-200 text-center">
                            <button
                              onClick={() => onCellClick && onCellClick(cell, row.patient_name, day)}
                              className={`w-full py-1.5 px-1 rounded border text-[11px] font-mono font-medium transition-transform hover:scale-105 flex flex-col items-center justify-center cursor-pointer ${getCellStatusStyle(
                                cell.status
                              )}`}
                              title={`Lịch hẹn ngày ${day}/${matrixData.month_str} (${cell.status})`}
                            >
                              <span className="leading-none">{cell.time_str || "—"}</span>
                              {cell.manual_override && (
                                <svg
                                  className="w-2.5 h-2.5 text-amber-600 mt-0.5"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};
