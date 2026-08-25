"use client";

import React, { useState } from "react";
import { Modal, Form, Input, Button, Alert } from "antd";
import { IdcardOutlined } from "@ant-design/icons";
import type { StaffWithClinicMemberships } from "@/types/clinic";
import { assignStaffLoginUsernameAction } from "@/app/actions/staff-actions";

export interface AssignStaffUsernameModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffWithClinicMemberships | null;
  onSuccess: () => void;
}

export const AssignStaffUsernameModal: React.FC<AssignStaffUsernameModalProps> = ({
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
      case "LOGIN_USERNAME_ALREADY_ASSIGNED":
      case "TARGET_USERNAME_ALREADY_SET":
        return "Nhân viên đã có tài khoản đăng nhập.";
      case "LOGIN_USERNAME_ALREADY_EXISTS":
        return "Tài khoản đăng nhập đã được sử dụng.";
      case "INVALID_LOGIN_USERNAME":
        return "Tài khoản đăng nhập không hợp lệ.";
      case "AUTH_ACCOUNT_MISSING":
        return "Không tìm thấy tài khoản đăng nhập đã liên kết.";
      case "TARGET_STAFF_INACTIVE":
        return "Nhân viên hiện không hoạt động.";
      case "TARGET_STAFF_NOT_ACCESSIBLE":
        return "Nhân viên không thuộc phòng khám đang thao tác.";
      case "UNAUTHORIZED_ADMIN":
        return "Bạn không có quyền thực hiện thao tác này.";
      default:
        return defaultMsg || "Đã xảy ra lỗi khi gán tài khoản. Vui lòng thử lại.";
    }
  };

  const handleSubmit = async (values: { loginUsername: string }) => {
    if (!staff) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await assignStaffLoginUsernameAction({
        staff_id: staff.id,
        login_username: values.loginUsername.trim(),
      });

      if (!result.success) {
        setErrorMessage(mapErrorMessage(result.code, result.error));
        setIsLoading(false);
        return;
      }

      setSuccessMessage(
        `Đã gán tên tài khoản "${result.data?.login_username || values.loginUsername}" thành công!`
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
          <IdcardOutlined style={{ color: "#0f766e", fontSize: 18 }} />
          <div>
            <div className="font-bold text-sm text-slate-900 leading-tight">
              Gán Tên Tài Khoản Đăng Nhập
            </div>
            <div className="text-[11px] text-slate-500 font-normal mt-0.5">
              Gán định danh đăng nhập chuẩn cho {staff?.full_name || "nhân viên"}
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
            label={<span className="text-xs font-semibold text-slate-700">Tên tài khoản (Username) mới *</span>}
            name="loginUsername"
            rules={[{ required: true, message: "Vui lòng nhập tên tài khoản" }]}
            className="mb-4"
          >
            <Input
              id="assign-login-username"
              placeholder="VD: haihuy, bsanhthe"
              autoComplete="off"
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
              Gán Tài Khoản
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
};
