# THUẬN THIÊN — MULTI-CLINIC CLINIC MANAGEMENT, MASTER DATA, RECEPTION, SCHEDULING & BHXH ARCHITECTURE

**Phiên bản:** V3.0  
**Vai trò tài liệu:** Tech Lead / System Design / Implementation Specification  
**Mục tiêu:** Thiết kế hệ thống quản lý Thuận Thiên theo kiến trúc nhiều cơ sở, có quản trị nhân viên và danh mục tập trung, tách rõ tiếp nhận với chẩn đoán/chỉ định, chuẩn bị an toàn cho tích hợp BHXH theo từng cơ sở, đồng thời thay thế quy trình Excel bằng dữ liệu chuẩn hóa.  
**Stack mục tiêu:** Next.js + TypeScript + Supabase/PostgreSQL.  
**Nguồn nghiệp vụ gốc:**

1. `01. FILE QUẢN LÝ KHÁCH HÀNG TRUYỀN THỐNG - THUẬN THIÊN ...xlsm`
2. `BẢNG GIỜ THÁNG 8 THUẬN THIÊN ...xlsx`
3. `THUAN_THIEN_RECEPTION_SCHEDULING_TECHLEAD_SPEC_V1.md`
4. Yêu cầu multi-clinic: Thuận Thiên có nhiều phòng khám; mỗi cơ sở có nhiều nhân viên; mỗi cơ sở có tài khoản/tên đăng nhập tích hợp BHXH riêng.
5. Yêu cầu Master Data: Admin quản lý Nhân viên, Lý do khám, Chẩn đoán, DVKT và tài nguyên; màn hình nghiệp vụ chỉ search/select, không hardcode.
6. Yêu cầu phân tách workflow: Tiếp nhận của lễ tân không đồng nghĩa với chẩn đoán/chỉ định của bác sĩ.

---

# 0. Executive Decision — Các quyết định kiến trúc mới so với V1

V1 đã đúng ở phần lõi nghiệp vụ:

```text
Patient
→ Reception
→ Treatment Course
→ Diagnosis + Service Orders
→ Appointment
→ Treatment Session
→ Follow-up
```

V3 giữ nguyên mô hình lõi đó nhưng thêm **hai lớp bắt buộc phía trên**:

```text
ORGANIZATION
    ↓
CLINIC
    ↓
OPERATIONAL DATA
```

Mô hình toàn hệ thống trở thành:

```text
THUẬN THIÊN (Organization)
        │
        ├── Clinic 1
        ├── Clinic 2
        ├── Clinic 3
        ├── ...
        └── Clinic N

Shared Patient Master (organization-wide)
        │
        ├── Reception @ Clinic 1
        │      └── Treatment Course
        │             └── Appointments
        │
        └── Reception @ Clinic 4
               └── Treatment Course
                      └── Appointments
```

Các quyết định Tech Lead mới:

1. **Số 6 không được hardcode.** Sáu phòng khám chỉ là dữ liệu hiện tại.
2. `Clinic` là một workspace/cơ sở vận hành, không phải một user account.
3. Mỗi nhân viên phải là một `staff` duy nhất; một nhân viên có thể làm nhiều cơ sở.
4. Quyền của nhân viên có thể khác nhau theo từng cơ sở.
5. Tài khoản login hệ thống của con người nằm trong `auth.users` và liên kết với `staff`.
6. Tài khoản BHXH/tài khoản cổng ngoài của phòng khám là **integration credential**, tuyệt đối không dùng làm tài khoản login hệ thống.
7. Patient Master dùng chung trong Organization để tránh bệnh nhân bị nhân bản giữa 6 cơ sở.
8. Reception, Treatment Course, Appointment, Resource, Shift, Follow-up là dữ liệu vận hành theo `clinic_id`.
9. Schedule của một clinic chỉ được dùng staff/resource/config của chính clinic đó.
10. RLS phải kiểm tra `user → staff → clinic membership → role/permission`.
11. Tài khoản/secret BHXH không được lưu plaintext trong client hoặc bảng nghiệp vụ thông thường.
12. Antigravity không được implement toàn bộ V3 trong một lượt. Mỗi Goal nhỏ phải có Goal Lock và STOP sau khi hoàn thành.
13. `Staff`, `Visit Reason`, `Diagnosis`, `Service/DVKT`, `Resource` là **Master Data** có module quản trị; không hardcode hoặc nhập tự do làm nguồn dữ liệu chuẩn.
14. Receptionist chịu trách nhiệm **Patient + Reception + lý do đến khám + bác sĩ khám ban đầu**; Doctor chịu trách nhiệm **Diagnosis + DVKT + treatment plan** theo quyền.
15. Lý do khám dùng mô hình hybrid: catalog chuẩn + ghi chú triệu chứng tự do; một reception có thể có nhiều lý do.
16. Chẩn đoán là dữ liệu lâm sàng, khác với lý do khám; không dùng text lễ tân nhập làm diagnosis chuẩn.
17. Master Data thông thường không hard-delete; dùng `is_active` để bảo toàn lịch sử.
18. UI quản trị dùng Ant Design nhất quán: Staff/DVKT phức tạp dùng Drawer; catalog nhỏ dùng Modal; hành động ngưng sử dụng có confirm.
19. Mọi operational selector chỉ hiển thị record active và đúng organization/clinic scope.
20. Catalog có thể organization-wide, còn availability/override có thể clinic-specific; không nhân bản catalog 6 lần.

---

# 1. Bốn loại danh tính phải tách riêng

Đây là quyết định quan trọng nhất của V3.

```text
1. ORGANIZATION / CLINIC
   = cơ cấu doanh nghiệp và địa điểm vận hành

2. AUTH USER
   = danh tính đăng nhập vào hệ thống Thuận Thiên

3. STAFF
   = hồ sơ con người/nhân viên trong phòng khám

4. EXTERNAL INTEGRATION ACCOUNT
   = tài khoản do BHXH/HIS/provider bên ngoài cấp cho từng phòng khám
```

Không được gộp chúng lại.

## 1.1. Sai nếu làm một account chung cho mọi thứ

Không thiết kế:

```text
clinic1 / password
     ↓
nhân viên dùng chung
     ↓
đồng thời dùng credential đó để BHXH
```

Vì sẽ gây:

- Không audit được ai đã sửa bệnh nhân/lịch.
- Khó thu hồi quyền khi một nhân viên nghỉ.
- Password bị chia sẻ.
- BHXH credential có nguy cơ lộ ra frontend.
- Không hỗ trợ một bác sĩ làm nhiều clinic.
- Không thể phân quyền chính xác.

## 1.2. Đúng phải là

```text
auth.users
    ↓ 1:1 / 0:1
staff
    ↓ N:N
staff_clinic_memberships
    ↓ 1:N
staff_clinic_roles
```

Song song:

```text
clinics
   ↓
clinic_integrations
   ↓
credential_secret_reference
```

Hai nhánh độc lập:

```text
Human Login Identity
≠
BHXH External Credential
```

---

# 2. Organization và Clinic

## 2.1. `organizations`

Hiện tại chỉ có một organization:

```text
THUAN_THIEN
```

Nhưng vẫn nên có table để kiến trúc rõ ràng và tránh gắn toàn hệ thống vào một constant.

Schema đề nghị:

```text
organizations
-----------------------------------------
id uuid PK default gen_random_uuid()
code text NOT NULL
name text NOT NULL
is_active boolean NOT NULL default true
created_at timestamptz NOT NULL
updated_at timestamptz NOT NULL
```

Constraint:

```text
UNIQUE(code)
```

## 2.2. `clinics`

Mỗi cơ sở là một row.

```text
clinics
-----------------------------------------
id uuid PK
organization_id uuid NOT NULL FK organizations
clinic_code text NOT NULL
name text NOT NULL
short_name text nullable
facility_code text nullable
address text nullable
phone text nullable
timezone text NOT NULL default 'Asia/Ho_Chi_Minh'
is_active boolean NOT NULL default true
created_at timestamptz
updated_at timestamptz
```

Constraint:

```text
UNIQUE(organization_id, clinic_code)
```

Không dùng:

```text
clinic_1
clinic_2
...
clinic_6
```

Không dùng:

```ts
const CLINICS = ["PK1", "PK2", ... "PK6"];
```

Số cơ sở phải là data-driven.

## 2.3. Clinic là workspace

Mỗi Clinic sở hữu/scopes:

```text
Reception
Treatment Course
Appointment
Treatment Session
Staff Shift
Resource
Resource Group
Scheduling Settings
Follow-up
Integration Account
Operational Dashboard
```

Patient Master không thuộc độc quyền một clinic.

---

# 3. Staff / Auth / Membership / Role

## 3.1. `auth.users`

Supabase Auth chịu trách nhiệm:

- Email/password.
- Session.
- Password reset/invite.
- User identity.

Không lưu plaintext password ở bất kỳ application table nào.

## 3.2. `staff`

`staff` là Employee Master của Organization.

```text
staff
-----------------------------------------
id uuid PK
organization_id uuid NOT NULL
user_id uuid nullable FK auth.users
staff_code text NOT NULL
full_name text NOT NULL
email text nullable
phone text nullable
professional_title text nullable
license_number text nullable
is_active boolean NOT NULL default true
created_at timestamptz
updated_at timestamptz
created_by uuid nullable
updated_by uuid nullable
```

Recommended constraints:

```text
UNIQUE(organization_id, staff_code)
UNIQUE(user_id) WHERE user_id IS NOT NULL
```

Không dùng `staff.clinic_id` làm source of truth.

Không dùng `staff.role_type` làm source of truth cho multi-clinic role.

Nếu V1/code hiện tại đã có các cột này thì migration phải backward-safe: giữ tạm, backfill dữ liệu sang membership/role mới, chuyển callers, rồi mới deprecate trong Goal riêng.

## 3.3. `staff_clinic_memberships`

Biểu diễn nhân viên làm ở clinic nào.

```text
staff_clinic_memberships
-----------------------------------------
id uuid PK
staff_id uuid NOT NULL FK staff
clinic_id uuid NOT NULL FK clinics
is_primary boolean NOT NULL default false
is_active boolean NOT NULL default true
joined_at timestamptz nullable
left_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

Constraint:

```text
UNIQUE(staff_id, clinic_id)
```

Ví dụ:

```text
BS Hùng
├── membership Clinic 1
└── membership Clinic 5
```

Staff vẫn chỉ có một record.

## 3.4. `staff_clinic_roles`

Một staff có thể có nhiều role tại một clinic.

```text
staff_clinic_roles
-----------------------------------------
id uuid PK
staff_clinic_membership_id uuid NOT NULL
role_code text NOT NULL
created_at timestamptz
created_by uuid nullable
```

Constraint:

```text
UNIQUE(staff_clinic_membership_id, role_code)
```

Canonical clinic roles:

```text
DOCTOR
RECEPTIONIST
TECHNICIAN
Y_SI
CSKH
MANAGER
ADMIN
```

Ví dụ:

```text
BS Hùng @ Clinic 1
→ DOCTOR

BS Hùng @ Clinic 5
→ DOCTOR
→ MANAGER
```

## 3.5. Organization-level admin

Quyền nhìn toàn chuỗi không nên nhét vào từng clinic role.

Đề nghị:

```text
staff_organization_roles
-----------------------------------------
staff_id
organization_id
role_code
```

Role đầu tiên:

```text
SUPER_ADMIN
```

`SUPER_ADMIN` có thể:

- Xem tất cả clinic.
- Tạo/deactivate clinic.
- Quản lý clinic admin.
- Xem dashboard tổng.
- Xem trạng thái integration toàn chuỗi.

Không nhất thiết implement table này trong Goal đầu nếu hiện tại chưa cần; nhưng kiến trúc không được khóa đường mở rộng.

---

# 4. Có nên tạo “6 tài khoản phòng khám” không?

## 4.1. Câu trả lời Tech Lead

Có thể có **mỗi clinic ít nhất một tài khoản Admin**, nhưng đó vẫn phải là user phục vụ con người quản trị, không phải “identity của clinic”.

Ví dụ:

```text
Clinic 1
├── Admin cơ sở
├── Lễ tân A
├── Lễ tân B
├── BS A
└── Y sĩ A
```

Mỗi người dùng tài khoản riêng.

Không khuyến nghị cho nhân viên hằng ngày dùng chung:

```text
clinic01@...
clinic02@...
```

Nếu hiện tại nghiệp vụ bắt buộc phải có 6 account bootstrap ban đầu, có thể tạo 6 `ADMIN` user tạm, một cho mỗi clinic, nhưng phải ghi nhận đây là account bootstrap/management và nên chuyển dần sang account cá nhân.

## 4.2. Vì sao không dùng “clinic account” chung

Audit yêu cầu biết:

```text
Ai đã sửa lịch?
Ai cập nhật BHYT?
Ai đổi chẩn đoán?
Ai deactivate nhân viên?
```

Nếu cả clinic dùng chung một account thì audit mất ý nghĩa.

## 4.3. Login của nhân viên

```text
Email + Password
      ↓
Supabase Auth
      ↓
Resolve staff by user_id
      ↓
Check staff.is_active
      ↓
Load active clinic memberships
      ↓
0 clinic → deny / contact admin
1 clinic → vào thẳng
>1 clinic → chọn clinic
      ↓
