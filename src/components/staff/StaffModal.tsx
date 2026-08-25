"use client";

import React, { useState } from "react";
import {
  Drawer,
  Form,
  Input,
  Select,
  Checkbox,
  Button,
  Alert,
  Typography,
  Row,
  Col,
} from "antd";
import {
  UserAddOutlined,
  EditOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import type { Clinic, StaffWithClinicMemberships, ClinicRoleCode } from "@/types/clinic";
import {
  createStaffAction,
  updateStaffAction,
  assignStaffClinicAction,
} from "@/app/actions/staff-actions";

const { Text } = Typography;

export interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "CREATE" | "EDIT" | "ASSIGN_CLINIC";
  selectedStaff: StaffWithClinicMemberships | null;
  clinics: Clinic[];
  onSuccess: () => void;
  onOpenResetPassword?: (staff: StaffWithClinicMemberships) => void;
  onOpenProvisionStaff?: (staff: StaffWithClinicMemberships) => void;
  onOpenAssignUsername?: (staff: StaffWithClinicMemberships) => void;
}

export const ALL_ROLES: { code: ClinicRoleCode; label: string }[] = [
  { code: "DOCTOR", label: "Bác Sĩ Điều Trị (DOCTOR)" },
  { code: "RECEPTIONIST", label: "Lễ Tân Tiếp Đón (RECEPTIONIST)" },
  { code: "TECHNICIAN", label: "Kỹ Thuật Viên (TECHNICIAN)" },
  { code: "Y_SI", label: "Y Sĩ Đa Khoa / YHCT (Y_SI)" },
  { code: "CSKH", label: "Chăm Sóc Khách Hàng (CSKH)" },
  { code: "MANAGER", label: "Quản Lý Cơ Sở (MANAGER)" },
  { code: "ADMIN", label: "Quản Trị Hệ Thống (ADMIN)" },
];

