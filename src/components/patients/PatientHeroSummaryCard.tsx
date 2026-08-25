"use client";

import React from "react";
import { Tag } from "antd";
import {
  PhoneOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  ColumnHeightOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import type { Patient, PatientInsuranceCard, PatientMeasurement } from "@/types/patient";

export interface PatientHeroSummaryCardProps {
  patient: Patient;
  currentInsurance?: PatientInsuranceCard | null;
  latestMeasurement?: PatientMeasurement | null;
}

export const PatientHeroSummaryCard: React.FC<PatientHeroSummaryCardProps> = ({
  patient,
  currentInsurance,
  latestMeasurement,
}) => {
  // Avatar initials
  const initials = patient.full_name
    ? patient.full_name
        .trim()
        .split(" ")
        .map((w) => w[0])
        .slice(-2)
        .join("")
        .toUpperCase()
    : "BN";

  // Calculate age
  const calculateAge = () => {
    if (patient.birth_year) {
      const currentYear = new Date().getFullYear();
      return `${currentYear - patient.birth_year} tuổi`;
    }
    if (patient.birth_date) {
      const birthYear = parseInt(patient.birth_date.slice(0, 4), 10);
      if (!isNaN(birthYear)) {
        const currentYear = new Date().getFullYear();
        return `${currentYear - birthYear} tuổi`;
      }
    }
    return null;
  };

  const ageText = calculateAge();
  const birthDateText = patient.birth_date
    ? new Intl.DateTimeFormat("vi-VN").format(new Date(patient.birth_date))
    : patient.birth_year
    ? `Năm ${patient.birth_year}`
    : "—";

  const heightWeightText =
    latestMeasurement?.height_cm && latestMeasurement?.weight_kg
      ? `${latestMeasurement.height_cm} cm / ${latestMeasurement.weight_kg} kg`
      : latestMeasurement?.height_cm
      ? `${latestMeasurement.height_cm} cm`
      : latestMeasurement?.weight_kg
      ? `${latestMeasurement.weight_kg} kg`
      : "—";

  const identityCardText = patient.citizen_id || "—";
  const insuranceCardText = currentInsurance?.card_number || "—";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* LEFT COLUMN: Patient Avatar, Name, Gender, Age, Code, Contact */}
        <div className="lg:col-span-6 flex items-start sm:items-center gap-5 border-b lg:border-b-0 lg:border-r border-slate-100 pb-5 lg:pb-0 lg:pr-6">
          {/* Avatar Initials */}
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-[#00897b] to-teal-700 text-white font-bold text-xl sm:text-2xl flex items-center justify-center shadow-xs shrink-0 select-none tracking-wider">
            {initials}
          </div>

          {/* Name & Demographics */}
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 m-0 tracking-tight">
                {patient.full_name}
              </h2>
              {patient.sex && (
                <Tag
                  color="cyan"
                  className="m-0 text-xs font-semibold px-2 py-0.5 rounded-md border-teal-200 text-teal-800 bg-teal-50"
                >
                  {patient.sex === "NAM" ? "Nam" : patient.sex === "NU" ? "Nữ" : "Khác"}
                </Tag>
              )}
              {ageText && (
                <Tag
                  color="default"
                  className="m-0 text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border-slate-200"
                >
                  {ageText}
                </Tag>
              )}
            </div>

            {/* Patient Code */}
            <div className="text-xs text-slate-500 font-mono font-medium flex items-center gap-1.5">
              <span>Mã BN:</span>
              <span className="font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                {patient.patient_code}
              </span>
            </div>

            {/* Phone & Address */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-0.5">
              <div className="flex items-center gap-1.5">
                <PhoneOutlined className="text-slate-400 text-xs" />
                <span className="font-mono text-slate-800">{patient.phone || "—"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <EnvironmentOutlined className="text-slate-400 text-xs" />
                <span className="truncate max-w-[220px] text-slate-700">
                  {patient.address || "Chưa cập nhật địa chỉ"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 2x2 Grid of Administrative / Clinical Info */}
        <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-2 gap-4 text-xs">
          {/* Ngày sinh */}
          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100/80">
            <span className="text-slate-400 font-medium block text-[11px] flex items-center gap-1.5">
              <CalendarOutlined className="text-slate-400 text-xs" />
              <span>Ngày sinh</span>
            </span>
            <span className="font-semibold text-slate-800 mt-1 block font-mono text-[13px]">
              {birthDateText}
            </span>
          </div>

          {/* Chiều cao / Cân nặng */}
          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100/80">
            <span className="text-slate-400 font-medium block text-[11px] flex items-center gap-1.5">
              <ColumnHeightOutlined className="text-slate-400 text-xs" />
              <span>Chiều cao / Cân nặng</span>
            </span>
            <span className="font-semibold text-slate-800 mt-1 block text-[13px]">
              {heightWeightText}
            </span>
          </div>

          {/* CCCD / CMND */}
          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100/80">
            <span className="text-slate-400 font-medium block text-[11px] flex items-center gap-1.5">
              <IdcardOutlined className="text-slate-400 text-xs" />
              <span>CCCD / CMND</span>
            </span>
            <span className="font-semibold text-slate-800 mt-1 block font-mono text-[13px]">
              {identityCardText}
            </span>
          </div>

          {/* Mã thẻ BHYT */}
          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100/80">
            <span className="text-slate-400 font-medium block text-[11px] flex items-center gap-1.5">
              <SafetyCertificateOutlined className="text-slate-400 text-xs" />
              <span>Mã thẻ BHYT</span>
            </span>
            <span className="font-semibold text-slate-800 mt-1 block font-mono text-[13px]">
              {insuranceCardText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