Resolve role/permissions tại clinic đó
```

---

# 5. Active Clinic Context

## 5.1. Không chỉ lưu bằng React Context

Active clinic là security boundary, không chỉ là UI preference.

Khuyến nghị URL:

```text
/c/[clinicCode]/reception
/c/[clinicCode]/patients
/c/[clinicCode]/schedule
/c/[clinicCode]/staff
/c/[clinicCode]/settings
```

Ví dụ:

```text
/c/PK01/reception
/c/PK05/schedule
```

Lợi ích:

- Hai browser tab có thể mở hai clinic khác nhau.
- URL tự mô tả target clinic.
- Server có thể resolve clinic sớm.
- Giảm thao tác nhầm cơ sở.

## 5.2. Server phải xác minh membership

Client gửi `clinicCode` hoặc `clinicId` không phải là bằng chứng quyền.

Mỗi request phải conceptually:

```text
Authenticated user
      ↓
Staff
      ↓
Resolve Clinic
      ↓
Active Membership?
      ↓
Required Permission?
      ↓
ALLOW / DENY
```

Không viết:

```ts
const clinicId = req.body.clinicId;
// rồi query thẳng
```

mà không server authorization.

## 5.3. Clinic Switcher

Chỉ hiển thị clinic mà user có membership hoặc organization-level privilege.

```text
Thuận Thiên | Cơ sở 3 ▼ | BS Hùng
```

Nếu user chỉ có một clinic thì có thể không cần switcher dropdown.

---

# 6. Tài khoản BHXH / External Integration — tách riêng khỏi Staff Login

## 6.1. Business requirement

Mỗi clinic có thể có tài khoản, username, mã cơ sở hoặc thông tin xác thực riêng để kết nối Cổng BHXH/HIS/provider bên ngoài.

Đây là **machine/integration credential owned by Clinic**.

Nó không phải:

- `auth.users`.
- `staff.user_id`.
- password nhân viên.

## 6.2. `clinic_integrations`

```text
clinic_integrations
-----------------------------------------
id uuid PK
organization_id uuid NOT NULL
clinic_id uuid NOT NULL
provider text NOT NULL
integration_code text NOT NULL
external_username text nullable
external_facility_code text nullable
secret_reference text nullable
status text NOT NULL
config jsonb nullable
last_verified_at timestamptz nullable
last_success_at timestamptz nullable
last_error_at timestamptz nullable
last_error_code text nullable
created_at timestamptz
updated_at timestamptz
created_by uuid nullable
updated_by uuid nullable
```

Provider examples:

```text
BHXH
HIS
OTHER
```

Constraint:

```text
UNIQUE(clinic_id, provider, integration_code)
```

Nếu business chỉ cho một BHXH account/clinic ở giai đoạn đầu:

```text
UNIQUE(clinic_id, provider)
```

có thể dùng, nhưng không nên khóa kiến trúc nếu sau này cần nhiều credential.

## 6.3. Secret storage

Không lưu:

```text
bhxh_password text plaintext
```

trong bảng application.

Không expose:

```text
NEXT_PUBLIC_BHXH_PASSWORD
```

Đề nghị:

```text
secret_reference
```

tham chiếu đến server-side secret storage (ví dụ Supabase Vault hoặc secret manager phù hợp với môi trường triển khai).

Frontend chỉ được biết:

```text
BHXH account: CONFIGURED
Last verified: ...
Status: ACTIVE / ERROR
```

Không trả password/token thật ra client.

## 6.4. `integration_sessions`

Nếu provider cần token/cookie/session:

```text
integration_sessions
-----------------------------------------
id uuid PK
clinic_integration_id uuid NOT NULL
status text NOT NULL
session_reference text nullable
expires_at timestamptz nullable
last_refresh_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

Session/token nhạy cảm phải được bảo vệ tương tự secret.

Không log raw token/cookie.

## 6.5. `integration_jobs`

Theo dõi việc gọi API/tra cứu/đồng bộ.

```text
integration_jobs
-----------------------------------------
id uuid PK
organization_id uuid
clinic_id uuid
clinic_integration_id uuid
job_type text
requested_by_staff_id uuid nullable
patient_id uuid nullable
status text
started_at timestamptz
completed_at timestamptz
correlation_id text
error_code text nullable
safe_metadata jsonb nullable
```

Không ghi password/token trong log.

## 6.6. Flow tra cứu BHXH tương lai

```text
Staff login
    ↓
Active Clinic = PK03
    ↓
Reception nhập BHYT
    ↓
Server verify staff permission at PK03
    ↓
Resolve BHXH integration for PK03
    ↓
Resolve secret server-side
    ↓
Acquire/refresh provider session
    ↓
Call authorized BHXH adapter/API
    ↓
Normalize response
    ↓
Return necessary data
    ↓
Audit integration job
```

Quan trọng:

Server phải tự resolve integration account từ `active clinic`.

Client không được gửi arbitrary:

```text
credentialId = account của Clinic khác
```

rồi server tin luôn.

## 6.7. Official API first

Khi có API/Webservice chính thức được cấp quyền, adapter phải ưu tiên interface chính thức thay vì browser scraping.

Nếu nghiệp vụ sau này cần portal automation hợp lệ, phải để trong provider adapter riêng, server-side, có rate-limit, session coordination, error handling và audit; không nhét automation trực tiếp vào React component.

---

# 7. Patient Master trong hệ thống nhiều clinic

## 7.1. Patient thuộc Organization, không thuộc riêng một Clinic

V1 `patients` được nâng thành:

```text
patients
-----------------------------------------
id uuid PK
organization_id uuid NOT NULL
patient_code text NOT NULL
full_name text NOT NULL
normalized_name text
phone text
citizen_id text
...
```

Constraint:

```text
UNIQUE(organization_id, patient_code)
```

Sau khi dữ liệu được làm sạch, có thể áp dụng partial unique theo organization cho citizen ID/BHYT phù hợp với business rule.

Không dùng:

```text
patients.clinic_id
```

làm sở hữu độc quyền.

## 7.2. Ví dụ cross-clinic

```text
Patient A
├── Reception 01 @ Clinic 1
├── Reception 02 @ Clinic 1
└── Reception 03 @ Clinic 4
```

Clinic 4 không tạo Patient A mới.

## 7.3. Cross-clinic privacy

Shared Patient Master không có nghĩa mọi staff thấy toàn bộ lịch sử toàn chuỗi.

Default đề nghị:

- Staff có quyền Reception có thể search identity để tránh duplicate.
- Clinical history mặc định scope theo active clinic.
- Manager/Admin có thể có quyền mở rộng theo policy.
- SUPER_ADMIN có cross-clinic access nếu business cho phép.

Tách:

```text
Patient identity discoverability
≠
Full cross-clinic medical history access
```

RLS/permission phải phản ánh khác biệt này.

---

# 8. Các bảng V1 phải thay đổi thế nào trong V3

## 8.1. `patient_insurance_cards`

Organization-level qua `patient_id`.

Có thể thêm:

```text
last_verified_clinic_id nullable
```

nếu cần biết cơ sở cuối kiểm tra, nhưng card vẫn thuộc patient master.

## 8.2. `patient_measurements`

Thêm:

```text
clinic_id nullable/not null theo source
recorded_by staff_id
```

Để biết số đo được ghi tại cơ sở nào.

## 8.3. `patient_alerts`

Cần phân biệt:

```text
scope = ORGANIZATION | CLINIC
clinic_id nullable
```

Một cảnh báo dị ứng/nguy hiểm có thể organization-wide; một note vận hành có thể clinic-specific.

## 8.4. `receptions`

Bắt buộc:

```text
organization_id
clinic_id
patient_id
```

Schema:

```text
receptions
-----------------------------------------
id
organization_id
clinic_id
patient_id
insurance_card_id
arrived_at
registered_at
reception_source
patient_relation_type
reason_for_visit
status
created_by_staff_id
created_at
```

## 8.5. `treatment_courses`

Bắt buộc:

```text
organization_id
clinic_id
```

`primary_doctor_id` phải là staff có active membership + DOCTOR role tại cùng clinic.

Course numbering recommendation:

```text
UNIQUE(patient_id, clinic_id, course_no)
```

hoặc nếu LT numbering là toàn chuỗi:

```text
UNIQUE(patient_id, course_no)
```

Business này phải xác nhận trước khi khóa constraint. Default V3 đề nghị course scoped theo clinic vì điều trị vận hành được thực hiện tại clinic cụ thể.

## 8.6. `appointments`

Bắt buộc:

```text
organization_id
clinic_id
```

Query chính:

```text
WHERE clinic_id = ?
AND appointment_date = ?
```

Indexes:

```text
(clinic_id, appointment_date)
(clinic_id, doctor_id, appointment_date)
(clinic_id, status, appointment_date)
```

## 8.7. `treatment_sessions`

Bắt buộc `clinic_id` hoặc phải có integrity đảm bảo clinic khớp appointment/course.

## 8.8. `follow_up_cases`

Clinic-scoped theo treatment course.

Assigned CSKH phải là staff membership hợp lệ của clinic nếu case là clinic-owned.

## 8.9. `audit_logs`

Nâng schema:

```text
audit_logs
-----------------------------------------
id
organization_id
clinic_id nullable
actor_auth_user_id
actor_staff_id
action
entity_type
entity_id
before_data jsonb
after_data jsonb
created_at
```

Global actions như tạo clinic có thể `clinic_id = null`.

---

# 9. Referential Integrity cho clinic scope

Khi denormalize `clinic_id` vào operational tables để query/RLS nhanh, phải ngăn dữ liệu mismatch.

Ví dụ nguy hiểm:

```text
appointment.clinic_id = Clinic A
course.clinic_id = Clinic B
```

Không được xảy ra.

Một chiến lược mạnh:

Parent có unique pair:

```text
UNIQUE(id, clinic_id)
```

Child dùng composite FK:

```text
( treatment_course_id, clinic_id )
REFERENCES treatment_courses(id, clinic_id)
```

Tương tự:

```text
(reception_id, clinic_id)
→ receptions(id, clinic_id)
```

Nếu project không dùng composite FK thì service/RPC + database trigger/constraint phải đảm bảo cùng clinic. Nhưng không chỉ dựa vào frontend validation.

---

# 10. Master Data Management — dữ liệu chuẩn dùng chung, không nhập tay rải rác

Đây là thay đổi lớn của V3. Các dữ liệu xuất hiện lặp lại trong nghiệp vụ phải được quản trị như **Master Data**, không hardcode trong React và không để từng người nhập tự do thành nguồn chuẩn.

## 10.1. Các Master Data chính

```text
Organization-wide Master Data
├── staff
├── visit_reason_catalog
├── diagnosis_catalog
├── service_catalog
├── course_tags
└── các catalog chuẩn khác khi có nghiệp vụ thật

Clinic-scoped Configuration
├── staff_clinic_memberships
├── staff_clinic_roles
├── clinic_service_settings
├── resources
├── resource_groups
├── staff_shifts
└── clinic_scheduling_settings
```

Nguyên tắc:

```text
Catalog = "đây là gì?"
Clinic setting = "cơ sở này có dùng không / dùng thế nào?"
Operational record = "bệnh nhân nào đã thực sự được áp dụng?"
```

Không duplicate toàn bộ catalog cho mỗi clinic.

---

## 10.2. `visit_reason_catalog` — Danh mục Lý do đến khám

V1 đang có `receptions.reason_for_visit text`. V3 không dùng field text này làm nguồn chuẩn duy nhất vì sẽ sinh dữ liệu như:

```text
Đau lưng
đau lưng
ĐAU LƯNG
đau lung
đau lưng nhiều
```

Schema đề nghị:

```text
visit_reason_catalog
-----------------------------------------
id uuid PK default gen_random_uuid()
organization_id uuid NOT NULL FK organizations
code text NOT NULL
name text NOT NULL
normalized_name text nullable
category text nullable
description text nullable
sort_order integer NOT NULL default 0
is_active boolean NOT NULL default true
created_at timestamptz NOT NULL
updated_at timestamptz NOT NULL
created_by uuid nullable
updated_by uuid nullable
```

Constraint:

```text
UNIQUE(organization_id, code)
```

Search index nên hỗ trợ `name/normalized_name` theo nhu cầu thực tế.

Ví dụ dữ liệu:

```text
DLUNG     Đau lưng
DAUVAI    Đau vai gáy
DAUGOI    Đau khớp gối
TECHAN    Tê chân
TETAY     Tê tay
MATNGU    Mất ngủ
```

Không invent danh mục production nếu chưa được phòng khám xác nhận.

---

## 10.3. `reception_visit_reasons` — một reception có nhiều lý do

Một bệnh nhân có thể đến vì nhiều vấn đề trong cùng lần tiếp nhận.

Không thiết kế:

```text
receptions.reason_id = chỉ một lý do
```

Đề nghị:

```text
reception_visit_reasons
-----------------------------------------
id uuid PK
reception_id uuid NOT NULL FK receptions
visit_reason_id uuid nullable FK visit_reason_catalog
is_primary boolean NOT NULL default false
note text nullable
created_at timestamptz
created_by uuid nullable
```

Constraint phù hợp:

```text
UNIQUE(reception_id, visit_reason_id)
```

nếu `visit_reason_id` không null và business không cho lặp cùng lý do.

Reception vẫn có thể giữ:

