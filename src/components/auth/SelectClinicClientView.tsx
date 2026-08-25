"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { StaffClinicMembershipIdentity } from "@/lib/auth/clinic-resolver";
import type { ClinicRoleCode } from "@/types/clinic";
import { ROLE_DISPLAY_LABELS } from "@/lib/auth/shell-identity";
import { setActiveClinicAction } from "@/app/actions/auth-actions";
import { LogoutButton } from "@/components/auth/LogoutButton";
import {
  Button,
  Tag,
  Avatar,
  Alert,
  Result,
} from "antd";
import {
  MedicineBoxOutlined,
  ArrowRightOutlined,
  UserOutlined,
  CheckCircleFilled,
  HistoryOutlined,
  StarFilled,
} from "@ant-design/icons";

export interface StaffClinicMembershipWithRoles extends StaffClinicMembershipIdentity {
  roles?: ClinicRoleCode[];
}

interface SelectClinicClientViewProps {
  staffName: string;
  staffCode: string;
  memberships: StaffClinicMembershipWithRoles[];
  currentActiveClinicId: string | null;
  lastSelectedClinicId?: string | null;
}

const ROLE_TAG_COLORS: Record<ClinicRoleCode, string> = {
  ADMIN: "red",
  MANAGER: "orange",
  DOCTOR: "blue",
  Y_SI: "cyan",
  TECHNICIAN: "geekblue",
  RECEPTIONIST: "green",
  CSKH: "purple",
};

