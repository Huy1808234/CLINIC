"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Drawer,
  Select,
  Input,
  InputNumber,
  Button,
  Tag,
  Alert,
  Checkbox,
  Spin,
  Collapse,
  App,
} from "antd";
import {
  MedicineBoxOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  BulbOutlined,
  InfoCircleOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import type { ReceptionQueueItem } from "@/types/reception";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";
import type { TreatmentSessionPlanItem } from "@/types/treatment";
import type { TemplateSuggestionResolution } from "@/types/clinical-template";
import { removeVietnameseAccents } from "@/utils/format-person-name";
import {
  recordCourseDiagnosisAction,
  establishInitialTreatmentPlanAction,
  orderCourseServicesAction,
  saveTreatmentSessionPlanAction,
  getCourseSessionPlansAction,
} from "@/app/actions/clinical-actions";
import { getClinicalTemplateSuggestionAction } from "@/app/actions/clinical-template-actions";

export interface ClinicalOrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: ReceptionQueueItem | null;
  diagnoses: DiagnosisCatalogItem[];
  services: ServiceCatalogItem[];
  onSuccess?: () => void;
}

function matchSearchNormalized(target: string, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  const qNorm = removeVietnameseAccents(q);
  const t = target.toLowerCase();
  const tNorm = removeVietnameseAccents(t);
  return t.includes(q) || tNorm.includes(qNorm);
}

function getServiceGroupLabel(group: string | null, name: string): string {
  if (group && group.trim()) return group.trim().toUpperCase();
  const lower = name.toLowerCase();
  if (lower.startsWith("điện châm")) return "ĐIỆN CHÂM";
  if (lower.startsWith("bó thuốc")) return "BÓ THUỐC";
  if (lower.startsWith("hào châm")) return "HÀO CHÂM";
  if (lower.startsWith("thủy châm")) return "THỦY CHÂM";
  if (lower.startsWith("xông thuốc")) return "XÔNG THUỐC";
  if (lower.startsWith("ngâm thuốc")) return "NGÂM THUỐC";
  if (lower.startsWith("xoa bóp")) return "XOA BÓP - BẤM HUYỆT";
  if (lower.startsWith("cấy chỉ")) return "CẤY CHỈ";
  if (lower.startsWith("giác hơi")) return "GIÁC HƠI";
  return "DỊCH VỤ KỸ THUẬT KHÁC";
}

interface FilterOptionItem {
  label?: unknown;
  code?: string;
  name?: string;
  group?: string;
  title?: string;
  value?: string;
}

