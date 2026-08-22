"use client";

import React from "react";
import type { StaffWithClinicMemberships, ClinicRoleCode } from "@/types/clinic";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface StaffTableProps {
  staffList: StaffWithClinicMemberships[];
  onEditStaff: (staff: StaffWithClinicMemberships) => void;
  onAssignClinic: (staff: StaffWithClinicMemberships) => void;
  onToggleActive: (staffId: string, currentStatus: boolean) => void;
}

const roleBadgeVariants: Record<ClinicRoleCode, "default" | "secondary" | "success" | "warning" | "danger" | "purple"> = {
  DOCTOR: "default",
  RECEPTIONIST: "secondary",
  TECHNICIAN: "purple",
  Y_SI: "success",
  CSKH: "warning",
  MANAGER: "purple",
  ADMIN: "danger",
};

const roleLabels: Record<ClinicRoleCode, string> = {
  DOCTOR: "Bác Sĩ",
  RECEPTIONIST: "Tiếp Đón",
  TECHNICIAN: "KTV",
  Y_SI: "Y Sĩ",
  CSKH: "CSKH",
  MANAGER: "Quản Lý",
  ADMIN: "Admin",
};

export const StaffTable: React.FC<StaffTableProps> = ({
  staffList,
  onEditStaff,
  onAssignClinic,
  onToggleActive,
}) => {
  if (staffList.length === 0) {
    return (
      <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
        Không tìm thấy nhân viên nào phù hợp với bộ lọc.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
          <tr>
            <th className="py-3 px-4">Mã NV</th>
            <th className="py-3 px-4">Họ Và Tên</th>
            <th className="py-3 px-4">Liên Hệ</th>
            <th className="py-3 px-4">Cơ Sở Trực Thuộc & Vai Trò</th>
            <th className="py-3 px-4 text-center">Trạng Thái</th>
            <th className="py-3 px-4 text-right">Thao Tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {staffList.map((staff) => (
            <tr key={staff.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="py-3.5 px-4 font-mono font-bold text-teal-700">
                {staff.staff_code}
              </td>
              <td className="py-3.5 px-4 font-semibold text-slate-900">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 font-bold text-[11px] flex items-center justify-center">
                    {staff.full_name.slice(0, 1).toUpperCase()}
                  </div>
                  <span>{staff.full_name}</span>
                </div>
              </td>
              <td className="py-3.5 px-4">
                <div className="space-y-0.5 font-mono text-[11px] text-slate-600">
                  <p>{staff.phone || "—"}</p>
                  {staff.email && <p className="text-slate-400 font-sans">{staff.email}</p>}
                </div>
              </td>
              <td className="py-3.5 px-4">
                {staff.memberships.length === 0 ? (
                  <span className="text-slate-400 italic">Chưa gán cơ sở</span>
                ) : (
                  <div className="space-y-1.5">
                    {staff.memberships.map((m) => (
                      <div
                        key={m.membership_id}
                        className={`flex flex-wrap items-center gap-1.5 p-1.5 rounded-lg border ${
                          m.is_active
                            ? "bg-slate-50/80 border-slate-200/80"
                            : "bg-slate-100/50 border-slate-200/40 opacity-60"
                        }`}
                      >
                        <span className="font-semibold text-slate-800 text-[11px]">
                          {m.clinic_name}
                          {m.is_primary && (
                            <span className="ml-1 text-[10px] text-teal-600 font-bold">(Chính)</span>
                          )}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {m.roles.map((r) => (
                            <Badge
                              key={r}
                              variant={roleBadgeVariants[r] || "default"}
                              size="sm"
                            >
                              {roleLabels[r] || r}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </td>
              <td className="py-3.5 px-4 text-center">
                <div className="flex flex-col items-center gap-1">
                  <Badge variant={staff.is_active ? "success" : "default"} size="sm">
                    {staff.is_active ? "Hoạt động" : "Đã khóa"}
                  </Badge>
                  {staff.user_id ? (
                    staff.auth_setup_required ? (
                      <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Chờ thiết lập
                      </span>
                    ) : (
                      <span className="text-[10px] text-teal-700 font-medium bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                        Đã kích hoạt
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">Chưa có TK</span>
                  )}
                </div>
              </td>
              <td className="py-3.5 px-4 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAssignClinic(staff)}
                    title="Phân cơ sở & vai trò"
                  >
                    Phân Cơ Sở
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEditStaff(staff)}
                    title="Sửa hồ sơ"
                  >
                    Sửa
                  </Button>
                  <Button
                    size="sm"
                    variant={staff.is_active ? "destructive" : "secondary"}
                    onClick={() => onToggleActive(staff.id, staff.is_active)}
                  >
                    {staff.is_active ? "Khóa" : "Mở"}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
