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
  onScheduleSubmit: (input: AutoScheduleInput) => Promise<AutoScheduleResult>;
}

export const AutoScheduleModal: React.FC<AutoScheduleModalProps> = ({
  isOpen,
  onClose,
  courseId,
  defaultDoctorId,
  doctors,
  onScheduleSubmit,
}) => {
  const [doctorId, setDoctorId] = useState<string>(defaultDoctorId || doctors[0]?.id || "");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [sessionCount, setSessionCount] = useState<number>(7);
  const [preferredTime, setPreferredTime] = useState<string>("07:30");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AutoScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await onScheduleSubmit({
        treatment_course_id: courseId,
        doctor_id: doctorId,
        start_date: startDate,
        planned_session_count: sessionCount,
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

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
            Bác Sĩ Phụ Trách
          </label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
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
            required
          />

          <Input
            label="Số Buổi Điều Trị"
            type="number"
            min={1}
            max={30}
            value={sessionCount}
            onChange={(e) => setSessionCount(parseInt(e.target.value, 10) || 7)}
            required
          />
        </div>

        <Input
          label="Giờ Hẹn Mong Muốn"
          type="time"
          value={preferredTime}
          onChange={(e) => setPreferredTime(e.target.value)}
          helperText="Mặc định 07:30 (bước nhảy 5 phút)"
        />

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800">Quy tắc xếp lịch:</p>
          <p>· Xếp vào các ngày làm việc liên tiếp từ Thứ 2 đến Thứ 7 (nghỉ Chủ Nhật).</p>
          <p>· Tự động kiểm tra không xếp trùng giờ bác sĩ hoặc bệnh nhân.</p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            Thực Hiện Xếp Lịch
          </Button>
        </div>
      </form>
    </Modal>
  );
};
