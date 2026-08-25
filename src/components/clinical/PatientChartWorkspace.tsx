"use client";

import React, { useState } from "react";
import type { PatientHistorySummary } from "@/types/patient";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";
import { PatientHeroSummaryCard } from "@/components/patients/PatientHeroSummaryCard";
import { CurrentVisitCard } from "@/components/patients/CurrentVisitCard";
import { CurrentCourseSummaryCard } from "@/components/patients/CurrentCourseSummaryCard";
import { TreatmentHistoryAccordion } from "@/components/patients/TreatmentHistoryAccordion";
import { CombinedClinicalSummaryCard } from "@/components/patients/CombinedClinicalSummaryCard";
import { PatientNotesCard } from "@/components/patients/PatientNotesCard";
import { RecentAppointmentsCard } from "@/components/clinical/RecentAppointmentsCard";

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
    clinical_notes = [],
  } = history;

  const currentInsurance = insurance_cards.find((i) => i.is_current) || insurance_cards[0];
  const latestMeasurement = measurements[0];
  const latestReception = recent_receptions?.[0];

  // Resolve current course
  const currentCourse = treatment_courses.length > 0 ? treatment_courses[0] : null;

  // Progressive disclosure for starting examination: !isExamStarted ? show start exam CTA : DoctorCurrentExamWorkspace
  const [isExamStarted, setIsExamStarted] = useState<boolean>(false);

  // Extract latest primary diagnosis
  const latestPrimaryDiag = currentCourse?.course_diagnoses?.find((d) => d.is_primary) || null;

  return (
    <div className="w-full space-y-6">
      {/* ROW 1: PATIENT HERO (Top Card) */}
      <PatientHeroSummaryCard
        patient={patient}
        currentInsurance={currentInsurance}
        latestMeasurement={latestMeasurement}
      />

      {/* ROW 2: SHARED HORIZONTAL ROW (Left: Current Visit with Start Exam | Right: Current Course + History) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.85fr)_minmax(360px,1fr)] gap-6 items-start">
        {/* ROW 2 LEFT (~65%): Buổi khám hiện tại */}
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
            clinicalNotes={clinical_notes}
            activeCourseId={currentCourse?.id}
          />
        </div>
      </div>

      {/* ROW 3: SHARED HORIZONTAL ROW (Left: Combined Summary | Right: Notes) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.85fr)_minmax(360px,1fr)] gap-6 items-stretch">
        {/* ROW 3 LEFT (~65%): One Combined Clinical Summary Surface */}
        <div className="flex flex-col h-full">
          <CombinedClinicalSummaryCard
            treatmentCourses={treatment_courses}
            latestPrimaryDiag={latestPrimaryDiag}
            doctorName={currentCourse?.doctor_name}
            diagnosisDate={currentCourse?.start_date}
          />
        </div>

        {/* ROW 3 RIGHT (~35%): Ghi chú lâm sàng */}
        <div className="flex flex-col h-full">
          <PatientNotesCard
            notes={latestReception?.notes}
            clinicalNotes={clinical_notes}
            totalNotesCount={history.clinical_notes_total_count}
            isDoctor={isDoctor}
            patientId={patient.id}
            patientName={patient.full_name}
            patientCode={patient.patient_code}
            treatmentCourseId={currentCourse?.id}
            treatmentCourseNo={currentCourse?.course_no}
            receptionId={latestReception?.id}
            doctorName={currentCourse?.doctor_name || undefined}
          />
        </div>
      </div>

      {/* OPTIONAL SECONDARY SECTION: Recent Appointments */}
      {recent_appointments && recent_appointments.length > 0 && (
        <div className="w-full">
          <RecentAppointmentsCard appointments={recent_appointments} />
        </div>
      )}
    </div>
  );
};
