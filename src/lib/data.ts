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

export function useNominationsRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("nominations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "nominations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["nominations"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
