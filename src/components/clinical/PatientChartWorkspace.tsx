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

      {/* 2. MAIN 2-COLUMN GRID (Left ~8/12, Right ~4/12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Current Visit -> Start Exam CTA / Workspace -> (Stats + Latest Diagnosis) */}
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

          {/* Bottom Grid: Thông tin tóm tắt & Chẩn đoán chính gần nhất side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Thông tin tóm tắt (3 metrics) */}
            <PatientStatsSummaryCard treatmentCourses={treatment_courses} />

            {/* Chẩn đoán chính gần nhất */}
            <LatestDiagnosisCard
              latestPrimaryDiag={latestPrimaryDiag}
              doctorName={currentCourse?.doctor_name}
              diagnosisDate={currentCourse?.start_date}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Current Course Summary -> Treatment History Accordion -> Notes -> Appointments */}
        <div className="lg:col-span-4 space-y-6">
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
