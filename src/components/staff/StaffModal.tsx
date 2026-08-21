"use client";

import React, { useState } from "react";
import type { Clinic, StaffWithClinicMemberships, ClinicRoleCode } from "@/types/clinic";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import {
  createStaffAction,
  updateStaffAction,
  assignStaffClinicAction,
} from "@/app/actions/staff-actions";

export interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "CREATE" | "EDIT" | "ASSIGN_CLINIC";
  selectedStaff: StaffWithClinicMemberships | null;
  clinics: Clinic[];
  onSuccess: () => void;
}

const ALL_ROLES: { code: ClinicRoleCode; label: string }[] = [
  { code: "DOCTOR", label: "Bác Sĩ Điều Trị (DOCTOR)" },
  { code: "RECEPTIONIST", label: "Lễ Tân Tiếp Đón (RECEPTIONIST)" },
  { code: "TECHNICIAN", label: "Kỹ Thuật Viên (TECHNICIAN)" },
  { code: "Y_SI", label: "Y Sĩ Đa Khoa / YHCT (Y_SI)" },
  { code: "CSKH", label: "Chăm Sóc Khách Hàng (CSKH)" },
  { code: "MANAGER", label: "Quản Lý Cơ Sở (MANAGER)" },
  { code: "ADMIN", label: "Quản Trị Hệ Thống (ADMIN)" },
];

interface StaffModalFormProps {
  mode: "CREATE" | "EDIT" | "ASSIGN_CLINIC";
  selectedStaff: StaffWithClinicMemberships | null;
  clinics: Clinic[];
  onClose: () => void;
  onSuccess: () => void;
}

const StaffModalForm: React.FC<StaffModalFormProps> = ({
  mode,
  selectedStaff,
  clinics,
  onClose,
  onSuccess,
}) => {
  const [staffCode, setStaffCode] = useState<string>(selectedStaff?.staff_code || "");
  const [fullName, setFullName] = useState<string>(selectedStaff?.full_name || "");
  const [phone, setPhone] = useState<string>(selectedStaff?.phone || "");
  const [email, setEmail] = useState<string>(selectedStaff?.email || "");
  const [roleType] = useState<ClinicRoleCode>("DOCTOR");

  const [selectedClinicId, setSelectedClinicId] = useState<string>(clinics[0]?.id || "");
  const [isPrimary, setIsPrimary] = useState<boolean>(mode === "CREATE");
  const [selectedRoles, setSelectedRoles] = useState<ClinicRoleCode[]>(["DOCTOR"]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRoleToggle = (code: ClinicRoleCode) => {
    if (selectedRoles.includes(code)) {
      if (selectedRoles.length > 1) {
        setSelectedRoles(selectedRoles.filter((r) => r !== code));
      }
    } else {
      setSelectedRoles([...selectedRoles, code]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (mode === "CREATE") {
        const res = await createStaffAction({
          staff_code: staffCode.trim().toUpperCase(),
          full_name: fullName.trim(),
          role_type: roleType,
          phone: phone.trim() || null,
          email: email.trim() || null,
          clinic_assignments: selectedClinicId
            ? [
                {
                  clinic_id: selectedClinicId,
                  is_primary: isPrimary,
                  roles: selectedRoles,
                },
              ]
            : [],
        });

        if (!res.success) {
          throw new Error(res.error);
        }
      } else if (mode === "EDIT" && selectedStaff) {
        const res = await updateStaffAction({
          id: selectedStaff.id,
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
        });

        if (!res.success) {
          throw new Error(res.error);
        }
      } else if (mode === "ASSIGN_CLINIC" && selectedStaff) {
        if (!selectedClinicId) {
          throw new Error("Vui lòng chọn cơ sở phòng khám.");
        }
        const res = await assignStaffClinicAction({
          staff_id: selectedStaff.id,
          clinic_id: selectedClinicId,
          is_primary: isPrimary,
          roles: selectedRoles,
        });

        if (!res.success) {
          throw new Error(res.error);
        }
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Đã xảy ra lỗi khi lưu thông tin.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

      {(mode === "CREATE" || mode === "EDIT") && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Mã Nhân Viên *"
              placeholder="VD: BS-HAI, LT-01"
              value={staffCode}
              onChange={(e) => setStaffCode(e.target.value.toUpperCase())}
              disabled={mode === "EDIT"}
              required
            />

            <Input
              label="Họ Và Tên *"
              placeholder="VD: BS. Nguyễn Văn Hải"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Số Điện Thoại"
              placeholder="VD: 0912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <Input
              label="Email"
              type="email"
              placeholder="VD: doctor.hai@thuanthien.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </>
      )}

      {(mode === "CREATE" || mode === "ASSIGN_CLINIC") && (
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-teal-800">
            Phân Công Cơ Sở Phòng Khám & Vai Trò
          </h4>

          {clinics.length === 0 ? (
            <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              Chưa có cơ sở phòng khám nào trong hệ thống.
            </p>
          ) : (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Chọn Cơ Sở Phòng Khám *
              </label>
              <select
                value={selectedClinicId}
                onChange={(e) => setSelectedClinicId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                required
              >
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.clinic_code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPrimaryClinic"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <label htmlFor="isPrimaryClinic" className="text-xs font-medium text-slate-700">
              Đây là cơ sở làm việc chính (Primary Clinic)
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Các Vai Trò Tại Cơ Sở Này * (Có thể chọn nhiều vai trò)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_ROLES.map((role) => {
                const isChecked = selectedRoles.includes(role.code);
                return (
                  <label
                    key={role.code}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      isChecked
                        ? "bg-teal-50/80 border-teal-400 text-teal-900 font-semibold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleRoleToggle(role.code)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span>{role.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
        <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
          Hủy
        </Button>
        <Button type="submit" variant="primary" isLoading={isLoading}>
          {mode === "CREATE" ? "Tạo Nhân Viên" : "Lưu Thay Đổi"}
        </Button>
      </div>
    </form>
  );
};

export const StaffModal: React.FC<StaffModalProps> = ({
  isOpen,
  onClose,
  mode,
  selectedStaff,
  clinics,
  onSuccess,
}) => {
  const modalTitle =
    mode === "CREATE"
      ? "Thêm Nhân Viên Mới"
      : mode === "EDIT"
      ? `Cập Nhật Hồ Sơ: ${selectedStaff?.full_name}`
      : `Phân Công Cơ Sở: ${selectedStaff?.full_name}`;

  const modalDescription =
    mode === "CREATE"
      ? "Tạo hồ sơ nhân viên mới và phân công vào các cơ sở phòng khám."
      : mode === "EDIT"
      ? "Chỉnh sửa thông tin liên hệ và danh xưng nhân viên."
      : "Gán nhân viên vào cơ sở phòng khám và phân quyền vai trò cụ thể.";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      description={modalDescription}
      maxWidth="lg"
    >
      {isOpen && (
        <StaffModalForm
          key={`${mode}-${selectedStaff?.id || "new"}`}
          mode={mode}
          selectedStaff={selectedStaff}
          clinics={clinics}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </Modal>
  );
};
