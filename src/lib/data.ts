import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { DEPARTMENT_ORDER, type Department, type Employee, type Nomination } from "./ohse";

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async (): Promise<Department[]> => {
      const { data, error } = await supabase.from("departments").select("*");
      if (error) throw error;
      return (data ?? []).sort(
        (a, b) => DEPARTMENT_ORDER.indexOf(a.name) - DEPARTMENT_ORDER.indexOf(b.name),
      );
    },
  });
}

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase
        .from("users_employees")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNominations() {
  return useQuery({
    queryKey: ["nominations"],
    queryFn: async (): Promise<Nomination[]> => {
      const { data, error } = await supabase
        .from("nominations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProgramSettings() {
  return useQuery({
    queryKey: ["program_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_settings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSupportRequests() {
  return useQuery({
    queryKey: ["support_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export async function deleteSupportRequest(id: string) {
  const { error } = await supabase.from("support_requests").delete().eq("id", id);
  if (error) throw error;
}

export function useNominationsRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("nominations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "nominations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["nominations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);
}

// ── Admin mutation helpers ────────────────────────────────────────────────────

export async function toggleNomineeStatus(id: string, is_nominee: boolean) {
  const { error } = await supabase.from("users_employees").update({ is_nominee }).eq("id", id);
  if (error) throw error;
}

export async function upsertEmployee(payload: {
  id?: string;
  full_name: string;
  position_title: string;
  leadership_tier: "Lead" | "Coordinator" | "Non-Leadership";
  department_id: string;
  email?: string | null;
  mobile_contact?: string | null;
  is_nominee?: boolean;
}) {
  if (payload.id) {
    const { id, ...rest } = payload;
    const { error } = await supabase.from("users_employees").update(rest).eq("id", id);
    if (error) throw error;
  } else {
    const { id: _id, ...rest } = payload;
    const { error } = await supabase.from("users_employees").insert(rest);
    if (error) throw error;
  }
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase.from("users_employees").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteNomination(id: string) {
  const { error } = await supabase.from("nominations").delete().eq("id", id);
  if (error) throw error;
}

export async function resetNominationStatus(id: string) {
  const { error } = await supabase
    .from("nominations")
    .update({
      status: "Pending HSE Verification",
      hse_score: null,
      capa_closure_rate: null,
      recordable_injury: false,
      disqualification_reason: null,
      hod_duty_of_care: null,
      hod_safe_work_behavior: null,
      hod_hazard_awareness: null,
      hod_speaking_up: null,
      hod_participation: null,
      citation_note: null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function updateProgramSettings(payload: {
  id: string;
  voting_closes_at: string;
  maturity_stage: string;
  admin_pin: string;
  hod_pin: string;
}) {
  const { id, ...rest } = payload;
  const { error } = await supabase.from("program_settings").update(rest).eq("id", id);
  if (error) throw error;
}

export async function upsertDepartment(payload: {
  id?: string;
  name: string;
  batch_category: "Batch I" | "Batch II";
}) {
  if (payload.id) {
    const { id, ...rest } = payload;
    const { error } = await supabase.from("departments").update(rest).eq("id", id);
    if (error) throw error;
  } else {
    const { id: _id, ...rest } = payload;
    const { error } = await supabase.from("departments").insert(rest);
    if (error) throw error;
  }
}

export async function deleteDepartment(id: string) {
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) throw error;
}
