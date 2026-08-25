import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

export function runLoginAntdRedesignTests() {
  console.log("Running Login Ant Design Redesign & Security Contract Tests...");

  const loginFormPath = path.join(process.cwd(), "src", "components", "auth", "LoginForm.tsx");
  const loginPagePath = path.join(process.cwd(), "src", "app", "login", "page.tsx");

  assert.equal(fs.existsSync(loginFormPath), true, "LoginForm.tsx exists");
  assert.equal(fs.existsSync(loginPagePath), true, "login/page.tsx exists");

  const formCode = fs.readFileSync(loginFormPath, "utf-8");
  const pageCode = fs.readFileSync(loginPagePath, "utf-8");

  // LOGIN-UI-1 & LOGIN-UI-2: Preserves username and password authentication (LOGIN-FIX-13)
  assert.equal(
    formCode.includes("login_username: trimmedUsername") && formCode.includes("password"),
    true,
    "LoginForm submits canonical login_username and password (LOGIN-UI-1, LOGIN-UI-2, LOGIN-FIX-13)"
  );
  assert.equal(
    formCode.includes("signInAction"),
    true,
    "LoginForm delegates authentication to signInAction"
  );

  // LOGIN-UI-3: Redirects on successful login
  assert.equal(
    formCode.includes('router.push("/select-clinic")'),
    true,
    "LoginForm redirects to /select-clinic upon successful authentication (LOGIN-UI-3)"
  );

  // LOGIN-UI-4 & LOGIN-UI-5: Generic error presentation (LOGIN-FIX-14)
  assert.equal(
    formCode.includes("Tài khoản hoặc mật khẩu không đúng."),
    true,
    "LoginForm displays generic error message to prevent enumeration (LOGIN-UI-4, LOGIN-UI-5, LOGIN-FIX-14)"
  );

  // LOGIN-UI-6: Prevents duplicate submits while loading (LOGIN-FIX-16)
  assert.equal(
    formCode.includes("if (isLoading) return;"),
    true,
    "LoginForm prevents duplicate submission while loading (LOGIN-UI-6, LOGIN-FIX-16)"
  );

  // LOGIN-UI-7 & LOGIN-UI-8: No public registration, no SSO
  assert.equal(
    formCode.includes("Đăng ký") || formCode.includes("Sign up") || formCode.includes("Register"),
    false,
    "No public self-registration on login page (LOGIN-UI-7)"
  );
  assert.equal(
    formCode.includes("Google") || formCode.includes("Microsoft") || formCode.includes("SSO"),
    false,
    "No SSO buttons on login page (LOGIN-UI-8)"
  );

  // LOGIN-UI-9: Informational forgot password (LOGIN-FIX-15)
  assert.equal(
    formCode.includes("Quên mật khẩu?"),
    true,
    "Forgot password link present (LOGIN-UI-9)"
  );
  assert.equal(
    formCode.includes("Quên mật khẩu? Vui lòng liên hệ quản trị viên."),
    true,
    "Forgot password opens truthful informational dialog (LOGIN-UI-9, LOGIN-FIX-15)"
  );
  assert.equal(
    formCode.includes("sendPasswordResetEmail") || formCode.includes("resetPasswordAction"),
    false,
    "No fake self-service reset flow on login page"
  );

  // LOGIN-UI-10: Login page is outside authenticated AppShell
  assert.equal(
    pageCode.includes("AppShell"),
    false,
    "LoginPage does not render AppShell or authenticated staff header (LOGIN-UI-10)"
  );

  // LOGIN-VIS-1: Single Branding instance (LOGIN-FIX-2)
  const brandOccurrences = (formCode.match(/Thuận Thiên Clinic/g) || []).length;
  // 1 in header title, 1 in footer copyright
  assert.equal(
    brandOccurrences <= 2,
    true,
    "Single brand header block and single footer copyright (LOGIN-FIX-2)"
  );

  // LOGIN-VIS-2: Card proportion (LOGIN-FIX-1)
  assert.equal(
    formCode.includes("max-w-[480px]"),
    true,
    "Card maximum width constrained for desktop/mobile proportion (LOGIN-VIS-2, LOGIN-FIX-1)"
  );

  // LOGIN-VIS-3: No feature-list marketing blocks
  assert.equal(
    formCode.includes("Quản lý bệnh nhân") || formCode.includes("Lịch hẹn thông minh") || formCode.includes("Báo cáo & thống kê"),
    false,
    "No feature-list marketing sections on login screen (LOGIN-VIS-3)"
  );

  // LOGIN-VIS-6 & LOGIN-VIS-7: Ant Design Input / Password / Button
  assert.equal(
    formCode.includes("Input.Password"),
    true,
    "Ant Design Input.Password component used (LOGIN-VIS-6)"
  );
  assert.equal(
    formCode.includes("UserOutlined") && formCode.includes("LockOutlined"),
    true,
    "Ant Design icons used for input prefixes (LOGIN-VIS-6)"
  );
  assert.equal(
    formCode.includes("type=\"primary\"") && formCode.includes("htmlType=\"submit\""),
    true,
    "Primary button is visually dominant submit button (LOGIN-VIS-7)"
  );

  // LOGIN-VIS-8: Subtle internal access security note
  assert.equal(
    formCode.includes("Truy cập nội bộ. Vui lòng đăng nhập để tiếp tục."),
    true,
    "Subtle internal access security notice present (LOGIN-VIS-8)"
  );

  // LOGIN-FIX-3: Zero unauthenticated avatars
  assert.equal(
    formCode.includes("rounded-full bg-[#00897b] text-white font-bold text-xs flex items-center justify-center shadow-xs\n          TT") ||
    formCode.includes(">TT</div>") ||
    formCode.includes(">N</div>"),
    false,
    "No unauthenticated avatar badges on login page (LOGIN-FIX-3)"
  );

  // LOGIN-FIX-4 & LOGIN-FIX-5: No baked-in UI bitmap backgrounds
  assert.equal(
    formCode.includes("login-background.png") || formCode.includes("reception-showcase.png"),
    false,
    "No bitmap mockup image used as background (LOGIN-FIX-4, LOGIN-FIX-5)"
  );

  // LOGIN-FIX-6, LOGIN-FIX-7, LOGIN-FIX-8: No fake footer metadata
  assert.equal(
    formCode.includes("Hotline:") || formCode.includes("1900 1234"),
    false,
    "No fake hotline in footer (LOGIN-FIX-6)"
  );
  assert.equal(
    formCode.includes("support@thuanthienclinic.vn"),
    false,
    "No fake support email in footer (LOGIN-FIX-7)"
  );
  assert.equal(
    formCode.includes("Phiên bản 2.0.0"),
    false,
    "No fake version in footer (LOGIN-FIX-8)"
  );

  console.log("All Login Ant Design Redesign Tests PASSED!");
}