```text
symptom_note text nullable
```

để lưu mô tả tự do như:

```text
"Đau tăng khi ngồi lâu, tê lan xuống chân trái"
```

Mô hình đúng:

```text
Structured reasons
+
Free-text symptom note
```

Catalog phục vụ báo cáo/tìm kiếm; note giữ sắc thái thực tế.

---

## 10.4. `diagnosis_catalog` — Chẩn đoán chuẩn

Lý do khám và chẩn đoán là hai khái niệm khác nhau:

```text
Patient nói: "Đau lưng"
        ↓
visit reason

Doctor khám
        ↓
M54.5 — Đau thắt lưng
        ↓
diagnosis
```

Schema:

```text
diagnosis_catalog
-----------------------------------------
id uuid PK
organization_id uuid NOT NULL
code_system text NOT NULL
code text NOT NULL
name text NOT NULL
traditional_code text nullable
traditional_name text nullable
is_active boolean NOT NULL default true
created_at timestamptz
updated_at timestamptz
created_by uuid nullable
updated_by uuid nullable
```

Recommended uniqueness:

```text
UNIQUE(organization_id, code_system, code)
```

`code_system` có thể hỗ trợ:

```text
ICD10
YHCT
INTERNAL
```

Không cho frontend tự tạo diagnosis string và coi đó là relational identity.

---

## 10.5. `course_diagnoses` — diagnosis thực tế của liệu trình

```text
course_diagnoses
-----------------------------------------
id uuid PK
treatment_course_id uuid NOT NULL
diagnosis_id uuid nullable
raw_code text nullable
raw_text text nullable
diagnosis_type text nullable
is_primary boolean NOT NULL default false
code_snapshot text nullable
name_snapshot text nullable
created_by uuid
created_at timestamptz
```

`diagnosis_id` nối catalog.

Snapshot được khuyến nghị khi cần bảo toàn nội dung lịch sử sau khi Admin sửa tên catalog:

```text
catalog hiện tại có thể thay đổi display name
clinical history không được âm thầm thay đổi ý nghĩa
```

Việc lock/immutability của diagnosis sau xác nhận của bác sĩ phải là Goal nghiệp vụ riêng.

---

## 10.6. `service_catalog` — Danh mục DVKT

Schema tổ chức dùng chung:

```text
service_catalog
-----------------------------------------
id uuid PK
organization_id uuid NOT NULL
service_code text NOT NULL
service_name text NOT NULL
service_group text nullable
default_duration_minutes integer nullable
setup_minutes integer nullable
cleanup_minutes integer nullable
required_resource_type text nullable
is_active boolean NOT NULL default true
created_at timestamptz
updated_at timestamptz
created_by uuid nullable
updated_by uuid nullable
```

Constraint:

```text
UNIQUE(organization_id, service_code)
```

Không hardcode:

```ts
if (service === "Bó thuốc") duration = 30
```

Duration là data/config.

---

## 10.7. `clinic_service_settings` — clinic override

Catalog DVKT dùng chung, nhưng mỗi clinic có thể:

- không cung cấp một service;
- có duration khác;
- có resource requirement/capacity khác.

```text
clinic_service_settings
-----------------------------------------
clinic_id uuid NOT NULL
service_id uuid NOT NULL
is_enabled boolean NOT NULL default true
default_duration_minutes nullable
setup_minutes nullable
cleanup_minutes nullable
required_resource_type nullable
capacity_override nullable
updated_at timestamptz
updated_by uuid nullable
PRIMARY KEY(clinic_id, service_id)
```

Resolution:

```text
Clinic override
    ↓ nếu null
Organization service default
```

Không copy `service_catalog` sáu lần.

---

## 10.8. Staff Master cũng là Master Data

`staff` mô tả con người.

`staff_clinic_memberships` mô tả người đó làm ở đâu.

`staff_clinic_roles` mô tả người đó làm vai trò gì ở clinic đó.

Doctor dropdown tại Clinic X phải query:

```text
staff.is_active = true
AND membership.clinic_id = X
AND membership.is_active = true
AND role_code = DOCTOR
```

Không query theo danh sách tên hardcode.

---

## 10.9. Deactivate thay vì hard-delete

Áp dụng mặc định cho:

```text
Staff
Visit Reason
Diagnosis
Service/DVKT
Clinic
Resource
```

UI dùng từ:

```text
Ngưng sử dụng
Ngưng hoạt động
```

thay vì `Xóa` nếu record có thể đã được lịch sử tham chiếu.

Dropdown mới chỉ load active record, nhưng historical record vẫn render được.

---

## 10.10. Quyền quản trị Catalog khác với quyền sử dụng Catalog

Ví dụ:

```text
catalog.diagnosis.manage
≠
clinical.diagnosis.assign
```

Admin có thể quản lý danh mục nhưng không mặc nhiên được phép chẩn đoán bệnh nhân.

Doctor có thể chọn diagnosis từ catalog nhưng không mặc nhiên được sửa catalog toàn tổ chức.

Tương tự:

```text
catalog.service.manage
≠
clinical.service_order.manage
```

---

## 10.11. UI quản trị Master Data

Khu vực Admin đề nghị:

```text
QUẢN TRỊ
├── Nhân viên
├── Danh mục điều trị
│   ├── Lý do khám
│   ├── Chẩn đoán
│   └── DVKT
├── Cơ sở
├── Tài nguyên / Máy
└── Tích hợp BHXH
```

Không làm một trang Admin khổng lồ.

Patterns Ant Design:

```text
Staff              → Table + Drawer create/edit
Visit Reason       → Table + Modal create/edit
Diagnosis Catalog  → Table + Modal/Drawer tùy độ phức tạp
Service/DVKT       → Table + Drawer
Deactivate         → confirmation Modal
```

Không đặt nút `+ Thêm lý do` cho mọi Receptionist ngay bên cạnh selector trừ khi role/permission cho phép, để tránh catalog bị rác.

```

Không copy service catalog 6 lần.

---

# 11. Resources và machine combo theo Clinic

## 11.1. `resources`

Nâng V1:

```text
resources
-----------------------------------------
id
organization_id
clinic_id
resource_code
name
resource_type
capacity
is_active
```

Constraint:

```text
UNIQUE(clinic_id, resource_code)
```

Vì `COMBO-01` ở Clinic A không phải `COMBO-01` ở Clinic B.

## 11.2. `resource_groups`

Bắt buộc `clinic_id`.

```text
UNIQUE(clinic_id, code)
```

Group members chỉ được chứa resource cùng clinic.

## 11.3. `staff_shifts`

Nâng thành:

```text
staff_shifts
-----------------------------------------
id
staff_id
clinic_id
work_date
start_time
end_time
shift_type
resource_group_id nullable
status
```

Một doctor có thể:

```text
07:00-12:00 Clinic 1
13:00-17:00 Clinic 3
```

Scheduler phải check membership + shift + overlap cross-clinic.

---

# 12. Clinic Scheduling Settings

V1 `scheduling_settings` toàn hệ thống phải đổi thành clinic-scoped.

```text
clinic_scheduling_settings
-----------------------------------------
clinic_id PK/FK
clinic_open_time
clinic_close_time
lunch_start
lunch_end
slot_interval_minutes
default_reception_duration
transition_minutes
working_days
follow_up_inactivity_days
updated_at
```

Không hardcode 5 phút hoặc 84 phút trong source.

Excel `CLS 65 BỆNH` chỉ là seed/default evidence.

Mỗi clinic có thể có:

```text
Clinic 1: slot 5m
Clinic 2: slot 5m
Clinic 6: slot 10m
```

mà không thay code.

---

# 13. Scheduler trong môi trường nhiều Clinic

## 13.1. Input bắt buộc có clinic context

```ts
{
  clinicId,
  patientId,
  treatmentCourseId,
  doctorId,
  startDate,
  plannedSessionCount,
  preferredShift,
  preferredTime,
  selectedWeekdays,
  serviceOrderIds
}
```

Nhưng `clinicId` từ client chỉ là target; server phải authorize.

## 13.2. Scheduler load đúng scope

```text
Resolve authorized Clinic
      ↓
Load clinic settings
      ↓
Load doctor membership + shifts at this clinic
      ↓
Load clinic resources/groups
      ↓
Load clinic service overrides
      ↓
Load existing clinic appointments
      ↓
Generate candidate slots
```

Không được dùng resource của clinic khác để giải conflict.

## 13.3. Cross-clinic staff conflict

Nếu BS A làm cả Clinic 1 và Clinic 3, scheduler phải ngăn:

```text
08:00 Clinic 1 appointment
08:00 Clinic 3 appointment
```

trừ khi business có cơ chế đặc biệt.

Doctor conflict query phải nhìn toàn staff schedule, không chỉ một clinic, trong cùng time window.

## 13.4. Atomic RPC

Đề nghị signature:

```text
schedule_treatment_course(
  p_clinic_id uuid,
  p_course_id uuid,
  p_options jsonb
)
```

RPC phải:

1. Resolve/validate clinic.
2. Lock course.
3. Verify course belongs to clinic.
4. Verify doctor membership/role.
5. Load clinic settings/resources.
6. Check staff cross-clinic conflict.
7. Reserve appointment/steps atomically.
8. Return FULL/PARTIAL/FAILED.

---

# 14. Reception Workflow V3 — tách Tiếp nhận khỏi Chẩn đoán/Chỉ định

V3 thay đổi workflow so với V1/V2 để ranh giới nghiệp vụ rõ hơn.

## 14.1. Trách nhiệm của Receptionist

Receptionist chịu trách nhiệm:

```text
Patient identity
BHYT/CCCD/SĐT cơ bản
Reception event
Lý do đến khám
Ghi chú triệu chứng ban đầu
Bác sĩ khám ban đầu
Check-in / trạng thái tiếp nhận theo quyền
```

Receptionist **không mặc định chịu trách nhiệm chẩn đoán**.

Không ép lễ tân điền:

```text
ICD-10 diagnosis
DVKT thực tế
Số buổi điều trị do bác sĩ quyết định
```

trong modal Tiếp nhận nếu nghiệp vụ chưa có quyết định khác.

---

## 14.2. Reception flow

```text
Login
 ↓
Resolve Staff
 ↓
Select / Enter Clinic
 ↓
/c/PK01/reception
 ↓
Search Patient Master organization-wide
 ↓
Found?
 ├─ YES → load master identity
 └─ NO  → create patient
 ↓
Verify clinic permission
 ↓
Select active DOCTOR @ PK01
 ↓
Select one/more Visit Reasons from catalog
 ↓
Optional symptom note
 ↓
Create Reception @ PK01
 ↓
Patient enters doctor queue / next clinical step
```

Không tạo chẩn đoán giả để hoàn thành Reception.

---

## 14.3. Reception Modal V3

Modal/Drawer tiếp nhận chỉ nên chứa dữ liệu cần cho quầy tiếp nhận.

```text
TIẾP NHẬN BỆNH NHÂN

THÔNG TIN BỆNH NHÂN
- Họ tên
- SĐT
- CCCD
- BHYT
- Năm/ngày sinh
- Địa chỉ

THÔNG TIN TIẾP NHẬN
- Bác sĩ khám ban đầu      searchable Select
- Lý do đến khám           searchable multi-select
- Ghi chú triệu chứng      textarea

[Hủy] [Tiếp nhận]
```

`Bác sĩ` lấy từ Staff Membership/Role đúng clinic.

`Lý do đến khám` lấy từ `visit_reason_catalog` active.

Không hardcode option.

---

## 14.4. Doctor / Clinical flow sau Reception

Sau khi Reception tồn tại:

```text
Doctor opens patient/reception
 ↓
Review visit reasons + symptom note
 ↓
Clinical examination
 ↓
Assign Diagnosis
 ↓
Order DVKT
 ↓
Determine Treatment Course / session plan
 ↓
Lock/confirm clinical order according to policy
 ↓
Schedule appointments
```

Màn hình lâm sàng đề nghị dùng Drawer/Page riêng, không nhét toàn bộ vào Reception modal.

---

## 14.5. Treatment Course creation policy

Có hai lựa chọn nghiệp vụ có thể cấu hình sau khi xác nhận thực tế:

```text
A. Reception creates empty/preliminary Course, Doctor completes clinical plan
B. Doctor creates Course after examination
```

V3 không ép schema vào một trong hai nếu chưa được phòng khám xác nhận.

Nhưng invariant phải giữ:

```text
Diagnosis/DVKT thuộc clinical/course workflow
không phải free-text field của Receptionist
```

---

## 14.6. Cross-clinic patient example

Patient từng ở Clinic 2.

Receptionist Clinic 5 search BHYT:

```text
Existing Patient found
```

Không tạo Patient mới.

Reception mới:

```text
patient_id = existing patient
clinic_id = Clinic 5
```

Cross-clinic clinical history hiển thị theo permission policy, không phải vì Patient Master shared mà mặc định lộ toàn bộ bệnh án.

ission policy.

---

# 15. Schedule UI V3

Routes:

```text
/c/[clinicCode]/schedule
```

Month Matrix only uses:

```text
appointments WHERE clinic_id = active clinic
```

Doctor dropdown only uses:

```text
active membership
+ role DOCTOR
+ same clinic
+ staff.is_active
```

Adding a new doctor membership to Clinic 3 makes the doctor appear at Clinic 3 without hardcoding.

Deactivating membership removes them from new selections but keeps historical records.

Realtime subscription must be scoped by:

```text
clinic_id
+ date range
```

Never subscribe to all appointments of the whole organization by default.

---

# 16. Staff Management Module V3

Staff Management là module quản trị thực sự, không chỉ là dropdown bác sĩ.

## 16.1. Staff Master

Organization-level Staff Master lưu con người một lần.

```text
staff
→ identity/profile

