"use client";

import React, { useState } from "react";
import {
  Modal,
  Upload,
  Button,
  Table,
  Tag,
  Alert,
  message,
  Tabs,
  Spin,
} from "antd";
import {
  InboxOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import {
  previewExcelDiagnosisImportAction,
  importDiagnosisCatalogAction,
} from "@/app/actions/diagnosis-catalog-actions";
import type {
  DiagnosisImportRowItem,
  DiagnosisImportPreviewResult,
  DiagnosisImportValidationResultItem,
} from "@/lib/master-data/diagnosis-catalog-service";

const { Dragger } = Upload;

export interface DiagnosisExcelImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DiagnosisExcelImportModal: React.FC<DiagnosisExcelImportModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<DiagnosisImportPreviewResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("ALL");

  const resetState = () => {
    setCurrentStep(1);
    setFileName("");
    setLoading(false);
    setImporting(false);
    setPreviewData(null);
    setErrorMessage(null);
    setActiveTab("ALL");
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      message.error("Vui lòng tải lên file Excel (.xlsx hoặc .xls).");
      return false;
    }

    setLoading(true);
    setErrorMessage(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "array" });

      if (workbook.SheetNames.length === 0) {
        throw new Error("File Excel không có dữ liệu.");
      }

      // Read first sheet
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<DiagnosisImportRowItem>(firstSheet, {
        defval: "",
        raw: false,
      });

      if (rawRows.length === 0) {
        throw new Error("Sheet đầu tiên không chứa hàng dữ liệu nào.");
      }

      const res = await previewExcelDiagnosisImportAction(rawRows);
      if (!res.success || !res.data) {
        throw new Error(res.error || "Không thể kiểm tra file Excel.");
      }

      setPreviewData(res.data);
      setCurrentStep(2);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Lỗi khi đọc file Excel.");
    } finally {
      setLoading(false);
    }

    return false; // Prevent default upload POST
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;

    // Filter only valid NEW items to insert
    const validItemsToInsert = previewData.items
      .filter((i) => i.status === "NEW")
      .map((i) => ({
        code_system: i.code_system,
        code: i.code,
        name: i.name,
        is_active: true,
      }));

    if (validItemsToInsert.length === 0) {
      message.warning("Không có bản ghi 'Mới' nào để nhập.");
      return;
    }

    setImporting(true);
    setErrorMessage(null);

    try {
      const res = await importDiagnosisCatalogAction(validItemsToInsert);
      if (!res.success || !res.data) {
        throw new Error(res.error || "Không thể nhập dữ liệu vào hệ thống.");
      }

      message.success(res.data.message);
      onSuccess();
      handleClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Lỗi khi nhập dữ liệu.");
    } finally {
      setImporting(false);
    }
  };

  const getFilteredItems = (): DiagnosisImportValidationResultItem[] => {
    if (!previewData) return [];
    if (activeTab === "ALL") return previewData.items;
    return previewData.items.filter((item) => item.status === activeTab);
  };

  const columns = [
    {
      title: "STT",
      dataIndex: "row_index",
      key: "row_index",
      width: 60,
      render: (v: number) => <span className="font-mono text-xs text-slate-500">{v}</span>,
    },
    {
      title: "Hệ thống mã",
      dataIndex: "code_system",
      key: "code_system",
      width: 120,
      render: (v: string) => <Tag className="m-0 font-mono text-[11px]">{v}</Tag>,
    },
    {
      title: "Mã bệnh",
      dataIndex: "code",
      key: "code",
      width: 120,
      render: (v: string) => <span className="font-mono font-bold text-slate-900 text-xs">{v}</span>,
    },
    {
      title: "Tên bệnh / Chẩn đoán",
      dataIndex: "name",
      key: "name",
      render: (v: string, record: DiagnosisImportValidationResultItem) => (
        <div className="text-xs">
          <span className="font-medium text-slate-800">{v}</span>
          {record.existing_name && (
            <div className="text-[11px] text-amber-700 mt-0.5">
              CSDL hiện tại: <span className="font-normal">{record.existing_name}</span>
            </div>
          )}
          {record.error_message && (
            <div className="text-[11px] text-rose-600 mt-0.5">{record.error_message}</div>
          )}
        </div>
      ),
    },
    {
      title: "Kết quả kiểm tra",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: string) => {
        switch (status) {
          case "NEW":
            return (
              <Tag color="success" icon={<CheckCircleOutlined />} className="m-0 text-xs font-semibold">
                Mới
              </Tag>
            );
          case "EXISTING":
            return (
              <Tag color="default" icon={<InfoCircleOutlined />} className="m-0 text-xs">
                Đã tồn tại
              </Tag>
            );
          case "CONFLICT":
            return (
              <Tag color="warning" icon={<WarningOutlined />} className="m-0 text-xs font-semibold">
                Xung đột
              </Tag>
            );
          case "ERROR":
            return (
              <Tag color="error" icon={<CloseCircleOutlined />} className="m-0 text-xs font-semibold">
                Lỗi
              </Tag>
            );
          default:
            return <Tag className="m-0 text-xs">{status}</Tag>;
        }
      },
    },
  ];

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <FileExcelOutlined className="text-lg text-teal-600" />
          <span className="text-base font-bold text-slate-900">Nhập từ Excel</span>
        </div>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      destroyOnClose
      width={800}
    >
      <div className="pt-3 space-y-4">
        {errorMessage && (
          <Alert message={errorMessage} type="error" showIcon closable className="text-xs" />
        )}

        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <div
            className={`px-4 py-3 text-xs font-semibold ${
              currentStep === 1 ? "bg-teal-50 text-teal-700" : "text-slate-500"
            }`}
          >
            1. Chọn tệp
          </div>
          <div
            className={`border-l border-slate-200 px-4 py-3 text-xs font-semibold ${
              currentStep === 2 ? "bg-teal-50 text-teal-700" : "text-slate-500"
            }`}
          >
            2. Kiểm tra & nhập
          </div>
        </div>

        {/* STEP 1: UPLOAD */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <Dragger
              name="file"
              multiple={false}
              showUploadList={false}
              beforeUpload={handleFileUpload}
              accept=".xlsx,.xls"
              disabled={loading}
              className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 hover:border-teal-500"
            >
              {loading ? (
                <div className="py-8 space-y-3">
                  <Spin size="large" />
                  <p className="text-sm font-medium text-slate-600 m-0">
                    Đang phân tích và kiểm tra file Excel...
                  </p>
                </div>
              ) : (
                <div className="py-4 space-y-2">
                  <p className="ant-upload-drag-icon text-teal-600 text-4xl m-0">
                    <InboxOutlined />
                  </p>
                  <p className="text-sm font-semibold text-slate-800 m-0">
                    Nhấp hoặc kéo thả file Excel vào đây để tải lên
                  </p>
                  <p className="text-xs text-slate-400 m-0">
                    Hỗ trợ định dạng .xlsx, .xls. Cột bắt buộc: <strong>Mã bệnh</strong>, <strong>Tên bệnh</strong> (tùy chọn: Hệ thống mã).
                  </p>
                </div>
              )}
            </Dragger>

            <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-700 block">Quy tắc nhập dữ liệu:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-500 m-0">
                <li>Các mã bệnh chưa có trong hệ thống sẽ được đánh dấu là <strong>Mới</strong> và sẵn sàng nhập.</li>
                <li>Các mã đã có tên giống trong hệ thống sẽ được đánh dấu <strong>Đã tồn tại</strong> và bỏ qua để tránh trùng lặp.</li>
                <li>Các mã bị xung đột tên hoặc thiếu dữ liệu sẽ được thông báo rõ ràng trước khi xác nhận.</li>
              </ul>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & CONFIRM */}
        {currentStep === 2 && previewData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
              <span>Tệp đã chọn: <strong className="text-slate-800">{fileName}</strong></span>
              <span>Tổng số: {previewData.total_rows} dòng</span>
            </div>

            {/* Summary badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-3 text-center">
                <span className="text-[11px] text-teal-700 font-medium block">Mới (Sẽ nhập)</span>
                <span className="text-lg font-bold text-teal-900 font-mono">
                  {previewData.new_count}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-100 p-3 text-center">
                <span className="text-[11px] text-slate-600 font-medium block">Đã tồn tại</span>
                <span className="text-lg font-bold text-slate-800 font-mono">
                  {previewData.existing_count}
                </span>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                <span className="text-[11px] text-amber-700 font-medium block">Xung đột</span>
                <span className="text-lg font-bold text-amber-900 font-mono">
                  {previewData.conflict_count}
                </span>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center">
                <span className="text-[11px] text-rose-700 font-medium block">Lỗi</span>
                <span className="text-lg font-bold text-rose-900 font-mono">
                  {previewData.error_count}
                </span>
              </div>
            </div>

            {/* Filter Tabs */}
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              size="small"
              items={[
                { key: "ALL", label: `Tất cả (${previewData.total_rows})` },
                { key: "NEW", label: `Mới (${previewData.new_count})` },
                { key: "EXISTING", label: `Đã tồn tại (${previewData.existing_count})` },
                { key: "CONFLICT", label: `Xung đột (${previewData.conflict_count})` },
                { key: "ERROR", label: `Lỗi (${previewData.error_count})` },
              ]}
            />

            {/* Table */}
            <Table
              dataSource={getFilteredItems()}
              columns={columns}
              rowKey="row_index"
              size="small"
              pagination={{ pageSize: 8, showSizeChanger: false }}
              scroll={{ y: 280 }}
            />

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <Button onClick={() => setCurrentStep(1)} disabled={importing}>
                Chọn file khác
              </Button>
              <div className="flex items-center gap-2">
                <Button onClick={handleClose} disabled={importing}>
                  Hủy
                </Button>
                <Button
                  type="primary"
                  onClick={handleConfirmImport}
                  loading={importing}
                  disabled={previewData.new_count === 0}
                  className="bg-[#00897b] hover:bg-teal-700 font-medium"
                >
                  Xác nhận nhập ({previewData.new_count} mã mới)
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
