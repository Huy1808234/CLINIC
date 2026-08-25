"use client";

import React, { useState } from "react";
import type { PatientHistorySummary } from "@/types/patient";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";
import { PatientSummaryCard } from "./PatientSummaryCard";
import { CurrentVisitSummaryCard } from "./CurrentVisitSummaryCard";
import { DoctorCurrentExamWorkspace } from "./DoctorCurrentExamWorkspace";
import { CurrentCourseSummaryCard } from "./CurrentCourseSummaryCard";
import { TreatmentHistoryAccordion } from "./TreatmentHistoryAccordion";
import { RecentAppointmentsCard } from "./RecentAppointmentsCard";
import { Tag } from "antd";
import { MedicineBoxOutlined } from "@ant-design/icons";

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

  // Resolve the canonical current course (highest course_no / active course)
  const currentCourse = treatment_courses.length > 0 ? treatment_courses[0] : null;

  // By default, start exam is not triggered unless doctor starts it
  const [isExamStarted, setIsExamStarted] = useState<boolean>(false);

  // Extract latest primary diagnosis if available
  const latestPrimaryDiag = currentCourse?.course_diagnoses?.find((d) => d.is_primary) || null;

  return (
    <div className="w-full space-y-6">
      {/* 1. PATIENT SUMMARY (Top Full-Width EHR Chart Header) */}
      <PatientSummaryCard
        patient={patient}
        currentInsurance={currentInsurance}
        latestMeasurement={latestMeasurement}
      />

      {/* 2. MAIN CLINICAL WORKSPACE GRID (~67% Left Main, ~33% Right Rail) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: CURRENT VISIT OR ACTIVE CLINICAL WORKSPACE */}
        <div className="lg:col-span-8 space-y-6">
          {!isExamStarted ? (
            <>
              <CurrentVisitSummaryCard
                recentReception={latestReception}
                isDoctor={isDoctor}
                onStartExam={() => setIsExamStarted(true)}
              />

              {/* Lower Clinical Summary: Chẩn đoán gần nhất if real data exists */}
              {latestPrimaryDiag && (
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <MedicineBoxOutlined className="text-teal-600 text-base" />
                      <h3 className="text-sm font-bold text-slate-800 m-0">Chẩn đoán chính gần nhất</h3>
                    </div>
                    <Tag color="blue" className="m-0 font-mono text-xs font-semibold">
                      {latestPrimaryDiag.raw_code}
                    </Tag>
                  </div>
                  <div className="text-xs text-slate-700">
                    <span className="font-semibold text-slate-900 text-sm block">
                      {latestPrimaryDiag.raw_text || latestPrimaryDiag.raw_code}
                    </span>
                    {currentCourse?.doctor_name && (
                      <span className="text-slate-400 mt-1 block">
                        Bác sĩ chẩn đoán: {currentCourse.doctor_name}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
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

        {/* RIGHT COLUMN: CURRENT COURSE SUMMARY -> TREATMENT HISTORY -> RECENT APPOINTMENTS */}
        <div className="lg:col-span-4 space-y-5">
          {/* Current Course Context Summary */}
          {currentCourse && <CurrentCourseSummaryCard currentCourse={currentCourse} />}

          {/* Historical Treatment Courses Accordion */}
          <TreatmentHistoryAccordion
            treatmentCourses={treatment_courses}
            activeCourseId={currentCourse?.id}
          />

          {/* Recent Appointments */}
          <RecentAppointmentsCard appointments={recent_appointments} />
        </div>
      </div>
    </div>
  );
};