staff_clinic_memberships
→ nơi làm việc

staff_clinic_roles
→ vai trò tại từng clinic

auth.users
→ tài khoản đăng nhập nếu được cấp
```

Không duplicate nhân viên khi họ làm nhiều cơ sở.

---

## 16.2. Routes

Organization/SUPER_ADMIN:

```text
/organization/staff
```

Clinic admin context:

```text
/c/[clinicCode]/staff
```

Clinic Admin chỉ quản lý phạm vi được policy cho phép.

---

## 16.3. Staff List UI

Ant Design Table:

```text
Quản lý nhân viên

[Tìm theo mã/tên/email/SĐT] [Cơ sở] [Vai trò] [Trạng thái]   [+ Thêm nhân viên]

Mã NV | Họ tên | Cơ sở | Vai trò | Tài khoản | Trạng thái | Thao tác
```

Row actions nên giới hạn action chính và dropdown `...` cho action phụ.

---

## 16.4. Create/Edit Staff — dùng Drawer

Staff có nhiều field/membership nên dùng Drawer thay vì Modal nhỏ.

```text
THÔNG TIN NHÂN VIÊN
- Mã nhân viên
- Họ tên
- SĐT
- Email
- Chức danh
- Số chứng chỉ (nếu áp dụng)
- Trạng thái

PHÂN CÔNG CƠ SỞ
☑ Clinic 1
   roles: DOCTOR

☑ Clinic 4
   roles: DOCTOR, MANAGER

[Hủy] [Lưu nhân viên]
```

Không bắt mọi staff phải có auth account ngay khi tạo Staff Master.

---

## 16.5. Provision Auth Account là thao tác riêng

Flow:

```text
Staff exists
 ↓
staff.user_id = null
 ↓
Admin chọn [Cấp tài khoản đăng nhập]
 ↓
server verifies permission
 ↓
Supabase Auth Admin / invite/reset flow
 ↓
staff.user_id linked
```

Admin API server-only.

Không hardcode default password production.

---

## 16.6. Deactivation semantics

Ba mức khác nhau:

```text
staff.is_active = false
→ người này ngừng hoạt động toàn Organization

membership.is_active = false
→ người này chỉ ngừng làm tại clinic đó

clinic.is_active = false
→ clinic đóng/suspend
```

Không hard-delete Staff đã có lịch sử.

---

## 16.7. Doctor dropdown behavior

Khi Admin thêm Doctor vào Clinic 3:

```text
Staff
+
Membership Clinic 3 active
+
Role DOCTOR
```

thì mọi selector bác sĩ Clinic 3 tự thấy người đó.

Khi membership bị deactivate:

```text
new selections → không còn hiển thị
historical records → vẫn render bác sĩ cũ
```

---

## 16.8. Staff audit

Các action cần audit theo kiến trúc audit hiện tại:

```text
STAFF_CREATED
STAFF_UPDATED
STAFF_DEACTIVATED
STAFF_REACTIVATED
MEMBERSHIP_ASSIGNED
MEMBERSHIP_DEACTIVATED
ROLE_ASSIGNED
ROLE_REMOVED
AUTH_ACCOUNT_LINKED
```

Không log password/token.

not hard-delete historical staff.

---

# 17. Authentication / Authorization V3

## 17.1. Login page

Public:

```text
/login
```

No public signup.

## 17.2. Login flow

```text
Supabase signInWithPassword
 ↓
get authenticated user
 ↓
lookup staff.user_id
 ↓
staff exists + active?
 ↓
load active memberships
 ↓
load organization roles
 ↓
select clinic if necessary
 ↓
server permission check
```

## 17.3. Permission categories

Example:

```text
patients.search
patients.read_basic
patients.read_clinical
patients.update_basic
reception.create
course.create
course.manage
schedule.read
schedule.manage
staff.read
staff.manage
integration.read_status
integration.manage
integration.execute_lookup
```

Do not scatter:

```ts
if (role === "ADMIN")
```

through all UI.

Create centralized permission mapping/helpers.

## 17.4. Role responsibility

### RECEPTIONIST

- Search/create/update patient basic identity.
- Reception.
- Create course according to policy.
- Schedule/reschedule.
- Check-in.
- May execute authorized BHXH lookup for active clinic if permission granted.

### DOCTOR

- Clinical patient/course.
- Diagnosis.
- DVKT.
- Clinical notes.

### TECHNICIAN / Y_SI

- Daily queue.
- Service steps.

### CSKH

- Follow-up cases/contact attempts for clinic.

### MANAGER

- Clinic operations/dashboard/schedule.

### ADMIN

- Clinic staff membership.
- Clinic settings.
- Resource configuration.
- Integration configuration if permitted.

### SUPER_ADMIN

- Organization-wide administration.

---

# 18. Multi-Clinic RLS Architecture

## 18.1. Core chain

```text
auth.uid()
  ↓
staff.user_id
  ↓
staff_clinic_memberships
  ↓
staff_clinic_roles
  ↓
clinic_id
  ↓
permission
```

## 18.2. Helper functions

Recommended database helpers (names conceptual):

```text
current_staff_id()
staff_has_clinic_membership(clinic_id)
staff_has_clinic_role(clinic_id, role_code)
is_org_super_admin(organization_id)
```

If implemented as SECURITY DEFINER functions:

- Lock `search_path`.
- Keep functions minimal.
- Prevent arbitrary dynamic SQL.
- Test RLS recursion carefully.

## 18.3. Example policy behavior

Receptionist at PK02:

```text
SELECT receptions PK02 → ALLOW
SELECT receptions PK01 → DENY
INSERT reception PK02   → ALLOW with permission
INSERT reception PK01   → DENY
```

SUPER_ADMIN may have cross-clinic access if policy grants it.

## 18.4. Patient RLS nuance

Patient identity search may need organization-wide access to avoid duplicates, but clinical details must be protected.

Possible split:

- Basic patient identity exposed through controlled RPC/search function.
- Full patient tables/clinical joins follow clinic/role permissions.

Do not solve cross-clinic dedupe by simply giving every staff `SELECT *` on all medical data.

---

# 19. BHXH Integration Security

## 19.1. Secret boundary

Only server-side code may resolve secrets.

Never:

```text
browser → password
browser → token
browser → cookie
```

## 19.2. Allowed users

Clinic admin can configure integration metadata/status.

Receptionist may execute a lookup if permission says so, but should not see secret.

## 19.3. Credential rotation

When credential changes:

```text
write new secret
update secret_reference
invalidate old integration session
record audit
```

## 19.4. Account status

```text
NOT_CONFIGURED
ACTIVE
INVALID_CREDENTIAL
LOCKED
ERROR
DISABLED
```

## 19.5. Concurrency/session coordination

If external provider account/session cannot safely handle concurrent login refreshes:

- serialize refresh operation per integration account;
- reuse valid session when allowed;
- prevent two workers from overwriting each other's session;
- use database/advisory/application lock as appropriate.

This is future adapter logic, not UI code.

---

# 20. API / Service Layer V3

Do not let React components construct cross-clinic queries directly.

Recommended architectural responsibility using the existing project layout:

```text
src/lib/clinics/
src/lib/auth/
src/lib/permissions/
src/lib/staff/
src/lib/patients/
src/lib/reception/
src/lib/treatments/
src/lib/scheduling/
src/lib/integrations/bhxh/

src/rsc-data/clinics/
src/rsc-data/staff/
src/rsc-data/patients/
src/rsc-data/schedule/

src/components/clinics/
src/components/staff/
...
```

Operational service signatures should carry clinic context:

```ts
getActiveDoctors({ clinicId })
getAppointments({ clinicId, date })
createReception({ clinicId, patientId, ... })
createTreatmentCourse({ clinicId, patientId, ... })
scheduleTreatmentCourse({ clinicId, courseId, ... })
```

But server code must authorize `clinicId` before executing.

Integration calls:

```ts
lookupBhxh({
  clinicId,
  patientId?,
  cardNumber,
  actorStaffId
})
```

The caller must not supply external username/password.

---

# 21. Revised ERD Logic

```text
organizations
│
├── clinics
│   ├── clinic_integrations
│   │   ├── integration_sessions
│   │   └── integration_jobs
│   │
│   ├── staff_clinic_memberships
│   │   └── staff_clinic_roles
│   │
│   ├── clinic_scheduling_settings
│   ├── clinic_service_settings
│   ├── resources
│   │   └── resource_groups
│   ├── staff_shifts
│   ├── receptions
│   │   └── treatment_courses
│   │       ├── course_diagnoses
│   │       ├── course_service_orders
│   │       ├── appointments
│   │       │   ├── appointment_steps
│   │       │   └── treatment_sessions
│   │       └── follow_up_cases
│   └── audit_logs
│
├── staff
│   ├── auth.users (via user_id)
│   ├── staff_clinic_memberships
│   └── staff_organization_roles
│
├── patients
│   ├── patient_insurance_cards
│   ├── patient_measurements
│   ├── patient_alerts
│   └── receptions across clinics
│
├── diagnosis_catalog
├── service_catalog
└── course_tags
```

---

# 22. Excel Analysis từ V1 vẫn giữ nguyên

Các kết luận V1 về Excel không thay đổi:

1. Dữ liệu không phải `1 row = 1 patient`.
2. BHYT/CCCD/SĐT cần normalize nhưng legacy repair phải giữ raw value.
3. LT1/LT2/LT3 là Treatment Course rows.
4. Dấu `✓` theo ngày phải thành Treatment Session/attendance.
5. BẢNG GIỜ month matrix là projection từ appointment rows.
6. Không tạo `day_1...day_31` columns.
7. Không dùng patient name làm FK.
8. Không dùng màu Excel làm business logic.
9. `CLS 65 BỆNH` chỉ là seed/config evidence, không hardcode 5 phút/84 phút.
10. Importer phải nhận biết schema drift theo header/version, không theo column letter cố định.

V3 giữ yêu cầu migration multi-clinic và bổ sung Master Data source mapping:

> Mọi dữ liệu Excel cũ phải được xác định thuộc clinic nào trước khi tạo Reception/Course/Appointment.

---

# 23. Excel Migration V3 — phải biết source Clinic

## M1. Import batch

```text
import_batches
-----------------------------------------
id
organization_id
clinic_id nullable until resolved
file_name
sheet_name
source_type
started_at
completed_at
status
imported_by
```

Nếu file là của một clinic cụ thể, `clinic_id` bắt buộc trước khi import operational rows.

## M2. Raw rows

Giữ `raw_data jsonb`.

## M3. Patient matching

Patient matching organization-wide:

```text
BHYT exact
→ CCCD exact
→ phone + DOB/name
→ fuzzy candidate
```

## M4. Clinic assignment

Before importing:

```text
Reception
Course
Appointment
```

must resolve:

```text
source clinic
```

Không import row vào “unknown clinic” rồi đoán sau nếu đó là operational history.

## M5. Cross-clinic duplicates

Nếu same patient xuất hiện ở Excel của Clinic 1 và Clinic 4:

- one Patient Master;
- separate clinic-scoped historical receptions/courses.

## M6. Reconciliation

Report thêm:

```text
Rows without clinic mapping
Cross-clinic duplicate patients merged
Clinic-specific appointments imported
Invalid clinic staff/doctor mapping
Unknown resource mapping by clinic
```

---

# 24. Revised Screens V3

## 24.1. `/login`

Human auth only.

Không public signup.

## 24.2. `/select-clinic`

Chỉ khi user có nhiều active memberships và không có cơ chế route mặc định khác.

## 24.3. `/c/[clinicCode]/reception`

Reception clinic-scoped nhưng patient identity search organization-wide.

Reception UI V3:

```text
Patient Search
  ↓
Patient Summary / New Patient
  ↓
Reception Modal/Drawer
  ├── Patient basic information
  ├── Initial doctor selector
  ├── Visit reason multi-select
  └── Symptom note
  ↓
Create Reception
```

Không đặt Diagnosis/DVKT/số buổi vào Receptionist modal theo mặc định.

## 24.4. `/c/[clinicCode]/clinical` hoặc patient/course clinical workspace

Doctor-oriented workspace:

```text
Reception context
Visit Reasons
Symptom Note
Patient summary

Diagnosis selector
DVKT/service orders
Treatment plan/session count
Clinical note

[Save]
[Confirm/Lock]
[Create/Update Treatment Course]
[Schedule] theo quyền
```

Tên route cuối cùng phải theo repository convention khi Goal thực thi; không tạo route chỉ vì spec ghi conceptual path.

## 24.5. `/c/[clinicCode]/schedule`

Month Matrix + Day Timeline scoped clinic.

## 24.6. `/organization/staff`

SUPER_ADMIN Staff Master.

Table + Drawer.

## 24.7. `/c/[clinicCode]/staff`

Clinic membership/role management theo permission.

## 24.8. `/organization/catalogs/visit-reasons`

Admin catalog page:

```text
Search | Status | [+ Thêm lý do]

