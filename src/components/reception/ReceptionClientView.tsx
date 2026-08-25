"use client";

import React, { useState, useMemo } from "react";
import {
  Card,
  Input,
  Select,
  DatePicker,
  Button,
  Alert,
  Typography,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { ReceptionQueueItem, ReceptionStats } from "@/types/reception";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";
import type { DoctorStaffItem } from "@/rsc-data/treatment/get-catalogs";
import { ReceptionStatsCards } from "./ReceptionStatsCards";
import { ReceptionQueueTable } from "./ReceptionQueueTable";
import { ReceptionModal } from "./ReceptionModal";
import { ClinicalOrderDrawer } from "./ClinicalOrderDrawer";
import { formatTimestampToClinicDate } from "@/utils/timezone";

const { Title, Text } = Typography;

export interface ReceptionClientViewProps {
  initialStats: ReceptionStats;
  initialQueue: ReceptionQueueItem[];
  catalogs: {
    diagnoses: DiagnosisCatalogItem[];
    services: ServiceCatalogItem[];
    doctors: DoctorStaffItem[];
  };
  isDoctor?: boolean;
}

export const ReceptionClientView: React.FC<ReceptionClientViewProps> = ({
  initialStats,
  initialQueue,
  catalogs,
  isDoctor = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [queue, setQueue] = useState<ReceptionQueueItem[]>(initialQueue);
  const [stats, setStats] = useState<ReceptionStats>(initialStats);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string | null>(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Clinical Order Drawer state (Doctor only)
  const [clinicalDrawerItem, setClinicalDrawerItem] = useState<ReceptionQueueItem | null>(null);
  const [isClinicalDrawerOpen, setIsClinicalDrawerOpen] = useState<boolean>(false);

  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleOpenClinicalDrawer = (item: ReceptionQueueItem) => {
    setClinicalDrawerItem(item);
    setIsClinicalDrawerOpen(true);
  };

  // Client-side filtering across Queue items
  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      // 1. Search Query filter (name, phone, patient_code, cccd, bhyt)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = item.patient.full_name.toLowerCase().includes(q);
        const phoneMatch = item.patient.phone?.toLowerCase().includes(q);
        const codeMatch = item.patient.patient_code.toLowerCase().includes(q);
        const cccdMatch = item.patient.citizen_id?.toLowerCase().includes(q);
        const insMatch = item.patient.current_insurance?.card_number.toLowerCase().includes(q);
        if (!nameMatch && !phoneMatch && !codeMatch && !cccdMatch && !insMatch) {
          return false;
        }
      }

      // 2. Doctor Filter
      if (selectedDoctorFilter) {
        if (item.active_course?.doctor_name !== selectedDoctorFilter) {
          return false;
        }
      }

      // 3. Status Filter (NEW vs RETURNING)
      if (selectedStatusFilter) {
        if (item.patient_relation_type !== selectedStatusFilter) {
          return false;
        }
      }

      // 4. Date Filter (matches clinic-local calendar date YYYY-MM-DD)
      if (selectedDateStr) {
        const itemLocalDate = formatTimestampToClinicDate(item.arrived_at);
        if (itemLocalDate !== selectedDateStr) {
          return false;
        }
      }

      return true;
    });
  }, [queue, searchQuery, selectedDoctorFilter, selectedStatusFilter, selectedDateStr]);

  const handleReceptionSuccess = (newQueueItem: ReceptionQueueItem, isExistingPatient: boolean) => {
    setQueue((prev) => [newQueueItem, ...prev]);
    setStats((prev) => ({
      ...prev,
      total_today: prev.total_today + 1,
      new_patients_today: isExistingPatient ? prev.new_patients_today : prev.new_patients_today + 1,
      returning_patients_today: isExistingPatient ? prev.returning_patients_today + 1 : prev.returning_patients_today,
      waiting_exam_count: prev.waiting_exam_count + 1,
    }));
    setAlertMsg({
      type: "success",
      text: "Tiếp nhận bệnh nhân thành công vào hệ thống!",
    });
  };

  return (
    <div className="space-y-4">
      {/* 4 Summary Stats Cards */}
      <ReceptionStatsCards stats={stats} />

      {/* Optional Top Alert Feedback */}
      {alertMsg && (
        <Alert
          type={alertMsg.type}
          title={alertMsg.text}
          showIcon
          closable
          onClose={() => setAlertMsg(null)}
          className="mb-3"
        />
      )}

      {/* Main Reception Operations Card Container */}
      <Card
        variant="borderless"
        className="shadow-xs border border-slate-200/90 rounded-xl bg-white"
        styles={{ body: { padding: "20px" } }}
      >
        {/* Operations Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <Title level={4} style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
              Quản Lý Tiếp Nhận Hôm Nay
            </Title>
            <Text type="secondary" style={{ fontSize: 12, color: "#64748b" }}>
              Theo dõi bệnh nhân đến khám, điều phối bác sĩ và chỉ định điều trị trong ngày.
            </Text>
          </div>

          {/* Primary CTA (Disabled/Hidden for DOCTOR-only without reception creation capability) */}
          {!isDoctor && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsModalOpen(true)}
              style={{
                backgroundColor: "#0f766e",
                fontWeight: 600,
                height: 36,
                padding: "0 16px",
              }}
            >
              Tiếp Nhận Bệnh Nhân
            </Button>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="py-3.5 flex flex-wrap items-center gap-2.5">
          <Input
            placeholder="Tìm bệnh nhân, SĐT, CCCD, BHYT..."
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />

          <Select
            placeholder="Bác sĩ khám"
            allowClear
            showSearch
            style={{ width: 180 }}
            value={selectedDoctorFilter}
            onChange={(val) => setSelectedDoctorFilter(val)}
            options={catalogs.doctors.map((d) => ({
              label: d.full_name,
              value: d.full_name,
            }))}
          />

          <Select
            placeholder="Phân loại"
            allowClear
            style={{ width: 140 }}
            value={selectedStatusFilter}
            onChange={(val) => setSelectedStatusFilter(val)}
            options={[
              { label: "Mới (Lần đầu)", value: "NEW" },
              { label: "Tái khám", value: "RETURNING" },
            ]}
          />

          <DatePicker
            placeholder="Ngày tiếp nhận"
            style={{ width: 150 }}
            allowClear
            onChange={(_date, dateString) => {
              setSelectedDateStr(typeof dateString === "string" && dateString ? dateString : null);
            }}
          />

          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setSearchQuery("");
              setSelectedDoctorFilter(null);
              setSelectedStatusFilter(null);
              setSelectedDateStr(null);
            }}
            title="Làm mới bộ lọc"
          >
            Làm mới
          </Button>
        </div>

        {/* Reception Queue Table */}
        <ReceptionQueueTable
          items={filteredQueue}
          isDoctor={isDoctor}
          onOpenClinicalDrawer={handleOpenClinicalDrawer}
          onCheckInSession={(courseId) => {
            setQueue((prev) =>
              prev.map((item) =>
                item.active_course?.id === courseId
                  ? {
                      ...item,
                      active_course: {
                        ...item.active_course,
                        completed_session_count: item.active_course.completed_session_count + 1,
                      },
                    }
                  : item
              )
            );
          }}
        />
      </Card>

      {/* Doctor-Only Clinical Order Drawer */}
      <ClinicalOrderDrawer
        key={clinicalDrawerItem?.id || "drawer"}
        isOpen={isClinicalDrawerOpen}
        onClose={() => {
          setIsClinicalDrawerOpen(false);
          setClinicalDrawerItem(null);
        }}
        item={clinicalDrawerItem}
        diagnoses={catalogs.diagnoses}
        services={catalogs.services}
        onSuccess={() => {
          setAlertMsg({
            type: "success",
            text: "Cập nhật chỉ định lâm sàng và kế hoạch điều trị thành công.",
          });
        }}
      />

      {/* Reception Intake Modal (Receptionist / Admin Workflow) */}
      <ReceptionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        doctors={catalogs.doctors}
        onSuccess={handleReceptionSuccess}
      />
    </div>
  );
};
