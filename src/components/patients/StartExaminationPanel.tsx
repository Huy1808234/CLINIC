"use client";

import React from "react";
import { Button } from "antd";
import {
  PlayCircleOutlined,
  MedicineBoxOutlined,
  CheckCircleOutlined,
  UpOutlined,
} from "@ant-design/icons";
import type { PatientTreatmentCourseSummaryItem } from "@/types/patient";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";
import { DoctorCurrentExamWorkspace } from "@/components/clinical/DoctorCurrentExamWorkspace";

export interface StartExaminationPanelProps {
  currentCourse?: PatientTreatmentCourseSummaryItem | null;
  diagnosesCatalog: DiagnosisCatalogItem[];
  servicesCatalog: ServiceCatalogItem[];
  isDoctor: boolean;
  isExamStarted: boolean;
  onStartExam: () => void;
  onCollapseExam?: () => void;
}

export const StartExaminationPanel: React.FC<StartExaminationPanelProps> = ({
  currentCourse,
  diagnosesCatalog,
  servicesCatalog,
  isDoctor,
  isExamStarted,
  onStartExam,
  onCollapseExam,
}) => {
  if (!isExamStarted) {
    return (
      <div className="rounded-2xl border border-teal-100 bg-gradient-to-b from-teal-50/70 via-teal-50/30 to-white p-6 sm:p-7 text-center space-y-3.5 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-teal-100/80 text-[#00897b] flex items-center justify-center mx-auto text-xl shadow-2xs">
          <MedicineBoxOutlined />
        </div>
        <div className="space-y-1">
          <h4 className="text-base font-bold text-slate-800 m-0">Bệnh nhân đã được tiếp nhận</h4>
          <p className="text-xs text-slate-500 m-0 max-w-md mx-auto leading-relaxed">
            Vui lòng xem lại thông tin hành chính, lý do khám và bấm Bắt đầu khám để tiến hành chẩn đoán và chỉ định điều trị.
          </p>
        </div>

        {isDoctor ? (
          <div className="pt-2">
            <Button
              type="primary"
              size="large"
              icon={<PlayCircleOutlined />}
              onClick={onStartExam}
              className="bg-[#00897b] hover:bg-teal-700 font-bold px-8 h-11 text-xs rounded-xl shadow-xs border-0 inline-flex items-center justify-center gap-2"
            >
              Bắt đầu khám
            </Button>
          </div>
        ) : (
          <div className="pt-2 text-xs text-slate-400 italic">
            Chỉ Bác sĩ phụ trách mới có quyền thực hiện khám và chỉ định điều trị.
          </div>
        )}
      </div>
    );
  }

  // When exam is active: show the clinical workspace with a header toggle
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-teal-200/80 bg-teal-50/60 p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00897b] text-white flex items-center justify-center text-sm font-bold">
            <CheckCircleOutlined />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 m-0">Đang trong quá trình khám</h4>
            <p className="text-[11px] text-teal-800 m-0">
              Nhập chẩn đoán, chọn gợi ý DVKT TT06 và thiết lập kế hoạch điều trị.
            </p>
          </div>
        </div>

        {onCollapseExam && (
          <Button
            size="small"
            type="text"
            icon={<UpOutlined />}
            onClick={onCollapseExam}
            className="text-xs text-slate-600 hover:text-slate-900 rounded-lg"
          >
            Thu gọn
          </Button>
        )}
      </div>

      {currentCourse ? (
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
  );
};