Code | Name | Category | Status | Actions
```

Create/Edit dùng Modal.

Deactivate dùng confirm.

## 24.9. `/organization/catalogs/diagnoses`

Diagnosis catalog management.

Search theo system/code/name.

Create/Edit theo policy; import catalog chuẩn có thể là Goal riêng.

Không cho quyền quản trị catalog đồng nghĩa quyền clinical diagnosis.

## 24.10. `/organization/catalogs/services`

Service/DVKT catalog management.

Create/Edit dùng Drawer do có duration/setup/cleanup/resource settings.

## 24.11. `/c/[clinicCode]/settings/services`

Clinic-specific enable/override cho service catalog.

Không duplicate service master.

## 24.12. `/organization/clinics`

Clinic administration.

## 24.13. `/c/[clinicCode]/resources`

Machine/room/bed/combo theo clinic.

## 24.14. `/c/[clinicCode]/settings/integrations`

Hiển thị metadata an toàn:

```text
BHXH
Status
External username masked/limited
Facility code
Last verified
Last success
Last error
[Configure / Rotate Credential]
[Test Connection]
```

Secret không render lại sau save.

## 24.15. Patient Detail

Contextual route, ví dụ:

```text
/c/PK03/patients/[id]
```

Tabs phù hợp:

```text
Tổng quan
BHYT
Lần tiếp nhận
Liệu trình
Chẩn đoán
DVKT
Lịch hẹn
Lịch sử đo
CSKH
Audit (permission)
```

Default clinical history theo active clinic; cross-clinic history yêu cầu permission riêng.

---

## 24.16. UI interaction rules cho Master Data

```text
Staff              → Drawer
Visit Reason       → Modal
Diagnosis          → Modal/Drawer tùy form
Service/DVKT       → Drawer
Deactivate         → confirmation Modal
Appointment detail → Drawer
```

Các selector operational phải:

- searchable;
- loading-aware;
- empty-state rõ;
- chỉ load active entries;
- đúng organization/clinic scope;
- không cho tạo catalog tùy tiện nếu user không có permission.

---

## 24.17. Ant Design visual standard

Frontend phải tuân `.agent/frontend.md`.

Mục tiêu:

```text
professional clinic operations UI
clean
calm
information-dense
consistent
```

Không chấp nhận màn hình chỉ "chạy được" nhưng thiếu hierarchy/spacing/loading/empty/error states.

 permission.

---

# 25. Dashboard V3

## 25.1. Clinic Dashboard

```text
Clinic 3

Reception today
Appointments today
Completed today
No-show
Active courses
Resource utilization
Follow-up due
BHXH integration status
```

## 25.2. Organization Dashboard

For SUPER_ADMIN:

```text
             Receptions   Completed   No-show
PK01              ...         ...       ...
PK02              ...         ...       ...
...
TOTAL             ...         ...       ...
```

Integration health:

```text
PK01 BHXH ACTIVE
PK02 BHXH ERROR
PK03 BHXH ACTIVE
...
```

No secret values displayed.

---

# 26. Revised Acceptance Criteria V3

## AC-MC01 — Clinic count data-driven

Thêm Clinic 7 không cần sửa source code để hệ thống chấp nhận số lượng clinic.

## AC-MC02 — One staff, multiple clinics

Một staff có thể có nhiều memberships nhưng chỉ một Staff Master.

## AC-MC03 — Different role per clinic

Staff A có thể DOCTOR ở Clinic 1 và DOCTOR+MANAGER ở Clinic 5.

## AC-MC04 — Doctor dropdown clinic-scoped

Doctor chỉ xuất hiện ở clinic có active membership + DOCTOR role.

## AC-MC05 — Patient not duplicated cross-clinic

BHYT/identifier đã có ở Clinic 1, search tại Clinic 4 trả cùng Patient Master.

## AC-MC06 — Reception is clinic-owned

Mỗi Reception có clinic scope hợp lệ.

## AC-MC07 — Reception reason is catalog-backed

Reception có thể chọn một hoặc nhiều `visit_reason_catalog` entries và lưu symptom note riêng.

## AC-MC08 — Reception is not diagnosis

Receptionist hoàn thành Reception mà không cần tự nhập diagnosis/DVKT giả.

## AC-MC09 — Diagnosis is doctor/clinical workflow

Diagnosis assignment dùng `diagnosis_catalog` + `course_diagnoses` theo permission; không dùng reason text làm diagnosis identity.

## AC-MC10 — Service/DVKT is catalog-backed

Clinical order chọn từ `service_catalog`; clinic-specific availability/override được resolve đúng.

## AC-MC11 — Master Data not hardcoded

Thêm Doctor/Visit Reason/Diagnosis/Service active hợp lệ làm selector tương ứng cập nhật từ DB mà không sửa frontend option list.

## AC-MC12 — Master Data preserves history

Deactivate Staff/Reason/Diagnosis/Service không phá record lịch sử đã tham chiếu.

## AC-MC13 — Schedule is clinic-owned

Appointment Clinic A không xuất hiện Clinic B operational schedule.

## AC-MC14 — Resource isolation

Scheduler Clinic A không dùng resource Clinic B.

## AC-MC15 — Cross-clinic doctor conflict

Một doctor không bị xếp overlap ở hai clinic trừ policy đặc biệt được xác nhận.

## AC-MC16 — Login identity is staff-linked

Authenticated auth user không có active staff không được vào app operational.

## AC-MC17 — Clinic membership enforced

Đổi URL sang clinic không có quyền phải DENY.

## AC-MC18 — BHXH credential clinic-scoped

Lookup Clinic 3 resolve integration Clinic 3 server-side.

## AC-MC19 — BHXH secret not exposed

Không client response/source/log nào chứa raw secret/token/cookie.

## AC-MC20 — Human login separated from integration login

Supabase Auth account và BHXH account là lifecycle riêng.

## AC-MC21 — Audit includes clinic/actor

Sensitive mutation audit được actor + clinic + entity + time khi applicable.

## AC-MC22 — Existing Excel invariants preserved

Không `day_1...day_31`, không patient-name FK, không LT1/LT2/LT3 fixed columns.

/LT2/LT3 columns.

---

# 27. Revised Test Plan V3

## Unit

- Permission resolver.
- Clinic membership resolver.
- Role resolver per clinic.
- Active clinic route parser.
- Visit reason search/normalization where applicable.
- Diagnosis/service selector DTO mapping.
- Excel normalizers.
- Scheduling date generator.
- Integration secret masking helper.
- Clinic service-setting resolution.

## Integration

- Auth user → staff resolution.
- Staff with one clinic auto-select.
- Staff with multiple clinics selection.
- Staff cannot access non-member clinic.
- Create membership.
- Duplicate membership rejected.
- Assign multiple roles.
- Doctor list scoped by clinic.
- Create/deactivate/reactivate Staff preserves history.
- Visit Reason CRUD/deactivate.
- Reception supports multiple visit reasons + symptom note.
- Reception can complete without diagnosis if policy says diagnosis belongs to Doctor.
- Diagnosis Catalog CRUD/deactivate.
- Doctor assigns primary/secondary diagnosis.
- Service Catalog CRUD/deactivate.
- Clinic service override resolution.
- Create Patient once; receive at two clinics.
- Create Reception requires clinic.
- Schedule resources only from clinic.
- Cross-clinic staff conflict detection.
- Resolve integration account by clinic.

## Security / RLS

- Anonymous cannot read sensitive operational data.
- Clinic A staff cannot read Clinic B operational rows unless explicit permission.
- Non-admin cannot mutate Staff/Catalog master data.
- Receptionist cannot assign locked clinical diagnosis if permission forbids it.
- Doctor can use catalog without gaining catalog-management permission.
- Clinic A user cannot select Clinic B integration account.
- Non-admin cannot rotate integration credential.
- Secret values never returned by ordinary client reads.

## E2E

### E2E-MC1 — Receptionist

```text
Login
→ enter PK01
→ search patient
→ select Doctor from PK01 staff
→ select Visit Reasons
→ enter symptom note
→ create Reception
→ no diagnosis is required at reception
```

### E2E-MC2 — Doctor clinical workflow

```text
Open received patient
→ see reason/symptom note
→ select Diagnosis from catalog
→ select DVKT from catalog
→ set treatment plan/session count
→ save/confirm
```

### E2E-MC3 — Admin adds Doctor

```text
Admin creates Staff
→ assign PK03 membership
→ assign DOCTOR
→ PK03 doctor selector shows new Doctor
→ PK01 selector does not
```

### E2E-MC4 — Admin manages Visit Reason

```text
Add Visit Reason
→ Reception selector sees it
→ deactivate reason
→ new selector hides it
→ old Reception still displays historical reason
```

### E2E-MC5 — Cross-clinic patient

```text
Patient created PK01
→ search same BHYT PK04
→ same Patient returned
→ new Reception PK04
```

### E2E-MC6 — Clinic authorization

```text
User belongs PK01 only
→ navigate /c/PK06/...
→ DENY
```

### E2E-MC7 — Integration routing

```text
Active clinic PK03
→ BHXH lookup
→ only PK03 integration resolved
→ audit job created
```

 selected server-side
→ integration job audit created
```

---

# 28. Implementation Roadmap V3 — MASTER ROADMAP, KHÔNG PHẢI EXECUTION PERMISSION

Roadmap này chỉ cho biết thứ tự kiến trúc. Agent không được lấy danh sách này làm quyền implement nhiều Goal.

Rule bất biến:

```text
Roadmap = knowledge
CURRENT_GOAL = permission
```

Mỗi macro phase bên dưới được chia tiếp thành micro-goals trong file:

```text
THUAN_THIEN_AGENT_MICRO_GOAL_PLAYBOOK_V3.md
```

## Milestone A — Repository & Agent Foundation

- Refresh CURRENT_STATE.
- Goal Lock / quota rules.
- Verify frontend/Supabase architecture.

## Milestone B — Multi-Clinic Identity

- Organization.
- Clinics.
- Staff Master alignment.
- Staff memberships.
- Clinic roles.

## Milestone C — Authentication & Clinic Context

- Supabase Auth.
- user → staff resolution.
- active staff gate.
- clinic selection.
- `/c/[clinicCode]` context.
- membership authorization.

## Milestone D — Multi-Clinic RLS Foundation

- DB helpers.
- organization/clinic/staff policies.
- security tests.

## Milestone E — Admin Staff Management

- Staff read/create/edit/deactivate.
- membership assignment.
- clinic role assignment.
- optional Auth account provisioning.

## Milestone F — Master Data Catalogs

- Visit Reason Catalog.
- Diagnosis Catalog.
- Service/DVKT Catalog.
- Clinic service settings.

## Milestone G — Patient Master

- organization-scoped identity.
- search/dedupe.
- insurance/history.

## Milestone H — Reception V3

- Patient selection/create.
- initial doctor selector.
- visit reason selector.
- symptom note.
- clinic-scoped Reception.

## Milestone I — Clinical / Treatment Course

- Doctor examination workspace.
- diagnosis assignment.
- service orders.
- treatment course/session planning.

## Milestone J — Basic Appointments & Schedule

- appointment schema.
- manual scheduling.
- month matrix.
- day timeline.
- realtime.

## Milestone K — Attendance

- check-in.
- treatment sessions.
- progress.

## Milestone L — Resources & Full Scheduler

- resources/groups.
- staff shifts.
- service resource requirements.
- capacity.
- atomic scheduling RPC.
- cross-clinic staff conflict.

## Milestone M — Follow-up

- inactivity detection.
- follow-up queue.
- contact attempts.

## Milestone N — Excel Migration

- staging.
- source-aware repair.
- adapters.
- matching/merge review.
- reconciliation.

## Milestone O — BHXH Integration

- clinic integration configuration.
- secret reference.
- provider auth/session.
- one authorized capability per Goal.
- audit/observability.

Không thực thi Milestone O trước khi clinic identity, auth, permission và secret boundary ổn định.

rized Operations

One capability per Goal.

---

# 29. Permanent Agent Execution Rule — Goal Lock + Completion Gate

This rule must live in `AGENTS.md` or an equivalent permanent agent rule.

```text
CURRENT_GOAL = exactly one Goal ID
```

Agent may implement only CURRENT_GOAL. Sau implement phải self-review đúng một lần, fix tối đa một lần, rồi STOP theo `AGENTS.md`.

If roadmap says:

```text
G-MC1
G-MC2
G-MC3
```

and CURRENT_GOAL = G-MC1:

```text
G-MC1 = AUTHORIZED
G-MC2 = FORBIDDEN
G-MC3 = FORBIDDEN
```

## Mandatory behavior

1. Inspect before edit.
2. List allowed scope.
3. Implement current Goal only.
4. Run validation.
5. Report DEFERRED.
6. STOP.

## Forbidden behavior

Do not:

- “while I am here” implement adjacent features;
- create speculative future tables/files;
- implement next phase automatically;
- redesign unrelated code;
- disable RLS for convenience;
- hardcode clinic count/names;
- hardcode doctor/staff names;
- put BHXH credential in frontend;
- trust arbitrary clinicId from client;
- edit historical applied migrations.

Every Goal final line:

```text
STOPPED. Waiting for Tech Lead approval.
```

---

# 30. Database Migration Strategy from Legacy/V1/V2 to V3

