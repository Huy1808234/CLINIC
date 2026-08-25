"use client";

import React, { useState, useEffect } from "react";
import { Layout, Typography, Space, Badge, Button } from "antd";
import { ClockCircleOutlined, MenuOutlined } from "@ant-design/icons";
import { LogoutButton } from "@/components/auth/LogoutButton";

const { Header: AntHeader } = Layout;
const { Title, Text } = Typography;

export interface HeaderProps {
  onOpenNav?: () => void;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNav,
  title,
  subtitle,
  actions,
}) => {
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

  return (
    <AntHeader
      className="border-b border-slate-200 bg-white flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10 no-print"
      style={{
        height: 64,
        lineHeight: "64px",
        backgroundColor: "#ffffff",
      }}
    >
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        {/* Single Navigation Drawer Trigger for ALL viewports */}
        {onOpenNav && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={onOpenNav}
            className="inline-flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            style={{
              fontSize: 18,
              width: 38,
              height: 38,
            }}
            title="Mở thanh điều hướng"
            aria-label="Mở thanh điều hướng"
          />
        )}

        <div className="flex flex-col justify-center min-w-0">
          {title && (
            <Title
              level={4}
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 700,
                color: "#0f172a",
                lineHeight: 1.2,
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
              className="truncate hidden sm:block"
            >
              {subtitle}
            </Text>
          )}
        </div>
      </div>

      <Space size={10} align="center">
        {/* Realtime Live Clock (Hidden on small mobile screens) */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
          <Badge status="processing" color="#10b981" />
          <ClockCircleOutlined style={{ fontSize: 12, color: "#64748b" }} />
          <span>{timeStr || "00:00:00"}</span>
        </div>

        {/* Custom Actions (e.g. Page-specific primary action) */}
        {actions}

        {/* Global Logout */}
        <div className="border-l border-slate-200 pl-2 sm:pl-3">
          <LogoutButton />
        </div>
      </Space>
    </AntHeader>
  );
};
