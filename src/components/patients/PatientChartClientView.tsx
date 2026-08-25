"use client";

import React, { useState } from "react";
import type { PatientHistorySummary } from "@/types/patient";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";
import { PatientHeroSummaryCard } from "./PatientHeroSummaryCard";
import { CurrentVisitCard } from "./CurrentVisitCard";
import { CurrentCourseSummaryCard } from "./CurrentCourseSummaryCard";
import { TreatmentHistoryAccordion } from "./TreatmentHistoryAccordion";
import { CombinedClinicalSummaryCard } from "./CombinedClinicalSummaryCard";
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
      {/* ROW 1: PATIENT HERO (Full-Width Top Card spanning both columns) */}
      <PatientHeroSummaryCard
        patient={patient}
        currentInsurance={currentInsurance}
        latestMeasurement={latestMeasurement}
      />

      {/* ROW 2: SHARED HORIZONTAL ROW (Left: Current Visit with Start Exam | Right: Current Course + History) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.85fr)_minmax(360px,1fr)] gap-6 items-start">
        {/* ROW 2 LEFT (~65%): Buổi khám hiện tại (Single coherent card with integrated Start Exam) */}
        <div className="flex flex-col h-full">
          <CurrentVisitCard
            recentReception={latestReception}
            currentCourse={currentCourse}
            diagnosesCatalog={diagnosesCatalog}
            servicesCatalog={servicesCatalog}
            isDoctor={isDoctor}
            isExamStarted={isExamStarted}
            onStartExam={() => setIsExamStarted(true)}
            onCollapseExam={() => setIsExamStarted(false)}
          />
        </div>

        {/* ROW 2 RIGHT (~35%): Thông tin trong liệu trình hiện tại + Lịch sử điều trị */}
        <div className="flex flex-col space-y-5 h-full">
          <CurrentCourseSummaryCard currentCourse={currentCourse} />
          <TreatmentHistoryAccordion
            treatmentCourses={treatment_courses}
            activeCourseId={currentCourse?.id}
          />
        </div>
      </div>

      {/* ROW 3: SHARED HORIZONTAL ROW (Left: Combined Summary | Right: Notes) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.85fr)_minmax(360px,1fr)] gap-6 items-stretch">
        {/* ROW 3 LEFT (~65%): One Combined Clinical Summary Surface (Thông tin tóm tắt [3 metrics] | Chẩn đoán chính gần nhất) */}
        <div className="flex flex-col h-full">
          <CombinedClinicalSummaryCard
            treatmentCourses={treatment_courses}
            latestPrimaryDiag={latestPrimaryDiag}
            doctorName={currentCourse?.doctor_name}
            diagnosisDate={currentCourse?.start_date}
          />
        </div>

        {/* ROW 3 RIGHT (~35%): Ghi chú */}
        <div className="flex flex-col h-full">
          <PatientNotesCard notes={latestReception?.notes} />
        </div>
      </div>

      {/* OPTIONAL SECONDARY SECTION: Recent Appointments (placed after main 3-row grid) */}
      {recent_appointments && recent_appointments.length > 0 && (
        <div className="w-full">
          <RecentAppointmentsCard appointments={recent_appointments} />
        </div>
      )}
    </div>
  );
};
