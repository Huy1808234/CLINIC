"use client";

import React, { useState } from "react";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Alert,
  Typography,
  Row,
  Col,
} from "antd";
import {
  UserAddOutlined,
  UserOutlined,
  PhoneOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import type { ReceptionQueueItem } from "@/types/reception";
import type { DoctorStaffItem } from "@/rsc-data/treatment/get-catalogs";
import type { DeduplicationMatchResult } from "@/types/patient";
import { parseHeightCm, parseWeightKg } from "@/lib/patients/normalizers";
import { DeduplicationBanner } from "./DeduplicationBanner";
import { submitReceptionAction } from "@/app/actions/reception-actions";

const { Text } = Typography;
const { TextArea } = Input;

export interface ReceptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctors: DoctorStaffItem[];
  onSuccess: (newQueueItem: ReceptionQueueItem, isExistingPatient: boolean) => void;
}

export const ReceptionModal: React.FC<ReceptionModalProps> = ({
  isOpen,
  onClose,
  doctors,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [matchCandidate, setMatchCandidate] = useState<DeduplicationMatchResult | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    form.resetFields();
    setMatchCandidate(null);
    setSelectedPatientId(null);
    setErrorMessage(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (values: {
    fullName: string;
    phone?: string;
    citizenId?: string;
    cardNumber?: string;
    birthYear?: string;
    height?: number | string | null;
    weight?: number | string | null;
    address?: string;
    doctorId?: string;
    reasonForVisit?: string;
    symptomNotes?: string;
  }) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const height_cm =
        values.height !== undefined && values.height !== null && String(values.height).trim() !== ""
          ? parseHeightCm(values.height)
          : null;
      const weight_kg =
        values.weight !== undefined && values.weight !== null && String(values.weight).trim() !== ""
          ? parseWeightKg(values.weight)
          : null;

      const res = await submitReceptionAction({
        patient_id: selectedPatientId || null,
        patient_data: {
          full_name: values.fullName.trim(),
          phone: values.phone?.trim() || null,
          citizen_id: values.citizenId?.trim() || null,
          insurance_card_number: values.cardNumber?.trim() || null,
          birth_year: values.birthYear?.trim() ? parseInt(values.birthYear.trim(), 10) : null,
          dob_precision: values.birthYear?.trim() ? "YEAR_ONLY" : "UNKNOWN",
          height_cm,
          weight_kg,
          address: values.address?.trim() || null,
          notes: values.symptomNotes?.trim() || null,
        },
        reception_source: "MANUAL",
        patient_relation_type: selectedPatientId ? "RETURNING" : "NEW",
        reason_for_visit: values.reasonForVisit?.trim() || null,
        create_course: true,
        doctor_id: values.doctorId && values.doctorId !== "" ? values.doctorId : null,
        notes: values.symptomNotes?.trim() || null,
      });

      if (!res.success) {
        throw new Error(res.error || "Lỗi tiếp nhận bệnh nhân.");
      }

      if (res.data) {
        const item: ReceptionQueueItem = {
          id: res.data.reception.id,
          patient_id: res.data.patient.id,
          insurance_card_id: res.data.reception.insurance_card_id,
          arrived_at: res.data.reception.arrived_at,
          registered_at: res.data.reception.registered_at,
          reception_source: res.data.reception.reception_source,
          patient_relation_type: res.data.reception.patient_relation_type,
          paper_file_status: res.data.reception.paper_file_status,
          his_import_status: res.data.reception.his_import_status,
          reason_for_visit: res.data.reception.reason_for_visit,
          notes: res.data.reception.notes,
          created_by: res.data.reception.created_by,
          created_at: res.data.reception.created_at,
          patient: {
            ...res.data.patient,
            current_insurance: null,
            active_alerts: [],
            active_treatment_courses_count: 1,
          },
          active_course: res.data.course
            ? {
                id: res.data.course.id,
                course_no: res.data.course.course_no,
                doctor_name:
                  doctors.find((d) => d.id === res.data!.course!.primary_doctor_id)
                    ?.full_name || null,
                planned_session_count: res.data.course.planned_session_count,
                completed_session_count: res.data.course.completed_session_count,
                status: res.data.course.status,
              }
            : null,
        };

        onSuccess(item, Boolean(selectedPatientId));
        handleClose();
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Lỗi tiếp nhận bệnh nhân.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onCancel={handleClose}
      footer={null}
      width={880}
      destroyOnHidden
      styles={{
        body: { padding: 0 },
      }}
      title={
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
            <UserAddOutlined style={{ fontSize: 18, color: "#0f766e" }} />
          </div>
          <div>
            <div className="font-bold text-base text-slate-900 leading-tight">
              Tiếp Nhận & Đăng Ký Khám Mới
            </div>
            <div className="text-xs text-slate-500 font-normal mt-0.5">
              Nhập thông tin hành chính của bệnh nhân và chỉ định bác sĩ tiếp nhận ban đầu.
            </div>
          </div>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          doctorId: doctors[0]?.id || undefined,
        }}
        className="pt-4 space-y-4"
      >
        {errorMessage && (
          <Alert
            type="error"
            title={errorMessage}
            showIcon
            closable
            onClose={() => setErrorMessage(null)}
            className="mb-2"
          />
        )}

        {matchCandidate && (
          <DeduplicationBanner
            matchResult={matchCandidate}
            onUseExisting={() => {
              setSelectedPatientId(matchCandidate.matched_patient_id);
              if (matchCandidate.existing_patient) {
                form.setFieldsValue({
                  fullName: matchCandidate.existing_patient.full_name,
                  phone: matchCandidate.existing_patient.phone || "",
                  citizenId: matchCandidate.existing_patient.citizen_id || "",
                  birthYear: matchCandidate.existing_patient.birth_year
                    ? String(matchCandidate.existing_patient.birth_year)
                    : "",
                  address: matchCandidate.existing_patient.address || "",
                });
              }
            }}
            onDismiss={() => setMatchCandidate(null)}
          />
        )}

        {/* Section 1: Patient Information */}
        <div className="p-5 md:p-6 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-4">
          <div>
            <Text strong className="text-xs text-slate-800 uppercase tracking-wider block">
              1. THÔNG TIN BỆNH NHÂN
            </Text>
            <Text type="secondary" className="text-xs text-slate-500 font-normal block mt-0.5">
              Thông tin định danh, liên hệ và chỉ số cơ bản của bệnh nhân.
            </Text>
          </div>

          <Row gutter={[16, 12]}>
            {/* ROW 1: Họ tên & SĐT (12 / 12) */}
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="text-xs font-semibold text-slate-700">Họ và tên *</span>}
                name="fullName"
                rules={[{ required: true, message: "Vui lòng nhập họ và tên bệnh nhân" }]}
                className="mb-0"
              >
                <Input
                  placeholder="Nhập họ và tên bệnh nhân"
                  prefix={<UserOutlined style={{ color: "#94a3b8" }} />}
                  className="h-10 text-xs"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="text-xs font-semibold text-slate-700">Số điện thoại</span>}
                name="phone"
                className="mb-0"
              >
                <Input
                  placeholder="Nhập số điện thoại"
                  prefix={<PhoneOutlined style={{ color: "#94a3b8" }} />}
                  className="h-10 text-xs"
                />
              </Form.Item>
            </Col>

            {/* ROW 2: CCCD & BHYT (12 / 12) */}
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="text-xs font-semibold text-slate-700">CCCD / CMND</span>}
                name="citizenId"
                className="mb-0"
              >
                <Input
                  placeholder="Nhập số CCCD / CMND"
                  prefix={<IdcardOutlined style={{ color: "#94a3b8" }} />}
                  className="h-10 text-xs font-mono"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="text-xs font-semibold text-slate-700">Số thẻ BHYT</span>}
                name="cardNumber"
                className="mb-0"
              >
                <Input
                  placeholder="Nhập số thẻ BHYT"
                  prefix={<SafetyCertificateOutlined style={{ color: "#94a3b8" }} />}
                  className="h-10 text-xs font-mono"
                />
              </Form.Item>
            </Col>

            {/* ROW 3: Năm sinh, Chiều cao, Cân nặng (8 / 8 / 8) */}
            <Col xs={24} sm={8}>
              <Form.Item
                label={<span className="text-xs font-semibold text-slate-700">Năm sinh</span>}
                name="birthYear"
                className="mb-0"
              >
                <Input
                  placeholder="VD: 1985"
                  maxLength={4}
                  className="h-10 text-xs font-mono"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={8}>
              <Form.Item
                label={<span className="text-xs font-semibold text-slate-700">Chiều cao</span>}
                name="height"
                className="mb-0"
              >
                <InputNumber
                  placeholder="VD: 165"
                  suffix={<span className="text-slate-400 text-xs font-medium">cm</span>}
                  min={30}
                  max={250}
                  className="w-full h-10 text-xs"
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={8}>
              <Form.Item
                label={<span className="text-xs font-semibold text-slate-700">Cân nặng</span>}
                name="weight"
                className="mb-0"
              >
                <InputNumber
                  placeholder="VD: 60"
                  suffix={<span className="text-slate-400 text-xs font-medium">kg</span>}
                  min={2}
                  max={300}
                  step={0.1}
                  className="w-full h-10 text-xs"
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>

            {/* ROW 4: Địa chỉ cư trú (24) */}
            <Col span={24}>
              <Form.Item
                label={<span className="text-xs font-semibold text-slate-700">Địa chỉ cư trú</span>}
                name="address"
                className="mb-0"
              >
                <Input
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                  className="h-10 text-xs"
                />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* Section 2: Reception Information */}
        <div className="p-5 md:p-6 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-4">
          <div>
            <Text strong className="text-xs text-slate-800 uppercase tracking-wider block">
              2. THÔNG TIN TIẾP NHẬN
            </Text>
            <Text type="secondary" className="text-xs text-slate-500 font-normal block mt-0.5">
              Thông tin tiếp nhận và lý do bệnh nhân đến khám.
            </Text>
          </div>

          <Row gutter={[16, 12]}>
            {/* ROW 1: Bác sĩ khám ban đầu & Lý do đến khám */}
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="text-xs font-semibold text-slate-700">Bác sĩ khám ban đầu</span>}
                name="doctorId"
                className="mb-0"
              >
                <Select
                  placeholder="Chọn bác sĩ phụ trách"
                  showSearch
                  allowClear
                  filterOption={(input, option) =>
                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                  options={doctors.map((d) => ({
                    label: d.full_name,
                    value: d.id,
                  }))}
                  className="h-10 text-xs w-full"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="text-xs font-semibold text-slate-700">Lý do đến khám</span>}
                name="reasonForVisit"
                className="mb-0"
              >
                <Input
                  placeholder="Đau lưng, mất ngủ, thoái hóa khớp..."
                  className="h-10 text-xs"
                />
              </Form.Item>
            </Col>

            {/* ROW 2: Ghi chú triệu chứng ban đầu */}
            <Col span={24}>
              <Form.Item
                label={<span className="text-xs font-semibold text-slate-700">Ghi chú triệu chứng ban đầu</span>}
                name="symptomNotes"
                className="mb-0"
              >
                <TextArea
                  rows={3}
                  placeholder="Ghi chú thêm về triệu chứng lâm sàng sơ bộ của bệnh nhân..."
                  className="text-xs"
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Info / Note Alert Block */}
          <Alert
            type="info"
            showIcon
            title={
              <span className="text-xs text-slate-600 font-normal">
                <strong>Lưu ý:</strong> Thông tin hành chính và chỉ số cơ bản chính xác giúp quá trình tiếp nhận thuận lợi hơn.
              </span>
            }
            className="border-sky-200/70 bg-sky-50/60 rounded-lg py-2 px-3.5"
          />
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button
            onClick={handleClose}
            disabled={isLoading}
            className="text-xs font-medium px-4 h-9"
          >
            Hủy
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            icon={<CheckOutlined />}
            loading={isLoading}
            disabled={isLoading}
            style={{ backgroundColor: "#0f766e", fontWeight: 600 }}
            className="text-xs px-5 h-9"
          >
            Hoàn Tất Tiếp Nhận
          </Button>
        </div>
      </Form>
    </Modal>
  );
};