If code/schema already exists, do not rewrite history.

## Step 1 — Add organization/clinic tables

Forward migration.

## Step 2 — Seed Organization

```text
THUAN_THIEN
```

## Step 3 — Create actual clinic rows

Only from confirmed clinic master data.

Do not invent fake six clinic names.

## Step 4 — Backfill existing data to a default/source clinic

Only if current production data is known to belong to one clinic.

If ambiguous, create migration mapping/review instead of guessing.

## Step 5 — Staff membership migration

Existing doctors/staff must be mapped to clinics.

Do not derive clinic membership solely from display names unless verified.

## Step 6 — Role migration

Existing `staff.role_type` can seed membership role only where clinic mapping is known.

Keep old field temporarily until callers are migrated.

## Step 7 — Operational tables

Add `organization_id`/`clinic_id` incrementally:

```text
receptions
courses
appointments
sessions
resources
shifts
follow-ups
```

Use NOT NULL only after data is backfilled and validated.

## Step 8 — RLS

Update policies after clinic ownership exists.

## Step 9 — Deprecate legacy columns

Only in a separate reviewed migration after all callers are moved.

---

# 31. Index Strategy

High-volume operational indexes should start with clinic scope.

Examples:

```text
receptions(clinic_id, registered_at)
receptions(clinic_id, patient_id, registered_at)

treatment_courses(clinic_id, status, start_date)
treatment_courses(clinic_id, primary_doctor_id, status)

appointments(clinic_id, appointment_date)
appointments(clinic_id, doctor_id, appointment_date)
appointments(clinic_id, status, appointment_date)

staff_shifts(clinic_id, work_date, staff_id)

follow_up_cases(clinic_id, status, next_follow_up_at)

clinic_integrations(clinic_id, provider, status)
```

Patient lookup indexes remain organization-wide:

```text
patients(organization_id, normalized_name)
patients(organization_id, phone)
patients(organization_id, citizen_id)
patient_insurance_cards(card_number)
```

Final exact indexes should follow actual query plans and data volume.

---

# 32. Audit Requirements V3

Audit important events:

```text
CLINIC_CREATED
CLINIC_UPDATED
CLINIC_DEACTIVATED

STAFF_CREATED
STAFF_UPDATED
STAFF_DEACTIVATED
MEMBERSHIP_ASSIGNED
MEMBERSHIP_REMOVED
ROLE_ASSIGNED
ROLE_REMOVED
AUTH_ACCOUNT_LINKED

INTEGRATION_CONFIGURED
INTEGRATION_CREDENTIAL_ROTATED
INTEGRATION_TESTED
INTEGRATION_LOOKUP_EXECUTED

PATIENT_UPDATED
RECEPTION_CREATED
COURSE_CREATED
APPOINTMENT_CREATED
APPOINTMENT_RESCHEDULED
APPOINTMENT_CANCELLED
```

Never audit raw:

```text
password
access token
refresh token
BHXH secret
session cookie
```

For integration requests, store safe correlation/error metadata only.

---

# 33. Hardcoding Rules V3

Do NOT hardcode:

- 6 clinics.
- clinic names.
- clinic IDs.
- doctor names.
- staff names.
- clinic usernames.
- BHXH username/password in source.
- machine combo list globally.
- slot interval.
- service duration.
- course maximum = 3.
- session count = 5/7/10.
- follow-up threshold.
- role UI decisions spread across components.

Can seed/configure:

- Organization Thuận Thiên.
- Confirmed clinic master rows.
- Confirmed staff master rows.
- Confirmed service catalog.
- Confirmed resource/group data per clinic.
- Default scheduling settings per clinic.

Seeds remain editable data, not source-code business constants.

---

# 34. Legacy Excel Normalization Rules remain source-aware

V1 normalizer behavior must be refined:

```text
Legacy Excel repair
≠
Production form normalization
≠
Validation
```

Example CCCD:

```text
LEGACY_EXCEL + 11 numeric digits
→ may generate prepend-0 candidate
→ keep raw
→ mark confidence/review
```

Production user input:

```text
11-digit CCCD
→ validation error / review
```

Do not universally prepend zero.

Same principle for phone and Excel serial date/time.

---

# 35. Business Questions that must be confirmed

Multi-clinic questions added to V1 unresolved list:

1. Tên/mã chính thức của 6 clinic hiện tại.
2. Mã cơ sở KCB/BHXH của từng clinic.
3. Mỗi clinic hiện có một hay nhiều credential BHXH.
4. Credential BHXH có được dùng đồng thời nhiều phiên không.
5. Nhân viên nào làm nhiều clinic.
6. Role của cùng một staff có khác nhau theo clinic không.
7. Patient clinical history có được hiển thị cross-clinic cho lễ tân hay chỉ basic identity.
8. Course LT có numbering toàn chuỗi hay reset/theo clinic.
9. Patient có được tiếp tục cùng một course ở clinic khác không hay tạo course mới/transfer.
10. CSKH vận hành riêng từng clinic hay có team CSKH toàn chuỗi.
11. Service catalog giống nhau 100% hay có clinic override.
12. Machine/resource tên giống nhau giữa clinic nhưng là thiết bị riêng đúng không.
13. Clinic Admin có quyền cấu hình BHXH credential hay chỉ SUPER_ADMIN.
14. Ai được phép thực thi tra cứu BHXH: Receptionist, Manager, Doctor hay subset.
15. Có yêu cầu audit/export lịch sử tra cứu BHXH không.

Không để agent tự đoán các câu này thành hardcoded business rules.

---

# 36. Definition of Done — Multi-Clinic Foundation

Foundation chỉ hoàn thành khi:

```text
[ ] Clinic count data-driven
[ ] Organization exists
[ ] Clinic master exists
[ ] Staff master separated from clinic membership
[ ] Staff can belong to multiple clinics
[ ] Role can differ by clinic
[ ] Human login separated from BHXH credential
[ ] Clinic integration model exists before BHXH feature
[ ] Patient Master is organization-wide
[ ] Reception/Course/Appointment are clinic-scoped
[ ] Resources/shifts are clinic-scoped
[ ] RLS checks membership/permission
[ ] Active clinic cannot be spoofed by client
[ ] Audit records clinic context
[ ] No secret exposed to client
[ ] No hardcoded six clinics
[ ] No hardcoded doctor list
[ ] Existing Excel invariants remain normalized
[ ] No day1..day31 schema
[ ] No LT1/LT2/LT3 fixed patient columns
```

---

# 37. Tech Lead Final Architecture V3

Kiến trúc V3 chốt cho Thuận Thiên:

```text
                         THUẬN THIÊN
                        ORGANIZATION
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
      CLINIC 1             CLINIC 2            CLINIC N
        │                    │
        ├── Staff Membership ├── Staff Membership
        ├── Roles            ├── Roles
        ├── Resources        ├── Resources
        ├── Schedule         ├── Schedule
        ├── Settings         ├── Settings
        └── BHXH Integration └── BHXH Integration

                    SHARED PATIENT MASTER
                             │
               ┌─────────────┴─────────────┐
               │                           │
       Reception @ Clinic 1        Reception @ Clinic 4
               │                           │
            Course                      Course
               │                           │
         Appointments                 Appointments
```

Identity model:

```text
SYSTEM LOGIN
(auth.users)
      ↓
STAFF
      ↓
CLINIC MEMBERSHIP
      ↓
ROLE / PERMISSION
```

Integration model:

```text
CLINIC
   ↓
BHXH INTEGRATION CONFIG
   ↓
SERVER-SIDE SECRET
   ↓
SESSION / JOB / AUDIT
```

Hai chuỗi này không được nhập làm một.

---

# 38. Recommended next execution sequence

Nếu project hiện tại đã bắt đầu code theo V1, **không code tiếp Login/Staff/Schedule lớn ngay**.

Thứ tự Tech Lead đề nghị:

```text
1. Audit current schema/code
2. Organization + Clinics
3. Staff Membership + Roles
4. Auth user → Staff
5. Clinic Selection / Route Scope
6. Multi-clinic RLS
7. Clinic Integration Credential Foundation
8. Staff Management UI
9. Patient organization scope
10. Reception clinic scope
11. Treatment Course clinic scope
12. Appointment/Schedule clinic scope
13. Resource/Shift clinic scope
14. Auto Scheduler
15. Excel migration by source clinic
16. BHXH adapter
```

Mỗi dòng là một hoặc nhiều Goal nhỏ.

Không giao toàn bộ roadmap cho Antigravity như một Goal execution.

---

# 39. Master Rule for Codex Planner + Antigravity Executor

Nếu dùng Codex để lập plan và Antigravity để code:

```text
Tech Lead / Current Goal
        ↓
Codex Planner
  - inspect repository
  - plan ONLY current Goal
  - identify files/migrations/risks
        ↓
Antigravity Executor
  - implement ONLY approved Goal
  - run validation
  - STOP
        ↓
Codex/Tech Lead Review
  - git diff
  - acceptance criteria
  - APPROVE / NEEDS_FIX / REJECT
```

Antigravity không có quyền dùng Master Roadmap như permission để tự làm Goal tiếp theo.

---

# 40. Kết luận V3

V1 giải quyết đúng bài toán:

```text
Excel tiếp nhận
→ Patient Master
→ Treatment Course
→ Appointment
→ Schedule
```

V3 bổ sung lớp kiến trúc cần thiết cho thực tế Thuận Thiên nhiều cơ sở và Master Data:

```text
Organization
→ Clinic
→ Staff Membership + Role
→ Human Auth
→ Clinic-scoped Operations
→ Clinic-owned BHXH Integration
```

Luồng vận hành mục tiêu cuối cùng:

```text
Nhân viên đăng nhập tài khoản cá nhân
        ↓
Hệ thống xác định Staff
        ↓
Chọn/resolve Clinic đang làm việc
        ↓
Tìm Patient Master dùng chung Thuận Thiên
        ↓
Tiếp nhận tại Clinic hiện tại
        ↓
Tạo/tiếp tục Treatment Course tại Clinic
        ↓
Chọn doctor thuộc Clinic
        ↓
Chẩn đoán + DVKT
        ↓
Scheduler dùng settings/staff/resource của Clinic
        ↓
Bảng giờ Clinic tự cập nhật
        ↓
Attendance + Follow-up
```

Khi cần BHXH:

```text
Active Clinic
        ↓
Server resolve BHXH integration của Clinic đó
        ↓
Server-side credential/session
        ↓
Authorized BHXH adapter
        ↓
Kết quả trả về nghiệp vụ
        ↓
Audit
```

Đây là kiến trúc nên dùng để phát triển tiếp thay vì tạo 6 app, 6 database, 6 bộ patient hoặc dùng một account chung cho tất cả nhân viên.

---

# APPENDIX 0 — V3 UI / MASTER DATA DECISION SUMMARY

V3 supersedes V2 ở các quyết định sau:

```text
Receptionist:
Patient + Reception + Initial Doctor + Visit Reasons + Symptom Note

Doctor:
Diagnosis + DVKT + Clinical Note + Treatment Plan

Admin:
Staff Master + Memberships/Roles + Catalogs + Clinic Config
```

Source mapping:

```text
Bác sĩ selector
→ staff + membership + DOCTOR role

Lý do khám
→ visit_reason_catalog + reception_visit_reasons

Chẩn đoán
→ diagnosis_catalog + course_diagnoses

DVKT
→ service_catalog + clinic_service_settings + course_service_orders

Số buổi
→ treatment_courses.planned_session_count

Lịch
→ appointments
```

Không dùng free-text operational field thay cho Master Data identity.

---

## Modal/Drawer decisions

```text
Reception                    → Modal/Drawer vừa, chỉ reception fields
Staff create/edit            → Drawer
Visit Reason create/edit     → Modal
Diagnosis catalog create/edit→ Modal/Drawer
Service/DVKT create/edit     → Drawer
Deactivate confirmation      → Modal
Clinical order               → Drawer hoặc dedicated page
Appointment detail           → Drawer
```

---

## Soft-delete rule

Master data thông thường dùng:

```text
is_active = false
```

để giữ history.

Không `DELETE` Staff/Diagnosis/Service/Visit Reason đang được tham chiếu trong nghiệp vụ thông thường.

---

## Agent execution note

Không paste toàn file này cho agent kèm câu "implement everything".

Agent đọc spec để hiểu context, nhưng execution prompt phải luôn có:

```text
CURRENT_GOAL = one micro-goal
ALLOWED
FORBIDDEN
VALIDATION
SELF REVIEW
STOP
```

Prompt copy/paste cụ thể nằm trong `THUAN_THIEN_AGENT_MICRO_GOAL_PLAYBOOK_V3.md`.

---

# APPENDIX A — DETAILED EXCEL EVIDENCE RETAINED FROM V1

> **Precedence rule:** Appendix A preserves the detailed Excel evidence and field mappings from V1 because they are still important for migration and feature behavior. If any target schema name or single-clinic assumption in this appendix conflicts with the V3 architecture above, **V3 is normative**. In particular, operational records must receive the correct `organization_id` / `clinic_id`, staff roles must use membership-based roles, and external BHXH credentials must use the clinic integration model.

**# 2. Những gì đang tồn tại trong file quản lý khách hàng**

Workbook quản lý khách hàng có 13 sheet. Các sheet quan trọng nhất đối với hệ thống mới:

