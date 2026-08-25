"use client";

import React, { useState } from "react";
import { Modal, Input, Button, Alert, App } from "antd";
import {
  FormOutlined,
  UserOutlined,
  CalendarOutlined,
  MedicineBoxOutlined,
} from "@ant-design/icons";
import { createClinicalNoteAction } from "@/app/actions/clinical-notes-actions";
import type { ClinicalNoteItem } from "@/types/patient";
import { DEFAULT_CLINIC_TIMEZONE } from "@/utils/timezone";

const { TextArea } = Input;

export interface AddClinicalNoteModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (note: ClinicalNoteItem) => void;
  patientId: string;
  patientName: string;
  patientCode: string;
  treatmentCourseId?: string | null;
  treatmentCourseNo?: number | null;
  receptionId?: string | null;
  doctorName?: string;
  clinicTimezone?: string;
}

export const AddClinicalNoteModal: React.FC<AddClinicalNoteModalProps> = ({
  open,
  onClose,
  onSuccess,
  patientId,
  patientName,
  patientCode,
  treatmentCourseId,
  treatmentCourseNo,
  receptionId,
  doctorName,
  clinicTimezone = DEFAULT_CLINIC_TIMEZONE,
}) => {
  const { message } = App.useApp();
  const [content, setContent] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentDateStr = new Intl.DateTimeFormat("vi-VN", {
    timeZone: clinicTimezone || DEFAULT_CLINIC_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

  const handleClose = () => {
    if (isSubmitting) return;
    setContent("");
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      setErrorMessage("Vui lòng nhập nội dung ghi chú lâm sàng.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await createClinicalNoteAction({
        patientId,
        treatmentCourseId: treatmentCourseId || null,
        receptionId: receptionId || null,
        content: trimmed,
      });

      if (!res.success || !res.note) {
        setErrorMessage(res.error || "Không thể lưu ghi chú lâm sàng.");
        setIsSubmitting(false);
        return;
      }

      message.success("Ghi chú lâm sàng đã được lưu thành công.");
      setContent("");
      setIsSubmitting(false);
      onSuccess(res.note);
      onClose();
    } catch {
      setErrorMessage("Đã xảy ra lỗi kết nối khi lưu ghi chú.");
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 text-slate-800 font-bold text-base pb-1">
          <FormOutlined className="text-[#00897b]" />
          <span>Thêm ghi chú lâm sàng</span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={isSubmitting} className="rounded-lg">
          Hủy
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          loading={isSubmitting}
          className="bg-[#00897b] hover:bg-teal-700 font-semibold rounded-lg border-0 shadow-xs"
        >
          Lưu ghi chú
        </Button>,
      ]}
      destroyOnHidden
      width={560}
      styles={{
        body: { paddingTop: 12 },
      }}
    >
      <div className="space-y-4">
        {/* Contextual Read-only Summary */}
        <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
          <div>
            <span className="text-slate-400 font-medium block text-[11px]">Bệnh nhân</span>
            <span className="font-bold text-slate-800 truncate block mt-0.5">
              {patientCode} · {patientName}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block text-[11px] flex items-center gap-1">
              <MedicineBoxOutlined className="text-slate-400 text-[11px]" />
              <span>Liệu trình</span>
            </span>
            <span className="font-semibold text-teal-800 block mt-0.5">
              {treatmentCourseNo ? `Liệu trình ${treatmentCourseNo}` : "Khám chung"}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block text-[11px] flex items-center gap-1">
              <CalendarOutlined className="text-slate-400 text-[11px]" />
              <span>Thời gian</span>
            </span>
            <span className="font-mono text-slate-700 block mt-0.5">
              {currentDateStr}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block text-[11px] flex items-center gap-1">
              <UserOutlined className="text-slate-400 text-[11px]" />
              <span>Bác sĩ ghi nhận</span>
            </span>
            <span className="font-medium text-slate-700 block mt-0.5 truncate">
              {doctorName || "Bác sĩ phụ trách"}
            </span>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <Alert title={errorMessage} type="error" showIcon className="text-xs py-2 rounded-lg" />
        )}

        {/* Content input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 block">
            Nội dung ghi chú <span className="text-red-500">*</span>
          </label>
          <TextArea
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Nhập diễn tiến triệu chứng, phản ứng sau điều trị, nhận xét lâm sàng, lưu ý cho lần điều trị tiếp theo..."
            maxLength={2000}
            showCount
            className="rounded-xl text-xs leading-relaxed"
            disabled={isSubmitting}
            autoFocus
          />
        </div>
      </div>
    </Modal>
  );
};
