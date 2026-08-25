"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  Row,
  Col,
  Input,
  Select,
  Button,
  Alert,
  Typography,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import type { Clinic, StaffWithClinicMemberships, ClinicRoleCode } from "@/types/clinic";
import { StaffTable } from "./StaffTable";
import { StaffModal, ALL_ROLES } from "./StaffModal";
import { ResetStaffPasswordModal } from "./ResetStaffPasswordModal";
import { ProvisionStaffCredentialsModal } from "./ProvisionStaffCredentialsModal";
import { AssignStaffUsernameModal } from "./AssignStaffUsernameModal";
import { toggleStaffStatusAction } from "@/app/actions/staff-actions";

const { Title, Text } = Typography;

export interface StaffClientViewProps {
  initialStaff: StaffWithClinicMemberships[];
  clinics: Clinic[];
}

export const StaffClientView: React.FC<StaffClientViewProps> = ({
  initialStaff,
  clinics,
}) => {
  const router = useRouter();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedClinicFilter, setSelectedClinicFilter] = useState<string | null>(null);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string | null>(null);
  const [selectedStaffStatusFilter, setSelectedStaffStatusFilter] = useState<string | null>(null);
  const [selectedAccountStatusFilter, setSelectedAccountStatusFilter] = useState<string | null>(null);

  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal / Drawer States
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT" | "ASSIGN_CLINIC">("CREATE");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffWithClinicMemberships | null>(null);

  // Admin Credential Modals State
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState<boolean>(false);
  const [resetPasswordStaff, setResetPasswordStaff] = useState<StaffWithClinicMemberships | null>(null);

  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState<boolean>(false);
  const [provisionStaff, setProvisionStaff] = useState<StaffWithClinicMemberships | null>(null);

  const [isAssignUsernameModalOpen, setIsAssignUsernameModalOpen] = useState<boolean>(false);
  const [assignUsernameStaff, setAssignUsernameStaff] = useState<StaffWithClinicMemberships | null>(null);

  // 4 Summary Metrics derived directly from actual staff dataset
  const metrics = useMemo(() => {
    const total = initialStaff.length;
    const active = initialStaff.filter((s) => s.is_active).length;
    const withAccount = initialStaff.filter((s) => !!s.user_id).length;
    const unassignedClinic = initialStaff.filter((s) => s.memberships.length === 0).length;

    return [
      {
        label: "Tổng Nhân Viên",
        value: total,
        sub: "Hồ sơ nhân sự toàn hệ thống",
        icon: <TeamOutlined style={{ fontSize: 20, color: "#0f766e" }} />,
        bg: "#f0fdfa",
        border: "#ccfbf1",
      },
      {
        label: "Đang Hoạt Động",
        value: active,
        sub: `${total - active} nhân viên đã khóa`,
        icon: <CheckCircleOutlined style={{ fontSize: 20, color: "#10b981" }} />,
        bg: "#ecfdf5",
        border: "#d1fae5",
      },
      {
        label: "Có Tài Khoản",
        value: withAccount,
        sub: `${total - withAccount} chưa cấp tài khoản`,
        icon: <UserOutlined style={{ fontSize: 20, color: "#0284c7" }} />,
        bg: "#f0f9ff",
        border: "#e0f2fe",
      },
      {
        label: "Chưa Phân Cơ Sở",
        value: unassignedClinic,
        sub: "Cần gán cơ sở & vai trò",
        icon: <ExclamationCircleOutlined style={{ fontSize: 20, color: "#f59e0b" }} />,
        bg: "#fffbeb",
        border: "#fef3c7",
      },
    ];
  }, [initialStaff]);

  // Client-side Filtering
  const filteredStaff = useMemo(() => {
    return initialStaff.filter((staff) => {
      // 1. Search Query filter (Mã NV, Họ tên, SĐT, Email, Username)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCode = staff.staff_code.toLowerCase().includes(q);
        const matchesName = staff.full_name.toLowerCase().includes(q);
        const matchesPhone = (staff.phone || "").toLowerCase().includes(q);
        const matchesEmail = (staff.email || "").toLowerCase().includes(q);
        const matchesUsername = (staff.login_username || "").toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesPhone && !matchesEmail && !matchesUsername) {
          return false;
        }
      }

      // 2. Clinic filter
      if (selectedClinicFilter) {
        const belongsToClinic = staff.memberships.some(
          (m) => m.clinic_id === selectedClinicFilter && m.is_active
        );
        if (!belongsToClinic) return false;
      }

      // 3. Role filter
      if (selectedRoleFilter) {
        const hasRole = staff.memberships.some((m) =>
          m.roles.includes(selectedRoleFilter as ClinicRoleCode)
        );
        if (!hasRole) return false;
      }

      // 4. Staff operational status filter
      if (selectedStaffStatusFilter) {
        if (selectedStaffStatusFilter === "ACTIVE" && !staff.is_active) return false;
        if (selectedStaffStatusFilter === "INACTIVE" && staff.is_active) return false;
      }

      // 5. Account status filter
      if (selectedAccountStatusFilter) {
        if (selectedAccountStatusFilter === "NO_ACCOUNT" && staff.user_id) return false;
        if (selectedAccountStatusFilter === "NEED_USERNAME" && (!staff.user_id || staff.login_username)) return false;
        if (selectedAccountStatusFilter === "ACTIVE" && (!staff.user_id || !staff.login_username || staff.auth_setup_required)) return false;
        if (selectedAccountStatusFilter === "SETUP_REQUIRED" && (!staff.user_id || !staff.login_username || !staff.auth_setup_required)) return false;
      }

      return true;
    });
  }, [
    initialStaff,
    searchQuery,
    selectedClinicFilter,
    selectedRoleFilter,
    selectedStaffStatusFilter,
    selectedAccountStatusFilter,
  ]);

  const handleToggleActive = async (staffId: string, currentStatus: boolean) => {
    if (!confirm(`Bạn có chắc muốn ${currentStatus ? "khóa" : "kích hoạt"} nhân viên này?`)) {
      return;
    }
    const res = await toggleStaffStatusAction(staffId, !currentStatus);
    if (!res.success) {
      setAlertMsg({ type: "error", text: res.error || "Lỗi cập nhật trạng thái nhân viên." });
      return;
    }
    setAlertMsg({
      type: "success",
      text: `Đã ${currentStatus ? "khóa" : "mở lại"} nhân viên thành công.`,
    });
    router.refresh();
  };

  const handleOpenResetPassword = (staff: StaffWithClinicMemberships) => {
    setResetPasswordStaff(staff);
    setIsResetPasswordModalOpen(true);
  };

  const handleOpenProvisionStaff = (staff: StaffWithClinicMemberships) => {
    setProvisionStaff(staff);
    setIsProvisionModalOpen(true);
  };

  const handleOpenAssignUsername = (staff: StaffWithClinicMemberships) => {
    setAssignUsernameStaff(staff);
    setIsAssignUsernameModalOpen(true);
  };

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

      {/* Top Alert Feedback */}
      {alertMsg && (
        <Alert
          type={alertMsg.type}
          title={alertMsg.text}
          showIcon
          closable
          onClose={() => setAlertMsg(null)}
          className="mb-2"
        />
      )}

      {/* Main Staff Administration Container */}
      <Card
        variant="borderless"
        className="shadow-xs border border-slate-200/90 rounded-xl bg-white"
        styles={{ body: { padding: "20px" } }}
      >
        {/* Operations Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <Title level={4} style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
              Danh Sách Nhân Sự & Phân Công Cơ Sở
            </Title>
            <Text type="secondary" style={{ fontSize: 12, color: "#64748b" }}>
              Quản lý hồ sơ nhân viên, phân quyền đa vai trò tại từng cơ sở phòng khám và quản trị tài khoản đăng nhập.
            </Text>
          </div>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setSelectedStaff(null);
              setModalMode("CREATE");
              setIsModalOpen(true);
            }}
            style={{
              backgroundColor: "#0f766e",
              fontWeight: 600,
              height: 36,
              padding: "0 16px",
            }}
          >
            Thêm Nhân Viên
          </Button>
        </div>

        {/* Filter Toolbar */}
        <div className="py-3.5 flex flex-wrap items-center gap-2.5">
          <Input
            placeholder="Tìm mã NV, họ tên, tài khoản, SĐT..."
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />

          <Select
            placeholder="Tất cả cơ sở"
            allowClear
            showSearch
            style={{ width: 180 }}
            value={selectedClinicFilter}
            onChange={(val) => setSelectedClinicFilter(val)}
            options={clinics.map((c) => ({
              label: c.name,
              value: c.id,
            }))}
          />

          <Select
            placeholder="Tất cả vai trò"
            allowClear
            showSearch
            style={{ width: 170 }}
            value={selectedRoleFilter}
            onChange={(val) => setSelectedRoleFilter(val)}
            options={ALL_ROLES.map((r) => ({
              label: r.label,
              value: r.code,
            }))}
          />

          <Select
            placeholder="Tất cả trạng thái"
            allowClear
            style={{ width: 150 }}
            value={selectedStaffStatusFilter}
            onChange={(val) => setSelectedStaffStatusFilter(val)}
            options={[
              { label: "Hoạt động", value: "ACTIVE" },
              { label: "Đã khóa", value: "INACTIVE" },
            ]}
          />

          <Select
            placeholder="Tất cả tài khoản"
            allowClear
            style={{ width: 170 }}
            value={selectedAccountStatusFilter}
            onChange={(val) => setSelectedAccountStatusFilter(val)}
            options={[
              { label: "Chưa có tài khoản", value: "NO_ACCOUNT" },
              { label: "Cần gán tài khoản", value: "NEED_USERNAME" },
              { label: "Đã kích hoạt", value: "ACTIVE" },
              { label: "Cần đặt lại mật khẩu", value: "SETUP_REQUIRED" },
            ]}
          />

          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setSearchQuery("");
              setSelectedClinicFilter(null);
              setSelectedRoleFilter(null);
              setSelectedStaffStatusFilter(null);
              setSelectedAccountStatusFilter(null);
            }}
            title="Làm mới bộ lọc"
          >
            Làm mới
          </Button>
        </div>

        {/* Staff Table */}
        <StaffTable
          staffList={filteredStaff}
          onEditStaff={(staff) => {
            setSelectedStaff(staff);
            setModalMode("EDIT");
            setIsModalOpen(true);
          }}
          onAssignClinic={(staff) => {
            setSelectedStaff(staff);
            setModalMode("ASSIGN_CLINIC");
            setIsModalOpen(true);
          }}
          onToggleActive={handleToggleActive}
          onResetPassword={handleOpenResetPassword}
          onProvisionStaff={handleOpenProvisionStaff}
          onAssignUsername={handleOpenAssignUsername}
        />
      </Card>

      {/* Staff Create / Edit / Assign Clinic Drawer */}
      <StaffModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={modalMode}
        selectedStaff={selectedStaff}
        clinics={clinics}
        onSuccess={() => {
          setAlertMsg({
            type: "success",
            text: "Cập nhật hồ sơ nhân sự thành công.",
          });
          router.refresh();
        }}
        onOpenResetPassword={handleOpenResetPassword}
        onOpenProvisionStaff={handleOpenProvisionStaff}
        onOpenAssignUsername={handleOpenAssignUsername}
      />

      {/* Direct Provision Credentials Modal */}
      <ProvisionStaffCredentialsModal
        isOpen={isProvisionModalOpen}
        onClose={() => {
          setIsProvisionModalOpen(false);
          setProvisionStaff(null);
        }}
        staff={provisionStaff}
        onSuccess={() => {
          router.refresh();
        }}
      />

      {/* Assign Username Modal */}
      <AssignStaffUsernameModal
        isOpen={isAssignUsernameModalOpen}
        onClose={() => {
          setIsAssignUsernameModalOpen(false);
          setAssignUsernameStaff(null);
        }}
        staff={assignUsernameStaff}
        onSuccess={() => {
          router.refresh();
        }}
      />

      {/* Admin Reset Staff Password Modal */}
      <ResetStaffPasswordModal
        isOpen={isResetPasswordModalOpen}
        onClose={() => {
          setIsResetPasswordModalOpen(false);
          setResetPasswordStaff(null);
        }}
        staff={resetPasswordStaff}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
};
