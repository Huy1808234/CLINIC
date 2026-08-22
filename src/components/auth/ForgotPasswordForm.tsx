"use client";

import React, { useState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/auth-actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";

export const ForgotPasswordForm: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await requestPasswordResetAction({
        email: email.trim(),
      });

      if (!res.success) {
        setErrorMessage(res.error || "Không thể gửi yêu cầu đặt lại mật khẩu.");
        setIsLoading(false);
        return;
      }

      setSuccessMessage(res.message || "Yêu cầu đã được gửi.");
      setIsLoading(false);
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error).message || "Đã xảy ra lỗi khi gửi yêu cầu. Vui lòng thử lại."
      );
      setIsLoading(false);
    }
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

        {/* Forgot Password Card */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold text-slate-900 text-center">
              Quên Mật Khẩu
            </CardTitle>
            <p className="text-xs text-slate-600 text-center">
              Nhập email đăng nhập. Nếu tài khoản tồn tại, hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu.
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
                id="forgot-email"
                label="Email Đăng Nhập *"
                type="email"
                placeholder="name@thuanthien.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || !!successMessage}
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full"
                  isLoading={isLoading}
                  disabled={isLoading || !!successMessage}
                >
                  Gửi Liên Kết Đặt Lại Mật Khẩu
                </Button>
              </div>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <Link
                href="/login"
                className="text-xs font-medium text-teal-700 hover:text-teal-900 hover:underline"
              >
                ← Quay lại trang đăng nhập
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
