"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { establishInitialTreatmentPlanAction } from "@/app/actions/clinical-actions";

export interface DoctorTreatmentPlanCardProps {
  courseId: string;
  courseStatus: string;
  plannedSessionCount: number | null;
  plannedByDoctorId?: string | null;
  plannedByDoctorName?: string | null;
  plannedAt?: string | null;
  isDoctor?: boolean;
  onSuccess?: () => void;
}

export const DoctorTreatmentPlanCard: React.FC<DoctorTreatmentPlanCardProps> = ({
  courseId,
  courseStatus,
  plannedSessionCount,
  plannedByDoctorId,
  plannedByDoctorName,
  plannedAt,
  isDoctor = true,
  onSuccess,
}) => {
  const router = useRouter();
  const [sessionCountInput, setSessionCountInput] = useState<string>("");
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const hasPlan = plannedSessionCount !== null && plannedSessionCount > 0;
  const isEligibleStatus = ["PLANNED", "ACTIVE"].includes(courseStatus);
  const isLegacyPlan = hasPlan && !plannedByDoctorId;
  const isEstablishedDoctorPlan = hasPlan && Boolean(plannedByDoctorId);

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return "—";
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    } catch {
      return isoString;
    }
  };

  const handleStartEstablish = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const count = parseInt(sessionCountInput, 10);
    if (isNaN(count) || count <= 0) {
      setErrorMsg("Số buổi điều trị phải lớn hơn 0.");
      return;
    }
    setIsConfirming(true);
  };

  const handleConfirmSubmit = async () => {
    const count = parseInt(sessionCountInput, 10);
    if (isNaN(count) || count <= 0) {
      setErrorMsg("Số buổi điều trị phải lớn hơn 0.");
      setIsConfirming(false);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await establishInitialTreatmentPlanAction({
        course_id: courseId,
        planned_session_count: count,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Không thể thiết lập kế hoạch điều trị lúc này. Vui lòng thử lại.");
        setIsConfirming(false);
        if (res.error?.includes("Kế hoạch điều trị đã được thiết lập")) {
          router.refresh();
        }
      } else {
        setSuccessMsg(res.data?.message || "Thiết lập kế hoạch điều trị thành công.");
        setIsConfirming(false);
        setSessionCountInput("");
        router.refresh();
        onSuccess?.();
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Lỗi hệ thống khi thiết lập kế hoạch điều trị.");
      setIsConfirming(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Kế Hoạch Điều Trị
          </h4>
        </div>
        {isEstablishedDoctorPlan && (
          <Badge variant="success" size="sm">
            Đã thiết lập
          </Badge>
        )}
        {isLegacyPlan && (
          <Badge variant="default" size="sm">
            Kế hoạch cũ
          </Badge>
        )}
        {!hasPlan && isEligibleStatus && (
          <Badge variant="warning" size="sm">
            Chưa thiết lập
          </Badge>
        )}
        {!hasPlan && !isEligibleStatus && (
          <Badge variant="secondary" size="sm">
            Không khả dụng
          </Badge>
        )}
      </div>

      {/* CASE 2: Established Doctor Plan (Read-Only) */}
      {isEstablishedDoctorPlan && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs">
          <div>
            <p className="text-slate-400 font-medium">Số Buổi Điều Trị</p>
            <p className="font-bold text-slate-900 text-sm mt-0.5">
              {plannedSessionCount} buổi
            </p>
          </div>
          <div>
            <p className="text-slate-400 font-medium">Bác Sĩ Lập Kế Hoạch</p>
            <p className="font-semibold text-slate-800 mt-0.5">
              {plannedByDoctorName || "Đã ghi nhận bác sĩ lập kế hoạch"}
            </p>
          </div>
          <div>
            <p className="text-slate-400 font-medium">Thời Gian Lập</p>
            <p className="font-semibold text-slate-800 mt-0.5 font-mono">
              {formatDateTime(plannedAt)}
            </p>
          </div>
        </div>
      )}

      {/* CASE 3: Legacy Plan with Unknown Provenance (Read-Only) */}
      {isLegacyPlan && (
        <div className="space-y-2 pt-1 text-xs">
          <div className="flex items-baseline gap-2">
            <span className="text-slate-400 font-medium">Số Buổi Điều Trị:</span>
            <span className="font-bold text-slate-900 text-sm">{plannedSessionCount} buổi</span>
          </div>
          <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px]">
            Dữ liệu kế hoạch cũ — chưa xác định bác sĩ lập kế hoạch.
          </p>
        </div>
      )}

      {/* CASE 1: No Plan Yet */}
      {!hasPlan && (
        <>
          {isEligibleStatus ? (
            isDoctor ? (
              <div className="space-y-3">
                {successMsg && (
                  <Alert variant="success" className="text-xs py-2.5">
                    {successMsg}
                  </Alert>
                )}
                {errorMsg && (
                  <Alert variant="error" className="text-xs py-2.5">
                    {errorMsg}
                  </Alert>
                )}

                {!isConfirming ? (
                  <form onSubmit={handleStartEstablish} className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Số Buổi Điều Trị <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={sessionCountInput}
                        onChange={(e) => setSessionCountInput(e.target.value)}
                        placeholder="Nhập số buổi bác sĩ chỉ định"
                        className="w-full sm:max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none"
                        required
                      />
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        Số buổi này là kế hoạch điều trị chuyên môn. Sau khi thiết lập, việc thay đổi kế hoạch phải thực hiện qua quy trình điều chỉnh kế hoạch.
                      </p>
                    </div>

                    <Button type="submit" size="sm" variant="primary">
                      Thiết Lập Kế Hoạch
                    </Button>
                  </form>
                ) : (
                  <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <svg className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-xs text-teal-900 leading-relaxed">
                        <p className="font-semibold">
                          Xác nhận thiết lập kế hoạch {sessionCountInput} buổi?
                        </p>
                        <p className="text-[11px] text-teal-800/90 mt-0.5">
                          Sau khi thiết lập, kế hoạch không thể sửa trực tiếp tại màn hình này.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleConfirmSubmit}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Đang xử lý..." : "Xác Nhận Thiết Lập"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsConfirming(false)}
                        disabled={isSubmitting}
                      >
                        Hủy
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Chưa có kế hoạch điều trị từ bác sĩ.
              </p>
            )
          ) : (
            <p className="text-xs text-slate-500 italic">
              Liệu trình hiện không ở trạng thái có thể thiết lập kế hoạch điều trị.
            </p>
          )}
        </>
      )}
    </div>
  );
};
