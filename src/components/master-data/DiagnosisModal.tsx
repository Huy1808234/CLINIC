"use client";

import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Select, Switch, message, Alert } from "antd";
import {
  createDiagnosisCatalogEntryAction,
  updateDiagnosisCatalogEntryAction,
} from "@/app/actions/diagnosis-catalog-actions";
import type { DiagnosisCatalogItem } from "@/types/catalog";

export interface DiagnosisModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingItem?: DiagnosisCatalogItem | null;
}

export const DiagnosisModal: React.FC<DiagnosisModalProps> = ({
  visible,
  onClose,
  onSuccess,
  editingItem,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEdit = !!editingItem;

  useEffect(() => {
    if (visible) {
      if (editingItem) {
        form.setFieldsValue({
          code_system: editingItem.code_system,
          code: editingItem.code,
          name: editingItem.name,
          traditional_code: editingItem.traditional_code || "",
          traditional_name: editingItem.traditional_name || "",
          is_active: editingItem.is_active,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          code_system: "ICD10_YHCT",
          is_active: true,
        });
      }
    }
  }, [visible, editingItem, form]);

  const handleCancel = () => {
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      setErrorMessage(null);

      if (isEdit && editingItem) {
        const res = await updateDiagnosisCatalogEntryAction(editingItem.id, {
          name: values.name,
          traditional_code: values.traditional_code || null,
          traditional_name: values.traditional_name || null,
          is_active: values.is_active,
        });

        if (!res.success) {
          setErrorMessage(res.error || "Không thể cập nhật mã bệnh.");
          return;
        }

        message.success("Cập nhật mã bệnh thành công!");
      } else {
        const res = await createDiagnosisCatalogEntryAction({
          code_system: values.code_system,
          code: values.code,
          name: values.name,
          traditional_code: values.traditional_code || null,
          traditional_name: values.traditional_name || null,
          is_active: values.is_active ?? true,
        });

        if (!res.success) {
          setErrorMessage(res.error || "Không thể tạo mã bệnh.");
          return;
        }

        message.success("Thêm mã bệnh mới thành công!");
      }

      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <span className="text-base font-bold text-slate-900">
          {isEdit ? "Chỉnh sửa mã bệnh" : "Thêm mã bệnh"}
        </span>
      }
      open={visible}
      onCancel={handleCancel}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText={isEdit ? "Lưu thay đổi" : "Thêm mã bệnh"}
      cancelText="Hủy"
      okButtonProps={{
        className: "bg-[#0f766e] hover:bg-teal-700 font-medium",
      }}
      destroyOnClose
      width={680}
    >
      <div className="pt-3">
        {errorMessage && (
          <Alert message={errorMessage} type="error" showIcon closable className="mb-4 text-xs" />
        )}

        <Form form={form} layout="vertical" className="text-xs">
          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <Form.Item
              label={<span className="text-xs font-semibold text-slate-700">Hệ thống mã</span>}
              name="code_system"
              rules={[{ required: true, message: "Vui lòng chọn hệ thống mã" }]}
            >
              <Select
                disabled={isEdit}
                options={[
                  { label: "ICD10_YHCT (Y học cổ truyền TT06)", value: "ICD10_YHCT" },
                  { label: "ICD10 (Quốc tế)", value: "ICD10" },
                ]}
                className="h-10 w-full"
              />
            </Form.Item>

            <Form.Item
              label={<span className="text-xs font-semibold text-slate-700">Mã bệnh</span>}
              name="code"
              rules={[
                { required: true, message: "Vui lòng nhập mã bệnh" },
                {
                  pattern: /^[a-zA-Z0-9._-]+$/,
                  message: "Mã chỉ chứa chữ cái, số, dấu chấm, gạch ngang",
                },
              ]}
            >
              <Input
                placeholder="VD: U62.151.8"
                disabled={isEdit}
                className="h-10 font-mono"
              />
            </Form.Item>
          </div>

          <Form.Item
            label={<span className="text-xs font-semibold text-slate-700">Tên bệnh</span>}
            name="name"
            rules={[{ required: true, message: "Vui lòng nhập tên bệnh" }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="VD: Các thoái hoá đa khớp khác"
              maxLength={255}
              showCount
            />
          </Form.Item>

          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <Form.Item
              label={<span className="text-slate-600 text-xs">Mã YHCT (Tùy chọn)</span>}
              name="traditional_code"
            >
              <Input placeholder="VD: T01" className="h-10 font-mono" />
            </Form.Item>

            <Form.Item
              label={<span className="text-slate-600 text-xs">Tên YHCT (Tùy chọn)</span>}
              name="traditional_name"
            >
              <Input placeholder="VD: Tý chứng" className="h-10" />
            </Form.Item>
          </div>

          <Form.Item
            label={<span className="text-xs font-semibold text-slate-700">Trạng thái</span>}
            name="is_active"
            valuePropName="checked"
            className="mb-0"
          >
            <Switch
              checkedChildren="Đang sử dụng"
              unCheckedChildren="Ngừng sử dụng"
              className="bg-slate-300"
            />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
};
