"use client";

import React, { useState, useMemo, useEffect } from "react";
import type { ReceptionQueueItem } from "@/types/reception";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";
import type { TreatmentSessionPlanItem } from "@/types/treatment";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import {
  recordCourseDiagnosisAction,
  establishInitialTreatmentPlanAction,
  orderCourseServicesAction,
  saveTreatmentSessionPlanAction,
  getCourseSessionPlansAction,
} from "@/app/actions/clinical-actions";

export interface ClinicalOrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: ReceptionQueueItem | null;
  diagnoses: DiagnosisCatalogItem[];
  services: ServiceCatalogItem[];
  onSuccess?: () => void;
}

export const ClinicalOrderDrawer: React.FC<ClinicalOrderDrawerProps> = ({
  isOpen,
  onClose,
  item,
  diagnoses,
  services,
  onSuccess,
}) => {
  // Section 1: Diagnosis state
  const [diagSearch, setDiagSearch] = useState<string>("");
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<DiagnosisCatalogItem | null>(null);
  const [diagnosisType, setDiagnosisType] = useState<"PRIMARY" | "SECONDARY">("PRIMARY");

  // Section 2: DVKT Ordered state (Course-level normalized N items)
  const [serviceSearch, setServiceSearch] = useState<string>("");
  const [orderedServices, setOrderedServices] = useState<ServiceCatalogItem[]>([]);
  const [serviceNotes, setServiceNotes] = useState<string>("");

  // Section 3: Treatment Plan Session Count state
  const [plannedSessions, setPlannedSessions] = useState<string>(
    item?.active_course?.planned_session_count
      ? String(item.active_course.planned_session_count)
      : ""
  );

  // Section 4: Occurrence Plans state (1..N sessions)
  const [sessionPlansMap, setSessionPlansMap] = useState<Record<number, TreatmentSessionPlanItem>>({});
  const [isLoadingPlans, setIsLoadingPlans] = useState<boolean>(false);
  const [editingSessionNo, setEditingSessionNo] = useState<number | null>(null);

  // Inline Session Editor state
  const [sessionServiceSearch, setSessionServiceSearch] = useState<string>("");
  const [sessionSelectedServices, setSessionSelectedServices] = useState<ServiceCatalogItem[]>([]);
  const [sessionNotes, setSessionNotes] = useState<string>("");
  const [isSavingSession, setIsSavingSession] = useState<boolean>(false);
  const [sessionErrorMsg, setSessionErrorMsg] = useState<string | null>(null);
  const [sessionSuccessMsg, setSessionSuccessMsg] = useState<string | null>(null);

  // Global drawer submitting / alert states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    if (!isOpen || !item?.active_course?.id) {
      return;
    }

    const courseId = item.active_course.id;

    const fetchPlans = async () => {
      setIsLoadingPlans(true);
      try {
        const res = await getCourseSessionPlansAction(courseId);
        if (!isCancelled && res.success && res.data) {
          const map: Record<number, TreatmentSessionPlanItem> = {};
          for (const p of res.data.plans) {
            map[p.session_number] = p;
          }
          setSessionPlansMap(map);
        }
      } catch {
        // Non-blocking
      } finally {
        if (!isCancelled) {
          setIsLoadingPlans(false);
        }
      }
    };

    fetchPlans();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, item?.active_course?.id]);

  // Filter diagnoses based on active catalog & search query
  const filteredDiagnoses = useMemo(() => {
    if (!diagSearch.trim()) return diagnoses.slice(0, 8);
    const q = diagSearch.toLowerCase().trim();
    return diagnoses
      .filter(
        (d) =>
          d.is_active &&
          (d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [diagnoses, diagSearch]);

  // Filter services for Course-level section
  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return services.slice(0, 8);
    const q = serviceSearch.toLowerCase().trim();
    return services
      .filter(
        (s) =>
          s.is_active &&
          (s.service_code.toLowerCase().includes(q) ||
            s.service_name.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [services, serviceSearch]);

  // Filter services for Inline Session Editor
  const filteredSessionServices = useMemo(() => {
    if (!sessionServiceSearch.trim()) return services.slice(0, 6);
    const q = sessionServiceSearch.toLowerCase().trim();
    return services
      .filter(
        (s) =>
          s.is_active &&
          (s.service_code.toLowerCase().includes(q) ||
            s.service_name.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [services, sessionServiceSearch]);

  // Course-level service order handlers
  const handleAddService = (service: ServiceCatalogItem) => {
    setOrderedServices((prev) => [...prev, service]);
    setServiceSearch("");
  };

  const handleRemoveService = (index: number) => {
    setOrderedServices((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Inline Session Editor Handlers
  const handleOpenSessionEditor = (sessionNo: number) => {
    setEditingSessionNo(sessionNo);
    setSessionErrorMsg(null);
    setSessionSuccessMsg(null);
    setSessionServiceSearch("");

    const existingPlan = sessionPlansMap[sessionNo];
    if (existingPlan && existingPlan.services.length > 0) {
      // Map existing planned services to ServiceCatalogItem objects
      const mappedServices: ServiceCatalogItem[] = existingPlan.services.map((ps) => {
        const found = services.find((s) => s.id === ps.service_id);
        return (
          found || {
            id: ps.service_id,
            service_code: ps.service_code,
            service_name: ps.service_name,
            service_group: null,
            default_duration_minutes: 30,
            setup_minutes: 0,
            cleanup_minutes: 0,
            required_resource_type: null,
            is_active: true,
          }
        );
      });
      setSessionSelectedServices(mappedServices);
      setSessionNotes(existingPlan.notes || "");
    } else {
      setSessionSelectedServices([]);
      setSessionNotes("");
    }
  };

  const handleCloseSessionEditor = () => {
    setEditingSessionNo(null);
    setSessionErrorMsg(null);
    setSessionSuccessMsg(null);
  };

  const handleAddServiceToSession = (service: ServiceCatalogItem) => {
    if (sessionSelectedServices.some((s) => s.id === service.id)) {
      setSessionErrorMsg("Dịch vụ này đã có trong danh sách chỉ định của buổi.");
      return;
    }
    setSessionErrorMsg(null);
    setSessionSelectedServices((prev) => [...prev, service]);
    setSessionServiceSearch("");
  };

  const handleRemoveServiceFromSession = (index: number) => {
    setSessionSelectedServices((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMoveService = (index: number, direction: "UP" | "DOWN") => {
    setSessionSelectedServices((prev) => {
      const copy = [...prev];
      const targetIndex = direction === "UP" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const refreshSessionPlans = async (courseId: string) => {
    setIsLoadingPlans(true);
    try {
      const res = await getCourseSessionPlansAction(courseId);
      if (res.success && res.data) {
        const map: Record<number, TreatmentSessionPlanItem> = {};
        for (const p of res.data.plans) {
          map[p.session_number] = p;
        }
        setSessionPlansMap(map);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const handleSaveSessionPlan = async (sessionNo: number) => {
    if (!item?.active_course?.id) {
      setSessionErrorMsg("Không tìm thấy liệu trình điều trị.");
      return;
    }

    if (sessionSelectedServices.length === 0) {
      setSessionErrorMsg("Vui lòng chọn ít nhất một DVKT cho buổi điều trị.");
      return;
    }

    setIsSavingSession(true);
    setSessionErrorMsg(null);
    setSessionSuccessMsg(null);

    try {
      const res = await saveTreatmentSessionPlanAction({
        treatment_course_id: item.active_course.id,
        session_number: sessionNo,
        service_ids: sessionSelectedServices.map((s) => s.id),
        notes: sessionNotes || null,
      });

      if (!res.success) {
        throw new Error(res.error || "Lỗi lưu kế hoạch buổi điều trị.");
      }

      setSessionSuccessMsg(`Đã lưu kế hoạch Buổi ${sessionNo} thành công!`);

      // Refresh session plans map
      await refreshSessionPlans(item.active_course.id);
      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        setEditingSessionNo(null);
        setSessionSuccessMsg(null);
      }, 1000);
    } catch (err: unknown) {
      const rawMsg = (err as Error).message || "";
      if (rawMsg.includes("PLAN_MUTATION_LOCKED") || rawMsg.includes("đã hoặc đang được thực hiện")) {
        setSessionErrorMsg("Buổi điều trị đã bắt đầu hoặc hoàn tất nên không thể thay đổi kế hoạch.");
      } else {
        setSessionErrorMsg(rawMsg || "Lỗi lưu kế hoạch buổi điều trị.");
      }
    } finally {
      setIsSavingSession(false);
    }
  };

  // Save global course-level clinical orders (Diagnosis, Course-level DVKT, Session Target)
  const handleSaveClinicalOrders = async () => {
    if (!item?.active_course?.id) {
      setErrorMsg("Bệnh nhân chưa có liệu trình điều trị để chỉ định lâm sàng.");
      return;
    }

    if (!selectedDiagnosis && orderedServices.length === 0 && !plannedSessions) {
      setErrorMsg("Vui lòng chọn chẩn đoán, dịch vụ kỹ thuật hoặc số buổi điều trị.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const courseId = item.active_course.id;

    try {
      // 1. Record Diagnosis if selected
      if (selectedDiagnosis) {
        const diagRes = await recordCourseDiagnosisAction({
          treatment_course_id: courseId,
          diagnosis_id: selectedDiagnosis.id,
          raw_code: selectedDiagnosis.code,
          raw_text: selectedDiagnosis.name,
          diagnosis_type: diagnosisType,
          is_primary: diagnosisType === "PRIMARY",
        });

        if (!diagRes.success) {
          throw new Error(diagRes.error || "Lỗi ghi nhận chẩn đoán.");
        }
      }

      // 2. Order Services if any selected (normalized course-level orders)
      if (orderedServices.length > 0) {
        const servRes = await orderCourseServicesAction({
          treatment_course_id: courseId,
          service_ids: orderedServices.map((s) => s.id),
          notes: serviceNotes || null,
        });

        if (!servRes.success) {
          throw new Error(servRes.error || "Lỗi chỉ định dịch vụ kỹ thuật.");
        }
      }

      // 3. Establish Treatment Plan if count provided and not established yet
      if (plannedSessions && !item.active_course.planned_session_count) {
        const count = parseInt(plannedSessions, 10);
        if (count > 0) {
          const planRes = await establishInitialTreatmentPlanAction({
            course_id: courseId,
            planned_session_count: count,
          });

          if (!planRes.success) {
            throw new Error(planRes.error || "Lỗi thiết lập kế hoạch điều trị.");
          }
        }
      }

      setSuccessMsg("Đã lưu chỉ định lâm sàng thành công!");
      if (onSuccess) {
        onSuccess();
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Đã xảy ra lỗi khi lưu chỉ định lâm sàng.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !item) return null;

  const totalSessionsCount = item.active_course?.planned_session_count || (plannedSessions ? parseInt(plannedSessions, 10) : 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      {/* Backdrop click to close */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Drawer Panel */}
      <div className="relative z-10 w-full max-w-xl bg-white shadow-2xl h-full flex flex-col overflow-hidden border-l border-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="default" size="sm">
                Bác Sĩ Chỉ Định
              </Badge>
              <h2 className="text-base font-bold text-slate-900">
                Chỉ Định Lâm Sàng & Kế Hoạch
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Nhập mã bệnh chuẩn hóa, chỉ định DVKT và lập kế hoạch chi tiết từng buổi điều trị.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Patient Identity Card */}
        <div className="px-5 py-3 bg-teal-50/60 border-b border-teal-100 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold text-teal-900 truncate">
              {item.patient.full_name}
            </p>
            <p className="text-[11px] text-teal-700 font-mono">
              Mã BN: {item.patient.patient_code} {item.patient.phone ? `· ${item.patient.phone}` : ""}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-teal-900 block">
              {item.active_course ? `Liệu Trình ${item.active_course.course_no}` : "Chưa tạo LT"}
            </span>
            <span className="text-[11px] text-teal-600">
              BS: {item.active_course?.doctor_name || "Chưa phân công"}
            </span>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {errorMsg && <Alert variant="error">{errorMsg}</Alert>}
          {successMsg && <Alert variant="success">{successMsg}</Alert>}

          {/* Section 1: Diagnosis */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-600 inline-block" />
                1. Chẩn Đoán Bệnh (Mã Bệnh YHCT / YHHĐ)
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDiagnosisType("PRIMARY")}
                  className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${
                    diagnosisType === "PRIMARY"
                      ? "bg-teal-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Chính
                </button>
                <button
                  type="button"
                  onClick={() => setDiagnosisType("SECONDARY")}
                  className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${
                    diagnosisType === "SECONDARY"
                      ? "bg-teal-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Phụ
                </button>
              </div>
            </div>

            {/* Diagnosis Search */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Tìm mã hoặc tên chẩn đoán (VD: U62.261.5, Đau lưng, Viêm khớp...)"
                value={diagSearch}
                onChange={(e) => setDiagSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
              />

              {diagSearch.trim() && (
                <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white shadow-sm">
                  {filteredDiagnoses.length === 0 ? (
                    <p className="p-3 text-xs text-slate-400 text-center">
                      Không tìm thấy mã bệnh trong danh mục.
                    </p>
                  ) : (
                    filteredDiagnoses.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedDiagnosis(d);
                          setDiagSearch("");
                        }}
                        className="w-full text-left p-2.5 hover:bg-teal-50/60 transition-colors flex items-center justify-between text-xs"
                      >
                        <span className="font-mono font-bold text-teal-800 w-24 shrink-0">
                          {d.code}
                        </span>
                        <span className="flex-1 text-slate-800 font-medium truncate">
                          {d.name}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected Diagnosis Card */}
            {selectedDiagnosis ? (
              <div className="p-3 rounded-xl bg-teal-50/80 border border-teal-200 flex items-center justify-between">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="font-mono font-bold text-teal-900 text-xs px-2 py-0.5 rounded bg-teal-200/70">
                    {selectedDiagnosis.code}
                  </span>
                  <span className="text-xs font-semibold text-teal-950 truncate">
                    {selectedDiagnosis.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDiagnosis(null)}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium ml-2 shrink-0"
                >
                  Bỏ chọn
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                Chưa chọn chẩn đoán bệnh. Tìm kiếm và chọn mã bệnh từ danh mục trên.
              </p>
            )}
          </div>

          {/* Section 2: Course-Level DVKT Ordered by Doctor */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-600 inline-block" />
                2. Dịch Vụ Kỹ Thuật (DVKT Bác Sĩ Chỉ Định)
              </label>
              <span className="text-[11px] text-slate-500">
                Đã chọn: {orderedServices.length} DVKT
              </span>
            </div>

            {/* Service Search & Add */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Tìm tên hoặc mã DVKT để thêm (VD: Điện châm, Bó thuốc, Xoa bóp...)"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
              />

              {serviceSearch.trim() && (
                <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white shadow-sm">
                  {filteredServices.length === 0 ? (
                    <p className="p-3 text-xs text-slate-400 text-center">
                      Không tìm thấy DVKT phù hợp trong danh mục.
                    </p>
                  ) : (
                    filteredServices.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleAddService(s)}
                        className="w-full text-left p-2.5 hover:bg-teal-50/60 transition-colors flex items-center justify-between text-xs"
                      >
                        <span className="font-mono font-semibold text-teal-800 w-24 shrink-0">
                          {s.service_code}
                        </span>
                        <span className="flex-1 text-slate-800 font-medium truncate">
                          {s.service_name}
                        </span>
                        <span className="text-xs text-emerald-600 font-bold ml-2">
                          + Thêm
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* List of Ordered Services */}
            {orderedServices.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                  Danh sách DVKT bác sĩ chỉ định cho liệu trình:
                </p>
                <div className="space-y-1.5">
                  {orderedServices.map((s, idx) => (
                    <div
                      key={`${s.id}-${idx}`}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-mono text-slate-600 text-[11px]">
                          {s.service_code}
                        </span>
                        <span className="font-semibold text-slate-900 truncate">
                          {s.service_name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(idx)}
                        className="text-rose-600 hover:text-rose-800 text-xs font-semibold px-2 py-0.5 rounded hover:bg-rose-50 transition-colors"
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400">
                Chưa có DVKT nào được chỉ định. Nhập tên dịch vụ ở trên để thêm.
              </div>
            )}

            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Ghi chú chỉ định DVKT (tùy chọn):
              </label>
              <input
                type="text"
                placeholder="VD: Châm tả huyệt Giáp tích, chiếu đèn hồng ngoại 20 phút..."
                value={serviceNotes}
                onChange={(e) => setServiceNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 3: Treatment Plan (Session Count) */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-600 inline-block" />
              3. Kế Hoạch Điều Trị (Số Buổi Liệu Trình)
            </label>

            {item.active_course?.planned_session_count ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600">Số buổi điều trị đã thiết lập:</span>
                <span className="font-bold text-teal-800 text-sm">
                  {item.active_course.planned_session_count} buổi
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Liệu trình này chưa được thiết lập kế hoạch số buổi. Bác sĩ vui lòng chỉ định:
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="VD: 5, 7, 10..."
                    value={plannedSessions}
                    onChange={(e) => setPlannedSessions(e.target.value)}
                    className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-teal-500 focus:outline-none"
                  />
                  <span className="text-xs text-slate-600">buổi điều trị</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Occurrence-Level Treatment Plans (Buổi 1..N) */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-600 inline-block" />
                4. Kế Hoạch DVKT Theo Buổi (Buổi 1..N)
              </label>
              {totalSessionsCount > 0 && (
                <span className="text-[11px] text-slate-500">
                  Tổng {totalSessionsCount} buổi
                </span>
              )}
            </div>

            {totalSessionsCount <= 0 ? (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900 space-y-1">
                <p className="font-semibold">Kế hoạch số buổi chưa được thiết lập.</p>
                <p className="text-[11px] text-amber-700">
                  Vui lòng thiết lập số buổi điều trị ở mục 3 trước khi lập kế hoạch chi tiết từng buổi.
                </p>
              </div>
            ) : isLoadingPlans ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Đang tải kế hoạch từng buổi...
              </div>
            ) : (
              <div className="space-y-2.5">
                {Array.from({ length: totalSessionsCount }, (_, i) => i + 1).map((sessionNo) => {
                  const plan = sessionPlansMap[sessionNo];
                  const hasPlan = !!(plan && plan.services.length > 0);
                  const isEditing = editingSessionNo === sessionNo;

                  return (
                    <div
                      key={`session-${sessionNo}`}
                      className={`rounded-xl border transition-all ${
                        isEditing
                          ? "border-teal-500 bg-teal-50/30 ring-1 ring-teal-500 shadow-sm"
                          : hasPlan
                          ? "border-slate-200 bg-white hover:border-slate-300"
                          : "border-slate-200 bg-slate-50/60"
                      }`}
                    >
                      {/* Session Header Card */}
                      <div className="p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
                              hasPlan
                                ? "bg-teal-700 text-white"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {sessionNo}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">
                                Buổi {sessionNo}
                              </span>
                              {hasPlan ? (
                                <Badge variant="success" size="sm">
                                  Đã lập ({plan.services.length} DVKT)
                                </Badge>
                              ) : (
                                <Badge variant="secondary" size="sm">
                                  Chưa lập
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {hasPlan
                                ? plan.services.map((s, idx) => `${idx + 1}. ${s.service_name}`).join(" · ")
                                : "Chưa chọn dịch vụ cho buổi này"}
                            </p>
                          </div>
                        </div>

                        <div>
                          {isEditing ? (
                            <button
                              type="button"
                              onClick={handleCloseSessionEditor}
                              className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2.5 py-1 rounded hover:bg-slate-100 transition-colors"
                            >
                              Đóng
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenSessionEditor(sessionNo)}
                              className="text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-3 py-1 rounded-lg transition-colors"
                            >
                              {hasPlan ? "Chỉnh sửa" : "Thiết lập"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline Session Editor */}
                      {isEditing && (
                        <div className="p-3.5 border-t border-teal-100 bg-white rounded-b-xl space-y-3">
                          {sessionErrorMsg && <Alert variant="error">{sessionErrorMsg}</Alert>}
                          {sessionSuccessMsg && <Alert variant="success">{sessionSuccessMsg}</Alert>}

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-slate-700 block">
                              Thêm DVKT vào Buổi {sessionNo}:
                            </label>
                            <input
                              type="text"
                              placeholder="Tìm mã hoặc tên DVKT để thêm..."
                              value={sessionServiceSearch}
                              onChange={(e) => setSessionServiceSearch(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                            />

                            {sessionServiceSearch.trim() && (
                              <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white shadow-sm">
                                {filteredSessionServices.length === 0 ? (
                                  <p className="p-2.5 text-xs text-slate-400 text-center">
                                    Không tìm thấy DVKT phù hợp.
                                  </p>
                                ) : (
                                  filteredSessionServices.map((s) => (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onClick={() => handleAddServiceToSession(s)}
                                      className="w-full text-left p-2 hover:bg-teal-50/60 transition-colors flex items-center justify-between text-xs"
                                    >
                                      <span className="font-mono font-semibold text-teal-800 w-20 shrink-0 text-[11px]">
                                        {s.service_code}
                                      </span>
                                      <span className="flex-1 text-slate-800 font-medium truncate text-xs">
                                        {s.service_name}
                                      </span>
                                      <span className="text-xs text-emerald-600 font-bold ml-2">
                                        + Thêm
                                      </span>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>

                          {/* Selected Services for this session */}
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-slate-700 block">
                              Danh sách DVKT thực hiện ở Buổi {sessionNo} ({sessionSelectedServices.length} DVKT):
                            </label>

                            {sessionSelectedServices.length > 0 ? (
                              <div className="space-y-1">
                                {sessionSelectedServices.map((s, idx) => (
                                  <div
                                    key={`${s.id}-${idx}`}
                                    className="p-2 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                                        {idx + 1}
                                      </span>
                                      <span className="font-mono text-slate-600 text-[11px]">
                                        {s.service_code}
                                      </span>
                                      <span className="font-semibold text-slate-900 truncate">
                                        {s.service_name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => handleMoveService(idx, "UP")}
                                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30 p-1 text-[11px]"
                                        title="Chuyển lên"
                                      >
                                        ↑
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === sessionSelectedServices.length - 1}
                                        onClick={() => handleMoveService(idx, "DOWN")}
                                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30 p-1 text-[11px]"
                                        title="Chuyển xuống"
                                      >
                                        ↓
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveServiceFromSession(idx)}
                                        className="text-rose-600 hover:text-rose-800 text-xs font-semibold px-1.5 py-0.5 rounded hover:bg-rose-50 ml-1"
                                      >
                                        Xóa
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic p-2 bg-slate-50 rounded border border-dashed text-center">
                                Chưa chọn DVKT nào. Tìm kiếm ở trên để thêm DVKT cho buổi này.
                              </p>
                            )}
                          </div>

                          {/* Session Notes */}
                          <div>
                            <label className="text-[11px] font-medium text-slate-600 block mb-1">
                              Ghi chú cho Buổi {sessionNo} (tùy chọn):
                            </label>
                            <input
                              type="text"
                              placeholder="VD: Kiểm tra mạch trước khi châm, giảm cường độ điện..."
                              value={sessionNotes}
                              onChange={(e) => setSessionNotes(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-teal-500 focus:outline-none"
                            />
                          </div>

                          {/* Action buttons for inline session save */}
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleCloseSessionEditor}
                              disabled={isSavingSession}
                            >
                              Hủy
                            </Button>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              isLoading={isSavingSession}
                              onClick={() => handleSaveSessionPlan(sessionNo)}
                            >
                              Lưu Buổi {sessionNo}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Đóng
          </Button>
          <Button
            type="button"
            variant="primary"
            isLoading={isLoading}
            onClick={handleSaveClinicalOrders}
          >
            Lưu Chỉ Định Lâm Sàng
          </Button>
        </div>
      </div>
    </div>
  );
};
