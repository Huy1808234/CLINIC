"use client";

import React from "react";
import type { MigrationValidationReport } from "@/types/migration";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface MigrationPreviewTableProps {
  report: MigrationValidationReport;
  onCommit: () => void;
  onCancel: () => void;
  isCommitting?: boolean;
}

export const MigrationPreviewTable: React.FC<MigrationPreviewTableProps> = ({
  report,
  onCommit,
  onCancel,
  isCommitting,
}) => {
  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">Tổng Dòng Dữ Liệu</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{report.total_rows}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="text-xs text-emerald-700 font-medium">Hợp Lệ (Sẵn Sàng Nhập)</p>
          <p className="text-xl font-bold text-emerald-900 mt-0.5">{report.valid_rows}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
          <p className="text-xs text-rose-700 font-medium">Lỗi / Thiếu Thông Tin</p>
          <p className="text-xl font-bold text-rose-900 mt-0.5">{report.error_rows}</p>
        </div>
        <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
          <p className="text-xs text-teal-700 font-medium">Tổng Buổi Khám/Hẹn</p>
          <p className="text-xl font-bold text-teal-900 mt-0.5">{report.total_appointments_count}</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            Xem Trước Kết Quả Phân Tích ({report.file_name})
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {report.new_patients_count} bệnh nhân mới · {report.existing_matches_count} bệnh nhân trùng khớp đã có trong hệ thống
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isCommitting}>
            Hủy Bỏ
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onCommit}
            isLoading={isCommitting}
            disabled={report.valid_rows === 0}
          >
            Xác Nhận Nhập {report.valid_rows} Dòng Vào Hệ Thống
          </Button>
        </div>
      </div>

      {/* Staging Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-14 text-center">Dòng</th>
                <th className="py-3 px-4">Sheet</th>
                <th className="py-3 px-4">Họ Tên</th>
                <th className="py-3 px-4">SĐT</th>
                <th className="py-3 px-4">CCCD</th>
                <th className="py-3 px-4">BHYT</th>
                <th className="py-3 px-4">Khớp Hồ Sơ</th>
                <th className="py-3 px-4 text-center">Số Buổi Hẹn</th>
                <th className="py-3 px-4">Trạng Thái / Lỗi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {report.preview_items.map((item) => {
                const hasError = item.errors.length > 0;

                return (
                  <tr
                    key={`${item.sheet}-${item.row_no}`}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      hasError ? "bg-rose-50/20" : ""
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-500 text-center">
                      {item.row_no}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">{item.sheet}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{item.name}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px]">{item.phone || "—"}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px]">{item.cccd || "—"}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px]">{item.bhyt || "—"}</td>
                    <td className="py-2.5 px-4">
                      {item.match_status === "NEW_PATIENT" ? (
                        <Badge variant="success" size="sm">Tạo mới</Badge>
                      ) : (
                        <Badge variant="purple" size="sm">{item.match_status}</Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono font-semibold">
                      {item.appt_count}
                    </td>
                    <td className="py-2.5 px-4">
                      {hasError ? (
                        <span className="text-rose-600 font-medium text-[11px]">
                          {item.errors.join("; ")}
                        </span>
                      ) : (
                        <Badge variant="success" size="sm">Hợp lệ</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
