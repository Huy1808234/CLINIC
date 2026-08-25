"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signInAction } from "@/app/actions/auth-actions";
import {
  Form,
  Input,
  Button,
  Modal,
} from "antd";
import {
  UserOutlined,
  LockOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";

export const LoginForm: React.FC = () => {
  const router = useRouter();
  const [loginUsername, setLoginUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState<boolean>(false);

  const handleSubmit = async () => {
    if (isLoading) return;

    const trimmedUsername = loginUsername.trim().toLowerCase();
    if (!trimmedUsername || !password) {
      setErrorMessage("Tài khoản hoặc mật khẩu không đúng.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await signInAction({
        login_username: trimmedUsername,
        password,
      });

      if (!res.success) {
        setErrorMessage("Tài khoản hoặc mật khẩu không đúng.");
        setIsLoading(false);
        return;
      }

      // Successful authentication -> navigate directly to clinic selection
      router.push("/select-clinic");
      router.refresh();
    } catch {
      setErrorMessage("Hệ thống đăng nhập đang tạm thời không khả dụng. Vui lòng thử lại sau.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-dvh flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-[#f0fdfa] via-[#f8fafc] to-[#f1f5f9] font-sans">
      {/* Decorative CSS-only medical ambiance background */}
      <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] rounded-full bg-teal-100/50 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-[34rem] h-[34rem] rounded-full bg-emerald-100/40 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-[26rem] h-[26rem] rounded-full bg-teal-100/40 blur-3xl pointer-events-none" />

      {/* Abstract subtle decorative medical crosses in background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <svg
          className="absolute top-20 right-28 text-teal-600/10 w-24 h-24 hidden lg:block"
          viewBox="0 0 100 100"
          fill="currentColor"
        >
          <path d="M40 0h20v40h40v20H60v40H40V60H0V40h40z" />
        </svg>
        <svg
          className="absolute bottom-28 left-20 text-teal-600/10 w-28 h-28 hidden md:block"
          viewBox="0 0 100 100"
          fill="currentColor"
        >
          <path d="M40 0h20v40h40v20H60v40H40V60H0V40h40z" />
        </svg>
        <svg
          className="absolute top-1/2 left-28 text-teal-600/5 w-16 h-16 hidden xl:block"
          viewBox="0 0 100 100"
          fill="currentColor"
        >
          <path d="M40 0h20v40h40v20H60v40H40V60H0V40h40z" />
        </svg>
      </div>

      {/* Main Content: Single Logical Container with Brand Header + Login Card */}
      <main className="flex-1 flex flex-col justify-center items-center px-4 py-8 sm:px-6 relative z-10">
        <div className="w-full max-w-[480px]">
          {/* Exactly ONE Branding Block */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="flex items-center gap-3 mb-2">
              {/* Medical Heart & Cross Logo SVG */}
              <div className="w-11 h-11 shrink-0">
                <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
                  <path
                    d="M50 86C50 86 20 66 20 42C20 28 30 18 43 18C48 18 50 21 50 21C50 21 52 18 57 18C70 18 80 28 80 42C80 66 50 86 50 86Z"
                    stroke="#00897b"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="#e0f2f1"
                    fillOpacity="0.6"
                  />
                  <path
                    d="M38 48H44L48 38L52 58L56 48H62"
                    stroke="#00897b"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M62 62C68 58 74 64 74 64C74 64 68 70 62 70C56 70 62 62 62 62Z"
                    fill="#00897b"
                  />
                </svg>
              </div>

              <h1 className="text-2xl sm:text-[26px] font-bold text-[#00695c] tracking-tight leading-tight m-0">
                Thuận Thiên Clinic
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[#00897b] m-0">
              HỆ THỐNG QUẢN LÝ PHÒNG KHÁM
            </p>
          </div>

          {/* Exactly ONE Login Card */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-7 sm:p-9">
            {/* Circular Medical Cross Badge */}
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-full bg-teal-50/80 border border-teal-100/80 shadow-xs flex items-center justify-center">
                <svg viewBox="0 0 100 100" fill="none" className="w-9 h-9">
                  <path
                    d="M40 22h20v18h18v20H60v18H40V60H22V40h18V22z"
                    fill="#00897b"
                  />
                  <path
                    d="M36 50h8l4-8 4 16 4-8h8"
                    stroke="#ffffff"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M58 64c5-3 10 2 10 2s-5 5-10 5c-5 0 0-7 0-7z"
                    fill="#004d40"
                  />
                </svg>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 text-center m-0">
              Đăng Nhập
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 text-center mt-1 mb-6">
              Truy cập hệ thống quản lý phòng khám
            </p>

            {/* Error Alert Box */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-800 text-xs sm:text-sm animate-fade-in">
                <ExclamationCircleOutlined className="text-red-500 text-base shrink-0" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            <Form
              layout="vertical"
              onFinish={handleSubmit}
              requiredMark={false}
              className="space-y-4"
            >
              {/* Username Field */}
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Tài Khoản *
                </label>
                <Input
                  id="login-username"
                  name="login_username"
                  prefix={<UserOutlined className="text-slate-400 mr-2 text-base" />}
                  placeholder="Nhập tên đăng nhập"
                  size="large"
                  autoComplete="username"
                  disabled={isLoading}
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="rounded-lg h-11 text-sm border-slate-200 hover:border-[#00897b] focus:border-[#00897b]"
                />
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Mật Khẩu *
                </label>
                <Input.Password
                  id="login-password"
                  name="password"
                  prefix={<LockOutlined className="text-slate-400 mr-2 text-base" />}
                  placeholder="Nhập mật khẩu"
                  size="large"
                  autoComplete="current-password"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-lg h-11 text-sm border-slate-200 hover:border-[#00897b] focus:border-[#00897b]"
                />
              </div>

              {/* Forgot Password Right-Aligned Link */}
              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-xs text-[#00897b] hover:text-[#00695c] font-medium cursor-pointer transition-colors"
                >
                  Quên mật khẩu?
                </button>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={isLoading}
                  disabled={isLoading}
                  icon={<LockOutlined />}
                  className="w-full h-11 rounded-lg font-bold text-sm bg-[#00897b] hover:bg-[#00796b] text-white shadow-md shadow-teal-900/10 border-none transition-all"
                >
                  Đăng Nhập
                </Button>
              </div>
            </Form>

            {/* Subtle Security Note */}
            <div className="flex items-center justify-center gap-2 text-slate-500 text-xs mt-6 pt-2">
              <SafetyCertificateOutlined className="text-[#00897b] text-base" />
              <span>Truy cập nội bộ. Vui lòng đăng nhập để tiếp tục.</span>
            </div>
          </div>
        </div>
      </main>

      {/* Exactly ONE Minimal Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white/50 backdrop-blur-xs relative z-10">
        <p className="m-0">© 2026 Thuận Thiên Clinic · Hệ thống quản lý phòng khám nội bộ</p>
      </footer>

      {/* Informational Forgot Password Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-900 font-bold">
            <InfoCircleOutlined className="text-[#00897b]" />
            <span>Quên Mật Khẩu</span>
          </div>
        }
        open={isForgotModalOpen}
        onOk={() => setIsForgotModalOpen(false)}
        onCancel={() => setIsForgotModalOpen(false)}
        footer={[
          <Button
            key="ok"
            type="primary"
            onClick={() => setIsForgotModalOpen(false)}
            className="bg-[#00897b] hover:bg-[#00796b]"
          >
            Đã hiểu
          </Button>,
        ]}
        centered
        width={420}
      >
        <p className="text-sm text-slate-600 leading-relaxed pt-2">
          Quên mật khẩu? Vui lòng liên hệ quản trị viên.
        </p>
      </Modal>
    </div>
  );
};