export const StaffModal: React.FC<StaffModalProps> = ({
  isOpen,
  onClose,
  mode,
  selectedStaff,
  clinics,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAfterOpenChange = (open: boolean) => {
    if (open) {
      setErrorMsg(null);
      if (mode === "CREATE") {
        form.setFieldsValue({
          staffCode: "",
          fullName: "",
          phone: "",
          email: "",
          clinicId: clinics[0]?.id || "",
          isPrimary: true,
          roles: ["DOCTOR"],
        });
      } else if (mode === "EDIT" && selectedStaff) {
        form.setFieldsValue({
          staffCode: selectedStaff.staff_code,
          fullName: selectedStaff.full_name,
          phone: selectedStaff.phone || "",
          email: selectedStaff.email || "",
        });
      } else if (mode === "ASSIGN_CLINIC" && selectedStaff) {
        const primaryMembership = selectedStaff.memberships.find((m) => m.is_primary);
        form.setFieldsValue({
          clinicId: primaryMembership?.clinic_id || clinics[0]?.id || "",
          isPrimary: primaryMembership ? primaryMembership.is_primary : true,
          roles: primaryMembership ? primaryMembership.roles : ["DOCTOR"],
        });
      }
    } else {
      setErrorMsg(null);
      form.resetFields();
    }
  };

  const handleSubmit = async (values: {
    staffCode?: string;
    fullName?: string;
    phone?: string;
    email?: string;
    clinicId?: string;
    isPrimary?: boolean;
    roles?: ClinicRoleCode[];
  }) => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (mode === "CREATE") {
        if (!values.clinicId) {
          throw new Error("Vui lòng chọn cơ sở phòng khám làm việc ban đầu.");
        }
        if (!values.roles || values.roles.length === 0) {
          throw new Error("Vui lòng chọn ít nhất một vai trò chuyên môn.");
        }

        const res = await createStaffAction({
          staff_code: values.staffCode!.trim().toUpperCase(),
          full_name: values.fullName!.trim(),
          phone: values.phone?.trim() || undefined,
          email: values.email?.trim() || undefined,
          role_type: values.roles[0] || "DOCTOR",
          is_active: true,
          clinic_assignments: [
            {
              clinic_id: values.clinicId,
              is_primary: values.isPrimary ?? true,
              roles: values.roles,
            },
          ],
        });

        if (!res.success) {
          throw new Error(res.error);
        }
      } else if (mode === "EDIT") {
        if (!selectedStaff) return;
        const res = await updateStaffAction({
          id: selectedStaff.id,
          full_name: values.fullName!.trim(),
          phone: values.phone?.trim() || undefined,
          email: values.email?.trim() || undefined,
        });

        if (!res.success) {
          throw new Error(res.error);
        }
      } else if (mode === "ASSIGN_CLINIC") {
        if (!selectedStaff) return;
        if (!values.clinicId) {
          throw new Error("Vui lòng chọn cơ sở phòng khám.");
        }
        if (!values.roles || values.roles.length === 0) {
          throw new Error("Vui lòng chọn ít nhất một vai trò.");
        }

        const res = await assignStaffClinicAction({
          staff_id: selectedStaff.id,
          clinic_id: values.clinicId,
          is_primary: values.isPrimary ?? false,
          roles: values.roles,
        });

        if (!res.success) {
          throw new Error(res.error);
        }
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Lỗi xử lý hồ sơ nhân viên.");
    } finally {
      setIsLoading(false);
    }
  };

  const titles = {
    CREATE: {
      title: "Thêm Nhân Viên Mới",
      sub: "Tạo hồ sơ nhân viên mới và thiết lập phân công cơ sở ban đầu",
      icon: <UserAddOutlined style={{ color: "#0f766e", fontSize: 18 }} />,
    },
    EDIT: {
      title: "Chỉnh Sửa Hồ Sơ Nhân Viên",
      sub: `Cập nhật thông tin định danh và liên hệ của ${selectedStaff?.full_name || ""}`,
      icon: <EditOutlined style={{ color: "#0f766e", fontSize: 18 }} />,
    },
    ASSIGN_CLINIC: {
      title: "Phân Công Cơ Sở & Vai Trò",
      sub: `Thiết lập phân quyền cơ sở cho nhân viên ${selectedStaff?.full_name || ""}`,
      icon: <ShopOutlined style={{ color: "#0f766e", fontSize: 18 }} />,
    },
  };

  const headerConfig = titles[mode];

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      afterOpenChange={handleAfterOpenChange}
      destroyOnHidden
      styles={{
        wrapper: { width: "580px", maxWidth: "90vw" },
        body: { padding: "20px" },
      }}
      title={
        <div className="flex items-center gap-2.5">
          {headerConfig.icon}
          <div>
            <div className="font-bold text-sm text-slate-900 leading-tight">
              {headerConfig.title}
            </div>
            <div className="text-[11px] text-slate-500 font-normal mt-0.5">
              {headerConfig.sub}
            </div>
          </div>
        </div>
      }
    >
      {errorMsg && (
        <Alert
          type="error"
          title={errorMsg}
          showIcon
          closable
          onClose={() => setErrorMsg(null)}
          className="mb-4"
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        className="space-y-4"
      >
        {/* Section 1: Staff Profile (CREATE & EDIT modes) */}
        {(mode === "CREATE" || mode === "EDIT") && (
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3">
            <Text strong className="text-xs text-slate-800 uppercase tracking-wider block">
              1. Thông Tin Định Danh & Liên Hệ
            </Text>

            <Row gutter={12}>
              <Col span={8}>
                <Form.Item
                  label={<span className="text-xs font-semibold text-slate-700">Mã NV *</span>}
                  name="staffCode"
                  rules={[{ required: mode === "CREATE", message: "Nhập mã nhân viên" }]}
                  className="mb-2"
                >
                  <Input placeholder="VD: BS01, LT02" disabled={mode === "EDIT"} />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item
                  label={<span className="text-xs font-semibold text-slate-700">Họ và tên *</span>}
                  name="fullName"
                  rules={[{ required: true, message: "Nhập họ và tên" }]}
                  className="mb-2"
                >
                  <Input placeholder="VD: Bác sĩ Nguyễn Văn An" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item
                  label={<span className="text-xs font-semibold text-slate-700">Số điện thoại</span>}
                  name="phone"
                  className="mb-0"
                >
                  <Input placeholder="0912345678" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={<span className="text-xs font-semibold text-slate-700">Email</span>}
                  name="email"
                  className="mb-0"
                >
                  <Input placeholder="bacsi@thuanthien.vn" />
                </Form.Item>
              </Col>
            </Row>
          </div>
        )}

        {/* Section 2: Clinic Assignment & Roles (CREATE & ASSIGN_CLINIC modes) */}
        {(mode === "CREATE" || mode === "ASSIGN_CLINIC") && (
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3">
            <Text strong className="text-xs text-slate-800 uppercase tracking-wider block">
              {mode === "CREATE" ? "2. Phân Công Cơ Sở & Vai Trò Ban Đầu" : "Thông Tin Phân Công Cơ Sở"}
            </Text>

            <Form.Item
              label={<span className="text-xs font-semibold text-slate-700">Cơ sở phòng khám *</span>}
              name="clinicId"
              rules={[{ required: true, message: "Vui lòng chọn cơ sở" }]}
              className="mb-2"
            >
              <Select
                placeholder="Chọn cơ sở làm việc"
                options={clinics.map((c) => ({ label: c.name, value: c.id }))}
              />
            </Form.Item>

            <Form.Item name="isPrimary" valuePropName="checked" className="mb-2">
              <Checkbox>
                <span className="text-xs text-slate-800 font-medium">
                  Đặt làm cơ sở làm việc chính (Primary Clinic)
                </span>
              </Checkbox>
            </Form.Item>

            <Form.Item
              label={<span className="text-xs font-semibold text-slate-700">Vai trò chuyên môn tại cơ sở *</span>}
              name="roles"
              rules={[{ required: true, message: "Chọn ít nhất một vai trò" }]}
              className="mb-0"
            >
              <Checkbox.Group className="grid grid-cols-1 gap-1.5 pt-1">
                {ALL_ROLES.map((r) => (
                  <Checkbox key={r.code} value={r.code} className="text-xs text-slate-700">
                    {r.label}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </Form.Item>
          </div>
        )}

        {/* Drawer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button onClick={onClose} disabled={isLoading}>
            Hủy
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={isLoading}
            style={{ backgroundColor: "#0f766e", fontWeight: 600 }}
          >
            {mode === "CREATE" ? "Tạo Nhân Viên" : "Lưu Thay Đổi"}
          </Button>
        </div>
      </Form>
    </Drawer>
  );
};
