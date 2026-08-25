"use client";

import React, { useState } from "react";
import type { PatientHistorySummary } from "@/types/patient";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";
import { PatientHeroSummaryCard } from "@/components/patients/PatientHeroSummaryCard";
import { CurrentVisitCard } from "@/components/patients/CurrentVisitCard";
import { StartExaminationPanel } from "@/components/patients/StartExaminationPanel";
import { PatientStatsSummaryCard } from "@/components/patients/PatientStatsSummaryCard";
import { LatestDiagnosisCard } from "@/components/patients/LatestDiagnosisCard";
import { CurrentCourseSummaryCard } from "@/components/patients/CurrentCourseSummaryCard";
import { TreatmentHistoryAccordion } from "@/components/patients/TreatmentHistoryAccordion";
import { PatientNotesCard } from "@/components/patients/PatientNotesCard";
import { RecentAppointmentsCard } from "@/components/clinical/RecentAppointmentsCard";
import { DoctorCurrentExamWorkspace } from "@/components/clinical/DoctorCurrentExamWorkspace";

export interface PatientChartWorkspaceProps {
  history: PatientHistorySummary;
  diagnosesCatalog: DiagnosisCatalogItem[];
  servicesCatalog: ServiceCatalogItem[];
  isDoctor: boolean;
}

export const PatientChartWorkspace: React.FC<PatientChartWorkspaceProps> = ({
  history,
  diagnosesCatalog,
  servicesCatalog,
  isDoctor,
}) => {
  const {
    patient,
    insurance_cards,
    measurements,
    treatment_courses,
    recent_appointments,
    recent_receptions,
  } = history;

  const currentInsurance = insurance_cards.find((i) => i.is_current) || insurance_cards[0];
  const latestMeasurement = measurements[0];
  const latestReception = recent_receptions?.[0];

  // Resolve current course
  const currentCourse = treatment_courses.length > 0 ? treatment_courses[0] : null;

  // Progressive disclosure for starting examination
  const [isExamStarted, setIsExamStarted] = useState<boolean>(false);

  // Extract latest primary diagnosis
  const latestPrimaryDiag = currentCourse?.course_diagnoses?.find((d) => d.is_primary) || null;

  return (
    <div className="w-full space-y-6">
      {/* 1. PATIENT HERO SUMMARY (Top Card) */}
      <PatientHeroSummaryCard
        patient={patient}
        currentInsurance={currentInsurance}
        latestMeasurement={latestMeasurement}
      />

      {/* 2. UPPER CLINICAL VISIT & COURSE WORKSPACE (2-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Upper Left (~8/12): Current Visit -> Start Exam CTA / Workspace */}
        <div className="lg:col-span-8 space-y-6">
          {/* Buổi khám hiện tại */}
          <CurrentVisitCard recentReception={latestReception} />

          {/* CTA Bắt đầu khám / Active Clinical Workspace */}
          {!isExamStarted ? (
            <StartExaminationPanel
              currentCourse={currentCourse}
              diagnosesCatalog={diagnosesCatalog}
              servicesCatalog={servicesCatalog}
              isDoctor={isDoctor}
              isExamStarted={false}
              onStartExam={() => setIsExamStarted(true)}
            />
          ) : currentCourse ? (
            <DoctorCurrentExamWorkspace
              currentCourse={currentCourse}
              diagnosesCatalog={diagnosesCatalog}
              servicesCatalog={servicesCatalog}
              isDoctor={isDoctor}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-xs text-slate-400">
              Bệnh nhân chưa có liệu trình điều trị nào được khởi tạo.
            </div>
          )}
        </div>

        {/* Upper Right (~4/12): Current Course Summary -> Treatment History Accordion */}
        <div className="lg:col-span-4 space-y-6">
          {/* Thông tin trong liệu trình hiện tại */}
          <CurrentCourseSummaryCard currentCourse={currentCourse} />

          {/* Lịch sử điều trị (Accordion timeline) */}
          <TreatmentHistoryAccordion
            treatmentCourses={treatment_courses}
            activeCourseId={currentCourse?.id}
          />
        </div>
      </div>

      {/* 3. LOWER SYNCHRONIZED 2-COLUMN GRID (Row 1: Stats + Notes, Row 2: Diagnosis + Appointments) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* ROW 1 LEFT (~8/12): Thông tin tóm tắt (3 KPI cards) */}
        <div className="lg:col-span-8 flex flex-col">
          <PatientStatsSummaryCard treatmentCourses={treatment_courses} />
        </div>

        {/* ROW 1 RIGHT (~4/12): Ghi chú */}
        <div className="lg:col-span-4 flex flex-col">
          <PatientNotesCard notes={latestReception?.notes} />
        </div>

        {/* ROW 2 LEFT (~8/12): Chẩn đoán chính gần nhất */}
        <div className="lg:col-span-8 flex flex-col">
          <LatestDiagnosisCard
            latestPrimaryDiag={latestPrimaryDiag}
            doctorName={currentCourse?.doctor_name}
            diagnosisDate={currentCourse?.start_date}
          />
        </div>

        {/* ROW 2 RIGHT (~4/12): Lịch hẹn gần đây */}
        <div className="lg:col-span-4 flex flex-col">
          <RecentAppointmentsCard appointments={recent_appointments} />
        </div>
      </div>
    </div>
  );
};
