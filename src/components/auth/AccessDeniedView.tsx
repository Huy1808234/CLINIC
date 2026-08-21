import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { LogoutButton } from "./LogoutButton";

export interface AccessDeniedViewProps {
  code: "STAFF_NOT_LINKED" | "STAFF_INACTIVE";
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({ code }) => {
  const isUnlinked = code === "STAFF_NOT_LINKED";

  const title = isUnlinked
    ? "Tài Khoản Chưa Được Liên Kết"
    : "Tài Khoản Nhân Viên Ngừng Hoạt Động";

  const message = isUnlinked
    ? "Tài khoản đăng nhập của bạn chưa được liên kết với bất kỳ hồ sơ nhân viên nào trong hệ thống. Vui lòng liên hệ Quản trị viên để được cấp quyền truy cập."
    : "Hồ sơ nhân viên của bạn hiện đang ở trạng thái ngừng hoạt động hoặc đã bị khóa. Vui lòng liên hệ Quản trị viên để được hỗ trợ.";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-amber-600 text-white font-bold text-2xl shadow-md mb-4">
            TT
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Thuận Thiên Clinic
          </h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-1">
            Thông Báo Quyền Truy Cập
          </p>
        </div>

        <Card className="shadow-sm border-amber-200 bg-white">
          <CardHeader className="p-6 pb-3 text-center border-b border-slate-100">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <CardTitle className="text-base font-bold text-slate-900">
              {title}
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6 space-y-6 text-center">
            <p className="text-xs text-slate-600 leading-relaxed">
              {message}
            </p>

            <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-3">
              <LogoutButton />
              <p className="text-[11px] text-slate-400">
                Đăng xuất để chuyển sang tài khoản khác.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
