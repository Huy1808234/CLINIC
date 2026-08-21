"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { StaffClinicMembershipIdentity } from "@/lib/auth/clinic-resolver";
import { setActiveClinicAction } from "@/app/actions/auth-actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";

interface SelectClinicClientViewProps {
  staffName: string;
  staffCode: string;
  memberships: StaffClinicMembershipIdentity[];
  currentActiveClinicId: string | null;
}

export const SelectClinicClientView: React.FC<SelectClinicClientViewProps> = ({
  staffName,
  staffCode,
  memberships,
  currentActiveClinicId,
}) => {
  const router = useRouter();
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(currentActiveClinicId);
  const [isSubmittingId, setIsSubmittingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectClinic = async (clinicId: string) => {
    setIsSubmittingId(clinicId);
    setErrorMessage(null);

    try {
      const res = await setActiveClinicAction(clinicId);

      if (!res.success) {
        throw new Error(res.error);
      }

      setSelectedClinicId(clinicId);
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error).message || "Không thể thiết lập cơ sở làm việc. Vui lòng tải lại danh sách."
      );
      setIsSubmittingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-teal-600 text-white font-bold text-xl shadow-md mb-4">
            TT
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Thuận Thiên Clinic
          </h1>
          <h2 className="text-base font-semibold text-teal-800 mt-1">
            Chọn Cơ Sở Làm Việc
          </h2>
          <p className="mt-2 text-xs text-slate-600 max-w-md mx-auto">
            Bạn có quyền truy cập nhiều cơ sở phòng khám. Vui lòng chọn cơ sở bạn muốn làm việc trong phiên này.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700">
            <span>Nhân viên: <strong className="text-slate-900">{staffName}</strong></span>
            <span className="text-slate-400">•</span>
            <span>Mã: <code className="font-mono font-bold text-teal-700">{staffCode}</code></span>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6">
            <Alert variant="error">{errorMessage}</Alert>
          </div>
        )}

        {memberships.length === 0 ? (
          <Card className="p-8 text-center border-amber-200 bg-amber-50/50">
            <div className="text-amber-800 font-semibold text-sm mb-2">
              Chưa Được Phân Công Cơ Sở
            </div>
            <p className="text-xs text-amber-700 max-w-md mx-auto">
              Hồ sơ nhân viên của bạn chưa được phân quyền vào bất kỳ cơ sở phòng khám nào đang hoạt động. Vui lòng liên hệ Quản trị viên hệ thống để được cấp quyền truy cập.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {memberships.map((membership) => {
                const isCurrentActive = membership.clinic_id === selectedClinicId;
                const isSubmittingThis = isSubmittingId === membership.clinic_id;

                return (
                  <Card
                    key={membership.membership_id}
                    className={`relative transition-all duration-200 ${
                      isCurrentActive
                        ? "border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/30 shadow-sm"
                        : "hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base font-bold text-slate-900">
                            {membership.clinic_name}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" size="sm">
                              Mã: {membership.clinic_code}
                            </Badge>
                            {membership.is_primary && (
                              <Badge variant="purple" size="sm">
                                Cơ sở chính
                              </Badge>
                            )}
                          </div>
                        </div>

                        {isCurrentActive && (
                          <Badge variant="success" size="sm">
                            Đang sử dụng
                          </Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-2">
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                        <Button
                          variant={isCurrentActive ? "outline" : "primary"}
                          size="sm"
                          isLoading={isSubmittingThis}
                          disabled={isSubmittingId !== null}
                          onClick={() => handleSelectClinic(membership.clinic_id)}
                          className="w-full sm:w-auto"
                        >
                          {isCurrentActive ? "Đang Làm Việc Tại Đây" : "Chọn Cơ Sở Này"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
