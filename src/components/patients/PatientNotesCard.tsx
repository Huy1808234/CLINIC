"use client";

import React, { useState, useCallback } from "react";
import { Button, Tag, Drawer, Pagination, Spin, Alert } from "antd";
import {
  FormOutlined,
  PlusOutlined,
  UserOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { SectionCard, SectionCardHeader, EmptyStatePanel } from "./SectionCard";
import { AddClinicalNoteModal } from "./AddClinicalNoteModal";
import { getPatientClinicalNotesPageAction } from "@/app/actions/clinical-notes-actions";
import type { ClinicalNoteItem } from "@/types/patient";
import { DEFAULT_CLINIC_TIMEZONE } from "@/utils/timezone";

export interface PatientNotesCardProps {
  notes?: string | null;
  clinicalNotes?: ClinicalNoteItem[];
  totalNotesCount?: number;
  isDoctor?: boolean;
  patientId?: string;
  patientName?: string;
  patientCode?: string;
  treatmentCourseId?: string | null;
  treatmentCourseNo?: number | null;
  receptionId?: string | null;
  doctorName?: string;
  clinicTimezone?: string;
  onAddNoteSuccess?: (note: ClinicalNoteItem) => void;
}

export const PatientNotesCard: React.FC<PatientNotesCardProps> = ({
  notes,
  clinicalNotes = [],
  totalNotesCount = 0,
  isDoctor = false,
  patientId = "",
  patientName = "",
  patientCode = "",
  treatmentCourseId,
  treatmentCourseNo,
  receptionId,
  doctorName,
  clinicTimezone = DEFAULT_CLINIC_TIMEZONE,
  onAddNoteSuccess,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isViewAllDrawerOpen, setIsViewAllDrawerOpen] = useState<boolean>(false);
  const [addedNotes, setAddedNotes] = useState<ClinicalNoteItem[]>([]);

  // Drawer lazy-loading state
  const [drawerNotes, setDrawerNotes] = useState<ClinicalNoteItem[]>([]);
  const [drawerTotal, setDrawerTotal] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoadingDrawer, setIsLoadingDrawer] = useState<boolean>(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const handleNoteCreated = (newNote: ClinicalNoteItem) => {
    setAddedNotes((prev) => [newNote, ...prev.filter((n) => n.id !== newNote.id)]);
    // If drawer has loaded notes, also prepend to drawer
    setDrawerNotes((prev) => [newNote, ...prev.filter((n) => n.id !== newNote.id)]);
    setDrawerTotal((prev) => prev + 1);
    onAddNoteSuccess?.(newNote);
  };

  const allNotes: ClinicalNoteItem[] = [
    ...addedNotes,
    ...clinicalNotes.filter((n) => !addedNotes.some((a) => a.id === n.id)),
  ];

  const displayedNotes = allNotes.slice(0, 3);
  const totalCount = Math.max(totalNotesCount, allNotes.length, drawerTotal);
  const hasMoreNotes = totalCount > 3;

  const fetchDrawerNotes = useCallback(
    async (page: number) => {
      if (!patientId) return;
      setIsLoadingDrawer(true);
      setDrawerError(null);
      try {
        const res = await getPatientClinicalNotesPageAction({
          patientId,
          page,
          pageSize: 20,
        });

        if (res.success && res.notes) {
          setDrawerNotes(res.notes);
          setDrawerTotal(res.total || 0);
          setCurrentPage(page);
        } else {
          setDrawerError(res.error || "Không thể tải danh sách ghi chú.");
        }
      } catch (err: unknown) {
        console.error("fetchDrawerNotes error:", err);
        setDrawerError("Đã xảy ra lỗi khi tải ghi chú.");
      } finally {
        setIsLoadingDrawer(false);
      }
    },
    [patientId]
  );

  const handleOpenDrawer = () => {
    setIsViewAllDrawerOpen(true);
    fetchDrawerNotes(1);
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat("vi-VN", {
        timeZone: clinicTimezone || DEFAULT_CLINIC_TIMEZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <SectionCard>
        {/* Shared Section Header with Add Note CTA */}
        <SectionCardHeader
          icon={<FormOutlined />}
          title="Ghi chú lâm sàng"
          badge={
            isDoctor && patientId ? (
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setIsAddModalOpen(true)}
                className="bg-[#00897b] hover:bg-teal-700 font-semibold text-xs rounded-lg border-0 shadow-2xs h-7 px-2.5 inline-flex items-center"
              >
                Thêm ghi chú
              </Button>
            ) : undefined
          }
        />

        {/* Card Content */}
        <div className="flex-1 flex flex-col justify-start space-y-3">
          {allNotes.length === 0 ? (
            notes && notes.trim() ? (
              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/70 text-xs text-slate-700 leading-relaxed italic">
                <span className="text-[10px] font-semibold text-slate-400 uppercase block not-italic mb-1">
                  Ghi chú tiếp nhận
                </span>
                {notes}
              </div>
            ) : (
              <EmptyStatePanel
                icon={<FormOutlined />}
                message="Chưa có ghi chú lâm sàng bổ sung."
              />
            )
          ) : (
            <div className="space-y-3">
              {displayedNotes.map((note, index) => (
                <div
                  key={note.id}
                  className={`space-y-1.5 ${
                    index > 0 ? "pt-3 border-t border-slate-100" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserOutlined className="text-teal-600 text-xs shrink-0" />
                      <span className="font-bold text-slate-800 truncate text-[12px]">
                        {note.author_name.startsWith("BS")
                          ? note.author_name
                          : `BS ${note.author_name}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-slate-400">
                      <CalendarOutlined className="text-[10px]" />
                      <span className="font-mono">{formatTimestamp(note.created_at)}</span>
                    </div>
                  </div>

                  {note.course_no && (
                    <div>
                      <Tag
                        color="cyan"
                        className="m-0 text-[10px] font-medium px-1.5 py-0 rounded border-teal-200 text-teal-800 bg-teal-50"
                      >
                        Liệu trình {note.course_no}
                      </Tag>
                    </div>
                  )}

                  <p className="text-xs text-slate-700 leading-relaxed m-0 whitespace-pre-wrap bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                    {note.content}
                  </p>
                </div>
              ))}

              {hasMoreNotes && (
                <div className="pt-2 text-center border-t border-slate-100">
                  <Button
                    type="link"
                    size="small"
                    onClick={handleOpenDrawer}
                    className="text-xs text-[#00897b] font-semibold hover:text-teal-800 p-0"
                  >
                    Xem tất cả ghi chú ({totalCount})
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Add Note Modal */}
      {isDoctor && patientId && (
        <AddClinicalNoteModal
          open={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={handleNoteCreated}
          patientId={patientId}
          patientName={patientName}
          patientCode={patientCode}
          treatmentCourseId={treatmentCourseId}
          treatmentCourseNo={treatmentCourseNo}
          receptionId={receptionId}
          doctorName={doctorName}
          clinicTimezone={clinicTimezone}
        />
      )}

      {/* View All Notes Drawer (On-demand paginated history) */}
      <Drawer
        title={
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <FormOutlined className="text-[#00897b]" />
            <span>Toàn bộ ghi chú lâm sàng ({drawerTotal || totalCount})</span>
          </div>
        }
        placement="right"
        size={500}
        open={isViewAllDrawerOpen}
        onClose={() => setIsViewAllDrawerOpen(false)}
      >
        <div className="space-y-4 flex flex-col h-full">
          {isLoadingDrawer ? (
            <div className="py-12 text-center">
              <Spin tip="Đang tải danh sách ghi chú..." />
            </div>
          ) : drawerError ? (
            <Alert type="error" title={drawerError} showIcon />
          ) : drawerNotes.length === 0 ? (
            <div className="text-center text-xs text-slate-400 py-8 italic">
              Không có ghi chú nào.
            </div>
          ) : (
            <>
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                {drawerNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <UserOutlined className="text-teal-600" />
                        <span className="font-bold text-slate-800">
                          {note.author_name.startsWith("BS")
                            ? note.author_name
                            : `BS ${note.author_name}`}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">
                        {formatTimestamp(note.created_at)}
                      </span>
                    </div>

                    {note.course_no && (
                      <div>
                        <Tag color="cyan" className="m-0 text-[10px] font-medium px-1.5 py-0 rounded">
                          Liệu trình {note.course_no}
                        </Tag>
                      </div>
                    )}

                    <p className="text-xs text-slate-700 leading-relaxed m-0 whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>

              {drawerTotal > 20 && (
                <div className="pt-3 border-t border-slate-200 flex justify-center shrink-0">
                  <Pagination
                    size="small"
                    current={currentPage}
                    total={drawerTotal}
                    pageSize={20}
                    onChange={(page) => fetchDrawerNotes(page)}
                    showSizeChanger={false}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Drawer>
    </>
  );
};
