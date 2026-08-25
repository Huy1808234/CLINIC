"use client";

import React, { useState } from "react";
import { Modal, Form, Input, Button, Alert } from "antd";
import { UserAddOutlined } from "@ant-design/icons";
import type { StaffWithClinicMemberships } from "@/types/clinic";
import { provisionStaffDirectCredentialsAction } from "@/app/actions/staff-actions";

export interface ProvisionStaffCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffWithClinicMemberships | null;
  onSuccess: () => void;
}

export const ProvisionStaffCredentialsModal: React.FC<ProvisionStaffCredentialsModalProps> = ({
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
      case "ACCOUNT_ALREADY_LINKED":
      case "TARGET_USERNAME_ALREADY_SET":
        return "Nhân viên đã có tài khoản đăng nhập.";
      case "LOGIN_USERNAME_ALREADY_EXISTS":
        return "Tài khoản đăng nhập đã được sử dụng.";
      case "INVALID_LOGIN_USERNAME":
        return "Tài khoản đăng nhập không hợp lệ.";
      case "STAFF_LOGIN_EMAIL_REQUIRED":
        return "Nhân viên chưa có email để cấp tài khoản.";
      case "STAFF_LOGIN_EMAIL_INVALID":
        return "Email của nhân viên không hợp lệ.";
      case "AUTH_ACCOUNT_CREATION_FAILED":
        return "Không thể tạo tài khoản xác thực.";
      case "AUTH_LINKAGE_FAILED":
        return "Không thể liên kết tài khoản với hồ sơ nhân viên.";
      case "AUTH_CREDENTIALS_PROVISIONING_FAILED":
        return "Cấp thông tin đăng nhập không thành công.";
      case "UNAUTHORIZED_ADMIN":
        return "Bạn không có quyền thực hiện thao tác này.";
      default:
        return defaultMsg || "Đã xảy ra lỗi khi cấp tài khoản. Vui lòng thử lại.";
    }
  };

  const handleSubmit = async (values: {
    loginUsername: string;
    password: string;
    confirmPassword: string;
  }) => {
    if (!staff) return;

    if (values.password !== values.confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await provisionStaffDirectCredentialsAction({
        staff_id: staff.id,
        login_username: values.loginUsername.trim(),
        password: values.password,
        confirm_password: values.confirmPassword,
      });

      if (!result.success) {
        setErrorMessage(mapErrorMessage(result.code, result.error));
        setIsLoading(false);
        return;
      }

      setSuccessMessage(
        `Đã cấp tài khoản "${result.data?.login_username || values.loginUsername}" thành công!`
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
          <UserAddOutlined style={{ color: "#0f766e", fontSize: 18 }} />
          <div>
            <div className="font-bold text-sm text-slate-900 leading-tight">
              Cấp Tài Khoản Đăng Nhập
            </div>
            <div className="text-[11px] text-slate-500 font-normal mt-0.5">
              Cấp tài khoản đăng nhập trực tiếp cho {staff?.full_name || "nhân viên"}
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
            label={<span className="text-xs font-semibold text-slate-700">Tài khoản đăng nhập (Username) *</span>}
            name="loginUsername"
            rules={[{ required: true, message: "Vui lòng nhập tên tài khoản" }]}
            className="mb-3"
          >
            <Input
              id="provision-login-username"
              placeholder="VD: haihuy, bsanhthe"
              autoComplete="off"
            />
          </Form.Item>

          <Form.Item
            label={<span className="text-xs font-semibold text-slate-700">Mật khẩu ban đầu *</span>}
            name="password"
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu" }]}
            className="mb-3"
          >
            <Input.Password
              id="provision-password"
              placeholder="Tối thiểu 8 ký tự"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            label={<span className="text-xs font-semibold text-slate-700">Xác nhận mật khẩu *</span>}
            name="confirmPassword"
            rules={[{ required: true, message: "Vui lòng xác nhận mật khẩu" }]}
            className="mb-4"
          >
            <Input.Password
              id="provision-confirm-password"
              placeholder="Nhập lại mật khẩu"
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
              Cấp Tài Khoản
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
};
