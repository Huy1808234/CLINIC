"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Clinic, StaffWithClinicMemberships, ClinicRoleCode } from "@/types/clinic";
import { StaffTable } from "./StaffTable";
import { StaffModal } from "./StaffModal";
import { Button } from "@/components/ui/Button";
import { toggleStaffStatusAction } from "@/app/actions/staff-actions";

export interface StaffClientViewProps {
  initialStaff: StaffWithClinicMemberships[];
  clinics: Clinic[];
}

export const StaffClientView: React.FC<StaffClientViewProps> = ({
  initialStaff,
  clinics,
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedClinicFilter, setSelectedClinicFilter] = useState<string>("ALL");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("ALL");

  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT" | "ASSIGN_CLINIC">("CREATE");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffWithClinicMemberships | null>(null);

  const filteredStaff = useMemo(() => {
    return initialStaff.filter((staff) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = staff.staff_code.toLowerCase().includes(q);
        const matchesName = staff.full_name.toLowerCase().includes(q);
        const matchesPhone = (staff.phone || "").includes(q);
        const matchesEmail = (staff.email || "").toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesPhone && !matchesEmail) {
          return false;
        }
      }

      // Clinic filter
      if (selectedClinicFilter !== "ALL") {
        const belongsToClinic = staff.memberships.some(
          (m) => m.clinic_id === selectedClinicFilter && m.is_active
        );
        if (!belongsToClinic) return false;
      }

      // Role filter
      if (selectedRoleFilter !== "ALL") {
        const hasRole = staff.memberships.some((m) =>
          m.roles.includes(selectedRoleFilter as ClinicRoleCode)
        );
        if (!hasRole) return false;
      }

      return true;
    });
  }, [initialStaff, searchQuery, selectedClinicFilter, selectedRoleFilter]);

  const handleToggleActive = async (staffId: string, currentStatus: boolean) => {
    if (!confirm(`Bạn có chắc muốn ${currentStatus ? "khóa" : "kích hoạt"} nhân viên này?`)) {
      return;
    }
    await toggleStaffStatusAction(staffId, !currentStatus);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
        {/* Search */}
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm theo Mã NV, Tên, SĐT, Email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Filters & Add Button */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Clinic Filter */}
          <select
            value={selectedClinicFilter}
            onChange={(e) => setSelectedClinicFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none"
          >
            <option value="ALL">Tất cả cơ sở</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none"
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="DOCTOR">Bác Sĩ</option>
            <option value="RECEPTIONIST">Lễ Tân</option>
            <option value="TECHNICIAN">Kỹ Thuật Viên</option>
            <option value="Y_SI">Y Sĩ</option>
            <option value="CSKH">CSKH</option>
            <option value="MANAGER">Quản Lý</option>
            <option value="ADMIN">Admin</option>
          </select>

          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setSelectedStaff(null);
              setModalMode("CREATE");
              setIsModalOpen(true);
            }}
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Thêm Nhân Viên
          </Button>
        </div>
      </div>

      {/* Staff List Table */}
      <StaffTable
        staffList={filteredStaff}
        onEditStaff={(staff) => {
          setSelectedStaff(staff);
          setModalMode("EDIT");
          setIsModalOpen(true);
        }}
        onAssignClinic={(staff) => {
          setSelectedStaff(staff);
          setModalMode("ASSIGN_CLINIC");
          setIsModalOpen(true);
        }}
        onToggleActive={handleToggleActive}
      />

      {/* Staff Modal */}
      <StaffModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={modalMode}
        selectedStaff={selectedStaff}
        clinics={clinics}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
};
