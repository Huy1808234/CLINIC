import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { MigrationValidationReport, MigrationCommitResult } from "@/types/migration";
import { parseExcelWorkbook } from "./excel-parser";
import { normalizeLegacyRow } from "./row-normalizer";
import { validateLegacyRows } from "./migration-validator";
import { createOrMatchPatient } from "@/lib/patients/patient-service";
import { createTreatmentCourse } from "@/lib/treatments/course-service";

export interface MigrationImportOptions {
  fileName: string;
  buffer: ArrayBuffer | Uint8Array | Buffer;
  monthStr?: string; // "2026-08" for appointment dates
  isDryRun?: boolean;
  actorUserId?: string;
}

export async function executeMigrationImport(
  supabase: SupabaseClient<Database>,
  options: MigrationImportOptions
): Promise<{
  report: MigrationValidationReport;
  commitResult?: MigrationCommitResult;
}> {
  const isDryRun = options.isDryRun ?? true;
  const monthStr = options.monthStr ?? new Date().toISOString().slice(0, 7); // "YYYY-MM"

  // 1. Create Import Batch Record
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      file_name: options.fileName,
      sheet_name: null,
      started_at: new Date().toISOString(),
      status: "RUNNING",
      imported_by: options.actorUserId || null,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    throw new Error(`Failed to create import batch: ${batchError?.message}`);
  }

  const batchId = (batch as unknown as { id: string }).id;

  // 2. Parse Workbook & Normalize Rows
  const parsedWorkbook = parseExcelWorkbook(options.buffer);
  const normalizedRows: ReturnType<typeof normalizeLegacyRow>[] = [];

  let globalRowCounter = 1;
  for (const sheet of parsedWorkbook.sheets) {
    for (const rawRow of sheet.rows) {
      // Ignore completely empty rows
      const hasContent = Object.values(rawRow).some((v) => v !== null && v !== undefined && v !== "");
      if (!hasContent) continue;

      const normalized = normalizeLegacyRow(rawRow, globalRowCounter++, sheet.sheetName);
      normalizedRows.push(normalized);
    }
  }

  // 3. Validate Rows & Match Patients
  const validationReport = await validateLegacyRows(supabase, options.fileName, normalizedRows);

  // 4. Save Staging Rows into legacy_source_rows table
  const stagingInserts = normalizedRows.map((row) => {
    const preview = validationReport.preview_items.find((p) => p.row_no === row.excel_row_no);
    const hasError = preview && preview.errors.length > 0;

    return {
      import_batch_id: batchId,
      sheet_name: row.sheet_name,
      excel_row_no: row.excel_row_no,
      raw_data: JSON.parse(JSON.stringify(row.raw)) as Json,
      matched_patient_id: preview?.matched_patient_id || null,
      result_status: hasError ? "ERROR" : isDryRun ? "VALID" : "PENDING",
      error_message: hasError ? preview?.errors.join("; ") : null,
    };
  });

  if (stagingInserts.length > 0) {
    await supabase.from("legacy_source_rows").insert(stagingInserts);
  }

  // 5. If Dry Run, finalize batch and return report (AC-10)
  if (isDryRun) {
    await supabase
      .from("import_batches")
      .update({
        completed_at: new Date().toISOString(),
        status: "COMPLETED",
      })
      .eq("id", batchId);

    return {
      report: validationReport,
    };
  }

  // 6. Commit Mode: Process and commit valid rows to production tables
  let committedPatients = 0;
  let reusedPatients = 0;
  let committedCourses = 0;
  let committedAppointments = 0;
  let errorsCount = 0;

  // Resolve Doctor mapping
  const { data: doctors } = await supabase
    .from("staff")
    .select("id, staff_code, full_name")
    .eq("role_type", "DOCTOR")
    .eq("is_active", true);

  const docList = (doctors as Array<{ id: string; staff_code: string; full_name: string }>) || [];

  for (const row of normalizedRows) {
    const preview = validationReport.preview_items.find((p) => p.row_no === row.excel_row_no);
    if (preview && preview.errors.length > 0) {
      errorsCount++;
      continue;
    }

    try {
      // Step A: Create or match Patient master record
      const patientResult = await createOrMatchPatient(
        supabase,
        {
          full_name: row.full_name,
          phone: row.phone,
          citizen_id: row.citizen_id,
          insurance_card_number: row.card_number,
          birth_date: row.birth_date,
          birth_year: row.birth_year,
          dob_precision: row.dob_precision,
          address: row.address,
        },
        options.actorUserId
      );

      if (!patientResult.patient) {
        errorsCount++;
        continue;
      }

      if (patientResult.isExisting) {
        reusedPatients++;
      } else {
        committedPatients++;
      }

      const patientId = patientResult.patient.id;

      // Step B: Match Doctor by name if present
      let doctorId: string | null = null;
      if (row.doctor_name) {
        const foundDoc = docList.find(
          (d) =>
            d.full_name.toLowerCase().includes(row.doctor_name!.toLowerCase()) ||
            row.doctor_name!.toLowerCase().includes(d.full_name.toLowerCase())
        );
        if (foundDoc) {
          doctorId = foundDoc.id;
        }
      }

      // Step C: Create Treatment Course
      const courseStartDate = `${monthStr}-01`;
      const plannedSessions = row.day_appointments.length > 0 ? row.day_appointments.length : 7;

      const courseResult = await createTreatmentCourse(
        supabase,
        {
          patient_id: patientId,
          primary_doctor_id: doctorId,
          start_date: courseStartDate,
          planned_session_count: plannedSessions,
          diagnoses: row.diagnoses.map((d) => ({
            raw_text: d,
            diagnosis_type: "PRIMARY",
            is_primary: true,
          })),
        },
        null,
        options.actorUserId
      );

      if (!courseResult.course) {
        errorsCount++;
        continue;
      }

      committedCourses++;
      const courseId = courseResult.course.id;

      // Step D: Create Appointments from legacy day columns
      for (let seq = 0; seq < row.day_appointments.length; seq++) {
        const dayAppt = row.day_appointments[seq];
        const dayStr = String(dayAppt.day_of_month).padStart(2, "0");
        const apptDate = `${monthStr}-${dayStr}`;
        const scheduledStartAt = `${apptDate}T${dayAppt.time_str}:00+07:00`;

        const { error: apptError } = await supabase.from("appointments").insert({
          patient_id: patientId,
          treatment_course_id: courseId,
          doctor_id: doctorId,
          appointment_date: apptDate,
          scheduled_start_at: scheduledStartAt,
          status: "PLANNED",
          schedule_source: "MIGRATION",
          sequence_in_day: seq + 1,
          manual_override: false,
        });

        if (!apptError) {
          committedAppointments++;
        }
      }

      // Update staging row result_status to COMMITTED
      await supabase
        .from("legacy_source_rows")
        .update({
          result_status: "COMMITTED",
          matched_patient_id: patientId,
        })
        .eq("import_batch_id", batchId)
        .eq("excel_row_no", row.excel_row_no);
    } catch {
      errorsCount++;
    }
  }

  // Finalize Batch
  await supabase
    .from("import_batches")
    .update({
      completed_at: new Date().toISOString(),
      status: errorsCount === 0 ? "COMPLETED" : "COMPLETED",
    })
    .eq("id", batchId);

  return {
    report: validationReport,
    commitResult: {
      batch_id: batchId,
      total_processed: normalizedRows.length,
      committed_patients: committedPatients,
      reused_patients: reusedPatients,
      committed_courses: committedCourses,
      committed_appointments: committedAppointments,
      errors_count: errorsCount,
    },
  };
}
