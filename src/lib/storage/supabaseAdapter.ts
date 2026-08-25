import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimeEntry, CurrentTask, Absence } from "../../types";
import type { TimeEntryStore } from "./types";

const TASKS_TABLE = "tid_current_tasks";
const ABSENCES_TABLE = "tid_absences";

interface AbsenceRow {
  id: string;
  employee_id: string;
  work_date: string;
  start_time: string;
  expected_end: string | null;
  ended: string | null;
  absence_type: string;
  note: string;
  slettet: boolean;
  created_at: string;
  updated_at: string;
}
function absenceFromRow(r: AbsenceRow): Absence {
  return {
    id: r.id,
    employeeId: r.employee_id,
    workDate: r.work_date,
    startTime: r.start_time,
    expectedEnd: r.expected_end,
    ended: r.ended,
    absenceType: r.absence_type,
    note: r.note,
    slettet: r.slettet,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

interface TaskRow {
  employee_id: string;
  category: string;
  subcategory: string | null;
  order_number: string | null;
  note: string | null;
  updated_at: string;
  updated_by: string | null;
}
function taskFromRow(r: TaskRow): CurrentTask {
  return {
    employeeId: r.employee_id,
    categoryId: r.category,
    subcategoryId: r.subcategory,
    orderNumber: r.order_number,
    note: r.note,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by,
  };
}

// Supabase-adapter — den endelige løsning. Aktiveres når VITE_SUPABASE_URL og
// VITE_SUPABASE_ANON_KEY er sat (se index.ts). Uden credentials importeres
// dette modul slet ikke (dynamisk import), og local-adapteren bruges i stedet.
//
// employee_id sættes i V1 fra den valgte medarbejder (ingen login endnu).
// Når rigtig auth tilføjes, kan RLS binde employee_id til auth.uid().
// Se supabase/migrations for schema + policies.

const TABLE = "tid_time_entries";

// DB-række (snake_case).
interface Row {
  id: string;
  employee_id: string;
  work_date: string;
  slettet: boolean;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  category_id: string;
  subcategory_id: string | null;
  customer: string;
  note: string;
  is_break: boolean;
  is_redo: boolean;
  redo_reason: string | null;
  redo_note: string;
  split_group_id: string | null;
  created_at: string;
  updated_at: string;
}

function toRow(e: TimeEntry): Row {
  return {
    id: e.id,
    employee_id: e.employeeId,
    work_date: e.workDate,
    slettet: e.slettet,
    start_time: e.startTime,
    end_time: e.endTime,
    duration_minutes: e.durationMinutes,
    category_id: e.categoryId,
    subcategory_id: e.subcategoryId,
    customer: e.customer,
    note: e.note,
    is_break: e.isBreak,
    is_redo: e.isRedo,
    redo_reason: e.redoReason,
    redo_note: e.redoNote,
    split_group_id: e.splitGroupId,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

function fromRow(r: Row): TimeEntry {
  return {
    id: r.id,
    employeeId: r.employee_id,
    workDate: r.work_date,
    slettet: r.slettet,
    startTime: r.start_time,
    endTime: r.end_time,
    durationMinutes: r.duration_minutes,
    categoryId: r.category_id,
    subcategoryId: r.subcategory_id,
    customer: r.customer,
    note: r.note,
    isBreak: r.is_break,
    isRedo: r.is_redo,
    redoReason: r.redo_reason,
    redoNote: r.redo_note,
    splitGroupId: r.split_group_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// Kun de felter der kan ændres via editoren mappes til snake_case ved update.
function patchToRow(patch: Partial<TimeEntry>): Record<string, unknown> {
  const map: Record<keyof TimeEntry, string> = {
    id: "id",
    employeeId: "employee_id",
    workDate: "work_date",
    slettet: "slettet",
    startTime: "start_time",
    endTime: "end_time",
    durationMinutes: "duration_minutes",
    categoryId: "category_id",
    subcategoryId: "subcategory_id",
    customer: "customer",
    note: "note",
    isBreak: "is_break",
    isRedo: "is_redo",
    redoReason: "redo_reason",
    redoNote: "redo_note",
    splitGroupId: "split_group_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  };
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof TimeEntry)[]) {
    out[map[key]] = patch[key];
  }
  out.updated_at = new Date().toISOString();
  return out;
}

// Bruger den DELTE klient (fra supabaseClient.ts), så login-sessionen følger med.
export function createSupabaseAdapter(client: SupabaseClient): TimeEntryStore {
  return {
    name: "supabase",

    async getEntriesForDate(employeeId, isoDate) {
      const { data, error } = await client
        .from(TABLE)
        .select("*")
        .eq("employee_id", employeeId)
        .eq("work_date", isoDate)
        .eq("slettet", false)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data as Row[]).map(fromRow);
    },

    async getEntriesForDateAll(isoDate) {
      const { data, error } = await client
        .from(TABLE)
        .select("*")
        .eq("work_date", isoDate)
        .eq("slettet", false)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data as Row[]).map(fromRow);
    },

    async getEntriesInRange(fromIso, toIso) {
      const { data, error } = await client
        .from(TABLE)
        .select("*")
        .gte("work_date", fromIso)
        .lte("work_date", toIso)
        .eq("slettet", false)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data as Row[]).map(fromRow);
    },

    async addEntries(entries) {
      const rows = entries.map(toRow);
      const { error } = await client.from(TABLE).insert(rows);
      if (error) throw error;
    },

    async updateEntry(id, patch) {
      const { error } = await client.from(TABLE).update(patchToRow(patch)).eq("id", id);
      if (error) throw error;
    },

    // Soft-delete: markér slettet (updated_at/by sættes af trigger).
    async deleteEntry(id) {
      const { error } = await client.from(TABLE).update({ slettet: true }).eq("id", id);
      if (error) throw error;
    },

    async deleteSplitGroup(splitGroupId) {
      const { error } = await client
        .from(TABLE)
        .update({ slettet: true })
        .eq("split_group_id", splitGroupId);
      if (error) throw error;
    },

    // ---- Aktuel opgave ----
    // Læsninger fejler blødt (returnerer null/[]), så appen ikke knækker hvis
    // migration 0005 endnu ikke er kørt. Skrivninger kaster (UI viser fejl).
    async getCurrentTask(employeeId) {
      try {
        const { data, error } = await client
          .from(TASKS_TABLE)
          .select("*")
          .eq("employee_id", employeeId)
          .maybeSingle();
        if (error || !data) return null;
        return taskFromRow(data as TaskRow);
      } catch {
        return null;
      }
    },

    async getAllCurrentTasks() {
      try {
        const { data, error } = await client.from(TASKS_TABLE).select("*");
        if (error || !data) return [];
        return (data as TaskRow[]).map(taskFromRow);
      } catch {
        return [];
      }
    },

    async setCurrentTask(task) {
      // updated_at/updated_by håndteres af DB (default + trigger).
      const row = {
        employee_id: task.employeeId,
        category: task.categoryId,
        subcategory: task.subcategoryId,
        order_number: task.orderNumber,
        note: task.note,
      };
      const { error } = await client
        .from(TASKS_TABLE)
        .upsert(row, { onConflict: "employee_id" });
      if (error) throw error;
    },

    async clearCurrentTask(employeeId) {
      const { error } = await client
        .from(TASKS_TABLE)
        .delete()
        .eq("employee_id", employeeId);
      if (error) throw error;
    },

    // ---- Fravær ----
    // Læsninger fejler blødt (returnerer null/[]), så appen IKKE knækker før
    // migration 0006 (tid_absences) er kørt. Skrivninger kaster (UI viser fejl).
    async getAbsencesForDate(employeeId, isoDate) {
      try {
        const { data, error } = await client
          .from(ABSENCES_TABLE)
          .select("*")
          .eq("employee_id", employeeId)
          .eq("work_date", isoDate)
          .eq("slettet", false);
        if (error || !data) return [];
        return (data as AbsenceRow[]).map(absenceFromRow);
      } catch {
        return [];
      }
    },

    async getAbsencesForDateAll(isoDate) {
      try {
        const { data, error } = await client
          .from(ABSENCES_TABLE)
          .select("*")
          .eq("work_date", isoDate)
          .eq("slettet", false);
        if (error || !data) return [];
        return (data as AbsenceRow[]).map(absenceFromRow);
      } catch {
        return [];
      }
    },

    async getActiveAbsence(employeeId) {
      try {
        const { data, error } = await client
          .from(ABSENCES_TABLE)
          .select("*")
          .eq("employee_id", employeeId)
          .is("ended", null) // aktivt fravær = ended IS NULL
          .eq("slettet", false)
          .maybeSingle();
        if (error || !data) return null;
        return absenceFromRow(data as AbsenceRow);
      } catch {
        return null;
      }
    },

    async addAbsence(absence) {
      const row = {
        id: absence.id,
        employee_id: absence.employeeId,
        work_date: absence.workDate,
        start_time: absence.startTime,
        expected_end: absence.expectedEnd,
        ended: absence.ended,
        absence_type: absence.absenceType,
        note: absence.note,
        slettet: absence.slettet,
      };
      const { error } = await client.from(ABSENCES_TABLE).insert(row);
      if (error) throw error;
    },

    async endAbsence(id, ended) {
      const { error } = await client.from(ABSENCES_TABLE).update({ ended }).eq("id", id);
      if (error) throw error;
    },
  };
}
