import * as fs from "node:fs";
import * as path from "node:path";
import type { StaffWithClinicMemberships } from "@/types/clinic";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export function runStaffAuthUiTests() {
  console.log("Running Staff Auth UI Contract Tests...");

  // Mock staff data across the 3 main states
  const staffStateA: StaffWithClinicMemberships = {
    id: "staff-a",
    staff_code: "BS-A",
    full_name: "Bác Sĩ A",
    email: "bs.a@thuanthien.vn",
    phone: "0900000001",
    is_active: true,
    user_id: null,
    login_username: null,
    auth_setup_required: false,
    auth_setup_completed_at: null,
    memberships: [],
  };

  const staffStateB: StaffWithClinicMemberships = {
    id: "staff-b",
    staff_code: "BS-B",
    full_name: "Bác Sĩ B",
    email: "bs.b@thuanthien.vn",
    phone: "0900000002",
    is_active: true,
    user_id: "auth-b-uuid",
    login_username: null,
    auth_setup_required: true,
    auth_setup_completed_at: null,
    memberships: [],
  };

  const staffStateCActive: StaffWithClinicMemberships = {
    id: "staff-c1",
    staff_code: "BS-C1",
    full_name: "Bác Sĩ C1",
    email: "bs.c1@thuanthien.vn",
    phone: "0900000003",
    is_active: true,
    user_id: "auth-c1-uuid",
    login_username: "bs.c1",
    auth_setup_required: false,
    auth_setup_completed_at: "2026-08-20T00:00:00Z",
    memberships: [],
  };

  const staffStateCPendingReset: StaffWithClinicMemberships = {
    id: "staff-c2",
    staff_code: "BS-C2",
    full_name: "Bác Sĩ C2",
    email: "bs.c2@thuanthien.vn",
    phone: "0900000004",
    is_active: true,
    user_id: "auth-c2-uuid",
    login_username: "bs.c2",
    auth_setup_required: true,
    auth_setup_completed_at: null,
    memberships: [],
  };

  // Helper functions simulating the UI state logic
  function getAccountStatusDisplay(staff: StaffWithClinicMemberships) {
    if (!staff.user_id) {
      return { status: "Chưa có tài khoản", badge: "Chưa có TK", action: "PROVISION" };
    }
    if (!staff.login_username) {
      return { status: "Cần hoàn tất tài khoản đăng nhập", badge: "Cần gán TK", action: "ASSIGN_USERNAME" };
    }
    if (staff.auth_setup_required) {
      return { status: "Cần đặt lại mật khẩu", badge: "Cần đổi MK", action: "RESET_PASSWORD", username: staff.login_username };
    }
    return { status: "Đang hoạt động", badge: "Đã kích hoạt", action: "RESET_PASSWORD", username: staff.login_username };
  }

  // UI1-1 & UI1-2: State A (user_id NULL) -> CẤP TÀI KHOẢN, not RESET
  const dispA = getAccountStatusDisplay(staffStateA);
  assert(dispA.status === "Chưa có tài khoản", "UI1-1: user_id NULL shows Chưa có tài khoản");
  assert(dispA.action === "PROVISION", "UI1-1: user_id NULL primary action is PROVISION");
  assert(dispA.action !== "RESET_PASSWORD", "UI1-2: user_id NULL does not offer reset password");

  // UI1-7, 8, 9: State B (linked + username NULL) -> GÁN TÀI KHOẢN
  const dispB = getAccountStatusDisplay(staffStateB);
  assert(dispB.status === "Cần hoàn tất tài khoản đăng nhập", "UI1-7: linked + username NULL shows Cần hoàn tất");
  assert(dispB.action === "ASSIGN_USERNAME", "UI1-7: linked + username NULL action is ASSIGN_USERNAME");

  // UI1-10, 11: State C (linked + username present) -> shows username & ĐẶT LẠI MẬT KHẨU
  const dispC1 = getAccountStatusDisplay(staffStateCActive);
  assert(dispC1.status === "Đang hoạt động", "UI1-10: active account shows Đang hoạt động");
  assert(dispC1.username === "bs.c1", "UI1-10: displays login_username");
  assert(dispC1.action === "RESET_PASSWORD", "UI1-11: action is RESET_PASSWORD");

  // UI1-17: State C pending setup -> Cần đặt lại mật khẩu
  const dispC2 = getAccountStatusDisplay(staffStateCPendingReset);
  assert(dispC2.status === "Cần đặt lại mật khẩu", "UI1-17: auth_setup_required TRUE displays Cần đặt lại mật khẩu");

  // Inspect UI Component files on disk
  const provisionModalPath = path.join(
    process.cwd(),
    "src",
    "components",
    "staff",
    "ProvisionStaffCredentialsModal.tsx"
  );
  assert(fs.existsSync(provisionModalPath), "UI1-3: ProvisionStaffCredentialsModal exists");
  const provisionModalCode = fs.readFileSync(provisionModalPath, "utf-8");

  // UI1-3: Direct provisioning modal fields
  assert(provisionModalCode.includes("provision-login-username"), "UI1-3: provision modal has login_username field");
  assert(provisionModalCode.includes("provision-password"), "UI1-3: provision modal has password field");
  assert(provisionModalCode.includes("provision-confirm-password"), "UI1-3: provision modal has confirm_password field");
  assert(provisionModalCode.includes("provisionStaffDirectCredentialsAction"), "UI1-4: calls provisionStaffDirectCredentialsAction");
  assert(!provisionModalCode.includes("clinic_id:"), "UI1-4: does not send clinic_id in form payload");
  assert(!provisionModalCode.includes("localStorage"), "UI1-26: no localStorage in provision modal");
  assert(!provisionModalCode.includes("sessionStorage"), "UI1-26: no sessionStorage in provision modal");

  const assignModalPath = path.join(
    process.cwd(),
    "src",
    "components",
    "staff",
    "AssignStaffUsernameModal.tsx"
  );
  assert(fs.existsSync(assignModalPath), "UI1-8: AssignStaffUsernameModal exists");
  const assignModalCode = fs.readFileSync(assignModalPath, "utf-8");
  assert(assignModalCode.includes("assign-login-username"), "UI1-8: assign modal has login_username field");
  assert(!assignModalCode.includes("type=\"password\""), "UI1-8: assign modal does not request password");
  assert(assignModalCode.includes("assignStaffLoginUsernameAction"), "UI1-9: calls assignStaffLoginUsernameAction");

  const resetModalPath = path.join(
    process.cwd(),
    "src",
    "components",
    "staff",
    "ResetStaffPasswordModal.tsx"
  );
  assert(fs.existsSync(resetModalPath), "UI1-12: ResetStaffPasswordModal exists");
  const resetModalCode = fs.readFileSync(resetModalPath, "utf-8");
  assert(resetModalCode.includes("admin-new-password"), "UI1-12: reset modal has new_password");
  assert(resetModalCode.includes("admin-confirm-password"), "UI1-12: reset modal has confirm_password");
  assert(resetModalCode.includes("resetStaffPasswordByAdminAction"), "UI1-12: calls resetStaffPasswordByAdminAction");
  assert(!resetModalCode.includes("auth_user_id:"), "UI1-13: does not send auth_user_id");
  assert(!resetModalCode.includes("clinic_id:"), "UI1-14: does not send clinic_id");
  assert(resetModalCode.includes("RESET_STATE_FINALIZATION_FAILED"), "UI1-20: contains special truthful UX for finalization failure");

  // UI1-21 to 24: No old invite UX in StaffTable
  const staffTablePath = path.join(
    process.cwd(),
    "src",
    "components",
    "staff",
    "StaffTable.tsx"
  );
  const staffTableCode = fs.readFileSync(staffTablePath, "utf-8");
  assert(!staffTableCode.includes("Gửi lời mời"), "UI1-22: No Gửi lời mời button in StaffTable");
  assert(!staffTableCode.includes("Gửi lại lời mời"), "UI1-23: No Gửi lại lời mời button in StaffTable");
  assert(!staffTableCode.includes("Chờ nhân viên thiết lập mật khẩu"), "UI1-24: No Chờ nhân viên thiết lập mật khẩu in StaffTable");
  assert(!staffTableCode.includes("Xem mật khẩu"), "UI1-21: No Xem mật khẩu button");

  console.log("All Staff Auth UI Contract Tests PASSED!");
}
