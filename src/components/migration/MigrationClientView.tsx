"use client";

import React, { useState } from "react";
import type { ImportBatchSummary } from "@/rsc-data/migration/get-batches";
import type { MigrationValidationReport } from "@/types/migration";
import { ExcelUploadZone } from "./ExcelUploadZone";
import { MigrationPreviewTable } from "./MigrationPreviewTable";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { processMigrationAction } from "@/app/actions/migration-actions";

export interface MigrationClientViewProps {
  initialBatches: ImportBatchSummary[];
}

export const MigrationClientView: React.FC<MigrationClientViewProps> = ({ initialBatches }) => {
  const [batches] = useState<ImportBatchSummary[]>(initialBatches);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [validationReport, setValidationReport] = useState<MigrationValidationReport | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setIsLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("isDryRun", "true");

      const res = await processMigrationAction(formData);

      if (!res.success) {
        throw new Error(res.error);
      }

      if (res.data?.report) {
        setValidationReport(res.data.report);
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Không thể phân tích tệp Excel.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!selectedFile || !validationReport) return;
    setIsCommitting(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("isDryRun", "false");

      const res = await processMigrationAction(formData);

      if (!res.success) {
        throw new Error(res.error);
      }

      const commit = res.data?.commitResult;
      setSuccessMsg(
        `Đã nhập thành công ${commit?.committed_patients || validationReport.valid_rows} hồ sơ bệnh nhân (${commit?.reused_patients || 0} hồ sơ trùng khớp) và ${commit?.committed_appointments || validationReport.total_appointments_count} buổi hẹn vào cơ sở dữ liệu Supabase!`
      );
      setValidationReport(null);
      setSelectedFile(null);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Đã xảy ra lỗi khi nạp dữ liệu vào hệ thống.");
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {successMsg && <Alert variant="success">{successMsg}</Alert>}
      {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

      {/* Upload Zone or Preview Table */}
      {!validationReport ? (
        <div className="space-y-4">
          <ExcelUploadZone onFileSelect={handleFileSelect} isLoading={isLoading} />

          {/* Historical Batches Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden mt-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Lịch Sử Nhập Dữ Liệu Excel ({batches.length} đợt)
              </h3>
            </div>

            {batches.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Chưa có đợt nhập dữ liệu nào được thực hiện.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Tên Tệp</th>
                      <th className="py-3 px-4">Thời Gian Nhập</th>
                      <th className="py-3 px-4">Trạng Thái</th>
                      <th className="py-3 px-4 text-center">Tổng Dòng</th>
                      <th className="py-3 px-4 text-center">Hợp Lệ</th>
                      <th className="py-3 px-4 text-center">Lỗi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {batches.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900">{b.file_name}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {new Date(b.started_at).toLocaleString("vi-VN")}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={b.status === "COMPLETED" ? "success" : "warning"}>
                            {b.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium">{b.total_rows}</td>
                        <td className="py-3 px-4 text-center font-mono text-emerald-700 font-semibold">
                          {b.valid_rows}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-rose-700 font-semibold">
                          {b.error_rows}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <MigrationPreviewTable
          report={validationReport}
          onCommit={handleCommit}
          onCancel={() => {
            setValidationReport(null);
            setSelectedFile(null);
          }}
          isCommitting={isCommitting}
        />
      )}
    </div>
  );
};
