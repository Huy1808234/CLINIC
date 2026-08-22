import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getPatientHistory } from "@/rsc-data/patients/get-patient-history";
import { getApplicationAccessContext } from "@/lib/auth/application-access";
import { getCurrentStaffRolesForClinic } from "@/lib/auth/role-resolver";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DoctorTreatmentPlanCard } from "@/components/clinical/DoctorTreatmentPlanCard";

interface PatientDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientDetailsPage({ params }: PatientDetailsPageProps) {
  const { id } = await params;
  const [history, accessContext] = await Promise.all([
    getPatientHistory(id),
    getApplicationAccessContext(),
  ]);

  if (!history) {
    notFound();
  }

  const roles = accessContext?.clinic.clinic_id
    ? await getCurrentStaffRolesForClinic(accessContext.clinic.clinic_id)
    : [];
  const isDoctor = roles.includes("DOCTOR");
  const { patient, insurance_cards, measurements, treatment_courses, recent_appointments } = history;
  const currentInsurance = insurance_cards.find((i) => i.is_current) || insurance_cards[0];
  const latestMeasurement = measurements[0];

  return (
    <AppShell
      title={`Hồ Sơ: ${patient.full_name}`}
      subtitle={`Mã bệnh nhân: ${patient.patient_code}`}
      actions={
        <Link href="/patients">
          <Button size="sm" variant="outline">
            Quay Lại Danh Sách
          </Button>
        </Link>
      }
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Patient Profile Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-800 font-bold text-xl flex items-center justify-center shadow-xs">
                {patient.full_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{patient.full_name}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="font-mono font-medium">{patient.patient_code}</span>
                  <span>·</span>
                  <span>{patient.sex === "NAM" ? "Nam" : patient.sex === "NU" ? "Nữ" : "Khác"}</span>
                  <span>·</span>
                  <span>Năm sinh: {patient.birth_year || (patient.birth_date ? patient.birth_date.slice(0, 4) : "—")}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">Hoạt động</Badge>
              {currentInsurance && <Badge variant="default">BHYT: {currentInsurance.card_number}</Badge>}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 text-xs">
            <div>
              <p className="text-slate-400 font-medium">Số Điện Thoại</p>
              <p className="font-semibold text-slate-900 mt-1 font-mono">{patient.phone || "—"}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Số CCCD / CMND</p>
              <p className="font-semibold text-slate-900 mt-1 font-mono">{patient.citizen_id || "—"}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Địa Chỉ Thường Trú</p>
              <p className="font-semibold text-slate-900 mt-1">{patient.address || "—"}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Chiều Cao / Cân Nặng</p>
              <p className="font-semibold text-slate-900 mt-1 font-mono">
                {latestMeasurement?.height_cm ? `${latestMeasurement.height_cm} cm` : "—"} /{" "}
                {latestMeasurement?.weight_kg ? `${latestMeasurement.weight_kg} kg` : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Treatment Courses History */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            Lịch Sử Liệu Trình Điều Trị ({treatment_courses.length})
          </h3>

          {treatment_courses.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 rounded-xl bg-white border border-slate-200">
              Bệnh nhân chưa có liệu trình điều trị nào.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {treatment_courses.map((course) => (
                <Card key={course.id} className="hover:border-teal-300 transition-all">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-teal-800">Liệu Trình LT{course.course_no}</CardTitle>
                      <Badge variant={course.status === "COMPLETED" ? "success" : "default"}>
                        {course.status} ({course.completed_session_count}/{course.planned_session_count ?? "—"} buổi)
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs">
                    <div>
                      <p className="text-slate-400">Bác sĩ phụ trách:</p>
                      <p className="font-semibold text-slate-800 mt-0.5">{course.doctor_name || "—"}</p>
                    </div>

                    {/* Doctor Treatment Plan Section */}
                    <DoctorTreatmentPlanCard
                      courseId={course.id}
                      courseStatus={course.status}
                      plannedSessionCount={course.planned_session_count}
                      plannedByDoctorId={course.planned_by_doctor_id}
                      plannedByDoctorName={course.planned_by_doctor_name}
                      plannedAt={course.planned_at}
                      isDoctor={isDoctor}
                    />

                    {course.diagnoses.length > 0 && (
                      <div>
                        <p className="text-slate-400">Chẩn đoán (ICD-10):</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {course.diagnoses.map((d, i) => (
                            <Badge key={i} variant="secondary" size="sm">
                              {d}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {course.services.length > 0 && (
                      <div>
                        <p className="text-slate-400">Dịch vụ chỉ định:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {course.services.map((s, i) => (
                            <Badge key={i} variant="purple" size="sm">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Appointments */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              Lịch Hẹn Gần Đây ({recent_appointments.length})
            </h3>
          </div>

          {recent_appointments.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Chưa có lịch hẹn nào được ghi nhận.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Ngày Hẹn</th>
                    <th className="py-2.5 px-4">Giờ Hẹn</th>
                    <th className="py-2.5 px-4">Bác Sĩ</th>
                    <th className="py-2.5 px-4">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {recent_appointments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-mono">{a.appointment_date}</td>
                      <td className="py-2.5 px-4 font-mono font-medium">
                        {a.scheduled_start_at.split("T")[1]?.slice(0, 5) || "—"}
                      </td>
                      <td className="py-2.5 px-4">{a.doctor_name || "—"}</td>
                      <td className="py-2.5 px-4">
                        <Badge
                          variant={a.status === "COMPLETED" ? "success" : "default"}
                          size="sm"
                        >
                          {a.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
