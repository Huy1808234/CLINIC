"use client";

import React from "react";
import type { DayTimelineData, DayTimelineSlot } from "@/types/schedule";
import type { AppointmentWithDetails } from "@/types/appointment";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface DayTimelineGridProps {
  timelineData: DayTimelineData;
  onAppointmentClick?: (appointment: AppointmentWithDetails) => void;
  onStatusChange?: (appointmentId: string, newStatus: AppointmentWithDetails["status"]) => void;
  /** ID of the appointment currently undergoing a server transition (disables its action buttons) */
  loadingApptId?: string | null;
}

export const DayTimelineGrid: React.FC<DayTimelineGridProps> = ({
  timelineData,
  onAppointmentClick,
  onStatusChange,
  loadingApptId,
}) => {
  // Filter slots to only show times with active appointments or every 30 mins
  const activeSlots = timelineData.slots.filter((slot) => {
    const hasAppts = Object.values(slot.appointments_by_doctor).some((list) => list.length > 0);
    const isMajorInterval = slot.time_str.endsWith(":00") || slot.time_str.endsWith(":30");
    return hasAppts || isMajorInterval;
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      {/* Header with Doctor Columns */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <th className="py-3 px-4 w-24 border-r border-slate-200 text-center font-mono">
                Khung Giờ
              </th>
              {timelineData.doctors.map((doc) => (
                <th key={doc.id} className="py-3 px-4 min-w-[240px] border-r border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-teal-600 text-white font-bold text-[10px] flex items-center justify-center">
                      {doc.code.slice(0, 3)}
                    </span>
                    <span className="text-sm font-bold text-slate-900">{doc.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeSlots.map((slot: DayTimelineSlot) => (
              <tr key={slot.time_str} className="hover:bg-slate-50/40 transition-colors">
                {/* Time Column */}
                <td className="py-3 px-3 text-center border-r border-slate-200 font-mono font-semibold text-slate-500 bg-slate-50/30">
                  {slot.time_str}
                </td>

                {/* Doctor Slot Columns */}
                {timelineData.doctors.map((doc) => {
                  const appts = slot.appointments_by_doctor[doc.id] || [];

                  return (
                    <td key={doc.id} className="p-2 border-r border-slate-200 align-top">
                      {appts.length === 0 ? (
                        <div className="h-8 rounded-lg border border-dashed border-slate-100 flex items-center justify-center text-slate-300 text-[10px]">
                          Trống
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {appts.map((appt) => {
                            const isLoading = loadingApptId === appt.id;

                            return (
                              <div
                                key={appt.id}
                                className="p-3 rounded-lg border border-slate-200 bg-white shadow-xs hover:border-teal-400 transition-all cursor-pointer"
                                onClick={() => onAppointmentClick && onAppointmentClick(appt)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-semibold text-slate-900 text-xs">
                                      {appt.patient_name}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                      {appt.patient_code} · LT{appt.course_no}
                                    </p>
                                  </div>
                                  <Badge
                                    variant={
                                      appt.status === "COMPLETED"
                                        ? "success"
                                        : appt.status === "IN_TREATMENT"
                                        ? "purple"
                                        : appt.status === "CHECKED_IN"
                                        ? "warning"
                                        : appt.status === "NO_SHOW"
                                        ? "danger"
                                        : "secondary"
                                    }
                                    size="sm"
                                  >
                                    {appt.status === "PLANNED"
                                      ? "Chưa đến"
                                      : appt.status === "CHECKED_IN"
                                      ? "Đã điểm danh"
                                      : appt.status === "IN_TREATMENT"
                                      ? "Đang điều trị"
                                      : appt.status === "COMPLETED"
                                      ? "Hoàn thành"
                                      : appt.status === "NO_SHOW"
                                      ? "Vắng mặt"
                                      : appt.status === "CANCELLED"
                                      ? "Đã hủy"
                                      : appt.status}
                                  </Badge>
                                </div>

                                {/* Attendance & Clinical Action buttons */}
                                <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-100 flex-wrap">
                                  {appt.status === "PLANNED" && onStatusChange && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-[11px] h-7 px-2 border-teal-500 text-teal-700 hover:bg-teal-50"
                                        disabled={isLoading}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onStatusChange(appt.id, "CHECKED_IN");
                                        }}
                                      >
                                        {isLoading ? "..." : "Điểm danh"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-[11px] h-7 px-2 text-rose-600 hover:bg-rose-50"
                                        disabled={isLoading}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onStatusChange(appt.id, "NO_SHOW");
                                        }}
                                      >
                                        {isLoading ? "..." : "Vắng"}
                                      </Button>
                                    </>
                                  )}
                                  {/* CHECKED_IN: NO Vắng button — patient has already arrived.
                                      CHECKED_IN → NO_SHOW is semantically forbidden. */}
                                  {appt.status === "CHECKED_IN" && onStatusChange && (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      className="text-[11px] h-7 px-2 bg-teal-600 hover:bg-teal-700"
                                      disabled={isLoading}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onStatusChange(appt.id, "IN_TREATMENT");
                                      }}
                                    >
                                      {isLoading ? "..." : "Bắt đầu điều trị"}
                                    </Button>
                                  )}
                                  {appt.status === "IN_TREATMENT" && onStatusChange && (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      className="text-[11px] h-7 px-2 bg-emerald-600 hover:bg-emerald-700"
                                      disabled={isLoading}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onStatusChange(appt.id, "COMPLETED");
                                      }}
                                    >
                                      {isLoading ? "..." : "Hoàn tất"}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
