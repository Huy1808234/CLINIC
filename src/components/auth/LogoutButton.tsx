"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/app/actions/auth-actions";
import { Button } from "@/components/ui/Button";

export interface LogoutButtonProps {
  className?: string;
}

export const LogoutButton: React.FC<LogoutButtonProps> = ({ className = "" }) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogout = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await signOutAction();
      if (!res.success) {
        setErrorMessage(res.error || "Không thể đăng xuất. Vui lòng thử lại.");
        setIsLoading(false);
        return;
      }

      // Success -> navigate to login page via replace to prevent back-button returning to authenticated state
      router.replace("/login");
      router.refresh();
    } catch {
      setErrorMessage("Không thể đăng xuất. Vui lòng thử lại.");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      {errorMessage && (
        <div className="absolute right-0 top-full mt-2 w-64 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 shadow-md z-50">
          <div className="flex items-center justify-between gap-2">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700 font-bold p-0.5 cursor-pointer"
              aria-label="Đóng thông báo"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        isLoading={isLoading}
        disabled={isLoading}
        onClick={handleLogout}
        className={`text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 text-xs ${className}`}
        title="Đăng xuất khỏi hệ thống"
      >
        <svg
          className="w-4 h-4 mr-1.5 text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
        Đăng xuất
      </Button>
    </div>
  );
};
