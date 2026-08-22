import React from "react";
import { redirect } from "next/navigation";
import { requireApplicationAccessContext } from "@/lib/auth/application-access";
import { AuthenticationRequiredError } from "@/lib/auth/auth-resolver";
import { StaffNotLinkedError, StaffInactiveError, AccountSetupRequiredError } from "@/lib/auth/staff-resolver";
import { NoActiveClinicSelectedError } from "@/lib/auth/clinic-context";
import { StaffClinicAccessDeniedError } from "@/lib/auth/role-resolver";
import { StaffNoActiveClinicError } from "@/lib/auth/clinic-resolver";
import { AccessDeniedView } from "@/components/auth/AccessDeniedView";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export interface AppShellProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Server-side application shell that enforces full Application Access Context
 * (authenticated user + active staff + verified active clinic selection).
 *
 * Specific Error Handling:
 * - Password setup required -> redirect to /auth/setup-password
 * - No active clinic / Clinic access denied / Zero active clinics -> redirect to /select-clinic
 * - Staff not linked -> renders AccessDeniedView(code="STAFF_NOT_LINKED") with Logout available
 * - Staff inactive -> renders AccessDeniedView(code="STAFF_INACTIVE") with Logout available
 * - Unauthenticated -> redirect to /login
 * - Unknown errors -> re-thrown to application error boundary
 */
export async function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  try {
    await requireApplicationAccessContext();
  } catch (error: unknown) {
    if (error instanceof AccountSetupRequiredError) {
      redirect("/auth/setup-password");
    }

    if (
      error instanceof NoActiveClinicSelectedError ||
      error instanceof StaffClinicAccessDeniedError ||
      error instanceof StaffNoActiveClinicError
    ) {
      redirect("/select-clinic");
    }

    if (error instanceof StaffNotLinkedError) {
      return <AccessDeniedView code="STAFF_NOT_LINKED" />;
    }

    if (error instanceof StaffInactiveError) {
      return <AccessDeniedView code="STAFF_INACTIVE" />;
    }

    if (error instanceof AuthenticationRequiredError) {
      redirect("/login");
    }

    // Re-throw any unknown or unexpected infrastructure errors
    throw error;
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} subtitle={subtitle} actions={actions} />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
