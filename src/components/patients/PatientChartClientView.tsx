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
import { RecentAppointmentsCard } from "@/components/clinical/RecentAppointmentsCard";

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

      {/* 2. MAIN 2-COLUMN GRID (Left ~8/12, Right ~4/12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Current Visit -> Start Exam CTA / Workspace -> Stats -> Latest Diagnosis */}
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

          {/* Thông tin tóm tắt (3 metrics: Tổng số liệu trình, Tổng số buổi, Buổi hoàn tất) */}
          <PatientStatsSummaryCard treatmentCourses={treatment_courses} />

          {/* Chẩn đoán chính gần nhất */}
          <LatestDiagnosisCard
            latestPrimaryDiag={latestPrimaryDiag}
            doctorName={currentCourse?.doctor_name}
            diagnosisDate={currentCourse?.start_date}
          />
        </div>

        {/* RIGHT COLUMN: Current Course Summary -> Treatment History Accordion -> Notes -> Appointments */}
        <div className="lg:col-span-4 space-y-5">
          {/* Thông tin trong liệu trình hiện tại */}
          <CurrentCourseSummaryCard currentCourse={currentCourse} />

          {/* Lịch sử điều trị (Accordion timeline) */}
          <TreatmentHistoryAccordion
            treatmentCourses={treatment_courses}
            activeCourseId={currentCourse?.id}
          />

          {/* Ghi chú */}
          <PatientNotesCard notes={latestReception?.notes} />

          {/* Lịch hẹn gần đây */}
          <RecentAppointmentsCard appointments={recent_appointments} />
        </div>
      </div>
    </div>
  );
};
