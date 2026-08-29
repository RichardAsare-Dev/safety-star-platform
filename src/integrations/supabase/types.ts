export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      departments: {
        Row: {
          batch_category: Database["public"]["Enums"]["batch_category"]
          created_at: string
          id: string
          name: string
        }
        Insert: {
          batch_category: Database["public"]["Enums"]["batch_category"]
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          batch_category?: Database["public"]["Enums"]["batch_category"]
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      nominations: {
        Row: {
          action_type: Database["public"]["Enums"]["nomination_action"]
          award_categories: string[]
          capa_closure_rate: number | null
          citation_note: string | null
          created_at: string
          disqualification_reason: string | null
          hod_duty_of_care: number | null
          hod_hazard_awareness: number | null
          hod_participation: number | null
          hod_safe_work_behavior: number | null
          hod_speaking_up: number | null
          hse_score: number | null
          id: string
          nominee_department_id: string | null
          nominee_id: string | null
          nominee_position_title: string | null
          recordable_injury: boolean
          status: Database["public"]["Enums"]["nomination_status"]
          voter_department_id: string | null
          voter_name: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["nomination_action"]
          award_categories?: string[]
          capa_closure_rate?: number | null
          citation_note?: string | null
          created_at?: string
          disqualification_reason?: string | null
          hod_duty_of_care?: number | null
          hod_hazard_awareness?: number | null
          hod_participation?: number | null
          hod_safe_work_behavior?: number | null
          hod_speaking_up?: number | null
          hse_score?: number | null
          id?: string
          nominee_department_id?: string | null
          nominee_id?: string | null
          nominee_position_title?: string | null
          recordable_injury?: boolean
          status?: Database["public"]["Enums"]["nomination_status"]
          voter_department_id?: string | null
          voter_name: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["nomination_action"]
          award_categories?: string[]
          capa_closure_rate?: number | null
          citation_note?: string | null
          created_at?: string
          disqualification_reason?: string | null
          hod_duty_of_care?: number | null
          hod_hazard_awareness?: number | null
          hod_participation?: number | null
          hod_safe_work_behavior?: number | null
          hod_speaking_up?: number | null
          hse_score?: number | null
          id?: string
          nominee_department_id?: string | null
          nominee_id?: string | null
          nominee_position_title?: string | null
          recordable_injury?: boolean
          status?: Database["public"]["Enums"]["nomination_status"]
          voter_department_id?: string | null
          voter_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "nominations_nominee_department_id_fkey"
            columns: ["nominee_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nominations_nominee_id_fkey"
            columns: ["nominee_id"]
            isOneToOne: false
            referencedRelation: "users_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nominations_voter_department_id_fkey"
            columns: ["voter_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      program_settings: {
        Row: {
          admin_pin: string
          created_at: string
          hod_pin: string
          id: string
          maturity_stage: string
          voting_closes_at: string
        }
        Insert: {
          admin_pin?: string
          created_at?: string
          hod_pin?: string
          id?: string
          maturity_stage?: string
          voting_closes_at: string
        }
        Update: {
          admin_pin?: string
          created_at?: string
          hod_pin?: string
          id?: string
          maturity_stage?: string
          voting_closes_at?: string
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          created_at: string
          employee_name: string
          id: string
          mobile_contact: string
          note: string | null
        }
        Insert: {
          created_at?: string
          employee_name: string
          id?: string
          mobile_contact: string
          note?: string | null
        }
        Update: {
          created_at?: string
          employee_name?: string
          id?: string
          mobile_contact?: string
          note?: string | null
        }
        Relationships: []
      }
      users_employees: {
        Row: {
          created_at: string
          department_id: string
          email: string | null
          full_name: string
          id: string
          is_nominee: boolean
          leadership_tier: Database["public"]["Enums"]["leadership_tier"]
          mobile_contact: string | null
          position_title: string
        }
        Insert: {
          created_at?: string
          department_id: string
          email?: string | null
          full_name: string
          id?: string
          is_nominee?: boolean
          leadership_tier?: Database["public"]["Enums"]["leadership_tier"]
          mobile_contact?: string | null
          position_title: string
        }
        Update: {
          created_at?: string
          department_id?: string
          email?: string | null
          full_name?: string
          id?: string
          is_nominee?: boolean
          leadership_tier?: Database["public"]["Enums"]["leadership_tier"]
          mobile_contact?: string | null
          position_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      batch_category: "Batch I" | "Batch II"
      leadership_tier: "Lead" | "Coordinator" | "Non-Leadership"
      nomination_action: "Check Batch I" | "Check Batch II" | "Request Support"
      nomination_status:
        | "Pending HSE Verification"
        | "Disqualified"
        | "Approved for HOD Evaluation"
        | "Completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      batch_category: ["Batch I", "Batch II"],
      leadership_tier: ["Lead", "Coordinator", "Non-Leadership"],
      nomination_action: ["Check Batch I", "Check Batch II", "Request Support"],
      nomination_status: [
        "Pending HSE Verification",
        "Disqualified",
        "Approved for HOD Evaluation",
        "Completed",
      ],
    },
  },
} as const
