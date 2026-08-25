"use client";

import React from "react";
import Link from "next/link";
import { Table, Tag, Button, Empty, Tooltip, Typography, Space } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  MedicineBoxOutlined,
  CheckCircleOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import type { ReceptionQueueItem } from "@/types/reception";
import { formatTimestampTime } from "@/utils/format-time";

const { Text } = Typography;

export interface ReceptionQueueTableProps {
  items: ReceptionQueueItem[];
  onCheckInSession?: (courseId: string) => void;
  onOpenClinicalDrawer?: (item: ReceptionQueueItem) => void;
  isDoctor?: boolean;
}

export const ReceptionQueueTable: React.FC<ReceptionQueueTableProps> = ({
  items,
  onCheckInSession,
  onOpenClinicalDrawer,
  isDoctor = false,
}) => {
  const columns: ColumnsType<ReceptionQueueItem> = [
    {
      title: "Giờ Đến",
      dataIndex: "arrived_at",
      key: "arrived_at",
      width: 90,
      render: (val: string) => {
        const timeStr = formatTimestampTime(val);
        return (
          <Text className="font-mono text-xs font-semibold text-slate-800">
            {timeStr}
          </Text>
        );
      },
    },
    {
      title: "Bệnh Nhân",
      key: "patient",
      render: (_, record) => {
        return (
          <div>
            <Link
              href={`/patients/${record.patient.id}`}
              className="font-bold text-xs text-teal-800 hover:text-teal-950 hover:underline block"
            >
              {record.patient.full_name}
            </Link>
            <Text type="secondary" className="text-[11px] font-mono block">
              {record.patient.patient_code}{" "}
              {record.patient.phone ? `· ${record.patient.phone}` : ""}
            </Text>
          </div>
        );
      },
    },
    {
      title: "Phân Loại",
      dataIndex: "patient_relation_type",
      key: "patient_relation_type",
      width: 110,
      render: (type: string) => {
        const isNew = type === "NEW";
        return isNew ? (
          <Tag color="success" className="font-semibold text-[11px]">
            Mới
          </Tag>
        ) : (
          <Tag color="blue" className="font-semibold text-[11px]">
            Tái khám
          </Tag>
        );
      },
    },
    {
      title: "BHYT",
      key: "insurance",
      width: 140,
      render: (_, record) => {
        const ins = record.patient.current_insurance;
        if (!ins) return <Text type="secondary" className="text-xs">—</Text>;
        return (
          <div>
            <Text className="font-mono text-xs font-medium text-slate-800 block">
              {ins.card_number}
            </Text>
            {ins.benefit_rate && (
              <Tag color="cyan" className="text-[10px] mt-0.5 px-1 py-0">
                Hưởng {ins.benefit_rate}%
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: "Liệu Trình",
      key: "course",
      width: 130,
      render: (_, record) => {
        const course = record.active_course;
        if (!course) return <Text type="secondary" className="text-xs">Chưa tạo</Text>;
        return (
          <Tag color="geekblue" className="font-medium text-xs">
            LT{course.course_no} ({course.completed_session_count}/
            {course.planned_session_count ?? "—"})
          </Tag>
        );
      },
    },
    {
      title: "Bác Sĩ",
      key: "doctor",
      width: 150,
      render: (_, record) => {
        const docName = record.active_course?.doctor_name;
        if (!docName) return <Text type="secondary" className="text-xs">—</Text>;
        return (
          <Text className="text-xs font-medium text-slate-800">
            {docName}
          </Text>
        );
      },
    },
    {
      title: "Thao Tác",
      key: "actions",
      align: "right",
      width: 220,
      render: (_, record) => {
        return (
          <Space size={6} wrap={false}>
            {/* Doctor-only Clinical Order Drawer Trigger */}
            {isDoctor && record.active_course && onOpenClinicalDrawer && (
              <Tooltip title="Chỉ định lâm sàng & Kế hoạch DVKT">
                <Button
                  size="small"
                  type="primary"
                  icon={<MedicineBoxOutlined />}
                  onClick={() => onOpenClinicalDrawer(record)}
                  className="bg-teal-700 hover:bg-teal-800 text-xs font-semibold"
                >
                  Chỉ Định
                </Button>
              </Tooltip>
            )}

            {/* Check-in Session */}
            {record.active_course && onCheckInSession && (
              <Tooltip title="Điểm danh buổi điều trị">
                <Button
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => onCheckInSession(record.active_course!.id)}
                  className="text-xs"
                >
                  Điểm Danh
                </Button>
              </Tooltip>
            )}

            {/* View Patient Details */}
            <Link href={`/patients/${record.patient.id}`}>
              <Tooltip title="Xem hồ sơ bệnh nhân">
                <Button size="small" icon={<EyeOutlined />} className="text-xs">
                  Hồ Sơ
                </Button>
              </Tooltip>
            </Link>
          </Space>
        );
      },
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={items}
      rowKey="id"
      size="middle"
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        pageSizeOptions: ["10", "20", "50"],
        showTotal: (total) => `Tổng ${total} lượt tiếp nhận`,
      }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Text strong className="text-slate-800 block text-xs">
                  Chưa có dữ liệu tiếp nhận
                </Text>
                <Text type="secondary" className="text-slate-400 text-xs">
                  Hôm nay chưa có bệnh nhân nào được tiếp nhận.
                </Text>
              </div>
            }
          />
        ),
      }}
      className="border border-slate-200/80 rounded-xl overflow-hidden shadow-xs bg-white"
    />
  );
};
