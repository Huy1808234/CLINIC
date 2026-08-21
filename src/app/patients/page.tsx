import React from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { searchPatients } from "@/rsc-data/patients/search-patients";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default async function PatientsPage() {
  const recentPatients = await searchPatients("a", 20);

  return (
    <AppShell
      title="Quản Lý Hồ Sơ Bệnh Nhân (Patient Master)"
      subtitle="Danh bạ bệnh nhân chuẩn hóa, thẻ bảo hiểm y tế và lịch sử trị liệu"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm kiếm theo Tên, SĐT, CCCD, BHYT hoặc Mã BN..."
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          <Link href="/reception">
            <Button size="sm" variant="primary">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Tạo Hồ Sơ Bệnh Nhân Mới
            </Button>
          </Link>
        </div>

        {/* Patients Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Danh Sách Bệnh Nhân ({recentPatients.length})
            </h3>
          </div>

          {recentPatients.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Chưa có hồ sơ bệnh nhân nào. Vui lòng nhập dữ liệu từ Excel hoặc đăng ký qua Tiếp nhận.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Mã BN</th>
                    <th className="py-3 px-4">Họ Và Tên</th>
                    <th className="py-3 px-4">Số Điện Thoại</th>
                    <th className="py-3 px-4">CCCD / CMND</th>
                    <th className="py-3 px-4">Thẻ BHYT</th>
                    <th className="py-3 px-4">Năm Sinh</th>
                    <th className="py-3 px-4 text-right">Chi Tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {recentPatients.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-teal-700">
                        {p.patient_code}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <Link href={`/patients/${p.id}`} className="hover:underline">
                          {p.full_name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">{p.phone || "—"}</td>
                      <td className="py-3 px-4 font-mono text-[11px]">{p.citizen_id || "—"}</td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {p.current_insurance ? (
                          <Badge variant="default" size="sm">
                            {p.current_insurance.card_number}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {p.birth_year || (p.birth_date ? p.birth_date.slice(0, 4) : "—")}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/patients/${p.id}`}>
                          <Button size="sm" variant="ghost">
                            Xem Hồ Sơ
                          </Button>
                        </Link>
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