\| Sheet | Vai trò hiện tại | Vai trò trong hệ thống mới |

\|---|---|---|

\| \`DSKHTT\` | Danh sách khách hàng truyền thống / hồ sơ gốc | Nguồn migration cho \`patients\`, \`insurance\_cards\`, \`patient\_notes\` |

\| \`01. KH TỔNG 2026\` | Danh sách lượt bệnh nhân năm 2026 + ngày điều trị | Nguồn cho \`encounters\`, \`treatment\_courses\`, attendance |

\| \`052026\`, \`062026\`, \`072026\` | Danh sách bệnh nhân theo tháng | Nguồn lịch sử course/session theo tháng |

\| \`thông tuyến LT1 082026\` | Danh sách bệnh nhân tháng 8 theo LT1/LT2/LT3 và giờ tiếp nhận | Nguồn trực tiếp cho reception/course tháng 8 |

\| \`DS GỌI\` | Danh sách bệnh nhân bỏ/chưa đi hết liệu trình | \`follow\_up\_cases\` + \`contact\_attempts\` |

\| \`THÔNG TUYẾN 072026\` | Danh sách thông tuyến tháng trước | Lịch sử encounter/course |

\| Các sheet bệnh nhân mới | Danh sách bổ sung | Migration staging / reconciliation |

**## 2.1. Phát hiện quan trọng về dữ liệu trùng**

Dữ liệu hiện tại không phải “1 dòng = 1 bệnh nhân”.

Ví dụ theo phân tích workbook:

\- \`DSKHTT\`: khoảng 1.755 dòng có tên, nhưng tên normalized bị lặp nhiều lần.

\- \`01. KH TỔNG 2026\`: khoảng 505 dòng tên nhưng chỉ khoảng 353 tên unique.

\- \`thông tuyến LT1 082026\`: khoảng 164 dòng nhưng chỉ khoảng 95 tên unique vì một người xuất hiện ở LT1, LT2, LT3.

Do đó:

**\*\*Không được import tất cả các dòng thành các patient khác nhau.\*\***

Matching ưu tiên:

\`\`\`text

1\. Mã BHYT chuẩn hóa

2\. CCCD chuẩn hóa

3\. SĐT + Họ tên + ngày/năm sinh

4\. Họ tên + ngày sinh + địa chỉ

5\. Không chắc chắn → đưa vào màn hình Merge Review

\`\`\`

\---

**# 3. Phân tích sheet \`DSKHTT\` — hồ sơ khách hàng truyền thống**

Header chính nằm ở row 7.

**## 3.1. Mapping cột Excel → field hệ thống**

\| Excel | Header | Ý nghĩa | Target field | Kiểu dữ liệu | Ghi chú |

\|---|---|---|---|---|---|

\| A | STT | Số thứ tự Excel | \`legacy\_row\_no\` | integer | Chỉ dùng migration/audit, không dùng làm PK |

\| B | NGHỀ NGHIỆP / GHI CHÚ | Ghi chú hỗn hợp | \`occupation\`, \`notes\` | text | Cần tách nếu có thể; nếu không giữ raw note |

\| C | NƠI ĐKKCB | Nơi đăng ký KCB ban đầu | \`insurance\_cards.registered\_facility\_code/name\` | text | Có dữ liệu số như \`82008\`; phải lưu text |

\| D | ĐỐI TƯỢNG | Đối tượng/ghi chú đặc biệt | \`insurance\_subject\` hoặc \`patient\_alert\` | text | Không nên ép enum trước khi thống kê đầy đủ |

\| E | TÌNH TRẠNG | Tình trạng/ghi chú vận hành | \`patient\_alerts.note\` | text | Có dữ liệu dạng cảnh báo; không nhét vào patient status |

\| F | HẠN THẺ | Khoảng hiệu lực BHYT | \`valid\_from\`, \`valid\_to\`, \`raw\_validity\_text\` | date/date/text | Một ô có thể chứa nhiều khoảng thời gian |

\| G | HỌ VÀ TÊN | Tên bệnh nhân | \`patients.full\_name\` | text | Bắt buộc |

\| H | CCCD | CCCD | \`patients.citizen\_id\` | text | Tuyệt đối không dùng numeric |

\| I | NGÀY CẤP | Ngày cấp CCCD | \`patients.citizen\_id\_issued\_at\` | date | Excel serial date |

\| J | NƠI CẤP | Nơi cấp CCCD | \`patients.citizen\_id\_issued\_by\` | text | Optional |

\| K | NĂM SINH | Thực tế có lúc là năm, có lúc là ngày sinh | \`patients.date\_of\_birth\`, \`dob\_precision\` | date + enum | Không đặt đơn giản là integer year |

\| L | MÃ BHYT | Mã thẻ BHYT | \`insurance\_cards.card\_number\` | text | Key matching tốt nhất hiện tại |

\| M | CÂN NẶNG | Cân nặng | \`patient\_measurements.weight\_kg\` | numeric | Có chuỗi \`67 kg\`, \`53 KG\` |

\| N | CHIỀU CAO | Chiều cao | \`patient\_measurements.height\_cm\` | numeric | Có chuỗi \`165 CM\` |

\| O | ĐIỆN THOẠI | SĐT | \`patients.phone\` | text | File cũ có số numeric làm mất số 0 đầu |

\| P | ĐỊA CHỈ | Địa chỉ | \`patients.address\` | text | Có cả địa chỉ cũ/mới trong cùng ô |

\| Q/R | Không có header ổn định | Ghi chú phát sinh | \`legacy\_notes\` / manual review | text | Không tạo field production theo cột này |

**## 3.2. Quy tắc normalize bắt buộc**

**### CCCD**

Excel hiện có CCCD numeric nên có thể mất số \`0\` đầu.

Ví dụ chiến lược migration:

\`\`\`text

raw: 82068001773

candidate normalized: 082068001773

\`\`\`

Rule:

\- Luôn lưu \`citizen\_id\` dạng \`text\`.

\- Nếu chỉ gồm số và có 11 ký tự, có thể sinh candidate thêm \`0\` đầu.

\- Candidate phải được đánh dấu \`normalization\_confidence\` để review, không âm thầm sửa dữ liệu nguồn.

\- Giữ \`legacy\_raw\_value\`.

**### Số điện thoại**

\- Dùng text.

\- Trim space, dấu \`.\` và ký tự không cần thiết.

\- Không parse sang integer.

\- Nếu 9 chữ số do mất \`0\` đầu, tạo candidate \`0xxxxxxxxx\` và flag review.

**### Ngày sinh**

Hiện tại cùng cột có thể là:

\`\`\`text

1977

22156  -> Excel date serial, format dd/mm/yyyy

\`\`\`

Target:

\`\`\`ts

birth\_date: date | null

birth\_year: smallint | null

dob\_precision: 'DATE' | 'YEAR\_ONLY' | 'UNKNOWN'

legacy\_dob\_raw: text | null

\`\`\`

**### Chiều cao**

Hiện có cả:

\`\`\`text

1.58

158

"165 CM"

\`\`\`

Normalization đề nghị:

\`\`\`text

1.20–2.20 → coi là mét → nhân 100

120–220 → coi là cm

string có cm → parse numeric

khác → manual review

\`\`\`

**### Cân nặng**

\`\`\`text

"67 kg" → 67

"53 KG" → 53

\`\`\`

Luôn giữ raw value trong migration staging.

\---

**# 4. Phân tích \`01. KH TỔNG 2026\` và các sheet tháng**

Đây không còn là patient master. Đây là dữ liệu **\*\*lượt điều trị / liệu trình / ngày đi\*\***.

**## 4.1. Header \`01. KH TỔNG 2026\`**

\| Cột | Header | Target |

\|---|---|---|

\| A | STT | \`legacy\_row\_no\` |

\| B | Đối tượng | \`encounter.patient\_type\` hoặc tag; hiện một phần ý nghĩa còn nằm ở màu ô |

\| C | Năm | Thành phần của \`start\_date\` |

\| D | Tháng | Thành phần của \`start\_date\` |

\| E | Ngày | Thành phần của \`start\_date\` |

\| F | Bác sĩ đảm trách | \`treatment\_courses.primary\_doctor\_id\` |

\| G | Họ tên | Lookup sang \`patient\_id\`, không copy làm khóa |

\| H | SĐT | Snapshot/đối chiếu patient |

\| I | CCCD | Snapshot/đối chiếu patient |

\| J | BHYT | Matching \`patient\_id\` + insurance card |

\| K | Mức hưởng | \`insurance\_verifications.benefit\_rate\` |

\| L | Địa chỉ | Snapshot / update patient |

\| M | Giới tính | Patient demographics |

\| N | Năm sinh | Thực tế year hoặc full date |

\| O | Chiều cao | Measurement |

\| P | Cân nặng | Measurement |

\| Q | Kéo - K5-k10 | Dữ liệu điều trị đặc thù của version này |

\| R | Mã bệnh | \`course\_diagnoses\` |

\| S | Tình trạng | \`course\_status\` / clinical note tùy giá trị |

\| T | LT1 | Dữ liệu course / khoảng thời gian |

\| U | LT2 | Dữ liệu course / khoảng thời gian |

\| V | Ghi chú | \`treatment\_courses.notes\` |

\| W\:BA | Ngày 1..31 | Attendance theo ngày → \`treatment\_sessions\` |

\| BB\:BE | Lần liên hệ 1..4 | \`contact\_attempts\` |

**## 4.2. Schema drift giữa các tháng**

Đây là lý do **\*\*không được viết importer theo letter column cố định cho mọi sheet\*\***.

Ví dụ tháng 7:

\| Cột | \`072026\` |

\|---|---|

\| Q | LT1 |

\| R | LT2 |

\| S | BỆNH |

\| T | Ghi chú |

\| U\:AY | Ngày điều trị 1..31 |

\| AZ\:BC | Trạng thái liên lạc lần 1..4 |

Trong khi \`01. KH TỔNG 2026\`:

\- Q = \`Kéo - K5-k10\`

\- R = \`Mã bệnh\`

\- S = \`Tình Trạng\`

\- T/U = LT1/LT2

\- W\:BA = ngày điều trị

**\*\*Kết luận:\*\*** importer phải nhận biết sheet/version bằng header text + row ngày, không map cứng \`Q = ...\` cho tất cả file.

**## 4.3. Các dấu ✓ theo ngày**

Excel đang dùng dấu \`✓\` trong các cột ngày 1..31 để biểu diễn bệnh nhân đã đi/được đánh dấu điều trị.

Không tạo 31 boolean trong database.

Target:

\`\`\`text

treatment\_sessions

\- id

\- treatment\_course\_id

\- appointment\_id

\- service\_date

\- status

\- checked\_in\_at

\- started\_at

\- completed\_at

\- attendance\_source

\`\`\`

Một dấu ✓ → một \`treatment\_session\` hoặc cập nhật session của ngày đó thành \`COMPLETED/ATTENDED\`.

\---

**# 5. Phân tích \`thông tuyến LT1 082026\`**

Đây là sheet quan trọng nhất để nối **\*\*tiếp nhận → liệu trình → bảng giờ tháng 8\*\***.

Sheet được chia thành section:

\`\`\`text

LIỆU TRÌNH 1

LIỆU TRÌNH 2

LIỆU TRÌNH 3

\`\`\`

Một bệnh nhân có thể xuất hiện ở nhiều section. Điều đó xác nhận rằng \`LT1\`, \`LT2\`, \`LT3\` phải là **\*\*Treatment Course\*\***, không phải một field đơn trên patient.

**## 5.1. Mapping chính**

\| Excel | Header | Target field |

\|---|---|---|

\| A | STT | \`legacy\_row\_no\` |

\| B | THÁNG | \`reception\_at / course\_start\_at\` |

\| C | NGÀY | \`reception\_at / course\_start\_at\` |

\| D | GIỜ | \`receptions.arrived\_at\` hoặc \`requested\_time\` |

\| E | HỌ TÊN | Match \`patient\_id\` |

\| F | Số ngày điều trị | \`treatment\_courses.planned\_session\_count\` |

\| G | Năm sinh | \`patients.date\_of\_birth\` / \`birth\_year\` |

\| H | Chiều cao | measurement |

\| I | Cân nặng | measurement |

\| J | MÃ BH | insurance card |

\| K | DVKT THỰC TẾ (bs cho) | \`course\_service\_orders\` với source \`DOCTOR\_ACTUAL\` |

\| L | BỆNH | \`clinical\_note\` / diagnosis text |

\| M | Mã bệnh | \`course\_diagnoses\` |

\| N | DVKT LẦN 1 | \`course\_service\_orders\` sequence/plan đầu tiên |

**## 5.2. Legend đang được encode bằng format/màu**

Các dòng đầu sheet có chú thích:

\`\`\`text

Nhập His

Tiếp nhận có hs giấy

Bệnh nhân mới hoàn toàn

Khách cũ thường đi

Khách bỏ, không đi đầy đủ

\`\`\`

Trong Excel, một phần trạng thái này đang được nhận biết qua màu/font.

Hệ thống mới phải biến thành field rõ ràng:

\`\`\`ts

reception\_source:

  HIS\_IMPORTED

  PAPER\_FILE

  MANUAL

patient\_relation\_type:

  NEW\_PATIENT

  RETURNING\_PATIENT

course\_adherence\_status:

  NORMAL

  AT\_RISK

  DROPPED

\`\`\`

Không đọc màu trên UI để quyết định business logic.

\---

**# 6. Phân tích \`BẢNG GIỜ\` tháng 8**

Sheet \`BẢNG GIỜ\` hiện có 4 block bác sĩ chính:

\- BS Anh Thư

\- BS Tuấn

\- BS Kha

\- BS Ngọc Thu

Mỗi block có dạng:

\`\`\`text

Cột A       STT

Cột B       Giá trị phụ / số LT / marker cũ (dữ liệu hiện không hoàn toàn nhất quán)

Cột C       TÊN BN

Cột D       Ghi chú/cảnh báo: K5, BỎ, IN KÍ, NGUY HIỂM, ĐẶC BIỆT...

Cột E\:AI    Ngày 1 → 31, giá trị trong ô là GIỜ

\`\`\`

**## 6.1. Quyết định cực kỳ quan trọng**

Không tạo table như:

\`\`\`sql

patient\_schedule(

  patient\_id,

  day\_1\_time,

  day\_2\_time,

  ...,

  day\_31\_time

)

\`\`\`

Đó là copy lỗi Excel sang database.

Phải dùng:

\`\`\`text

appointments

\---------------------------------

id

patient\_id

treatment\_course\_id

doctor\_id

appointment\_date

start\_at

status

notes

\`\`\`

UI tháng mới dựng matrix:

\`\`\`text

Patient | 01/08 | 02/08 | 03/08 | ...

\`\`\`

từ các appointment rows.

**## 6.2. Cột D phải thành tags/status rõ ràng**

Các giá trị thấy trong file:

\`\`\`text

K5

K5-K7

BỎ

IN KÍ

NGUY HIỂM

ĐẶC BIỆT

\`\`\`

Không nên nhét tất cả vào một enum duy nhất vì chúng thuộc nhiều loại khác nhau.

Đề nghị:

\`\`\`text

course\_tags

\- id

\- code

\- label

\- category

categories:

\- CLINICAL\_ALERT

\- PAPERWORK

\- SCHEDULING

\- TREATMENT

\- ADHERENCE

\`\`\`

Ví dụ:

\`\`\`text

BỎ        → ADHERENCE / DROPPED

IN\_KY     → PAPERWORK

DAC\_BIET  → SCHEDULING / SPECIAL

NGUY\_HIEM → CLINICAL\_ALERT

K5        → TREATMENT tag (sau khi xác nhận nghiệp vụ chính xác)

\`\`\`

**## 6.3. Không dùng tên bệnh nhân để nối bảng giờ**

Trong file hiện có tên kiểu:

\`\`\`text

Tên A

Tên A 1967

Tên B (1972)

\`\`\`

Vì vậy UI có thể hiển thị tên, nhưng row phải giữ:

\`\`\`text

patient\_id

course\_id

\`\`\`

**## 6.4. Bảng giờ hiện đang dùng một slot template**

Các giờ đầu bảng khớp với sheet \`CLS 65 BỆNH\`.

Ví dụ chuỗi đầu ngày bắt đầu gần:

\`\`\`text

07:34

07:39

07:44

07:50

...

\`\`\`

Tức là bệnh nhân được stagger khoảng 5 phút.

Đây là bằng chứng rằng bảng giờ hiện tại thực chất đang kết hợp:

\`\`\`text

Patient order

\+ Doctor block

\+ Slot template

\+ Resource rotation

\+ Manual overrides

\`\`\`

Hệ thống mới nên tự sinh các slot thay vì lưu một template copy tay theo tháng.

\---

**# 7. Phân tích resource ở đầu \`BẢNG GIỜ\`**

Phần trên cùng có các tên nhân sự và \`combo máy 1..15\`, lặp theo nhóm.

Điều này cho thấy lịch không chỉ phụ thuộc bác sĩ; nó còn phụ thuộc:

\- Y sĩ/KTV.

\- Nhóm máy/combo máy.

\- Dịch vụ bệnh nhân cần làm.

\- Thời lượng từng công đoạn.

Do đó database phải có resource model.

Không hardcode:

\`\`\`ts

if (combo === 1) ...

if (staff === 'THANH') ...

\`\`\`

Phải có table cấu hình.

\---

**# 8. Phân tích \`CLS 65 BỆNH\` — cơ sở cho scheduling engine**

Sheet này rất quan trọng vì nó chứa logic năng lực phục vụ.

**## 8.1. Capacity hiện tại được thể hiện trong Excel**

Bảng đầu sheet thể hiện quy mô gần như:

\| Số bệnh nhân | Bác sĩ | Y sĩ | Nhóm máy |

\|---:|---:|---:|---:|

\| 64 | 1 | 2 | 5 |

\| 128 | 2 | 4 | 10 |

\| 192 | 3 | 6 | 15 |

\| 256 | 4 | 8 | 20 |

\| 320 | 5 | 10 | 25 |

Các con số này phải được coi là **\*\*default capacity rule lấy từ Excel\*\***, nhưng cần cho phép admin chỉnh sau này.

**## 8.2. Thời lượng pipeline thường**

Dòng cấu hình thời lượng của Excel cho thấy một flow mẫu:

\`\`\`text

Tiếp nhận / chuyển khám        \~ 5 phút

Chỉ định                      \~ 1 phút

Bó thuốc                      \~ 30 phút

Chuyển công đoạn              \~ 1 phút

Điện châm / Hào châm          \~ 25 phút

Chuyển công đoạn              \~ 1 phút

Xông / Ngâm / Thủy            \~ 20 phút

Ra viện / chuyển trạng thái   \~ 1 phút

\`\`\`

Tổng flow mẫu khoảng:

\`\`\`text

5 + 1 + 30 + 1 + 25 + 1 + 20 + 1 = 84 phút

\`\`\`

**\*\*Không hardcode 84 phút trong code.\*\***

Phải seed thành database:

\`\`\`text

service\_catalog.default\_duration\_minutes

workflow\_step.transition\_minutes

\`\`\`

và cho phép chỉnh qua admin.

**## 8.3. Hai loại thời gian cần tách**

Trong file tháng 8 có:

\- \`GIỜ\` ở sheet thông tuyến: thời gian tiếp nhận/đến ban đầu.

\- \`BẢNG GIỜ\`: giờ slot kế hoạch theo lịch.

Target phải có cả:

\`\`\`text

arrived\_at / registered\_at

scheduled\_start\_at

\`\`\`

Không overwrite cái này bằng cái kia.

\---

**# 9. Phân tích \`MÃ BỆNH\` và mapping mã bệnh/DVKT**

Sheet \`MÃ BỆNH\` có các cột:

\`\`\`text

HỌ TÊN

MÃ THẺ

NĂM SINH

MÃ CHÍNH

MÃ PHỤ

LẦN 1

LẦN 2

CÂN NẶNG

CHIỀU CAO

\`\`\`

Nó đang đóng vai trò lookup hỗ trợ bác sĩ/nhân viên.

Không nên tạo một patient table thứ hai cho sheet này.

Target:

\`\`\`text

diagnosis\_catalog

course\_diagnoses

service\_catalog

course\_service\_orders

\`\`\`

Sheet phụ \`Sheet1\` trong workbook bảng giờ còn cho thấy mapping:

\`\`\`text

MÃ TÂY Y

MÃ U / YHCT

DVKT CHỈ ĐỊNH

Tên bệnh YHCT

Tên bệnh Tây y

\`\`\`

Nên seed thành catalog để người dùng search/select thay vì gõ tự do mọi lần.

\---

**# 10. Workflow hiện tại được reconstruct từ Excel**

Quy trình hiện tại có thể hiểu như sau:

\`\`\`text

1\. Bệnh nhân đến

   ↓

2\. Lễ tân tìm thông tin trong file khách hàng

   ↓

3\. Nhập/thêm bệnh nhân vào sheet tháng / thông tuyến

   ↓

4\. Xác định LT1/LT2/LT3 + số ngày điều trị

   ↓

5\. Bác sĩ cho DVKT / mã bệnh

   ↓

6\. Nhân viên đưa tên bệnh nhân qua BẢNG GIỜ

   ↓

7\. Chọn block bác sĩ

   ↓

8\. Chọn dòng / slot giờ

   ↓

9\. Dựa vào y sĩ + combo máy + màu/công thức để sắp

   ↓

10\. Mỗi ngày đánh dấu đi/không đi

   ↓

11\. Nếu bỏ liệu trình → sang DS GỌI

\`\`\`

Hệ thống mới phải biến nó thành một flow duy nhất, không copy dữ liệu giữa các file.

\---


---

# APPENDIX B — ORIGINAL EXCEL MIGRATION EVIDENCE

> Apply these source-data rules together with V3 Section 23: each operational legacy row must be assigned to a confirmed source clinic before creating Reception/Course/Appointment history.

**# 25. Migration strategy từ Excel**

Không import trực tiếp vào production tables từ frontend.

**## Phase M1 — Ingest raw**

Mỗi sheet → \`legacy\_source\_rows.raw\_data\`.

**## Phase M2 — Normalize**

Normalize:

\- Name.

\- Phone.

\- CCCD.

\- BHYT.

\- DOB.

\- Height.

\- Weight.

\- Excel serial dates/times.

**## Phase M3 — Patient matching**

Priority:

\`\`\`text

BHYT exact

→ CCCD exact

→ phone + DOB/name

→ fuzzy candidate

\`\`\`

**## Phase M4 — Merge Review**

UI:

\`\`\`text

Candidate A              Candidate B

Tên                      Tên

DOB                      DOB

BHYT                     BHYT

CCCD                     CCCD

SĐT                      SĐT

Địa chỉ                  Địa chỉ

[Same patient - Merge]

[Different patients]

[Skip]

\`\`\`

**## Phase M5 — Import courses**

\- Monthly sheet row = encounter/course history.

\- LT section determines \`course\_no\` where trustworthy.

\- Dấu ✓ → session attendance.

**## Phase M6 — Import August schedule**

BẢNG GIỜ:

\`\`\`text

Doctor block

\+ patient match

\+ day column

\+ time value

→ appointment

\`\`\`

Matching phải dùng patient/course ID từ migration, không rely vào name nếu đã có BHYT mapping từ nguồn.

**## Phase M7 — Reconciliation report**

Output:

\`\`\`text

Imported patients

Merged duplicates

Rows unresolved

Invalid BHYT

Invalid CCCD

Ambiguous DOB

Ambiguous phone

Appointments without patient match

\`\`\`

Không go-live nếu còn nhiều unresolved rows không được review.

\---

**# 26. Quy tắc import đặc biệt**

**## 26.1. BHYT placeholder**

Các text kiểu:

\`\`\`text

CHƯA CÓ THÔNG TIN VỀ THẺ NÀY

\`\`\`

không phải card number.

Chuyển thành:

\`\`\`text

insurance\_verification\_status = NOT\_FOUND

card\_number = null nếu không có số thật

\`\`\`

**## 26.2. Tên có hậu tố năm sinh**

Ví dụ:

\`\`\`text

Tên BN 1967

Tên BN (1972)

\`\`\`

Khi matching có thể strip suffix để tạo \`normalized\_name\`, nhưng display name chuẩn phải lấy từ patient master.

**## 26.3. Giá trị giờ Excel**

Excel lưu giờ dạng fraction của ngày.

Ví dụ:

\`\`\`text

0.315277... → 07:34

\`\`\`

Importer phải convert đúng thành local time.

**## 26.4. Màu và font**

Trong migration có thể đọc style để map trạng thái cũ, nhưng sau migration phải lưu explicit field/tag.

\---


---

# APPENDIX C — UNRESOLVED BUSINESS RULES FROM V1

> These remain unresolved unless V3 explicitly supersedes them. Antigravity must not convert them into hardcoded rules without business confirmation.

**# 38. Các nghiệp vụ còn cần phòng khám xác nhận sau khi dựng skeleton**

Các điểm này **\*\*không cản trở việc code schema/core\*\***, nhưng cần xác nhận trước khi hoàn thiện scheduler:

1\. Cột B trong BẢNG GIỜ hiện được dùng chính xác cho số liệu trình hay còn ý nghĩa khác; file có một số value/time format không nhất quán.

2\. \`K5\`, \`K7\`, \`K10\` chính xác là số buổi, loại kéo, máy hay quy ước nội bộ nào.

3\. Một bệnh nhân tối đa bao nhiêu buổi trong một ngày.

4\. LT planned 5/7/10 ngày có luôn liên tiếp hay có thể chọn ngày.

5\. Mỗi nhóm DVKT chính xác cần máy/y sĩ nào.

6\. Một \`combo máy\` có capacity là 1 hay có thể chạy nhiều bệnh nhân song song.

7\. Bác sĩ có cần thực hiện đủ 5 phút cho từng bệnh nhân hay có trường hợp group/batch.

8\. Giờ trong BẢNG GIỜ là giờ tiếp nhận, giờ khám hay giờ bắt đầu pipeline chính thức đối với từng block.

9\. Quy tắc auto-cancel future appointments khi bệnh nhân \`BỎ\`.

10\. Bao nhiêu ngày không đi thì tự đưa vào danh sách CSKH.

Hệ thống nên để các rule này configurable để tránh phải đổi schema về sau.

\---

