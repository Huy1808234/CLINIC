"use client";

import React from "react";
import {
  Table,
  Avatar,
  Tag,
  Badge,
  Button,
  Dropdown,
  Tooltip,
  Typography,
  Empty,
  Space,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { MenuProps } from "antd";
import {
  EditOutlined,
  MoreOutlined,
  ShopOutlined,
  UserAddOutlined,
  IdcardOutlined,
  KeyOutlined,
  LockOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import type { StaffWithClinicMemberships, ClinicRoleCode } from "@/types/clinic";
import { getAvatarInitials } from "@/lib/auth/shell-identity";

const { Text } = Typography;

export interface StaffTableProps {
  staffList: StaffWithClinicMemberships[];
  onEditStaff: (staff: StaffWithClinicMemberships) => void;
  onAssignClinic: (staff: StaffWithClinicMemberships) => void;
  onToggleActive: (staffId: string, currentStatus: boolean) => void;
  onResetPassword: (staff: StaffWithClinicMemberships) => void;
  onProvisionStaff?: (staff: StaffWithClinicMemberships) => void;
  onAssignUsername?: (staff: StaffWithClinicMemberships) => void;
}

const roleTagColors: Record<ClinicRoleCode, string> = {
  DOCTOR: "teal",
  RECEPTIONIST: "cyan",
  TECHNICIAN: "purple",
  Y_SI: "green",
  CSKH: "gold",
  MANAGER: "geekblue",
  ADMIN: "magenta",
};

const roleLabels: Record<ClinicRoleCode, string> = {
  DOCTOR: "Bác sĩ",
  RECEPTIONIST: "Tiếp đón",
  TECHNICIAN: "KTV",
  Y_SI: "Y sĩ",
  CSKH: "CSKH",
  MANAGER: "Quản lý",
  ADMIN: "Admin",
};

export const StaffTable: React.FC<StaffTableProps> = ({
  staffList,
  onEditStaff,
  onAssignClinic,
  onToggleActive,
  onResetPassword,
  onProvisionStaff,
  onAssignUsername,
}) => {
  const columns: ColumnsType<StaffWithClinicMemberships> = [
    {
      title: "Nhân Viên",
      key: "staff_info",
      width: 220,
      render: (_, record) => {
        const initials = getAvatarInitials(record.full_name);
        return (
          <div className="flex items-center gap-2.5">
            <Avatar
              size={36}
              style={{
                backgroundColor: record.is_active ? "#0f766e" : "#94a3b8",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {initials}
            </Avatar>
            <div className="min-w-0 flex-1">
              <Text strong className="text-xs text-slate-900 leading-tight block truncate">
                {record.full_name}
              </Text>
              <Text type="secondary" className="font-mono text-[11px] text-slate-500 block">
                {record.staff_code}
              </Text>
            </div>
          </div>
        );
      },
    },
    {
      title: "Liên Hệ",
      key: "contact",
      width: 180,
      render: (_, record) => {
        return (
          <div className="space-y-0.5">
            <Text className="font-mono text-xs text-slate-800 font-medium block">
              {record.phone || "—"}
            </Text>
            {record.email ? (
              <Tooltip title={record.email}>
                <Text type="secondary" className="text-[11px] text-slate-500 block truncate max-w-[170px]">
                  {record.email}
                </Text>
              </Tooltip>
            ) : (
              <Text type="secondary" className="text-[11px] text-slate-400 block">
                —
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: "Cơ Sở & Vai Trò",
      key: "memberships",
      render: (_, record) => {
        if (record.memberships.length === 0) {
          return (
            <Tag color="warning" className="text-[11px]">
              Chưa phân cơ sở
            </Tag>
          );
        }

        return (
          <div className="space-y-1.5 py-1">
            {record.memberships.map((m) => (
              <div
                key={m.membership_id}
                className={`flex flex-wrap items-center gap-1.5 p-1.5 rounded-md border ${
                  m.is_active
                    ? "bg-slate-50/70 border-slate-200/70"
                    : "bg-slate-100/40 border-slate-200/40 opacity-60"
                }`}
              >
                <Text strong className="text-xs text-slate-800">
                  {m.clinic_name}
                </Text>
                {m.is_primary && (
                  <Tag color="teal" className="text-[10px] px-1 py-0 font-semibold">
                    Chính
                  </Tag>
                )}
                <div className="flex flex-wrap gap-1">
                  {m.roles.map((r) => (
                    <Tag
                      key={r}
                      color={roleTagColors[r] || "default"}
                      className="text-[10px] px-1.5 py-0 font-medium"
                    >
                      {roleLabels[r] || r}
                    </Tag>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      title: "Tài Khoản",
      key: "account",
      width: 170,
      render: (_, record) => {
        // STATE A: No Auth account
        if (!record.user_id) {
          return (
            <Tag color="default" className="text-[11px] text-slate-500">
              Chưa có tài khoản
            </Tag>
          );
        }

        // STATE B: Linked Auth account requiring username
        if (!record.login_username) {
          return (
            <Tag color="warning" className="text-[11px]">
              Cần gán tài khoản
            </Tag>
          );
        }

        // STATE D: Setup / Reset password required
        if (record.auth_setup_required) {
          return (
            <div>
              <span className="font-mono text-slate-700 font-medium text-xs block truncate">
                {record.login_username}
              </span>
              <Tag color="warning" className="text-[10px] mt-0.5">
                Cần đặt lại mật khẩu
              </Tag>
            </div>
          );
        }

        // STATE C: Normal active login account
        return (
          <div>
            <span className="font-mono text-teal-700 font-bold text-xs block truncate">
              {record.login_username}
            </span>
            <Tag color="success" className="text-[10px] mt-0.5">
              Đã kích hoạt
            </Tag>
          </div>
        );
      },
    },
    {
      title: "Trạng Thái",
      key: "status",
      width: 120,
      render: (_, record) => {
        return record.is_active ? (
          <Badge status="success" text={<span className="text-xs text-slate-700 font-medium">Hoạt động</span>} />
        ) : (
          <Badge status="default" text={<span className="text-xs text-slate-400 font-medium">Đã khóa</span>} />
        );
      },
    },
    {
      title: "Thao Tác",
      key: "actions",
      align: "right",
      width: 130,
      render: (_, record) => {
        // Context-aware More dropdown items
        const menuItems: MenuProps["items"] = [
          {
            key: "assign-clinic",
            icon: <ShopOutlined />,
            label: "Phân công cơ sở",
            onClick: () => onAssignClinic(record),
          },
        ];

        // Credential action based on state
        if (!record.user_id && record.is_active && onProvisionStaff) {
          menuItems.push({
            key: "provision",
            icon: <UserAddOutlined />,
            label: "Cấp tài khoản",
            onClick: () => onProvisionStaff(record),
          });
        } else if (record.user_id && !record.login_username && record.is_active && onAssignUsername) {
          menuItems.push({
            key: "assign-username",
            icon: <IdcardOutlined />,
            label: "Gán tài khoản đăng nhập",
            onClick: () => onAssignUsername(record),
          });
        } else if (record.user_id && record.login_username && record.is_active) {
          menuItems.push({
            key: "reset-password",
            icon: <KeyOutlined />,
            label: "Đặt lại mật khẩu",
            onClick: () => onResetPassword(record),
          });
        }

        menuItems.push({
          type: "divider",
        });

        menuItems.push({
          key: "toggle-status",
          icon: record.is_active ? <LockOutlined /> : <UnlockOutlined />,
          danger: record.is_active,
          label: record.is_active ? "Khóa nhân viên" : "Mở lại nhân viên",
          onClick: () => onToggleActive(record.id, record.is_active),
        });

        return (
          <Space size={6} wrap={false}>
            {/* Primary Action: Sửa */}
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEditStaff(record)}
              className="text-xs font-semibold"
            >
              Sửa
            </Button>

            {/* Context-aware More Dropdown Menu */}
            <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
              <Button size="small" icon={<MoreOutlined />} className="text-slate-600 hover:text-slate-900" />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={staffList}
      rowKey="id"
      size="middle"
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        pageSizeOptions: ["10", "20", "50"],
        showTotal: (total, range) => `Hiển thị ${range[0]}–${range[1]} / ${total} nhân viên`,
      }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Text strong className="text-slate-800 block text-xs">
                  Không tìm thấy nhân viên phù hợp
                </Text>
                <Text type="secondary" className="text-slate-400 text-xs">
                  Thử thay đổi bộ lọc hoặc tìm kiếm lại.
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
