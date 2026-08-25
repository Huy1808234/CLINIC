"use client";

import React, { useState } from "react";
import { Modal, Form, Input, Button, Alert } from "antd";
import { KeyOutlined } from "@ant-design/icons";
import type { StaffWithClinicMemberships } from "@/types/clinic";
import { resetStaffPasswordByAdminAction } from "@/app/actions/staff-actions";

export interface ResetStaffPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffWithClinicMemberships | null;
  onSuccess: () => void;
}

export const ResetStaffPasswordModal: React.FC<ResetStaffPasswordModalProps> = ({
  isOpen,
  onClose,
  staff,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetForm = () => {
    form.resetFields();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const mapErrorMessage = (code?: string, defaultMsg?: string) => {
    switch (code) {
      case "RESET_STATE_FINALIZATION_FAILED":
        return "Mật khẩu đã được cập nhật nhưng hệ thống chưa hoàn tất ghi nhận trạng thái. Vui lòng thử lại thao tác đặt lại mật khẩu.";
      case "AUTH_ACCOUNT_MISSING":
        return "Không tìm thấy tài khoản đăng nhập đã liên kết.";
      case "INVALID_PASSWORD":
        return "Mật khẩu chưa đáp ứng yêu cầu (tối thiểu 8 ký tự).";
      case "TARGET_STAFF_INACTIVE":
        return "Nhân viên hiện không hoạt động.";
      case "TARGET_STAFF_NOT_ACCESSIBLE":
        return "Nhân viên không thuộc phòng khám đang thao tác.";
      case "UNAUTHORIZED_ADMIN":
        return "Bạn không có quyền thực hiện thao tác này.";
      default:
        return defaultMsg || "Đã xảy ra lỗi khi đặt lại mật khẩu. Vui lòng thử lại.";
    }
  };

  const handleSubmit = async (values: {
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (!staff) return;

    if (values.newPassword !== values.confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await resetStaffPasswordByAdminAction({
        staff_id: staff.id,
        new_password: values.newPassword,
        confirm_password: values.confirmPassword,
      });

      if (!result.success) {
        setErrorMessage(mapErrorMessage(result.code, result.error));
        setIsLoading(false);
        return;
      }

      setSuccessMessage(
        `Đã đặt lại mật khẩu thành công cho tài khoản "${staff.login_username || staff.full_name}"!`
      );
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 1000);
    } catch {
      setErrorMessage("Đã xảy ra lỗi không xác định. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onCancel={handleClose}
      footer={null}
      width={480}
      destroyOnHidden
      title={
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <KeyOutlined style={{ color: "#0f766e", fontSize: 18 }} />
          <div>
            <div className="font-bold text-sm text-slate-900 leading-tight">
              Đặt Lại Mật Khẩu
            </div>
            <div className="text-[11px] text-slate-500 font-normal mt-0.5">
              Thiết lập mật khẩu mới cho tài khoản {staff?.login_username || staff?.full_name}
            </div>
          </div>
        </div>
      }
    >
      <div className="pt-3 space-y-3">
        {errorMessage && (
          <Alert
            type="error"
            title={errorMessage}
            showIcon
            closable
            onClose={() => setErrorMessage(null)}
          />
        )}
        {successMessage && (
          <Alert type="success" title={successMessage} showIcon />
        )}

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label={<span className="text-xs font-semibold text-slate-700">Mật khẩu mới *</span>}
            name="newPassword"
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu mới" }]}
            className="mb-3"
          >
            <Input.Password
              id="admin-new-password"
              placeholder="Tối thiểu 8 ký tự"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            label={<span className="text-xs font-semibold text-slate-700">Xác nhận mật khẩu mới *</span>}
            name="confirmPassword"
            rules={[{ required: true, message: "Vui lòng xác nhận mật khẩu mới" }]}
            className="mb-4"
          >
            <Input.Password
              id="admin-confirm-password"
              placeholder="Nhập lại mật khẩu mới"
              autoComplete="new-password"
            />
          </Form.Item>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button onClick={handleClose} disabled={isLoading}>
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              style={{ backgroundColor: "#0f766e", fontWeight: 600 }}
            >
              Đặt Lại Mật Khẩu
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
};
