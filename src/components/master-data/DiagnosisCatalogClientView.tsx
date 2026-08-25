"use client";

import React, { useState, useTransition, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  Button,
  Input,
  Select,
  Tag,
  Dropdown,
  Popconfirm,
  message,
  Tooltip,
  Pagination,
} from "antd";
import type { MenuProps, TableColumnsType } from "antd";
import {
  PlusOutlined,
  FileExcelOutlined,
  SearchOutlined,
  EditOutlined,
  StopOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  MoreOutlined,
  ClearOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  setDiagnosisCatalogActiveAction,
  deleteDiagnosisCatalogEntryAction,
} from "@/app/actions/diagnosis-catalog-actions";
import type { DiagnosisCatalogItem } from "@/types/catalog";
import type { ClinicRoleCode } from "@/types/clinic";
import type { DiagnosisCatalogPageResult } from "@/lib/master-data/diagnosis-catalog-service";
import { DiagnosisModal } from "./DiagnosisModal";
import { DiagnosisExcelImportModal } from "./DiagnosisExcelImportModal";

export interface DiagnosisCatalogClientViewProps {
  pageResult: DiagnosisCatalogPageResult;
  userRoles: ClinicRoleCode[];
}

interface QuickFilterTab {
  key: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export const DiagnosisCatalogClientView: React.FC<DiagnosisCatalogClientViewProps> = ({
  pageResult,
  userRoles,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // URL query params
  const currentSearch = searchParams.get("search") || "";
  const currentCodeSystem = searchParams.get("codeSystem") || "ALL";
  const currentStatus = searchParams.get("status") || "ALL";
  const currentSortBy = searchParams.get("sortBy") || "code";
  const currentSortDir = searchParams.get("sortDirection") || "asc";

  // Local state for debounced search input with standard render-time prop sync
  const [prevSearch, setPrevSearch] = useState<string>(currentSearch);
  const [searchInput, setSearchInput] = useState<string>(currentSearch);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  if (prevSearch !== currentSearch) {
    setPrevSearch(currentSearch);
    setSearchInput(currentSearch);
  }

  // Modal states
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<DiagnosisCatalogItem | null>(null);
  const [isImportModalVisible, setIsImportModalVisible] = useState<boolean>(false);

  const isAdminOrManager = userRoles.includes("ADMIN") || userRoles.includes("MANAGER");

  // Push URL update helper
  const updateUrl = useCallback(
    (updates: Record<string, string | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, val]) => {
        if (val === null || val === "" || (key === "codeSystem" && val === "ALL") || (key === "status" && val === "ALL")) {
          params.delete(key);
        } else {
          params.set(key, String(val));
        }
      });

      startTransition(() => {
        router.replace(`/master-data/diagnoses?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams]
  );

  // Debounced search handler (~300ms)
  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      updateUrl({ search: val.trim() || null, page: 1 });
    }, 300);
  };

  // Filter handlers
  const handleCodeSystemChange = (val: string) => {
    updateUrl({ codeSystem: val, page: 1 });
  };

  const handleStatusChange = (val: string) => {
    updateUrl({ status: val, page: 1 });
  };

  const handlePageChange = (page: number, pageSize: number) => {
    updateUrl({ page, pageSize });
  };

  const handlePageSizeChange = (pageSize: number) => {
    updateUrl({ page: 1, pageSize });
  };

  const handleClearFilters = () => {
    setSearchInput("");
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    updateUrl({
      search: null,
      codeSystem: null,
      status: null,
      page: 1,
    });
  };

  // Actions
  const handleToggleActive = async (record: DiagnosisCatalogItem) => {
    try {
      const nextStatus = !record.is_active;
      const res = await setDiagnosisCatalogActiveAction(record.id, nextStatus);

      if (!res.success) {
        message.error(res.error || "Không thể cập nhật trạng thái.");
        return;
      }

      message.success(
        nextStatus
          ? `Đã kích hoạt lại mã '${record.code}'`
          : `Đã ngừng sử dụng mã '${record.code}'`
      );
      router.refresh();
    } catch {
      message.error("Lỗi khi thay đổi trạng thái.");
    }
  };

  const handleDelete = async (record: DiagnosisCatalogItem) => {
    try {
      const res = await deleteDiagnosisCatalogEntryAction(record.id);
      if (!res.success) {
        message.error(res.error || "Không thể xóa mã bệnh.");
        return;
      }
      message.success(`Đã xóa vĩnh viễn mã bệnh '${record.code}'.`);
      router.refresh();
    } catch {
      message.error("Lỗi khi thực hiện xóa mã bệnh.");
    }
  };

  const hasActiveFilters = Boolean(
    currentSearch || currentCodeSystem !== "ALL" || currentStatus !== "ALL"
  );

  const quickFilterTabs: QuickFilterTab[] = [
    {
      key: "all",
      label: "Tất cả",
      isActive: currentCodeSystem === "ALL" && currentStatus === "ALL",
      onClick: () => updateUrl({ codeSystem: null, status: null, page: 1 }),
    },
    ...pageResult.codeSystems.map((codeSystem) => ({
      key: `system-${codeSystem}`,
      label: codeSystem,
      isActive: currentCodeSystem === codeSystem && currentStatus !== "INACTIVE",
      onClick: () => updateUrl({ codeSystem, status: null, page: 1 }),
    })),
    {
      key: "inactive",
      label: "Đã ngừng sử dụng",
      isActive: currentStatus === "INACTIVE",
      onClick: () => updateUrl({ codeSystem: null, status: "INACTIVE", page: 1 }),
    },
  ];

  const codeSystemOptions = [
    { label: "Hệ thống: Tất cả", value: "ALL" },
    ...pageResult.codeSystems.map((codeSystem) => ({
      label: codeSystem,
      value: codeSystem,
    })),
  ];

  const statusOptions = [
    { label: "Trạng thái: Tất cả", value: "ALL" },
    { label: "Đang sử dụng", value: "ACTIVE" },
    { label: "Ngừng sử dụng", value: "INACTIVE" },
  ];

  const actionColumn: TableColumnsType<DiagnosisCatalogItem>[number] = {
    title: "Thao tác",
    key: "actions",
    width: 92,
    align: "center" as const,
    render: (_: unknown, record: DiagnosisCatalogItem) => {
      const menuItems: MenuProps["items"] = [
        {
          key: "toggle-active",
          icon: record.is_active ? <StopOutlined /> : <CheckCircleOutlined />,
          label: record.is_active ? "Ngừng sử dụng" : "Kích hoạt lại",
          danger: record.is_active,
          onClick: () => handleToggleActive(record),
        },
        {
          type: "divider",
        },
        {
          key: "delete",
          icon: <DeleteOutlined />,
          label: (
            <Popconfirm
              title="Xóa vĩnh viễn mã bệnh này?"
              description="Hệ thống sẽ kiểm tra và chỉ cho phép xóa nếu mã chưa từng được sử dụng trong hồ sơ điều trị."
              onConfirm={() => handleDelete(record)}
              okText="Xóa vĩnh viễn"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <span className="text-rose-600 font-medium">Xóa vĩnh viễn</span>
            </Popconfirm>
          ),
        },
      ];

      return (
        <div className="flex items-center justify-center gap-1">
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingItem(record);
                setIsModalVisible(true);
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-teal-50 hover:text-teal-700"
              aria-label="Chỉnh sửa"
            />
          </Tooltip>
          <Tooltip title="Tác vụ khác">
            <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
              <Button
                type="text"
                size="small"
                icon={<MoreOutlined />}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                aria-label="Tác vụ khác"
              />
            </Dropdown>
          </Tooltip>
        </div>
      );
    },
  };

  const columns: TableColumnsType<DiagnosisCatalogItem> = [
    {
      title: "Mã bệnh",
      dataIndex: "code",
      key: "code",
      width: 140,
      sorter: true,
      sortOrder: currentSortBy === "code" ? (currentSortDir === "asc" ? ("ascend" as const) : ("descend" as const)) : null,
      render: (code: string) => (
        <span className="inline-flex h-6 items-center rounded-md bg-slate-100 px-2 font-mono text-xs font-semibold text-slate-800">
          {code}
        </span>
      ),
    },
    {
      title: "Tên bệnh",
      dataIndex: "name",
      key: "name",
      sorter: true,
      sortOrder: currentSortBy === "name" ? (currentSortDir === "asc" ? ("ascend" as const) : ("descend" as const)) : null,
      render: (name: string, record: DiagnosisCatalogItem) => (
        <div className="space-y-0.5">
          <span className="text-sm font-medium text-slate-800">{name}</span>
          {(record.traditional_code || record.traditional_name) && (
            <div className="text-[11px] text-slate-400">
              YHCT:{" "}
              <span className="font-mono text-slate-600">
                {record.traditional_code ? `[${record.traditional_code}] ` : ""}
                {record.traditional_name || ""}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Hệ thống mã",
      dataIndex: "code_system",
      key: "code_system",
      width: 164,
      render: (codeSystem: string) => (
        <Tag className="m-0 rounded-md border-teal-100 bg-teal-50/70 px-2 py-0.5 font-mono text-[11px] font-medium text-teal-700">
          {codeSystem}
        </Tag>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "is_active",
      key: "is_active",
      width: 144,
      render: (isActive: boolean) =>
        isActive ? (
          <Tag
            className="m-0 rounded-md border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
          >
            ● Đang sử dụng
          </Tag>
        ) : (
          <Tag
            className="m-0 rounded-md border-amber-100 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700"
          >
            ● Ngừng sử dụng
          </Tag>
        ),
    },
    ...(isAdminOrManager ? [actionColumn] : []),
  ];

  return (
    <div className="diagnosis-master-page mx-auto w-full max-w-[1540px] space-y-3">
      <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-bold leading-tight text-slate-900">
            Danh mục mã bệnh
          </h1>
          <p className="mt-1.5 mb-0 text-sm leading-6 text-slate-500">
            Quản lý danh mục mã bệnh sử dụng trong chẩn đoán và chỉ định lâm sàng.
          </p>
        </div>

        {isAdminOrManager && (
          <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
            <Button
              icon={<FileExcelOutlined />}
              onClick={() => setIsImportModalVisible(true)}
              className="h-9 rounded-md border-slate-200 bg-white px-4 text-sm font-medium text-slate-700"
            >
              Nhập từ Excel
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingItem(null);
                setIsModalVisible(true);
              }}
              className="h-9 rounded-md border-0 bg-[#0f766e] px-4 text-sm font-semibold shadow-xs hover:bg-teal-700"
            >
              + Thêm mã bệnh
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-flex min-w-max items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {quickFilterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={tab.onClick}
              className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
                tab.isActive
                  ? "bg-teal-50 text-teal-700 shadow-[inset_0_-1px_0_#0f766e]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="w-full lg:max-w-[48%] lg:flex-[1_1_48%]">
            <Input
              placeholder="Tìm theo mã bệnh, tên bệnh..."
              prefix={<SearchOutlined className="mr-1 text-slate-400" />}
              allowClear
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-10 rounded-md text-sm"
            />
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[210px_180px_auto] lg:w-auto">
            <Select
              value={currentCodeSystem}
              onChange={handleCodeSystemChange}
              className="h-10 w-full text-sm"
              options={codeSystemOptions}
            />
            <Select
              value={currentStatus}
              onChange={handleStatusChange}
              className="h-10 w-full text-sm"
              options={statusOptions}
            />
            <Button
              icon={<ClearOutlined />}
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              className="h-10 rounded-md px-3 text-sm font-medium text-slate-600"
            >
              Xóa bộ lọc
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <p className="m-0 text-sm font-semibold text-slate-800">
              Tổng số: {pageResult.total} mã bệnh
            </p>
            <p className="m-0 text-xs text-slate-500">
              {pageResult.activeCount} mã đang sử dụng
            </p>
          </div>
          <Tooltip title="Làm mới dữ liệu">
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={() => router.refresh()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-teal-700"
              aria-label="Làm mới dữ liệu"
            />
          </Tooltip>
        </div>

        <div className="overflow-x-auto">
          <Table
            className="diagnosis-master-table"
            dataSource={pageResult.items}
            columns={columns}
            rowKey="id"
            loading={isPending}
            size="middle"
            pagination={false}
            scroll={{ x: 820 }}
            onChange={(_pagination, _filters, sorter) => {
            const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
            const newSortBy = singleSorter?.field ? String(singleSorter.field) : "code";
            const newSortDir = singleSorter?.order === "descend" ? "desc" : "asc";

            updateUrl({
              page: 1,
              sortBy: newSortBy,
              sortDirection: newSortDir,
            });
            }}
            locale={{
              emptyText: (
                <div className="py-7 text-center text-sm text-slate-500">
                  Không tìm thấy mã bệnh phù hợp.
                </div>
              ),
            }}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Select
            value={pageResult.pageSize}
            onChange={handlePageSizeChange}
            className="h-9 w-[118px] text-sm"
            options={[
              { label: "10 / trang", value: 10 },
              { label: "20 / trang", value: 20 },
              { label: "50 / trang", value: 50 },
            ]}
          />
          <Pagination
            current={pageResult.page}
            pageSize={pageResult.pageSize}
            total={pageResult.total}
            showSizeChanger={false}
            showQuickJumper={false}
            onChange={handlePageChange}
            className="self-end"
          />
        </div>
      </div>

      {isAdminOrManager && (
        <>
          <DiagnosisModal
            visible={isModalVisible}
            onClose={() => setIsModalVisible(false)}
            onSuccess={() => router.refresh()}
            editingItem={editingItem}
          />

          <DiagnosisExcelImportModal
            visible={isImportModalVisible}
            onClose={() => setIsImportModalVisible(false)}
            onSuccess={() => router.refresh()}
          />
        </>
      )}

      <style jsx global>{`
        .diagnosis-master-table .ant-table {
          font-size: 13px;
        }

        .diagnosis-master-table .ant-table-container {
          border-start-start-radius: 0;
          border-start-end-radius: 0;
        }

        .diagnosis-master-table .ant-table-thead > tr > th {
          background: #f8fafc !important;
          color: #475569 !important;
          font-size: 12px;
          font-weight: 600;
          padding: 10px 12px !important;
          border-bottom-color: #e2e8f0 !important;
        }

        .diagnosis-master-table .ant-table-tbody > tr > td {
          padding: 9px 12px !important;
          border-bottom-color: #f1f5f9 !important;
        }

        .diagnosis-master-table .ant-table-tbody > tr:last-child > td {
          border-bottom: 0 !important;
        }

        .diagnosis-master-table .ant-table-column-sorters {
          padding: 0;
        }

        .diagnosis-master-table .ant-table-cell::before {
          display: none;
        }

        @media (max-width: 640px) {
          .diagnosis-master-page {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
