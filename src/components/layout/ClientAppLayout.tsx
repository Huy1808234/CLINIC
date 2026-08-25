"use client";

import React, { useState } from "react";
import { Layout } from "antd";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import type { ClinicRoleCode } from "@/types/clinic";

const { Content } = Layout;

export interface ClientAppLayoutProps {
  currentStaff: {
    id: string;
    staff_code: string;
    full_name: string;
  };
  activeClinic: {
    clinic_id: string;
    clinic_code: string;
    name: string;
  };
  activeRoles?: ClinicRoleCode[];
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const ClientAppLayout: React.FC<ClientAppLayoutProps> = ({
  currentStaff,
  activeClinic,
  activeRoles = [],
  title,
  subtitle,
  actions,
  children,
}) => {
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  return (
    <Layout className="min-h-screen" style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      {/* 1. Global Navigation Drawer (All Viewports: Desktop, Laptop, Tablet, Mobile) */}
      <Sidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentStaff={currentStaff}
        activeClinic={activeClinic}
        activeRoles={activeRoles}
      />

      {/* 2. Full-Width Top Header */}
      <Header
        onOpenNav={() => setDrawerOpen(true)}
        title={title}
        subtitle={subtitle}
        actions={actions}
      />

      {/* 3. Full-Width Fluid Content Container (No reserved Sider width) */}
      <Content
        style={{
          margin: 0,
          padding: "20px 24px",
          backgroundColor: "#f8fafc",
          minHeight: "calc(100vh - 64px)",
          overflowY: "auto",
          width: "100%",
        }}
        className="p-4 sm:p-5 md:p-6"
      >
        {children}
      </Content>
    </Layout>
  );
};
