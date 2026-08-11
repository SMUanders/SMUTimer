import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimeEntry } from "../../types";
import type { TimeEntryStore } from "./types";

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
  };
}
