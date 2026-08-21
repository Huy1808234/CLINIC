"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export interface ExcelUploadZoneProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
}

export const ExcelUploadZone: React.FC<ExcelUploadZoneProps> = ({ onFileSelect, isLoading }) => {
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        onFileSelect(file);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
        isDragOver
          ? "border-teal-500 bg-teal-50/50 scale-[0.99]"
          : "border-slate-300 bg-white hover:border-slate-400"
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        accept=".xlsx, .xls"
        className="hidden"
      />

      <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>

      <h3 className="text-base font-semibold text-slate-900">
        Kéo thả tệp Excel dữ liệu phòng khám vào đây
      </h3>
      <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
        Hỗ trợ định dạng .xlsx, .xls bao gồm các sheet Bác Sĩ (Bs Hải, Bs Uyên, Bs Ánh, Bs Quyên) và sheet Theo Dõi Bệnh Nhân.
      </p>

      <div className="mt-6 flex justify-center">
        <Button
          type="button"
          variant="primary"
          isLoading={isLoading}
          onClick={() => fileInputRef.current?.click()}
        >
          Chọn Tệp Từ Máy Tính
        </Button>
      </div>
    </div>
  );
};
