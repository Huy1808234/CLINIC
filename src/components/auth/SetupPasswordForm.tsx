"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { setupStaffPasswordAction, signOutAction } from "@/app/actions/auth-actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";

export const SetupPasswordForm: React.FC = () => {
  const router = useRouter();
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (password.length < 6) {
      setErrorMessage("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await setupStaffPasswordAction({
        password,
        confirm_password: confirmPassword,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Lỗi thiết lập mật khẩu.");
        setIsLoading(false);
        return;
      }

      setSuccessMessage(res.message || "Thiết lập mật khẩu thành công!");
      setTimeout(() => {
        router.push("/select-clinic");
        router.refresh();
      }, 1500);
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error).message || "Đã xảy ra lỗi trong quá trình thiết lập mật khẩu. Vui lòng thử lại."
      );
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutAction();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-teal-600 text-white font-bold text-2xl shadow-md mb-4">
            TT
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Thuận Thiên Clinic
          </h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-800 mt-1">
            Hệ Thống Quản Lý Phòng Khám
          </p>
        </div>

        {/* Setup Card */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold text-slate-900 text-center">
              Thiết Lập Mật Khẩu
            </CardTitle>
            <p className="text-xs text-slate-600 text-center">
              Tài khoản nhân viên của bạn đã được cấp. Vui lòng tạo mật khẩu riêng để bắt đầu sử dụng hệ thống.
            </p>
          </CardHeader>

          <CardContent>
            {errorMessage && (
              <Alert variant="error" className="mb-4">
                {errorMessage}
              </Alert>
            )}

            {successMessage && (
              <Alert variant="success" className="mb-4">
                {successMessage}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Mật Khẩu Mới *"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading || !!successMessage}
              />

              <Input
                label="Xác Nhận Mật Khẩu *"
                type="password"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading || !!successMessage}
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full"
                  isLoading={isLoading}
                  disabled={!!successMessage}
                >
                  Hoàn Tất Thiết Lập
                </Button>
              </div>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Đăng nhập tài khoản khác?</span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-teal-700 hover:text-teal-900 font-semibold underline underline-offset-2"
              >
                Đăng Xuất
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