export const ClinicalOrderDrawer: React.FC<ClinicalOrderDrawerProps> = ({
  isOpen,
  onClose,
  item,
  diagnoses,
  services,
  onSuccess,
}) => {
  const { message } = App.useApp();

  // Form State inside Drawer
  const [selectedPrimaryId, setSelectedPrimaryId] = useState<string | undefined>(undefined);
  const [selectedSecondaryIds, setSelectedSecondaryIds] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [serviceNotes, setServiceNotes] = useState<string>("");
  const [plannedSessionsInput, setPlannedSessionsInput] = useState<number | null>(
    item?.active_course?.planned_session_count || null
  );

  // TT06 Suggestion State
  const [templateResolution, setTemplateResolution] = useState<TemplateSuggestionResolution | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState<boolean>(false);
  const reqCounter = useRef<number>(0);

  // Occurrence Plans state (1..N sessions)
  const [sessionPlansMap, setSessionPlansMap] = useState<Record<number, TreatmentSessionPlanItem>>({});
  const [isLoadingPlans, setIsLoadingPlans] = useState<boolean>(false);
  const [editingSessionNo, setEditingSessionNo] = useState<number | null>(null);

  // Inline Session Editor state
  const [sessionSelectedServices, setSessionSelectedServices] = useState<ServiceCatalogItem[]>([]);
  const [sessionNotes, setSessionNotes] = useState<string>("");
  const [isSavingSession, setIsSavingSession] = useState<boolean>(false);
  const [sessionErrorMsg, setSessionErrorMsg] = useState<string | null>(null);
  const [sessionSuccessMsg, setSessionSuccessMsg] = useState<string | null>(null);

  // Global drawer submitting / alert states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load session plans when drawer opens and course exists
  useEffect(() => {
    let isCancelled = false;
    if (!isOpen || !item?.active_course?.id) return;

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

  const fetchTemplateSuggestions = (diagId?: string) => {
    if (!diagId || !item?.active_course?.id) {
      setTemplateResolution(null);
      setIsLoadingSuggestion(false);
      return;
    }

    const currentReq = ++reqCounter.current;
    setIsLoadingSuggestion(true);

    getClinicalTemplateSuggestionAction({
      diagnosis_id: diagId,
      treatment_course_id: item.active_course.id,
    })
      .then((res) => {
        if (currentReq === reqCounter.current) {
          setTemplateResolution(res);
          setIsLoadingSuggestion(false);
        }
      })
      .catch((err) => {
        if (currentReq === reqCounter.current) {
          setTemplateResolution({
            success: false,
            found: false,
            reason: "UNAUTHORIZED",
            error: err instanceof Error ? err.message : "Lỗi tải gợi ý điều trị.",
          });
          setIsLoadingSuggestion(false);
        }
      });
  };

  // Diagnosis options
  const primaryDiagnosisOptions = useMemo(() => {
    return diagnoses
      .filter((d) => d.is_active)
      .map((d) => ({
        value: d.id,
        label: `${d.code} — ${d.name}`,
        code: d.code,
        name: d.name,
      }));
  }, [diagnoses]);

  const secondaryDiagnosisOptions = useMemo(() => {
    return diagnoses
      .filter((d) => d.is_active && d.id !== selectedPrimaryId)
      .map((d) => ({
        value: d.id,
        label: `${d.code} — ${d.name}`,
        code: d.code,
        name: d.name,
      }));
  }, [diagnoses, selectedPrimaryId]);

  // Grouped active service options for manual DVKT combobox
  const groupedServiceOptions = useMemo(() => {
    const groups: Record<string, Array<{ value: string; label: string; code: string; name: string; group: string; disabled: boolean }>> = {};

    for (const s of services) {
      if (!s.is_active) continue;
      const groupName = getServiceGroupLabel(s.service_group, s.service_name);
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push({
        value: s.id,
        label: `${s.service_code} — ${s.service_name}`,
        code: s.service_code,
        name: s.service_name,
        group: groupName,
        disabled: false,
      });
    }

    return Object.entries(groups).map(([groupTitle, opts]) => ({
      label: <span className="font-bold text-slate-700 text-xs tracking-wider">{groupTitle}</span>,
      title: groupTitle,
      options: opts,
    }));
  }, [services]);

  // Selected services list
  const selectedServices = useMemo(() => {
    return selectedServiceIds
      .map((id) => services.find((s) => s.id === id))
      .filter((s): s is ServiceCatalogItem => Boolean(s));
  }, [selectedServiceIds, services]);

  const handleToggleSuggestedService = (serviceId: string, available: boolean, alreadyOrdered: boolean) => {
    if (!available || alreadyOrdered) return;
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSelectAllAvailableSuggestions = () => {
    if (!templateResolution || !templateResolution.success || !templateResolution.found) return;
    const availableNewIds = templateResolution.template.items
      .filter((it) => it.is_available && !it.already_ordered)
      .map((it) => it.service_id);

    setSelectedServiceIds((prev) => Array.from(new Set([...prev, ...availableNewIds])));
  };

  const handleRemoveService = (serviceId: string) => {
    setSelectedServiceIds((prev) => prev.filter((id) => id !== serviceId));
  };

  // Inline Session Editor Handlers
  const handleOpenSessionEditor = (sessionNo: number) => {
    setEditingSessionNo(sessionNo);
    setSessionErrorMsg(null);
    setSessionSuccessMsg(null);

    const existingPlan = sessionPlansMap[sessionNo];
    if (existingPlan && existingPlan.services.length > 0) {
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
      // Default to the course-level ordered services if session plan is brand new
      if (selectedServices.length > 0) {
        setSessionSelectedServices([...selectedServices]);
      } else {
        setSessionSelectedServices([]);
      }
      setSessionNotes("");
    }
  };

  const handleCloseSessionEditor = () => {
    setEditingSessionNo(null);
    setSessionErrorMsg(null);
    setSessionSuccessMsg(null);
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
      message.success(`Đã lưu kế hoạch Buổi ${sessionNo}.`);

      // Refresh session plans map
      const freshPlans = await getCourseSessionPlansAction(item.active_course.id);
      if (freshPlans.success && freshPlans.data) {
        const map: Record<number, TreatmentSessionPlanItem> = {};
        for (const p of freshPlans.data.plans) {
          map[p.session_number] = p;
        }
        setSessionPlansMap(map);
      }

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        setEditingSessionNo(null);
        setSessionSuccessMsg(null);
      }, 600);
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

  // Save global course-level clinical orders
  const handleSaveClinicalOrders = async () => {
    if (!item?.active_course?.id) {
      setErrorMsg("Bệnh nhân chưa có liệu trình điều trị để chỉ định lâm sàng.");
      return;
    }

    if (!selectedPrimaryId && selectedServiceIds.length === 0 && !plannedSessionsInput) {
      setErrorMsg("Vui lòng chọn chẩn đoán, dịch vụ kỹ thuật hoặc số buổi điều trị.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const courseId = item.active_course.id;

    try {
      // 1. Record Primary Diagnosis
      if (selectedPrimaryId) {
        const primaryObj = diagnoses.find((d) => d.id === selectedPrimaryId);
        if (primaryObj) {
          const diagRes = await recordCourseDiagnosisAction({
            treatment_course_id: courseId,
            diagnosis_id: primaryObj.id,
            raw_code: primaryObj.code,
            raw_text: primaryObj.name,
            diagnosis_type: "PRIMARY",
            is_primary: true,
          });
          if (!diagRes.success) {
            throw new Error(diagRes.error || "Lỗi ghi nhận chẩn đoán chính.");
          }
        }
      }

      // 2. Record Secondary Diagnoses
      if (selectedSecondaryIds.length > 0) {
        for (const secId of selectedSecondaryIds) {
          const secObj = diagnoses.find((d) => d.id === secId);
          if (secObj) {
            const secRes = await recordCourseDiagnosisAction({
              treatment_course_id: courseId,
              diagnosis_id: secObj.id,
              raw_code: secObj.code,
              raw_text: secObj.name,
              diagnosis_type: "SECONDARY",
              is_primary: false,
            });
            if (!secRes.success) {
              throw new Error(secRes.error || "Lỗi ghi nhận chẩn đoán kèm theo.");
            }
          }
        }
      }

      // 3. Order Services
      if (selectedServiceIds.length > 0) {
        const servRes = await orderCourseServicesAction({
          treatment_course_id: courseId,
          service_ids: selectedServiceIds,
          notes: serviceNotes || null,
        });

        if (!servRes.success) {
          throw new Error(servRes.error || "Lỗi chỉ định dịch vụ kỹ thuật.");
        }
      }

      // 4. Establish Treatment Plan if session count is provided
      if (plannedSessionsInput && plannedSessionsInput > 0) {
        const planRes = await establishInitialTreatmentPlanAction({
          course_id: courseId,
          planned_session_count: plannedSessionsInput,
        });

        if (!planRes.success && !planRes.error?.includes("đã được thiết lập")) {
          throw new Error(planRes.error || "Lỗi thiết lập kế hoạch điều trị.");
        }
      }

      setSuccessMsg("Đã lưu chỉ định lâm sàng & kế hoạch điều trị thành công!");
      message.success("Chỉ định lâm sàng & kế hoạch đã được lưu thành công.");

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Đã xảy ra lỗi khi lưu chỉ định lâm sàng.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!item) return null;

  const totalSessionsCount = plannedSessionsInput || item.active_course?.planned_session_count || 0;

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      destroyOnHidden
      width={760}
      className="clinical-order-drawer"
      styles={{
        header: {
          padding: "16px 20px",
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#f8fafc",
        },
        body: {
          padding: "20px",
          backgroundColor: "#ffffff",
        },
        footer: {
          padding: "12px 20px",
          borderTop: "1px solid #e2e8f0",
          backgroundColor: "#f8fafc",
        },
      }}
      title={
        <div className="flex items-center gap-2">
          <Tag color="cyan" className="m-0 text-xs font-semibold px-2 py-0.5 rounded-md border-teal-200 text-teal-800 bg-teal-50">
            BÁC SĨ CHỈ ĐỊNH
          </Tag>
          <span className="font-bold text-slate-900 text-base">
            Chỉ Định Lâm Sàng & Kế Hoạch
          </span>
        </div>
      }
      extra={
        <span className="text-xs text-slate-400 font-normal">
          Chẩn đoán · DVKT · kế hoạch điều trị
        </span>
      }
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <Button onClick={onClose} disabled={isLoading} size="middle">
            Đóng
          </Button>
          <Button
            type="primary"
            loading={isLoading}
            onClick={handleSaveClinicalOrders}
            icon={<CheckCircleOutlined />}
            size="middle"
            className="bg-[#00897b] hover:bg-teal-700"
          >
            Lưu Chỉ Định & Kế Hoạch
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Patient Identity Context Band */}
        <div className="px-4 py-3 bg-teal-50/70 border border-teal-100 rounded-xl flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-teal-950 text-sm truncate">
                {item.patient.full_name}
              </span>
              <Tag color="teal" className="m-0 text-[11px] font-semibold">
                {item.active_course ? `LT${item.active_course.course_no}` : "Chưa tạo LT"}
              </Tag>
            </div>
            <div className="text-xs text-teal-700 flex items-center gap-2 mt-0.5 font-mono">
              <span>Mã BN: {item.patient.patient_code}</span>
              {item.patient.phone && <span>· SĐT: {item.patient.phone}</span>}
            </div>
          </div>
          <div className="text-right shrink-0 text-xs">
            <span className="text-slate-400 text-[11px] block">Bác sĩ phụ trách</span>
            <span className="font-semibold text-teal-900">
              BS. {item.active_course?.doctor_name || "Chưa phân công"}
            </span>
          </div>
        </div>

        {/* Reception Intake Context (Reason for visit & Symptoms) */}
        {(item.reason_for_visit || item.notes) && (
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1 text-xs">
            {item.reason_for_visit && (
              <div>
                <span className="font-semibold text-amber-900">Lý do đến khám: </span>
                <span className="text-amber-950 font-medium">{item.reason_for_visit}</span>
              </div>
            )}
            {item.notes && (
              <div>
                <span className="font-semibold text-amber-900">Triệu chứng ban đầu: </span>
                <span className="text-amber-900 italic">{item.notes}</span>
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <Alert
            type="error"
            showIcon
            title={errorMsg}
            closable
            onClose={() => setErrorMsg(null)}
          />
        )}

        {successMsg && (
          <Alert
            type="success"
            showIcon
            title={successMsg}
          />
        )}

        {/* SECTION 1: CHẨN ĐOÁN */}
        <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <MedicineBoxOutlined className="text-teal-600" />
              1. Chẩn Đoán Bệnh
            </span>
            <span className="text-[11px] text-slate-400">
              Danh mục ICD-10 & YHCT chuẩn hóa
            </span>
          </div>

          {/* Primary Diagnosis */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Chẩn Đoán Chính (Mã bệnh chính) <span className="text-rose-500">*</span>
            </label>
            <Select
              showSearch
              placeholder="🔎 Gõ mã bệnh hoặc tên chẩn đoán (VD: thoái hoá khớp, đau lưng...)"
              className="w-full"
              value={selectedPrimaryId}
              onChange={(val) => {
                setSelectedPrimaryId(val);
                setSelectedSecondaryIds((prev) => prev.filter((id) => id !== val));
                fetchTemplateSuggestions(val);
              }}
              filterOption={(input, option) => {
                if (!option || !input) return true;
                const opt = option as FilterOptionItem;
                const label = String(opt.label || "").toLowerCase();
                const code = String(opt.code || "").toLowerCase();
                const name = String(opt.name || "").toLowerCase();
                const q = input.toLowerCase().trim();
                const combined = `${code} ${name} ${label}`;
                return label.includes(q) || code.includes(q) || name.includes(q) || matchSearchNormalized(combined, input);
              }}
              options={primaryDiagnosisOptions}
              size="large"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Chọn chẩn đoán chính để tự động nạp gói gợi ý DVKT theo Thông tư 06 (TT06).
            </span>
          </div>

          {/* Secondary Diagnoses */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Chẩn Đoán Kèm Theo (Tùy chọn)
            </label>
            <Select
              mode="multiple"
              showSearch
              placeholder="Chọn thêm mã bệnh kèm theo..."
              className="w-full"
              value={selectedSecondaryIds}
              onChange={setSelectedSecondaryIds}
              filterOption={(input, option) => {
                if (!option || !input) return true;
                const opt = option as FilterOptionItem;
                const label = String(opt.label || "").toLowerCase();
                const code = String(opt.code || "").toLowerCase();
                const name = String(opt.name || "").toLowerCase();
                const q = input.toLowerCase().trim();
                const combined = `${code} ${name} ${label}`;
                return label.includes(q) || code.includes(q) || name.includes(q) || matchSearchNormalized(combined, input);
              }}
              options={secondaryDiagnosisOptions}
              size="middle"
            />
          </div>
        </div>

        {/* TT06 TEMPLATE SUGGESTIONS (Appears above manual DVKT search) */}
        <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-100 space-y-3">
          <div className="flex items-center justify-between border-b border-teal-100/80 pb-2">
            <div className="flex items-center gap-1.5">
              <BulbOutlined className="text-teal-600 text-sm" />
              <span className="text-xs font-bold text-teal-900 uppercase tracking-wider">
                Gợi Ý DVKT Theo Mã Bệnh (TT06)
              </span>
              <Tag color="cyan" className="text-[10px] m-0 font-medium">
                TT_06_2026
              </Tag>
            </div>
            {templateResolution?.success && templateResolution.found && (
              <Button
                type="link"
                size="small"
                onClick={handleSelectAllAvailableSuggestions}
                className="text-xs text-teal-700 font-semibold p-0 h-auto"
              >
                + Chọn tất cả gợi ý
              </Button>
            )}
          </div>

          {/* Suggestion Loading State */}
          {isLoadingSuggestion && (
            <div className="flex items-center justify-center py-4 bg-white/80 rounded-lg border border-teal-100">
              <Spin size="small" />
              <span className="ml-2 text-xs text-teal-700">Đang tìm gói dịch vụ TT06 phù hợp...</span>
            </div>
          )}

          {/* Suggestion Loaded State */}
          {!isLoadingSuggestion && templateResolution?.success && templateResolution.found && (
            <div className="space-y-2.5">
              <div className="space-y-2">
                {templateResolution.template.items.map((it) => {
                  const isSelected = selectedServiceIds.includes(it.service_id);
                  return (
                    <div
                      key={it.item_id}
                      onClick={() => handleToggleSuggestedService(it.service_id, it.is_available, it.already_ordered)}
                      className={`flex items-start justify-between p-2.5 rounded-lg border text-xs transition-all ${
                        it.already_ordered
                          ? "bg-purple-50/60 border-purple-200 cursor-default"
                          : !it.is_available
                          ? "bg-slate-100/70 border-slate-200 opacity-60 cursor-not-allowed"
                          : isSelected
                          ? "bg-teal-50 border-teal-400 shadow-2xs cursor-pointer"
                          : "bg-white border-slate-200 hover:border-teal-300 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          checked={isSelected}
                          disabled={!it.is_available || it.already_ordered}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <span>{it.service_name || it.service_code}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              ({it.service_code})
                            </span>
                          </div>
                          {it.indication_notes && (
                            <div className="text-[11px] text-teal-700 font-medium mt-0.5">
                              Chỉ định gợi ý: <span className="font-semibold">{it.indication_notes}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        {it.already_ordered ? (
                          <Tag color="purple" className="m-0 text-[10px]">
                            ✓ Đã chỉ định
                          </Tag>
                        ) : !it.is_available ? (
                          <Tag color="default" className="m-0 text-[10px]">
                            Unavailable tại cơ sở
                          </Tag>
                        ) : isSelected ? (
                          <Tag color="success" className="m-0 text-[10px]">
                            ✓ Đã chọn
                          </Tag>
                        ) : (
                          <Tag color="cyan" className="m-0 text-[10px]">
                            + Chọn
                          </Tag>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] text-teal-800 flex items-center justify-between px-1">
                <span>{templateResolution.template.items.length} DVKT được đề xuất từ phác đồ chuẩn</span>
                <span className="text-slate-400">Hiệu lực từ: {templateResolution.template.effective_from}</span>
              </div>

              {/* Collapsible Cycle Coding (Mã HIS/BHYT theo lượt) */}
              <Collapse
                ghost
                size="small"
                className="bg-white rounded-lg border border-teal-100 text-xs"
                items={[
                  {
                    key: "cycle_coding",
                    label: (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                        <InfoCircleOutlined className="text-teal-600" />
                        <span>Mã HIS/BHYT theo lượt (Tham khảo chu kỳ thanh toán)</span>
                      </div>
                    ),
                    children: (
                      <div className="space-y-2 text-[11px] text-slate-600">
                        <p className="text-slate-400 italic mb-2">
                          Lưu ý: Lượt 1/2/3 là chu kỳ mã hóa BHYT/HIS đối soát thanh toán, không phải số buổi điều trị thực tế.
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {[1, 2, 3].map((cycleNum) => (
                            <div key={cycleNum} className="p-2 rounded bg-slate-50 border border-slate-200">
                              <div className="font-bold text-teal-800 mb-1 text-xs">Lượt {cycleNum}</div>
                              <div className="space-y-1">
                                {templateResolution.template.items.map((it) => {
                                  const c = it.cycles.find((cy) => cy.cycle_number === cycleNum);
                                  return (
                                    <div key={it.item_id} className="text-[10px] leading-tight">
                                      <span className="font-medium text-slate-700">{it.service_name}: </span>
                                      <span className="font-mono text-teal-700">{c?.diagnosis_code || "—"}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}

          {/* No Template State */}
          {!isLoadingSuggestion && templateResolution?.success && !templateResolution.found && (
            <Alert
              type="info"
              showIcon
              title="Chưa có gói gợi ý DVKT TT06 cho mã bệnh này."
              description="Bác sĩ có thể trực tiếp chọn các dịch vụ kỹ thuật phù hợp từ danh mục phía dưới."
              className="text-xs"
            />
          )}

          {/* Template Conflict State */}
          {!isLoadingSuggestion && templateResolution && !templateResolution.success && (
            <Alert
              type="warning"
              showIcon
              title={templateResolution.error || "Không thể tải gói dịch vụ gợi ý."}
              className="text-xs"
            />
          )}

          {/* Prompt to select primary diagnosis */}
          {!selectedPrimaryId && (
            <div className="text-xs text-slate-400 italic py-2 text-center">
              Vui lòng chọn Chẩn đoán chính để tự động nạp các gói DVKT gợi ý theo TT06.
            </div>
          )}
        </div>

        {/* SECTION 2: DỊCH VỤ KỸ THUẬT (COMBOBOX SEARCH + SELECTION) */}
        <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <MedicineBoxOutlined className="text-teal-600" />
              2. Dịch Vụ Kỹ Thuật (DVKT Bác Sĩ Chỉ Định)
            </span>
            <Tag color={selectedServices.length > 0 ? "teal" : "default"} className="m-0 font-semibold text-xs">
              Đã chọn: {selectedServices.length} DVKT
            </Tag>
          </div>

          {/* Searchable DVKT Combobox */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tìm & Chọn Dịch Vụ Kỹ Thuật (Gõ tên, mã hoặc chỉ định)
            </label>
            <Select
              mode="multiple"
              showSearch
              placeholder="Nhập tên, mã hoặc chỉ định DVKT để tìm (VD: tiền đình, xoang, liệt mặt, xoa bóp...)"
              className="w-full"
              value={selectedServiceIds}
              onChange={setSelectedServiceIds}
              filterOption={(input, option) => {
                if (!option || !input) return true;
                const opt = option as FilterOptionItem;
                const label = String(opt.label || "").toLowerCase();
                const code = String(opt.code || "").toLowerCase();
                const name = String(opt.name || "").toLowerCase();
                const group = String(opt.group || "").toLowerCase();
                const q = input.toLowerCase().trim();
                const combined = `${code} ${name} ${label} ${group}`;
                return label.includes(q) || code.includes(q) || name.includes(q) || group.includes(q) || matchSearchNormalized(combined, input);
              }}
              options={groupedServiceOptions}
              size="large"
              prefix={<SearchOutlined className="text-slate-400 mr-1" />}
              style={{ minHeight: "42px" }}
            />
          </div>

          {/* Selected DVKT Compact Chips */}
          <div>
            <span className="text-[11px] font-semibold text-slate-600 block mb-1.5 uppercase tracking-wide">
              Danh sách DVKT đã chọn:
            </span>
            {selectedServices.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedServices.map((s) => (
                  <Tag
                    key={s.id}
                    closable
                    onClose={() => handleRemoveService(s.id)}
                    className="px-2.5 py-1 text-xs bg-white border-teal-200 text-teal-900 rounded-lg flex items-center gap-1.5 font-medium m-0 shadow-2xs hover:border-teal-400 transition-colors"
                  >
                    <span>{s.service_name}</span>
                    <span className="text-[10px] text-teal-600 font-mono">({s.service_code})</span>
                  </Tag>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic py-1.5">
                Chưa chọn DVKT.
              </div>
            )}
          </div>

          {/* Free Text Note */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Ghi chú chỉ định DVKT (Tùy chọn):
            </label>
            <Input.TextArea
              rows={2}
              placeholder="VD: Châm tả huyệt Giáp tích, theo dõi đau tăng khi vận động, chiếu đèn 20 phút..."
              value={serviceNotes}
              onChange={(e) => setServiceNotes(e.target.value)}
              className="text-xs rounded-lg"
            />
          </div>
        </div>

        {/* SECTION 3: KẾ HOẠCH ĐIỀU TRỊ */}
        <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <CalendarOutlined className="text-teal-600" />
              3. Kế Hoạch Điều Trị (Số Buổi Liệu Trình)
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Số buổi dự kiến
            </label>
            <div className="flex items-center gap-3">
              <InputNumber
                min={1}
                max={100}
                placeholder="VD: 15"
                value={plannedSessionsInput}
                onChange={(val) => setPlannedSessionsInput(val)}
                size="large"
                className="w-40 font-bold text-slate-900"
              />
              <span className="text-xs font-medium text-slate-700">buổi điều trị</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Số buổi cho toàn bộ liệu trình hiện tại.
            </span>
          </div>
        </div>

        {/* SECTION 4: KẾ HOẠCH DVKT THEO BUỔI */}
        <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <CalendarOutlined className="text-teal-600" />
              4. Kế Hoạch DVKT Theo Buổi (Buổi 1..N)
            </span>
            {totalSessionsCount > 0 && (
              <Tag color="cyan" className="m-0 text-xs font-medium">
                Tổng {totalSessionsCount} buổi
              </Tag>
            )}
          </div>

          {totalSessionsCount <= 0 ? (
            <Alert
              type="info"
              showIcon
              title="Thiết lập số buổi điều trị để lập kế hoạch theo buổi."
              className="text-xs"
            />
          ) : isLoadingPlans ? (
            <div className="p-4 text-center text-xs text-slate-400">
              <Spin size="small" />
              <span className="ml-2">Đang tải kế hoạch từng buổi...</span>
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
                        : "border-slate-200 bg-white/70"
                    }`}
                  >
                    {/* Session Header Card */}
                    <div className="p-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
                            hasPlan
                              ? "bg-[#00897b] text-white"
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
                              <Tag color="success" className="m-0 text-[10px]">
                                Đã lập ({plan.services.length} DVKT)
                              </Tag>
                            ) : (
                              <Tag color="default" className="m-0 text-[10px]">
                                Chưa lập
                              </Tag>
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
                          <Button
                            size="small"
                            onClick={handleCloseSessionEditor}
                          >
                            Đóng
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            type={hasPlan ? "default" : "primary"}
                            onClick={() => handleOpenSessionEditor(sessionNo)}
                            className={!hasPlan ? "bg-[#00897b] hover:bg-teal-700" : ""}
                          >
                            {hasPlan ? "Chỉnh sửa" : "Thiết lập"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Inline Session Editor */}
                    {isEditing && (
                      <div className="p-3.5 border-t border-teal-100 bg-white rounded-b-xl space-y-3">
                        {sessionErrorMsg && (
                          <Alert
                            type="error"
                            showIcon
                            title={sessionErrorMsg}
                            className="text-xs"
                          />
                        )}
                        {sessionSuccessMsg && (
                          <Alert
                            type="success"
                            showIcon
                            title={sessionSuccessMsg}
                            className="text-xs"
                          />
                        )}

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-slate-700 block">
                            Dịch vụ kỹ thuật cho Buổi {sessionNo}:
                          </label>
                          <Select
                            mode="multiple"
                            showSearch
                            placeholder="Chọn DVKT cho buổi này..."
                            className="w-full"
                            value={sessionSelectedServices.map((s) => s.id)}
                            onChange={(serviceIds: string[]) => {
                              const mapped = serviceIds
                                .map((id) => services.find((s) => s.id === id))
                                .filter((s): s is ServiceCatalogItem => Boolean(s));
                              setSessionSelectedServices(mapped);
                            }}
                            filterOption={(input, option) => {
                              if (!option || !input) return true;
                              const opt = option as FilterOptionItem;
                              const label = String(opt.label || "").toLowerCase();
                              const code = String(opt.code || "").toLowerCase();
                              const name = String(opt.name || "").toLowerCase();
                              const group = String(opt.group || "").toLowerCase();
                              const q = input.toLowerCase().trim();
                              const combined = `${code} ${name} ${label} ${group}`;
                              return label.includes(q) || code.includes(q) || name.includes(q) || group.includes(q) || matchSearchNormalized(combined, input);
                            }}
                            options={groupedServiceOptions}
                            size="middle"
                          />
                        </div>

                        {/* Selected Services for this session */}
                        {sessionSelectedServices.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {sessionSelectedServices.map((s, idx) => (
                              <Tag
                                key={`${s.id}-${idx}`}
                                closable
                                onClose={() =>
                                  setSessionSelectedServices((prev) =>
                                    prev.filter((_, i) => i !== idx)
                                  )
                                }
                                className="text-xs bg-slate-50 border-slate-200 text-slate-800"
                              >
                                {s.service_name}
                              </Tag>
                            ))}
                          </div>
                        )}

                        {/* Session Notes */}
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 block mb-1">
                            Ghi chú cho Buổi {sessionNo} (tùy chọn):
                          </label>
                          <Input
                            placeholder="VD: Kiểm tra huyết áp trước khi châm, giảm cường độ..."
                            value={sessionNotes}
                            onChange={(e) => setSessionNotes(e.target.value)}
                            size="small"
                            className="text-xs"
                          />
                        </div>

                        {/* Action buttons for inline session save */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            size="small"
                            onClick={handleCloseSessionEditor}
                            disabled={isSavingSession}
                          >
                            Hủy
                          </Button>
                          <Button
                            type="primary"
                            size="small"
                            loading={isSavingSession}
                            onClick={() => handleSaveSessionPlan(sessionNo)}
                            className="bg-[#00897b] hover:bg-teal-700"
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
    </Drawer>
  );
};
