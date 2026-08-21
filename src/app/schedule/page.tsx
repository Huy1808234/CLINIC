import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getMonthScheduleMatrix } from "@/rsc-data/schedule/get-month-schedule";
import { getDayTimeline } from "@/rsc-data/schedule/get-day-schedule";
import { getCatalogs } from "@/rsc-data/treatment/get-catalogs";
import { ScheduleClientView } from "@/components/schedule/ScheduleClientView";

export default async function SchedulePage() {
  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const todayDate = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  const [matrixData, timelineData, catalogs] = await Promise.all([
    getMonthScheduleMatrix(currentMonth),
    getDayTimeline(todayDate),
    getCatalogs(),
  ]);

  return (
    <AppShell
      title="Lịch Hẹn & Ma Trận Trị Liệu"
      subtitle="Bảng ma trận tháng 31 ngày phân theo bác sĩ và dòng thời gian 5 phút"
    >
      <div className="max-w-[1400px] mx-auto">
        <ScheduleClientView
          initialMatrix={matrixData}
          initialTimeline={timelineData}
          doctors={catalogs.doctors}
        />
      </div>
    </AppShell>
  );
}
