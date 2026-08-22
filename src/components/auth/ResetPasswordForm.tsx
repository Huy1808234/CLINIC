"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/auth-actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";

interface ResetPasswordFormProps {
  isAuthenticated: boolean;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ isAuthenticated }) => {
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
      const res = await resetPasswordAction({
        password,
        confirm_password: confirmPassword,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Không thể đặt lại mật khẩu.");
        setIsLoading(false);
        return;
      }

      setSuccessMessage(res.message || "Đổi mật khẩu thành công. Đang chuyển hướng về trang đăng nhập...");
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1500);
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error).message || "Đã xảy ra lỗi khi đặt lại mật khẩu. Vui lòng thử lại."
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

        {/* Reset Password Card */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold text-slate-900 text-center">
              Đặt Lại Mật Khẩu
            </CardTitle>
            <p className="text-xs text-slate-600 text-center">
              Vui lòng nhập mật khẩu mới cho tài khoản của bạn.
            </p>
          </CardHeader>

          <CardContent>
            {!isAuthenticated ? (
              <div className="space-y-4">
                <Alert variant="error">
                  Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.
                </Alert>
                <div className="pt-2">
                  <Link href="/auth/forgot-password" className="block w-full">
                    <Button type="button" className="w-full">
                      Yêu Cầu Liên Kết Mới
                    </Button>
                  </Link>
                </div>
                <div className="mt-4 text-center">
                  <Link
                    href="/login"
                    className="text-xs font-medium text-teal-700 hover:text-teal-900 hover:underline"
                  >
                    ← Quay lại trang đăng nhập
                  </Link>
                </div>
              </div>
            ) : (
              <>
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
                      disabled={isLoading || !!successMessage}
                    >
                      Đặt Lại Mật Khẩu
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
