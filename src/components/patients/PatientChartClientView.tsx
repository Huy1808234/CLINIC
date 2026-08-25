"use client";

import React, { useState } from "react";
import type { PatientHistorySummary } from "@/types/patient";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";
import { PatientHeroSummaryCard } from "./PatientHeroSummaryCard";
import { CurrentVisitCard } from "./CurrentVisitCard";
import { StartExaminationPanel } from "./StartExaminationPanel";
import { PatientStatsSummaryCard } from "./PatientStatsSummaryCard";
import { LatestDiagnosisCard } from "./LatestDiagnosisCard";
import { CurrentCourseSummaryCard } from "./CurrentCourseSummaryCard";
import { TreatmentHistoryAccordion } from "./TreatmentHistoryAccordion";
import { PatientNotesCard } from "./PatientNotesCard";
import { RecentAppointmentsCard } from "./RecentAppointmentsCard";

export interface PatientChartClientViewProps {
  history: PatientHistorySummary;
  diagnosesCatalog: DiagnosisCatalogItem[];
  servicesCatalog: ServiceCatalogItem[];
  isDoctor: boolean;
}

export const PatientChartClientView: React.FC<PatientChartClientViewProps> = ({
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

  // Resolve the canonical current course (highest course_no / active course)
  const currentCourse = treatment_courses.length > 0 ? treatment_courses[0] : null;

  // Start exam state for progressive disclosure
  const [isExamStarted, setIsExamStarted] = useState<boolean>(false);

  // Extract latest primary diagnosis across courses
  const latestPrimaryDiag = currentCourse?.course_diagnoses?.find((d) => d.is_primary) || null;

  return (
    <div className="w-full space-y-6">
      {/* 1. PATIENT HERO SUMMARY (Full-Width Top Card) */}
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

          {/* Khối CTA Bắt đầu khám / Active Clinical Workspace */}
          <StartExaminationPanel
            currentCourse={currentCourse}
            diagnosesCatalog={diagnosesCatalog}
            servicesCatalog={servicesCatalog}
            isDoctor={isDoctor}
            isExamStarted={isExamStarted}
            onStartExam={() => setIsExamStarted(true)}
            onCollapseExam={() => setIsExamStarted(false)}
          />
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
