"use client";

import React from "react";
import Link from "next/link";
import {
  Table,
  Avatar,
  Tag,
  Button,
  Empty,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { EyeOutlined } from "@ant-design/icons";
import type { PatientProfile } from "@/types/patient";
import { getAvatarInitials } from "@/lib/auth/shell-identity";

const { Text } = Typography;

export interface PatientTableProps {
  patients: PatientProfile[];
  searchQuery?: string;
  onClearSearch?: () => void;
}

const genderLabels: Record<string, string> = {
  NAM: "Nam",
  NU: "Nữ",
  KHAC: "Khác",
};

export const PatientTable: React.FC<PatientTableProps> = ({
  patients,
  searchQuery,
  onClearSearch,
}) => {
  const columns: ColumnsType<PatientProfile> = [
    {
      title: "Mã BN",
      dataIndex: "patient_code",
      key: "patient_code",
      width: 140,
      render: (code: string) => (
        <span className="font-mono font-bold text-xs text-teal-700">
          {code}
        </span>
      ),
    },
    {
      title: "Bệnh Nhân",
      key: "patient_name",
      width: 240,
      render: (_, record) => {
        const initials = getAvatarInitials(record.full_name);
        const gender = record.sex ? genderLabels[record.sex] || record.sex : null;
        const birthYear = record.birth_year || (record.birth_date ? record.birth_date.slice(0, 4) : null);
        const metaParts = [gender, birthYear ? `Sinh năm ${birthYear}` : null].filter(Boolean);

        return (
          <div className="flex items-center gap-2.5">
            <Avatar
              size={36}
              style={{
                backgroundColor: "#0f766e",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {initials}
            </Avatar>
            <div className="min-w-0 flex-1">
              <Link
                href={`/patients/${record.id}`}
                className="font-semibold text-xs text-slate-900 leading-tight block truncate hover:text-teal-700 transition-colors"
              >
                {record.full_name}
              </Link>
              {metaParts.length > 0 && (
                <Text type="secondary" className="text-[11px] text-slate-500 block truncate mt-0.5">
                  {metaParts.join(" · ")}
                </Text>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: "Liên Hệ",
      key: "contact",
      width: 180,
      render: (_, record) => (
        <div className="space-y-0.5">
          <Text className="font-mono text-xs text-slate-800 font-medium block">
            {record.phone || "—"}
          </Text>
          {record.citizen_id ? (
            <Text type="secondary" className="font-mono text-[11px] text-slate-500 block">
              CCCD: {record.citizen_id}
            </Text>
          ) : (
            <Text type="secondary" className="text-[11px] text-slate-400 block">
              Chưa có CCCD
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Thẻ BHYT",
      key: "insurance",
      width: 180,
      render: (_, record) => {
        if (record.current_insurance?.card_number) {
          return (
            <Tag color="blue" className="font-mono text-xs font-medium px-2 py-0.5 m-0">
              {record.current_insurance.card_number}
            </Tag>
          );
        }
        return (
          <Tag color="default" className="text-slate-400 text-[11px] px-2 py-0.5 m-0 border-dashed">
            Chưa có
          </Tag>
        );
      },
    },
    {
      title: "Năm Sinh",
      key: "birth_year",
      width: 110,
      render: (_, record) => {
        const year = record.birth_year || (record.birth_date ? record.birth_date.slice(0, 4) : "—");
        return (
          <span className="text-xs font-medium text-slate-700">
            {year}
          </span>
        );
      },
    },
    {
      title: "Thao Tác",
      key: "actions",
      align: "right",
      width: 130,
      render: (_, record) => (
        <Link href={`/patients/${record.id}`}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            className="text-xs font-semibold hover:border-teal-500 hover:text-teal-700"
          >
            Xem Hồ Sơ
          </Button>
        </Link>
      ),
    },
  ];

  const hasSearch = Boolean(searchQuery && searchQuery.trim().length > 0);

  return (
    <Table
      columns={columns}
      dataSource={patients}
      rowKey="id"
      size="middle"
      scroll={{ x: 800 }}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        pageSizeOptions: ["10", "20", "50"],
        showTotal: (total, range) => `Hiển thị ${range[0]}–${range[1]} / ${total} bệnh nhân`,
      }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              hasSearch ? (
                <div className="py-2 space-y-2">
                  <Text strong className="text-slate-800 block text-xs">
                    Không tìm thấy bệnh nhân phù hợp
                  </Text>
                  <Text type="secondary" className="text-slate-400 text-xs block">
                    Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.
                  </Text>
                  {onClearSearch && (
                    <Button size="small" onClick={onClearSearch} className="text-xs mt-1">
                      Xóa tìm kiếm
                    </Button>
                  )}
                </div>
              ) : (
                <div className="py-2 space-y-1">
                  <Text strong className="text-slate-800 block text-xs">
                    Chưa có bệnh nhân
                  </Text>
                  <Text type="secondary" className="text-slate-400 text-xs block">
                    Nhấn &quot;Tạo Hồ Sơ Bệnh Nhân Mới&quot; để bắt đầu thêm hồ sơ đầu tiên.
                  </Text>
                </div>
              )
            }
          />
        ),
      }}
      className="border border-slate-200/80 rounded-xl overflow-hidden shadow-xs bg-white"
    />
  );
};
