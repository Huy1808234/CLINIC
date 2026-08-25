"use client";

import React from "react";
import { Card, Row, Col, Typography } from "antd";
import {
  UserAddOutlined,
  UsergroupAddOutlined,
  SyncOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import type { ReceptionStats } from "@/types/reception";

const { Text } = Typography;

export interface ReceptionStatsCardsProps {
  stats: ReceptionStats;
}

export const ReceptionStatsCards: React.FC<ReceptionStatsCardsProps> = ({ stats }) => {
  const cards = [
    {
      label: "Tổng Tiếp Nhận Hôm Nay",
      value: stats.total_today,
      sub: "Bệnh nhân đã điểm danh",
      icon: <UserAddOutlined style={{ fontSize: 20, color: "#0f766e" }} />,
      bg: "#f0fdfa",
      border: "#ccfbf1",
    },
    {
      label: "Bệnh Nhân Mới",
      value: stats.new_patients_today,
      sub: "Tạo hồ sơ lần đầu",
      icon: <UsergroupAddOutlined style={{ fontSize: 20, color: "#10b981" }} />,
      bg: "#ecfdf5",
      border: "#d1fae5",
    },
    {
      label: "Bệnh Nhân Tái Khám",
      value: stats.returning_patients_today,
      sub: "Tiếp tục liệu trình",
      icon: <SyncOutlined style={{ fontSize: 20, color: "#0284c7" }} />,
      bg: "#f0f9ff",
      border: "#e0f2fe",
    },
    {
      label: "Chờ Khám & Điều Trị",
      value: stats.waiting_exam_count + stats.in_treatment_count,
      sub: `${stats.waiting_exam_count} chờ khám · ${stats.in_treatment_count} đang điều trị`,
      icon: <ClockCircleOutlined style={{ fontSize: 20, color: "#f59e0b" }} />,
      bg: "#fffbeb",
      border: "#fef3c7",
    },
  ];

  return (
    <Row gutter={[16, 16]} className="mb-5">
      {cards.map((c, i) => (
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
  );
};
