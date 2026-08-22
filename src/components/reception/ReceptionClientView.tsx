"use client";

import React, { useState } from "react";
import type { ReceptionQueueItem, ReceptionStats } from "@/types/reception";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";
import type { DoctorStaffItem } from "@/rsc-data/treatment/get-catalogs";
import { ReceptionStatsCards } from "./ReceptionStatsCards";
import { ReceptionQueueTable } from "./ReceptionQueueTable";
import { DeduplicationBanner } from "./DeduplicationBanner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import type { DeduplicationMatchResult } from "@/types/patient";
import { submitReceptionAction } from "@/app/actions/reception-actions";

export interface ReceptionClientViewProps {
  initialStats: ReceptionStats;
  initialQueue: ReceptionQueueItem[];
  catalogs: {
    diagnoses: DiagnosisCatalogItem[];
    services: ServiceCatalogItem[];
    doctors: DoctorStaffItem[];
  };
}

export const ReceptionClientView: React.FC<ReceptionClientViewProps> = ({
  initialStats,
  initialQueue,
  catalogs,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [queue, setQueue] = useState<ReceptionQueueItem[]>(initialQueue);
  const [stats, setStats] = useState<ReceptionStats>(initialStats);

  // Form State
  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [citizenId, setCitizenId] = useState<string>("");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [birthYear, setBirthYear] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [doctorId, setDoctorId] = useState<string>(catalogs.doctors[0]?.id || "");
  const [reasonForVisit, setReasonForVisit] = useState<string>("");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [matchCandidate, setMatchCandidate] = useState<DeduplicationMatchResult | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const resetForm = () => {
    setFullName("");
    setPhone("");
    setCitizenId("");
    setCardNumber("");
    setBirthYear("");
    setAddress("");
    setReasonForVisit("");
    setMatchCandidate(null);
    setSelectedPatientId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAlertMsg(null);

    try {
      const res = await submitReceptionAction({
        patient_id: selectedPatientId || null,
        patient_data: {
          full_name: fullName,
          phone: phone || null,
          citizen_id: citizenId || null,
          insurance_card_number: cardNumber || null,
          birth_year: parseInt(birthYear, 10) || null,
          dob_precision: birthYear ? "YEAR_ONLY" : "UNKNOWN",
          address: address || null,
        },
        reception_source: "MANUAL",
        patient_relation_type: selectedPatientId ? "RETURNING" : "NEW",
        reason_for_visit: reasonForVisit || null,
        create_course: true,
        doctor_id: doctorId && doctorId !== "" ? doctorId : null,
      });

      if (!res.success) {
        throw new Error(res.error);
      }

      if (res.data) {
        const item: ReceptionQueueItem = {
          id: res.data.reception.id,
          patient_id: res.data.patient.id,
          insurance_card_id: res.data.reception.insurance_card_id,
          arrived_at: res.data.reception.arrived_at,
          registered_at: res.data.reception.registered_at,
          reception_source: res.data.reception.reception_source,
          patient_relation_type: res.data.reception.patient_relation_type,
          paper_file_status: res.data.reception.paper_file_status,
          his_import_status: res.data.reception.his_import_status,
          reason_for_visit: res.data.reception.reason_for_visit,
          notes: res.data.reception.notes,
          created_by: res.data.reception.created_by,
          created_at: res.data.reception.created_at,
          patient: {
            ...res.data.patient,
            current_insurance: null,
            active_alerts: [],
            active_treatment_courses_count: 1,
          },
          active_course: res.data.course
            ? {
              id: res.data.course.id,
              course_no: res.data.course.course_no,
              doctor_name: catalogs.doctors.find((d) => d.id === res.data!.course!.primary_doctor_id)?.full_name || null,
              planned_session_count: res.data.course.planned_session_count,
              completed_session_count: res.data.course.completed_session_count,
              status: res.data.course.status,
            }
            : null,
        };

        setQueue([item, ...queue]);
        setStats((prev) => ({
          ...prev,
          total_today: prev.total_today + 1,
          new_patients_today: selectedPatientId ? prev.new_patients_today : prev.new_patients_today + 1,
          returning_patients_today: selectedPatientId ? prev.returning_patients_today + 1 : prev.returning_patients_today,
          waiting_exam_count: prev.waiting_exam_count + 1,
        }));
      }

      setAlertMsg({ type: "success", text: "Tiếp nhận bệnh nhân thành công vào cơ sở dữ liệu!" });
      setIsModalOpen(false);
      resetForm();
    } catch (err: unknown) {
      setAlertMsg({ type: "error", text: (err as Error).message || "Lỗi tiếp nhận bệnh nhân." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <ReceptionStatsCards stats={stats} />

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Quản Lý Tiếp Nhận Hôm Nay</h2>
          <p className="text-xs text-slate-500">
            Tiếp đón bệnh nhân đến khám, kiểm tra thẻ BHYT và xếp vào hàng đợi bác sĩ.
          </p>
        </div>

        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Đăng Ký Khám Mới
        </Button>
      </div>

      {alertMsg && (
        <Alert variant={alertMsg.type === "success" ? "success" : "error"}>
          {alertMsg.text}
        </Alert>
      )}

      {/* Today's Queue */}
      <ReceptionQueueTable
        items={queue}
        onCheckInSession={(courseId) => {
          setQueue((prev) =>
            prev.map((item) =>
              item.active_course?.id === courseId
                ? {
                  ...item,
                  active_course: {
                    ...item.active_course,
                    completed_session_count: item.active_course.completed_session_count + 1,
                  },
                }
                : item
            )
          );
        }}
      />

      {/* Reception Intake Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title="Tiếp Nhận & Đăng Ký Khám Mới"
        description="Nhập thông tin bệnh nhân và chỉ định bác sĩ khám ban đầu."
        maxWidth="2xl"
      >
        {matchCandidate && (
          <DeduplicationBanner
            matchResult={matchCandidate}
            onUseExisting={() => {
              setSelectedPatientId(matchCandidate.matched_patient_id);
              if (matchCandidate.existing_patient) {
                setFullName(matchCandidate.existing_patient.full_name);
                setPhone(matchCandidate.existing_patient.phone || "");
                setCitizenId(matchCandidate.existing_patient.citizen_id || "");
                setBirthYear(matchCandidate.existing_patient.birth_year ? String(matchCandidate.existing_patient.birth_year) : "");
                setAddress(matchCandidate.existing_patient.address || "");
              }
              setMatchCandidate(null);
            }}
            onDismiss={() => setMatchCandidate(null)}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Họ Và Tên Bệnh Nhân *"
              placeholder="VD: Nguyễn Văn An"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <Input
              label="Số Điện Thoại"
              placeholder="VD: 0912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Số CCCD / CMND"
              placeholder="12 chữ số"
              value={citizenId}
              onChange={(e) => setCitizenId(e.target.value)}
            />

            <Input
              label="Số Thẻ BHYT"
              placeholder="15 ký tự (VD: GD479...)"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
            />

            <Input
              label="Năm Sinh"
              type="number"
              placeholder="VD: 1968"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
            />
          </div>

          <Input
            label="Địa Chỉ"
            placeholder="Số nhà, đường, phường/xã, quận/huyện..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />

          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Bác Sĩ Khám Ban Đầu
            </label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">-- Chưa chỉ định bác sĩ --</option>
              {catalogs.doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name} ({d.staff_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Input
              label="Lý Do Đến Khám"
              placeholder="VD: Đau lưng, tê bì chân tay..."
              value={reasonForVisit}
              onChange={(e) => setReasonForVisit(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              Hoàn Tất Tiếp Nhận
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
