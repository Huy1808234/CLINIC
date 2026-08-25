"use client";

import React from "react";
import type { PatientHistorySummary } from "@/types/patient";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";
import { DoctorClinicalCourseCard } from "./DoctorClinicalCourseCard";

export interface DoctorCurrentExamWorkspaceProps {
  currentCourse: PatientHistorySummary["treatment_courses"][number];
  diagnosesCatalog: DiagnosisCatalogItem[];
  servicesCatalog: ServiceCatalogItem[];
  isDoctor: boolean;
}

export const DoctorCurrentExamWorkspace: React.FC<DoctorCurrentExamWorkspaceProps> = ({
  currentCourse,
  diagnosesCatalog,
  servicesCatalog,
  isDoctor,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse"></span>
          <h3 className="text-base font-bold text-slate-900 m-0">
            Khám Hiện Tại — Liệu Trình LT{currentCourse.course_no}
          </h3>
        </div>
      </div>

      {/* Render the single current course card */}
      <DoctorClinicalCourseCard
        course={currentCourse}
        diagnosesCatalog={diagnosesCatalog}
        servicesCatalog={servicesCatalog}
        isDoctor={isDoctor}
      />
    </div>
  );
};
