"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import type { AutoScheduleInput, AutoScheduleResult } from "@/types/schedule";

export interface AutoScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  defaultDoctorId?: string;
  doctors: Array<{ id: string; name: string; code: string }>;
  plannedSessionCount?: number | null;
  completedSessionCount?: number | null;
  remainingSchedulableSlots?: number | null;
  onScheduleSubmit: (input: AutoScheduleInput) => Promise<AutoScheduleResult>;
}

export const AutoScheduleModal: React.FC<AutoScheduleModalProps> = ({
  isOpen,
  onClose,
  courseId,
  defaultDoctorId,
  doctors,
  plannedSessionCount,
  completedSessionCount,
  remainingSchedulableSlots,
  onScheduleSubmit,
}) => {
  const isPlanUnestablished =
    plannedSessionCount !== undefined &&
    (plannedSessionCount === null || plannedSessionCount <= 0);

  const isZeroRemaining =
    remainingSchedulableSlots !== undefined &&
    remainingSchedulableSlots !== null &&
    remainingSchedulableSlots <= 0;

  const isSchedulingDisabled = isPlanUnestablished || isZeroRemaining;

  const initialScheduleCount =
    remainingSchedulableSlots !== undefined && remainingSchedulableSlots !== null
      ? Math.max(0, remainingSchedulableSlots)
      : 1;

  const [doctorId, setDoctorId] = useState<string>(defaultDoctorId || doctors[0]?.id || "");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [scheduleCount, setScheduleCount] = useState<number>(initialScheduleCount);
  const [preferredTime, setPreferredTime] = useState<string>("07:30");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AutoScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSchedulingDisabled) {
      return;
    }
    if (
      remainingSchedulableSlots !== undefined &&
      remainingSchedulableSlots !== null &&
      scheduleCount > remainingSchedulableSlots
    ) {
      setError("Số lịch muốn xếp vượt quá số buổi còn lại trong kế hoạch điều trị.");
      return;
    }
    if (scheduleCount <= 0) {
      setError("Số lịch muốn xếp phải lớn hơn 0.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await onScheduleSubmit({
        treatment_course_id: courseId,
        doctor_id: doctorId,
        start_date: startDate,
        schedule_count: scheduleCount,
        preferred_time: preferredTime,
        selected_weekdays: [1, 2, 3, 4, 5, 6],
      });

      setResult(res);
      if (res.success && res.status === "FULL") {
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Đã xảy ra lỗi khi xếp lịch tự động.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xếp Lịch Điều Trị Tự Động (Auto-Fill Engine)"
      description="Hệ thống sẽ tự động tính toán các ngày điều trị liên tiếp, kiểm tra xung đột và xếp vào bảng giờ."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {result && (
          <Alert variant={result.status === "FULL" ? "success" : "warning"}>
            {result.message}
          </Alert>
        )}

        {/* State Banner: Plan Unestablished */}
        {isPlanUnestablished && (
          <Alert variant="warning">
            Bác sĩ chưa thiết lập kế hoạch điều trị cho liệu trình này.
          </Alert>
        )}

        {/* State Banner: Zero Remaining Capacity */}
        {isZeroRemaining && !isPlanUnestablished && (
          <Alert variant="info">
            Liệu trình đã được xếp đủ số buổi theo kế hoạch điều trị.
          </Alert>
        )}

        {/* Read-only Clinical Plan Summary Banner */}
        {plannedSessionCount !== undefined && plannedSessionCount !== null && !isPlanUnestablished && (
          <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100 text-xs text-teal-950 space-y-1">
            <div className="flex justify-between">
              <span className="font-medium text-slate-600">Kế hoạch bác sĩ:</span>
              <span className="font-bold">{plannedSessionCount} buổi</span>
            </div>
            {completedSessionCount !== undefined && completedSessionCount !== null && (
              <div className="flex justify-between">
                <span className="font-medium text-slate-600">Đã hoàn thành:</span>
                <span className="font-bold">{completedSessionCount} buổi</span>
              </div>
            )}
            {remainingSchedulableSlots !== undefined && remainingSchedulableSlots !== null && (
              <div className="flex justify-between">
                <span className="font-medium text-slate-600">Còn có thể xếp:</span>
                <span className="font-bold text-teal-700">{remainingSchedulableSlots} buổi</span>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
            Bác Sĩ Phụ Trách
          </label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            disabled={isSchedulingDisabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Ngày Bắt Đầu"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isSchedulingDisabled}
            required
          />

          <Input
            label="Số Lịch Muốn Xếp Thêm"
            type="number"
            min={1}
            max={remainingSchedulableSlots !== undefined && remainingSchedulableSlots !== null && remainingSchedulableSlots > 0 ? remainingSchedulableSlots : undefined}
            value={scheduleCount}
            onChange={(e) => setScheduleCount(parseInt(e.target.value, 10) || 0)}
            disabled={isSchedulingDisabled}
            helperText={
              isZeroRemaining
                ? "Không còn buổi nào cần xếp thêm"
                : "Không làm thay đổi kế hoạch điều trị của bác sĩ"
            }
            required
          />
        </div>

        <Input
          label="Giờ Hẹn Mong Muốn"
          type="time"
          value={preferredTime}
          onChange={(e) => setPreferredTime(e.target.value)}
          disabled={isSchedulingDisabled}
          helperText="Mặc định 07:30 (bước nhảy 5 phút)"
        />

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800">Quy tắc xếp lịch:</p>
          <p>· Xếp vào các ngày làm việc liên tiếp từ Thứ 2 đến Thứ 7 (nghỉ Chủ Nhật).</p>
          <p>· Tự động kiểm tra không xếp trùng giờ bác sĩ hoặc bệnh nhân.</p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose}>
            {isSchedulingDisabled ? "Đóng" : "Hủy"}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            disabled={isSchedulingDisabled}
          >
            Thực Hiện Xếp Lịch
          </Button>
        </div>
      </form>
    </Modal>
  );
};

