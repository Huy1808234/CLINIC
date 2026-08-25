"use client";

import React, { useState } from "react";
import type { MonthMatrixData, DayTimelineData, MonthMatrixCell } from "@/types/schedule";
import type { DoctorStaffItem } from "@/rsc-data/treatment/get-catalogs";
import { MonthMatrixGrid } from "./MonthMatrixGrid";
import { DayTimelineGrid } from "./DayTimelineGrid";
import { AutoScheduleModal } from "./AutoScheduleModal";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useRealtimeSchedule } from "@/hooks/useRealtimeSchedule";
import type { AppointmentWithDetails } from "@/types/appointment";
import { autoScheduleAction, updateAppointmentStatusAction } from "@/app/actions/scheduling-actions";

export interface ScheduleClientViewProps {
  initialMatrix: MonthMatrixData;
  initialTimeline: DayTimelineData;
  doctors: DoctorStaffItem[];
  clinicTodayDate?: string;
  clinicTimezone?: string;
}

export const ScheduleClientView: React.FC<ScheduleClientViewProps> = ({
  initialMatrix,
  initialTimeline,
  doctors,
  clinicTodayDate,
  clinicTimezone,
}) => {
  const [activeTab, setActiveTab] = useState<"MONTH" | "DAY">("MONTH");
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMatrix.month_str);
  const [selectedDate, setSelectedDate] = useState<string>(initialTimeline.date_str);

  const [matrixData] = useState<MonthMatrixData>(initialMatrix);
  const [timelineData, setTimelineData] = useState<DayTimelineData>(initialTimeline);

  const [isAutoScheduleOpen, setIsAutoScheduleOpen] = useState<boolean>(false);
  const [autoScheduleDoctorId, setAutoScheduleDoctorId] = useState<string>("");

  const [selectedCellInfo, setSelectedCellInfo] = useState<{
    cell: MonthMatrixCell;
    patientName: string;
    day: number;
  } | null>(null);

  // Hook up Realtime Live synchronization (AC-09)
  useRealtimeSchedule({
    monthOrDateStr: activeTab === "MONTH" ? selectedMonth : selectedDate,
    onUpdate: () => {
      console.log("Realtime appointment update received.");
    },
  });

  return (
    <div className="space-y-6">
      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/80 border border-slate-200/60">
          <button
            onClick={() => setActiveTab("MONTH")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "MONTH"
                ? "bg-white text-teal-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Ma Trận Tháng (31 Ngày)
          </button>
          <button
            onClick={() => setActiveTab("DAY")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "DAY"
                ? "bg-white text-teal-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Dòng Thời Gian Ngày (5 Phút)
          </button>
        </div>

        {/* Date / Month Picker & Actions */}
        <div className="flex items-center gap-3">
          {activeTab === "MONTH" ? (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">Tháng:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-mono font-medium focus:border-teal-500 focus:outline-none"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">Ngày:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-mono font-medium focus:border-teal-500 focus:outline-none"
              />
            </div>
          )}

          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setAutoScheduleDoctorId(doctors[0]?.id || "");
              setIsAutoScheduleOpen(true);
            }}
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Xếp Lịch Tự Động
          </Button>
        </div>
      </div>

      {/* Main Views */}
      {activeTab === "MONTH" ? (
        <MonthMatrixGrid
          matrixData={matrixData}
          onCellClick={(cell, patientName, day) => {
            setSelectedCellInfo({ cell, patientName, day });
          }}
          onAutoScheduleClick={(docId) => {
            setAutoScheduleDoctorId(docId);
            setIsAutoScheduleOpen(true);
          }}
        />
      ) : (
        <DayTimelineGrid
          timelineData={timelineData}
          onAppointmentClick={(appt) => {
            console.log("Appointment details:", appt);
          }}
          onStatusChange={async (apptId, newStatus) => {
            // Optimistic update
            setTimelineData((prev) => ({
              ...prev,
              slots: prev.slots.map((slot) => {
                const updatedByDoctor: Record<string, AppointmentWithDetails[]> = {};
                for (const [docId, appts] of Object.entries(slot.appointments_by_doctor)) {
                  updatedByDoctor[docId] = appts.map((a) =>
                    a.id === apptId ? { ...a, status: newStatus } : a
                  );
                }
                return {
                  ...slot,
                  appointments_by_doctor: updatedByDoctor,
                };
              }),
            }));

            // Call Server Action
            await updateAppointmentStatusAction({
              appointment_id: apptId,
              status: newStatus,
            });
          }}
        />
      )}

      {/* Auto Schedule Modal */}
      <AutoScheduleModal
        isOpen={isAutoScheduleOpen}
        onClose={() => setIsAutoScheduleOpen(false)}
        courseId="123e4567-e89b-12d3-a456-426614174000"
        defaultDoctorId={autoScheduleDoctorId}
        defaultStartDate={clinicTodayDate}
        clinicTimezone={clinicTimezone}
        doctors={doctors.map((d) => ({ id: d.id, name: d.full_name, code: d.staff_code }))}
        onScheduleSubmit={async (input) => {
          const res = await autoScheduleAction(input);
          if (!res.success) {
            throw new Error(res.error);
          }
          return res.data!;
        }}
      />

      {/* Cell Detail Modal */}
      {selectedCellInfo && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCellInfo(null)}
          title={`Chi Tiết Lịch Hẹn Ngày ${selectedCellInfo.day}/${matrixData.month_str}`}
          description={`Bệnh nhân: ${selectedCellInfo.patientName}`}
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">Giờ hẹn:</span>
              <span className="text-sm font-mono font-bold text-slate-900">
                {selectedCellInfo.cell.time_str || "—"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">Trạng thái:</span>
              <Badge variant="default">{selectedCellInfo.cell.status}</Badge>
            </div>

            {selectedCellInfo.cell.manual_override && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Lịch hẹn đã được khóa thủ công (Manual Override Lock).</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button size="sm" variant="ghost" onClick={() => setSelectedCellInfo(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