export const SelectClinicClientView: React.FC<SelectClinicClientViewProps> = ({
  staffName,
  staffCode,
  memberships,
  currentActiveClinicId,
  lastSelectedClinicId = null,
}) => {
  const router = useRouter();
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(currentActiveClinicId);
  const [isSubmittingId, setIsSubmittingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectClinic = async (clinicId: string) => {
    if (isSubmittingId) return;

    setIsSubmittingId(clinicId);
    setErrorMessage(null);

    try {
      const res = await setActiveClinicAction(clinicId);

      if (!res.success) {
        throw new Error(res.error || "Không thể thiết lập cơ sở làm việc.");
      }

      setSelectedClinicId(clinicId);
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error).message || "Không thể thiết lập cơ sở làm việc. Vui lòng tải lại danh sách."
      );
      setIsSubmittingId(null);
    }
  };

  const staffInitials =
    staffName
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(-2)
      .join("")
      .toUpperCase() || "NV";

  return (
    <div className="min-h-screen min-h-dvh flex flex-col justify-between bg-gradient-to-br from-[#f0fdfa] via-[#f8fafc] to-[#f1f5f9] font-sans">
      {/* Compact Authenticated Top Navigation Header */}
      <header className="w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 lg:px-12 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Clinic Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 shrink-0">
              <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
                <path
                  d="M50 86C50 86 20 66 20 42C20 28 30 18 43 18C48 18 50 21 50 21C50 21 52 18 57 18C70 18 80 28 80 42C80 66 50 86 50 86Z"
                  stroke="#00897b"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="#e0f2f1"
                  fillOpacity="0.6"
                />
                <path
                  d="M38 48H44L48 38L52 58L56 48H62"
                  stroke="#00897b"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M62 62C68 58 74 64 74 64C74 64 68 70 62 70C56 70 62 62 62 62Z"
                  fill="#00897b"
                />
              </svg>
            </div>
            <div>
              <div className="text-base sm:text-lg font-bold text-[#00695c] tracking-tight leading-tight">
                Thuận Thiên Clinic
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00897b]">
                HỆ THỐNG QUẢN LÝ PHÒNG KHÁM
              </div>
            </div>
          </div>

          {/* Authenticated Staff Identity & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <Avatar className="bg-[#00897b] text-white font-bold text-xs shrink-0">
                {staffInitials}
              </Avatar>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-800 leading-tight">
                  {staffName}
                </div>
                <div className="text-[11px] font-mono font-semibold text-[#00897b]">
                  {staffCode}
                </div>
              </div>
            </div>

            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Workspace Selection Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex flex-col">
        {/* Page Title & Medical Icon */}
        <div className="mb-6 sm:mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold mb-2">
            <MedicineBoxOutlined />
            <span>Không gian làm việc</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight m-0">
            Chọn Cơ Sở Làm Việc
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 m-0 max-w-2xl">
            Chọn cơ sở bạn muốn truy cập để bắt đầu phiên làm việc.
          </p>
        </div>

        {/* Compact Staff Context Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#00897b] text-xl shrink-0">
              <UserOutlined />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm sm:text-base font-bold text-slate-900">
                  {staffName}
                </span>
                <Tag className="font-mono text-xs font-bold bg-slate-100 text-slate-700 border-slate-200 m-0">
                  {staffCode}
                </Tag>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Nhân viên đã xác thực danh tính trong hệ thống
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Tag color="cyan" className="text-xs font-semibold px-3 py-1 rounded-full m-0">
              Bạn có quyền truy cập {memberships.length} cơ sở phòng khám
            </Tag>
          </div>
        </div>

        {/* Error Alert Message */}
        {errorMessage && (
          <div className="mb-6">
            <Alert title={errorMessage} type="error" showIcon className="rounded-xl shadow-xs" />
          </div>
        )}

        {/* Empty State vs Clinic Grid */}
        {memberships.length === 0 ? (
          <div className="bg-white rounded-2xl border border-amber-200 p-8 shadow-xs text-center">
            <Result
              status="warning"
              title="Chưa Được Phân Công Cơ Sở"
              subTitle="Bạn chưa được phân công vào cơ sở hoạt động nào. Vui lòng liên hệ Quản trị viên hệ thống để được cấp quyền truy cập."
              extra={<LogoutButton />}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {memberships.map((membership) => {
              const isCurrentActive = membership.clinic_id === selectedClinicId;
              const isRecent =
                !isCurrentActive && membership.clinic_id === lastSelectedClinicId;
              const isSubmittingThis = isSubmittingId === membership.clinic_id;

              return (
                <div
                  key={membership.membership_id}
                  className={`bg-white rounded-2xl border transition-all duration-200 p-5 sm:p-6 flex flex-col justify-between ${
                    isCurrentActive
                      ? "border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/20 shadow-md"
                      : isRecent
                      ? "border-teal-400/80 shadow-xs hover:border-teal-500 hover:shadow-md"
                      : "border-slate-200/80 hover:border-teal-500/50 hover:shadow-md shadow-xs"
                  }`}
                >
                  {/* Top: Clinic Icon, Name, and Badges */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#00897b] text-xl shrink-0">
                        <MedicineBoxOutlined />
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {membership.is_primary && (
                          <Tag
                            color="purple"
                            icon={<StarFilled />}
                            className="text-[11px] font-semibold m-0"
                          >
                            Cơ sở chính
                          </Tag>
                        )}
                        {isRecent && (
                          <Tag
                            color="blue"
                            icon={<HistoryOutlined />}
                            className="text-[11px] font-semibold m-0"
                          >
                            Gần đây
                          </Tag>
                        )}
                        {isCurrentActive && (
                          <Tag
                            color="success"
                            icon={<CheckCircleFilled />}
                            className="text-[11px] font-semibold m-0"
                          >
                            Đang sử dụng
                          </Tag>
                        )}
                      </div>
                    </div>

                    <div className="mt-3.5">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug m-0">
                        {membership.clinic_name}
                      </h2>
                      <div className="mt-1.5">
                        <Tag className="font-mono text-xs font-semibold bg-slate-100 text-slate-600 border-slate-200 m-0">
                          {membership.clinic_code}
                        </Tag>
                      </div>
                    </div>

                    {/* Middle: Role Tags */}
                    {membership.roles && membership.roles.length > 0 && (
                      <div className="mt-4 pt-3.5 border-t border-slate-100">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Vai trò tại cơ sở
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {membership.roles.map((role) => (
                            <Tag
                              key={role}
                              color={ROLE_TAG_COLORS[role] || "default"}
                              className="text-xs font-medium m-0"
                            >
                              {ROLE_DISPLAY_LABELS[role] || role}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom: Action CTA Button */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-end">
                    <Button
                      type="primary"
                      icon={<ArrowRightOutlined />}
                      loading={isSubmittingThis}
                      disabled={isSubmittingId !== null}
                      onClick={() => handleSelectClinic(membership.clinic_id)}
                      className={`w-full sm:w-auto h-10 px-5 rounded-lg font-bold text-xs sm:text-sm transition-all border-none ${
                        isCurrentActive
                          ? "bg-teal-700 hover:bg-teal-800 text-white"
                          : "bg-[#00897b] hover:bg-[#00796b] text-white shadow-xs shadow-teal-900/10"
                      }`}
                    >
                      {isCurrentActive ? "Đang Làm Việc Tại Đây" : "Vào Cơ Sở"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white/50 backdrop-blur-xs">
        <p className="m-0">© 2026 Thuận Thiên Clinic · Hệ thống quản lý phòng khám nội bộ</p>
      </footer>
    </div>
  );
};
