"use client";

import React from "react";
import Link from "next/link";
import { Tag } from "antd";
import {
  SolutionOutlined,
  CalendarOutlined,
  IdcardOutlined,
  TeamOutlined,
  FileExcelOutlined,
  ArrowRightOutlined,
  BankOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import type { ClinicRoleCode } from "@/types/clinic";
import type { ReceptionStats } from "@/types/reception";
import { isRouteVisibleForRoles } from "@/lib/auth/shell-identity";
import { ReceptionStatsCards } from "@/components/reception/ReceptionStatsCards";

export interface DashboardClientViewProps {
  staff: {
    id: string;
    staff_code: string;
    full_name: string;
  };
  clinic: {
    clinic_id: string;
    clinic_code: string;
    clinic_name: string;
    organization_id: string;
    is_primary: boolean;
    timezone: string;
  };
  activeRoles: ClinicRoleCode[];
  stats: ReceptionStats;
}

interface DashboardModuleConfig {
  title: string;
  description: string;
  href: string;
  badge: string;
  icon: React.ReactNode;
  iconBg: string;
  iconBorder: string;
  iconColor: string;
  tagColor: string;
}

const ALL_DASHBOARD_MODULES: DashboardModuleConfig[] = [
  {
    title: "Tiếp Nhận & Đăng Ký Khám",
    description: "Tiếp nhận bệnh nhân, kiểm tra thông tin thẻ BHYT và điều phối bác sĩ khám ban đầu.",
    href: "/reception",
    badge: "Hàng ngày",
    icon: <SolutionOutlined />,
    iconBg: "bg-teal-50",
    iconBorder: "border-teal-100",
    iconColor: "text-[#00897b]",
    tagColor: "teal",
  },
  {
    title: "Lịch Hẹn & Ma Trận Tháng",
    description: "Theo dõi lịch hẹn, lịch điều trị và ma trận lịch 31 ngày phân bổ theo bác sĩ.",
    href: "/schedule",
    badge: "Lịch khám & điều trị",
    icon: <CalendarOutlined />,
    iconBg: "bg-sky-50",
    iconBorder: "border-sky-100",
    iconColor: "text-sky-700",
    tagColor: "blue",
  },
  {
    title: "Quản Lý Hồ Sơ Bệnh Nhân",
    description: "Tra cứu hồ sơ 360°, thông tin bảo hiểm, lịch sử liệu trình và diễn tiến điều trị.",
    href: "/patients",
    badge: "Hồ sơ 360°",
    icon: <IdcardOutlined />,
    iconBg: "bg-purple-50",
    iconBorder: "border-purple-100",
    iconColor: "text-purple-700",
    tagColor: "purple",
  },
  {
    title: "Quản Trị Nhân Sự & Cơ Sở",
    description: "Quản lý hồ sơ nhân viên, phân công cơ sở hoạt động, cấp quyền và bảo mật tài khoản.",
    href: "/staff",
    badge: "Quản trị",
    icon: <TeamOutlined />,
    iconBg: "bg-emerald-50",
    iconBorder: "border-emerald-100",
    iconColor: "text-emerald-700",
    tagColor: "green",
  },
  {
    title: "Nhập Dữ Liệu Excel Cũ",
    description: "Chuyển đổi và kiểm tra chuẩn hóa dữ liệu lịch sử khám và liệu trình từ file Excel.",
    href: "/migration",
    badge: "Chuyển đổi dữ liệu",
    icon: <FileExcelOutlined />,
    iconBg: "bg-amber-50",
    iconBorder: "border-amber-100",
    iconColor: "text-amber-700",
    tagColor: "orange",
  },
];

export const DashboardClientView: React.FC<DashboardClientViewProps> = ({
  staff,
  clinic,
  activeRoles,
  stats,
}) => {
  // Role-filtered dashboard module visibility using centralized navigation authorization
  const visibleModules = ALL_DASHBOARD_MODULES.filter((mod) =>
    isRouteVisibleForRoles(mod.href, activeRoles)
  );

  return (
    <div className="w-full max-w-[1560px] mx-auto space-y-7 pb-8">
      {/* 1. Dynamic Greeting & Clinic Workspace Context */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold mb-2">
            <BankOutlined />
            <span>{clinic.clinic_name}</span>
            <span className="font-mono text-[11px] text-teal-600">[{clinic.clinic_code}]</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight m-0">
            Xin chào, {staff.full_name}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 m-0">
            Tổng quan hoạt động tại {clinic.clinic_name} hôm nay.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Tag color="cyan" className="text-xs font-semibold px-3 py-1 rounded-full m-0">
            Mã NV: {staff.staff_code}
          </Tag>
        </div>
      </div>

      {/* 2. Operations Statistics Section */}
      <div className="w-full">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-teal-600" />
          <span>Thống Kê Hoạt Động Hôm Nay</span>
        </div>
        <ReceptionStatsCards stats={stats} />
      </div>

      {/* 3. Authorized Modules Section */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-3.5">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <AppstoreOutlined className="text-teal-600" />
            <span>Phân Hệ Chức Năng</span>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {visibleModules.length} phân hệ khả dụng
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {visibleModules.map((mod) => (
            <Link key={mod.href} href={mod.href} className="group block focus:outline-none w-full">
              <div className="h-full w-full bg-white rounded-2xl border border-slate-200/90 hover:border-teal-500/60 hover:shadow-md transition-all duration-200 p-5 sm:p-6 flex flex-col justify-between shadow-xs">
                <div>
                  {/* Top: Icon & Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 border ${mod.iconBg} ${mod.iconBorder} ${mod.iconColor}`}
                    >
                      {mod.icon}
                    </div>
                    <Tag color={mod.tagColor} className="text-xs font-semibold m-0">
                      {mod.badge}
                    </Tag>
                  </div>

                  {/* Middle: Title & Description */}
                  <div className="mt-4">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors m-0">
                      {mod.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed m-0">
                      {mod.description}
                    </p>
                  </div>
                </div>

                {/* Bottom: Action CTA */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    Nhấn để mở phân hệ
                  </span>
                  <span className="inline-flex items-center text-xs sm:text-sm font-bold text-[#00897b] group-hover:translate-x-1 transition-transform">
                    Truy cập
                    <ArrowRightOutlined className="ml-1.5 text-xs" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 4. Minimal Footer */}
      <footer className="w-full pt-6 border-t border-slate-200/60 text-center text-xs text-slate-400">
        <p className="m-0">© 2026 Thuận Thiên Clinic · Hệ thống quản lý phòng khám nội bộ</p>
      </footer>
    </div>
  );
};
