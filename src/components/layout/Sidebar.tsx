"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Drawer } from "antd";
import {
  UserAddOutlined,
  CalendarOutlined,
  FileTextOutlined,
  TeamOutlined,
  CloudUploadOutlined,
  MedicineBoxOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import type { ClinicRoleCode } from "@/types/clinic";
import { isRouteVisibleForRoles } from "@/lib/auth/shell-identity";

export interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  currentStaff?: {
    id: string;
    staff_code: string;
    full_name: string;
  };
  activeClinic?: {
    clinic_id: string;
    clinic_code: string;
    name: string;
  };
  activeRoles?: ClinicRoleCode[];
}

interface NavItemConfig {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({
  open = false,
  onClose,
  activeClinic,
  activeRoles = [],
}) => {
  const pathname = usePathname();

  const allNavConfigs: NavItemConfig[] = [
    {
      key: "/reception",
      label: "Tiếp Nhận Khám",
      href: "/reception",
      icon: <UserAddOutlined style={{ fontSize: 16 }} />,
    },
    {
      key: "/schedule",
      label: "Lịch Hẹn & Ma Trận",
      href: "/schedule",
      icon: <CalendarOutlined style={{ fontSize: 16 }} />,
    },
    {
      key: "/patients",
      label: "Hồ Sơ Bệnh Nhân",
      href: "/patients",
      icon: <FileTextOutlined style={{ fontSize: 16 }} />,
    },
    {
      key: "/staff",
      label: "Nhân Sự & Cơ Sở",
      href: "/staff",
      icon: <TeamOutlined style={{ fontSize: 16 }} />,
    },
    {
      key: "/master-data/diagnoses",
      label: "Danh Mục Mã Bệnh",
      href: "/master-data/diagnoses",
      icon: <MedicineBoxOutlined style={{ fontSize: 16 }} />,
    },
    {
      key: "/migration",
      label: "Nhập Dữ Liệu Excel",
      href: "/migration",
      icon: <CloudUploadOutlined style={{ fontSize: 16 }} />,
    },
  ];

  // Dynamic role-based navigation visibility (UNION semantics)
  const visibleNavConfigs = allNavConfigs.filter((item) =>
    isRouteVisibleForRoles(item.href, activeRoles)
  );

  // Determine active key from current path
  const selectedKey =
    visibleNavConfigs.find(
      (item) => pathname === item.href || pathname?.startsWith(`${item.href}/`)
    )?.key || "/reception";

  const drawerMenuItems = visibleNavConfigs.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: (
      <Link href={item.href} onClick={() => onClose?.()}>
        {item.label}
      </Link>
    ),
  }));

  return (
    <Drawer
      placement="left"
      open={open}
      onClose={onClose}
      closable={false}
      styles={{
        wrapper: {
          width: "320px",
          maxWidth: "85vw",
        },
        body: {
          padding: 0,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          backgroundColor: "#ffffff",
        },
      }}
    >
      {/* 1. Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
            TT
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs font-bold text-slate-900 leading-tight truncate m-0">
              {activeClinic?.name ? activeClinic.name.toUpperCase() : ""}
            </h1>
            <p className="text-[10px] text-teal-700 font-medium truncate m-0">
              Y Học Cổ Truyền
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
          aria-label="Đóng thanh điều hướng"
        >
          <CloseOutlined style={{ fontSize: 14 }} />
        </button>
      </div>

      {/* 2. Authorized Navigation Menu */}
      <div className="flex-1 py-3 overflow-y-auto">
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={drawerMenuItems}
          style={{ borderRight: 0 }}
        />
      </div>
    </Drawer>
  );
};
