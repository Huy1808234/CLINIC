"use client";

import React, { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  Drawer,
  Select,
  InputNumber,
  Button,
  Tag,
  Alert,
  Space,
  Typography,
  Checkbox,
  Spin,
  Collapse,
} from "antd";
import {
  EditOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  MedicineBoxOutlined,
  BulbOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";
import type { PatientHistorySummary } from "@/types/patient";
import type { TemplateSuggestionResolution } from "@/types/clinical-template";
import {
  recordCourseDiagnosisAction,
  orderCourseServicesAction,
  establishInitialTreatmentPlanAction,
} from "@/app/actions/clinical-actions";
import { getClinicalTemplateSuggestionAction } from "@/app/actions/clinical-template-actions";
import { DoctorTreatmentPlanCard } from "./DoctorTreatmentPlanCard";

const { Text } = Typography;

export interface DoctorClinicalCourseCardProps {
  course: PatientHistorySummary["treatment_courses"][number];
  diagnosesCatalog: DiagnosisCatalogItem[];
  servicesCatalog: ServiceCatalogItem[];
  isDoctor: boolean;
}

export const DoctorClinicalCourseCard: React.FC<DoctorClinicalCourseCardProps> = ({
  course,
  diagnosesCatalog,
  servicesCatalog,
  isDoctor,
}) => {
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Identify existing primary vs secondary diagnoses
  const existingDiagnoses = course.course_diagnoses || [];
  const primaryDiag = existingDiagnoses.find(
    (d) => d.is_primary || d.diagnosis_type === "PRIMARY"
  );
  const secondaryDiags = existingDiagnoses.filter((d) => d !== primaryDiag);

  const existingServices = course.course_services || [];

  // Form State inside Drawer
  const [selectedPrimaryId, setSelectedPrimaryId] = useState<string | undefined>(
    primaryDiag?.diagnosis_id || undefined
  );
  const [selectedSecondaryIds, setSelectedSecondaryIds] = useState<string[]>(
    secondaryDiags
      .map((d) => d.diagnosis_id)
      .filter((id): id is string => Boolean(id))
  );
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    existingServices.map((s) => s.service_id)
  );
  const [plannedSessionsInput, setPlannedSessionsInput] = useState<number | null>(
    course.planned_session_count || null
  );

  // TT06 Suggestion State
  const [templateResolution, setTemplateResolution] = useState<TemplateSuggestionResolution | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState<boolean>(false);
  const reqCounter = useRef<number>(0);

  const hasAnyDiagnosis = Boolean(primaryDiag || secondaryDiags.length > 0);

  const fetchTemplateSuggestions = (diagId?: string) => {
    if (!diagId) {
      setTemplateResolution(null);
      setIsLoadingSuggestion(false);
      return;
    }

    const currentReq = ++reqCounter.current;
    setIsLoadingSuggestion(true);

    getClinicalTemplateSuggestionAction({
      diagnosis_id: diagId,
      treatment_course_id: course.id,
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

  // Filter diagnoses excluding selected primary from secondary choices
  const secondaryDiagnosisOptions = useMemo(() => {
    return diagnosesCatalog
      .filter((d) => d.is_active && d.id !== selectedPrimaryId)
      .map((d) => ({
        value: d.id,
        label: `${d.code} — ${d.name}`,
        code: d.code,
        name: d.name,
      }));
  }, [diagnosesCatalog, selectedPrimaryId]);

  const primaryDiagnosisOptions = useMemo(() => {
    return diagnosesCatalog
      .filter((d) => d.is_active)
      .map((d) => ({
        value: d.id,
        label: `${d.code} — ${d.name}`,
        code: d.code,
        name: d.name,
      }));
  }, [diagnosesCatalog]);

  const serviceOptions = useMemo(() => {
    return servicesCatalog
      .filter((s) => s.is_active)
      .map((s) => ({
        value: s.id,
        label: `${s.service_code} — ${s.service_name}`,
        code: s.service_code,
        name: s.service_name,
      }));
  }, [servicesCatalog]);

  const handleOpenDrawer = () => {
    const initialPrimaryId = primaryDiag?.diagnosis_id || undefined;
    setSelectedPrimaryId(initialPrimaryId);
    setSelectedSecondaryIds(
      secondaryDiags
        .map((d) => d.diagnosis_id)
        .filter((id): id is string => Boolean(id))
    );
    setSelectedServiceIds(existingServices.map((s) => s.service_id));
    setPlannedSessionsInput(course.planned_session_count || null);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsDrawerOpen(true);
    fetchTemplateSuggestions(initialPrimaryId);
  };

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

  const handleSaveClinicalPlan = async () => {
    if (!selectedPrimaryId) {
      setErrorMsg("Vui lòng chọn chẩn đoán chính cho liệu trình.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Record Primary Diagnosis
      const primaryRes = await recordCourseDiagnosisAction({
        treatment_course_id: course.id,
        diagnosis_id: selectedPrimaryId,
        is_primary: true,
        diagnosis_type: "PRIMARY",
      });

      if (!primaryRes.success) {
        setErrorMsg(primaryRes.error || "Không thể lưu chẩn đoán chính.");
        setIsSubmitting(false);
        return;
      }

      // 2. Record Secondary Diagnoses if any
      for (const secId of selectedSecondaryIds) {
        const secRes = await recordCourseDiagnosisAction({
          treatment_course_id: course.id,
          diagnosis_id: secId,
          is_primary: false,
          diagnosis_type: "SECONDARY",
        });

        if (!secRes.success) {
          setErrorMsg(secRes.error || "Không thể lưu chẩn đoán kèm theo.");
          setIsSubmitting(false);
          return;
        }
      }

      // 3. Record DVKT Service Orders (only newly selected services, preventing duplication)
      const existingServiceIdSet = new Set(existingServices.map((s) => s.service_id));
      const newServiceIds = selectedServiceIds.filter((id) => !existingServiceIdSet.has(id));

      if (newServiceIds.length > 0) {
        const servRes = await orderCourseServicesAction({
          treatment_course_id: course.id,
          service_ids: newServiceIds,
        });

        if (!servRes.success) {
          setErrorMsg(servRes.error || "Không thể chỉ định dịch vụ kỹ thuật.");
          setIsSubmitting(false);
          return;
        }
      }

      // 4. Optionally establish initial planned sessions if not already established
      if (
        plannedSessionsInput &&
        plannedSessionsInput > 0 &&
        course.planned_session_count === null
      ) {
        const planRes = await establishInitialTreatmentPlanAction({
          course_id: course.id,
          planned_session_count: plannedSessionsInput,
        });

        if (!planRes.success && !planRes.error?.includes("Kế hoạch điều trị đã được thiết lập")) {
          setErrorMsg(planRes.error || "Không thể thiết lập kế hoạch buổi điều trị.");
          setIsSubmitting(false);
          return;
        }
      }

      setSuccessMsg("Đã lưu kế hoạch chẩn đoán và chỉ định DVKT thành công.");
      setTimeout(() => {
        setIsDrawerOpen(false);
        router.refresh();
      }, 700);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Đã xảy ra lỗi không mong muốn.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card
        size="small"
        className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden mb-4"
        title={
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-sm">
                Liệu Trình {course.course_no} (LT{course.course_no})
              </span>
              <Tag color={course.status === "ACTIVE" ? "green" : "default"} className="m-0 text-xs">
                {course.status === "ACTIVE" ? "Đang điều trị" : course.status}
              </Tag>
            </div>
            {isDoctor && (
              <Button
                type="primary"
                size="small"
                icon={hasAnyDiagnosis ? <EditOutlined /> : <PlusOutlined />}
                onClick={handleOpenDrawer}
                className="bg-[#00897b] hover:bg-teal-700 text-xs font-medium"
              >
                {hasAnyDiagnosis ? "Chỉnh sửa Chẩn đoán & DVKT" : "Nhập Chẩn đoán & Chỉ định"}
              </Button>
            )}
          </div>
        }
      >
        {/* SECTION 1: CHẨN ĐOÁN & CHỈ ĐỊNH DVKT */}
        <div className="bg-slate-50/80 rounded-lg p-3 border border-slate-100 mb-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MedicineBoxOutlined className="text-teal-600" />
            <span>Đánh Giá Lâm Sàng & Chỉ Định</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Primary Diagnosis */}
            <div>
              <Text className="text-[11px] font-semibold text-slate-400 block">
                Chẩn đoán chính (Mã bệnh):
              </Text>
              {primaryDiag ? (
                <div className="flex items-center gap-1.5 mt-0.5 font-semibold text-slate-800">
                  {primaryDiag.raw_code && (
                    <Tag color="blue" className="m-0 font-mono text-xs">
                      {primaryDiag.raw_code}
                    </Tag>
                  )}
                  <span>{primaryDiag.raw_text}</span>
                </div>
              ) : (
                <span className="text-slate-400 italic mt-0.5 block">Chưa có chẩn đoán chính</span>
              )}
            </div>

            {/* Secondary Diagnoses */}
            <div>
              <Text className="text-[11px] font-semibold text-slate-400 block">
                Chẩn đoán kèm theo:
              </Text>
              {secondaryDiags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {secondaryDiags.map((d, i) => (
                    <Tag key={i} color="cyan" className="m-0 text-xs">
                      {d.raw_code ? `${d.raw_code} - ${d.raw_text}` : d.raw_text}
                    </Tag>
                  ))}
                </div>
              ) : (
                <span className="text-slate-400 mt-0.5 block">Không có</span>
              )}
            </div>

            {/* Ordered DVKT Services */}
            <div>
              <Text className="text-[11px] font-semibold text-slate-400 block">
                Dịch vụ kỹ thuật chỉ định:
              </Text>
              {existingServices.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {existingServices.map((s, i) => (
                    <Tag key={i} color="purple" className="m-0 text-xs font-medium">
                      {s.service_name || s.service_code}
                    </Tag>
                  ))}
                </div>
              ) : (
                <span className="text-slate-400 mt-0.5 block">Chưa có chỉ định DVKT</span>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: KẾ HOẠCH ĐIỀU TRỊ */}
        <DoctorTreatmentPlanCard
          courseId={course.id}
          courseStatus={course.status}
          plannedSessionCount={course.planned_session_count}
          plannedByDoctorId={course.planned_by_doctor_id}
          plannedByDoctorName={course.planned_by_doctor_name}
          plannedAt={course.planned_at}
          isDoctor={isDoctor}
        />
      </Card>

      {/* DOCTOR CLINICAL DRAWER */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <MedicineBoxOutlined className="text-teal-600 text-lg" />
            <span className="font-bold text-slate-900">
              Chẩn Đoán & Chỉ Định — Liệu Trình LT{course.course_no}
            </span>
          </div>
        }
        placement="right"
        width={580}
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
        extra={
          <Space>
            <Button onClick={() => setIsDrawerOpen(false)} disabled={isSubmitting}>
              Đóng
            </Button>
            <Button
              type="primary"
              onClick={handleSaveClinicalPlan}
              loading={isSubmitting}
              icon={<CheckCircleOutlined />}
              className="bg-[#00897b] hover:bg-teal-700"
            >
              Lưu Kế Hoạch
            </Button>
          </Space>
        }
      >
        <div className="space-y-5">
          {errorMsg && (
            <Alert
              type="error"
              showIcon
              message={errorMsg}
              closable
              onClose={() => setErrorMsg(null)}
            />
          )}

          {successMsg && (
            <Alert
              type="success"
              showIcon
              message={successMsg}
            />
          )}

          {/* SECTION 1: CHẨN ĐOÁN */}
          <div className="space-y-4 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>1. Chẩn Đoán Bệnh</span>
            </div>

            {/* Primary Diagnosis */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Chẩn Đoán Chính (Mã bệnh chính) <span className="text-rose-500">*</span>
              </label>
              <Select
                showSearch
                placeholder="🔎 Tìm mã hoặc tên bệnh theo ICD/YHCT..."
                className="w-full"
                value={selectedPrimaryId}
                onChange={(val) => {
                  setSelectedPrimaryId(val);
                  setSelectedSecondaryIds((prev) => prev.filter((id) => id !== val));
                  fetchTemplateSuggestions(val);
                }}
                filterOption={(input, option) => {
                  const label = String(option?.label || "").toLowerCase();
                  const code = String(option?.code || "").toLowerCase();
                  const name = String(option?.name || "").toLowerCase();
                  const q = input.toLowerCase().trim();
                  return label.includes(q) || code.includes(q) || name.includes(q);
                }}
                options={primaryDiagnosisOptions}
                size="large"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Chọn chẩn đoán chính để tự động nạp gói gợi ý DVKT chuẩn TT06.
              </span>
            </div>

            {/* Secondary Diagnoses */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
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
                  const label = String(option?.label || "").toLowerCase();
                  const code = String(option?.code || "").toLowerCase();
                  const name = String(option?.name || "").toLowerCase();
                  const q = input.toLowerCase().trim();
                  return label.includes(q) || code.includes(q) || name.includes(q);
                }}
                options={secondaryDiagnosisOptions}
                size="middle"
              />
            </div>
          </div>

          {/* SECTION 2: GỢI Ý DVKT THEO TT06 */}
          <div className="bg-teal-50/50 p-3.5 rounded-xl border border-teal-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BulbOutlined className="text-teal-600 text-sm" />
                <span className="text-xs font-bold text-teal-900 uppercase tracking-wider">
                  2. Gợi Ý DVKT Theo TT06
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
                  Chọn tất cả gợi ý
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
                  {templateResolution.template.items.map((item) => {
                    const isSelected = selectedServiceIds.includes(item.service_id);
                    return (
                      <div
                        key={item.item_id}
                        onClick={() => handleToggleSuggestedService(item.service_id, item.is_available, item.already_ordered)}
                        className={`flex items-start justify-between p-2.5 rounded-lg border text-xs transition-all ${
                          item.already_ordered
                            ? "bg-purple-50/60 border-purple-200 cursor-default"
                            : !item.is_available
                            ? "bg-slate-100/70 border-slate-200 opacity-60 cursor-not-allowed"
                            : isSelected
                            ? "bg-teal-50 border-teal-400 shadow-xs cursor-pointer"
                            : "bg-white border-slate-200 hover:border-teal-300 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <Checkbox
                            checked={isSelected}
                            disabled={!item.is_available || item.already_ordered}
                            className="mt-0.5"
                          />
                          <div>
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <span>{item.service_name || item.service_code}</span>
                              <span className="text-[10px] text-slate-400 font-mono font-normal">
                                ({item.service_code})
                              </span>
                            </div>
                            {item.indication_notes && (
                              <div className="text-[11px] text-teal-700 font-medium mt-0.5">
                                Chỉ định gợi ý: <span className="font-semibold">{item.indication_notes}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          {item.already_ordered ? (
                            <Tag color="purple" className="m-0 text-[10px]">
                              ✓ Đã chỉ định
                            </Tag>
                          ) : !item.is_available ? (
                            <Tag color="default" className="m-0 text-[10px]">
                              Unavailable tại cơ sở
                            </Tag>
                          ) : isSelected ? (
                            <Tag color="success" className="m-0 text-[10px]">
                              Đã chọn
                            </Tag>
                          ) : (
                            <Tag color="cyan" className="m-0 text-[10px]">
                              Gợi ý
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
                          <span>Mã HIS/BHYT theo lượt (Tham khảo)</span>
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
                                  {templateResolution.template.items.map((item) => {
                                    const c = item.cycles.find((cy) => cy.cycle_number === cycleNum);
                                    return (
                                      <div key={item.item_id} className="text-[10px] leading-tight">
                                        <span className="font-medium text-slate-700">{item.service_name}: </span>
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

            {/* No Template Informational State */}
            {!isLoadingSuggestion && templateResolution?.success && !templateResolution.found && (
              <Alert
                type="info"
                showIcon
                message="Chưa có gợi ý DVKT theo TT06 cho mã bệnh này."
                description="Bác sĩ có thể tự chọn các dịch vụ kỹ thuật được phép phía dưới."
                className="text-xs"
              />
            )}

            {/* Template Conflict State */}
            {!isLoadingSuggestion && templateResolution && !templateResolution.success && (
              <Alert
                type="warning"
                showIcon
                message={templateResolution.error || "Không thể xác định phiên bản mẫu điều trị."}
                className="text-xs"
              />
            )}

            {/* Prompt to select primary diagnosis */}
            {!selectedPrimaryId && (
              <div className="text-xs text-slate-400 italic py-2 text-center">
                Vui lòng chọn Chẩn đoán chính để xem các gói DVKT gợi ý theo TT06.
              </div>
            )}
          </div>

          {/* SECTION 3: DVKT CHỈ ĐỊNH / CHỌN THÊM */}
          <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>3. Tổng Hợp DVKT Chỉ Định ({selectedServiceIds.length})</span>
            </div>

            <Select
              mode="multiple"
              showSearch
              placeholder="Chọn thêm dịch vụ kỹ thuật ngoài gợi ý..."
              className="w-full"
              value={selectedServiceIds}
              onChange={setSelectedServiceIds}
              filterOption={(input, option) => {
                const label = String(option?.label || "").toLowerCase();
                const code = String(option?.code || "").toLowerCase();
                const name = String(option?.name || "").toLowerCase();
                const q = input.toLowerCase().trim();
                return label.includes(q) || code.includes(q) || name.includes(q);
              }}
              options={serviceOptions}
              size="large"
            />
            <span className="text-[11px] text-slate-400 block">
              Bác sĩ có thể thêm hoặc bớt các dịch vụ kỹ thuật phù hợp với chẩn đoán lâm sàng.
            </span>
          </div>

          {/* SECTION 4: KẾ HOẠCH BUỔI ĐIỀU TRỊ */}
          {course.planned_session_count === null && (
            <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                <span>4. Kế Hoạch Số Buổi Điều Trị</span>
              </div>
              <InputNumber
                min={1}
                max={60}
                placeholder="VD: 7 hoặc 10 buổi"
                className="w-full"
                value={plannedSessionsInput}
                onChange={(val) => setPlannedSessionsInput(val)}
                size="large"
              />
              <span className="text-[11px] text-slate-400 block">
                Bác sĩ có thể thiết lập số buổi dự kiến ngay khi chẩn đoán và chỉ định DVKT.
              </span>
            </div>
          )}
        </div>
      </Drawer>
    </>
  );
};
