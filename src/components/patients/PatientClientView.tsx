"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  Row,
  Col,
  Input,
  Button,
  Typography,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  IdcardOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import type { PatientProfile } from "@/types/patient";
import { PatientTable } from "./PatientTable";
import { removeVietnameseAccents } from "@/utils/format-person-name";

const { Title, Text } = Typography;

export interface PatientClientViewProps {
  initialPatients: PatientProfile[];
}

export const PatientClientView: React.FC<PatientClientViewProps> = ({
  initialPatients,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 4 Summary Metrics derived directly from loaded patient dataset
  const metrics = useMemo(() => {
    const total = initialPatients.length;
    const withInsurance = initialPatients.filter((p) => !!p.current_insurance?.card_number).length;
    const withCccd = initialPatients.filter((p) => !!p.citizen_id).length;
    const missingPhone = initialPatients.filter((p) => !p.phone).length;

    return [
      {
        label: "Tổng Bệnh Nhân",
        value: total,
        sub: "Hồ sơ lưu trữ hệ thống",
        icon: <UserOutlined style={{ fontSize: 20, color: "#0f766e" }} />,
        bg: "#f0fdfa",
        border: "#ccfbf1",
      },
      {
        label: "Có Thẻ BHYT",
        value: withInsurance,
        sub: `${total - withInsurance} bệnh nhân dịch vụ / tự chi trả`,
        icon: <SafetyCertificateOutlined style={{ fontSize: 20, color: "#10b981" }} />,
        bg: "#ecfdf5",
        border: "#d1fae5",
      },
      {
        label: "Có CCCD / CMND",
        value: withCccd,
        sub: `${total - withCccd} chưa bổ sung định danh`,
        icon: <IdcardOutlined style={{ fontSize: 20, color: "#0284c7" }} />,
        bg: "#f0f9ff",
        border: "#e0f2fe",
      },
      {
        label: "Chưa Có SĐT",
        value: missingPhone,
        sub: "Cần cập nhật số liên lạc",
        icon: <PhoneOutlined style={{ fontSize: 20, color: "#f59e0b" }} />,
        bg: "#fffbeb",
        border: "#fef3c7",
      },
    ];
  }, [initialPatients]);

  // Real-time client-side filter
  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) {
      return initialPatients;
    }

    const q = searchQuery.toLowerCase().trim();
    const unaccentedQ = removeVietnameseAccents(q);

    return initialPatients.filter((p) => {
      const codeMatch = p.patient_code.toLowerCase().includes(q);
      const nameMatch =
        p.full_name.toLowerCase().includes(q) ||
        (p.normalized_name && p.normalized_name.toLowerCase().includes(unaccentedQ)) ||
        removeVietnameseAccents(p.full_name.toLowerCase()).includes(unaccentedQ);
      const phoneMatch = (p.phone || "").includes(q);
      const cccdMatch = (p.citizen_id || "").toLowerCase().includes(q);
      const insuranceMatch = (p.current_insurance?.card_number || "").toLowerCase().includes(q);
      const birthMatch = String(p.birth_year || "").includes(q);

      return codeMatch || nameMatch || phoneMatch || cccdMatch || insuranceMatch || birthMatch;
    });
  }, [initialPatients, searchQuery]);

  return (
    <div className="space-y-4">
      {/* 4 Summary Stats Cards */}
      <Row gutter={[16, 16]}>
        {metrics.map((c, i) => (
          <Col xs={24} sm={12} xl={6} key={i}>
            <Card
              variant="borderless"
              className="shadow-xs border border-slate-200/90 rounded-xl hover:shadow-sm transition-shadow"
              styles={{ body: { padding: "16px 20px" } }}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{ backgroundColor: c.bg, borderColor: c.border }}
                >
                  {c.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <Text type="secondary" className="text-xs font-medium block truncate">
                    {c.label}
                  </Text>
                  <div className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">
                    {c.value}
                  </div>
                  <Text type="secondary" className="text-[11px] text-slate-400 block truncate mt-0.5">
                    {c.sub}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Top Search & Actions Toolbar Card */}
      <Card
        variant="borderless"
        className="shadow-xs border border-slate-200/90 rounded-xl bg-white"
        styles={{ body: { padding: "16px 20px" } }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 max-w-lg">
            <Input
              size="middle"
              placeholder="Tìm theo tên, SĐT, CCCD, BHYT hoặc mã bệnh nhân..."
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              className="w-full"
            />
          </div>

          <Link href="/reception">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{
                backgroundColor: "#0f766e",
                fontWeight: 600,
                height: 36,
                padding: "0 16px",
              }}
            >
              Tạo Hồ Sơ Bệnh Nhân Mới
            </Button>
          </Link>
        </div>
      </Card>

      {/* Main Patient List Card */}
      <Card
        variant="borderless"
        className="shadow-xs border border-slate-200/90 rounded-xl bg-white"
        styles={{ body: { padding: "20px" } }}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
          <div>
            <Title level={4} style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
              Danh Sách Bệnh Nhân ({filteredPatients.length})
            </Title>
            <Text type="secondary" style={{ fontSize: 12, color: "#64748b" }}>
              Danh bạ hồ sơ bệnh nhân chuẩn hóa toàn hệ thống phòng khám.
            </Text>
          </div>

          {searchQuery && (
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={() => setSearchQuery("")}
              className="text-xs"
            >
              Xóa tìm kiếm
            </Button>
          )}
        </div>

        {/* Patient Table */}
        <PatientTable
          patients={filteredPatients}
          searchQuery={searchQuery}
          onClearSearch={() => setSearchQuery("")}
        />
      </Card>
    </div>
  );
};
