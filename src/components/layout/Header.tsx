"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layout, Typography, Space, Badge, Button, Avatar, Dropdown } from "antd";
import type { MenuProps } from "antd";
import {
  ClockCircleOutlined,
  MenuOutlined,
  ArrowLeftOutlined,
  DownOutlined,
  LogoutOutlined,
  SwapOutlined,
  BankOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import type { ClinicRoleCode } from "@/types/clinic";
import { getAvatarInitials, getPrimaryRoleLabel } from "@/lib/auth/shell-identity";
import { signOutAction } from "@/app/actions/auth-actions";

const { Header: AntHeader } = Layout;
const { Title, Text } = Typography;

export interface HeaderProps {
  onOpenNav?: () => void;
  title?: string;
  subtitle?: string;
  backHref?: string;
  actions?: React.ReactNode;
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

export const Header: React.FC<HeaderProps> = ({
  onOpenNav,
  title,
  subtitle,
  backHref,
  actions,
  currentStaff,
  activeClinic,
  activeRoles = [],
}) => {
  const router = useRouter();
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      const res = await signOutAction();
      if (res?.success) {
        router.replace("/login");
        router.refresh();
      }
    } catch {
      router.replace("/login");
      router.refresh();
    }
  };

  const initials = getAvatarInitials(currentStaff?.full_name || "");
  const roleLabel = getPrimaryRoleLabel(activeRoles);

  const profileMenuItems: MenuProps["items"] = [
    {
      key: "clinic-info",
      icon: <BankOutlined className="text-teal-600" />,
      label: (
        <div className="py-0.5">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Cơ sở làm việc</div>
          <div className="text-xs font-bold text-slate-800">{activeClinic?.name || "Phòng khám"}</div>
        </div>
      ),
      disabled: true,
    },
    {
      key: "role-info",
      icon: <SafetyCertificateOutlined className="text-teal-600" />,
      label: (
        <div className="py-0.5">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Vai trò</div>
          <div className="text-xs font-medium text-slate-700">{roleLabel}</div>
        </div>
      ),
      disabled: true,
    },
    {
      key: "switch-clinic",
      icon: <SwapOutlined />,
      label: "Đổi cơ sở làm việc",
      onClick: () => {
        router.push("/select-clinic");
      },
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      danger: true,
      label: "Đăng xuất",
      onClick: handleLogout,
    },
  ];

  return (
    <AntHeader
      className="border-b border-slate-200 bg-white flex items-center justify-between px-4 sm:px-5 sticky top-0 z-10 no-print"
      style={{
        height: 64,
        lineHeight: "64px",
        backgroundColor: "#ffffff",
      }}
    >
      {/* LEFT REGION: Hamburger -> Back Arrow -> Page Title / Context */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* 1. Global Navigation Hamburger on the FAR LEFT */}
        {onOpenNav && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={onOpenNav}
            className="inline-flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg shrink-0"
            style={{
              fontSize: 18,
              width: 38,
              height: 38,
            }}
            title="Mở thanh điều hướng"
            aria-label="Mở thanh điều hướng"
          />
        )}

        {/* 2. Optional Back Arrow */}
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
            title="Quay lại"
            aria-label="Quay lại"
          >
            <ArrowLeftOutlined style={{ fontSize: 15 }} />
          </Link>
        )}

        {/* 3. Page Context Hierarchy */}
        <div className="flex flex-col justify-center min-w-0">
          {title && (
            <Title
              level={4}
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 700,
                color: "#0f172a",
                lineHeight: 1.25,
              }}
              className="truncate"
            >
              {title}
            </Title>
          )}
          {subtitle && (
            <Text
              type="secondary"
              style={{
                fontSize: 11,
                color: "#64748b",
                lineHeight: 1.3,
              }}
              className="truncate hidden sm:block mt-0.5"
            >
              {subtitle}
            </Text>
          )}
        </div>
      </div>

      {/* RIGHT REGION: Clock -> Custom Actions -> Staff Identity Dropdown */}
      <Space size={12} align="center">
        {/* Live Realtime Clock */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
          <Badge status="processing" color="#10b981" />
          <ClockCircleOutlined style={{ fontSize: 12, color: "#64748b" }} />
          <span>{timeStr || "00:00:00"}</span>
        </div>

        {/* Custom Actions */}
        {actions}

        {/* Dynamic Staff Identity Dropdown */}
        <Dropdown menu={{ items: profileMenuItems }} trigger={["click"]} placement="bottomRight">
          <div className="flex items-center gap-2.5 px-2.5 py-1 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors select-none">
            <Avatar
              size={32}
              style={{
                backgroundColor: "#00897b",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {initials}
            </Avatar>
            <div className="hidden sm:flex flex-col text-left min-w-0 max-w-[160px]">
              <span className="text-xs font-bold text-slate-800 truncate leading-tight">
                {currentStaff?.full_name || "Nhân viên"}
              </span>
              <span className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                {roleLabel}
              </span>
            </div>
            <DownOutlined style={{ fontSize: 10, color: "#94a3b8" }} className="shrink-0" />
          </div>
        </Dropdown>
      </Space>
    </AntHeader>
  );
};
