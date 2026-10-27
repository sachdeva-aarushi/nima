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
      articles: {
        Row: {
          category: string
          created_at: string
          fetched_at: string
          id: string
          image: string | null
          is_curated: boolean
          slug: string
          source_name: string | null
          source_url: string | null
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          fetched_at?: string
          id?: string
          image?: string | null
          is_curated?: boolean
          slug: string
          source_name?: string | null
          source_url?: string | null
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          fetched_at?: string
          id?: string
          image?: string | null
          is_curated?: boolean
          slug?: string
          source_name?: string | null
          source_url?: string | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      baby_logs: {
        Row: {
          created_at: string
          id: string
          log_type: string
          note: string | null
          occurred_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          log_type: string
          note?: string | null
          occurred_at?: string
          user_id: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          log_type?: string
          note?: string | null
          occurred_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json
          role: Database["public"]["Enums"]["chat_role"]
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          role: Database["public"]["Enums"]["chat_role"]
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: Database["public"]["Enums"]["chat_role"]
          user_id?: string
        }
        Relationships: []
      }
      checkins: {
        Row: {
          created_at: string
          energy_level: number | null
          id: string
          mood: Database["public"]["Enums"]["checkin_mood"]
          note: string | null
          sleep_hours: number | null
          symptoms: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          energy_level?: number | null
          id?: string
          mood: Database["public"]["Enums"]["checkin_mood"]
          note?: string | null
          sleep_hours?: number | null
          symptoms?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          energy_level?: number | null
          id?: string
          mood?: Database["public"]["Enums"]["checkin_mood"]
          note?: string | null
          sleep_hours?: number | null
          symptoms?: string[]
          user_id?: string
        }
        Relationships: []
      }
      daily_article_suggestions: {
        Row: {
          created_at: string
          shown_date: string
          slug: string
          user_id: string
        }
        Insert: {
          created_at?: string
          shown_date?: string
          slug: string
          user_id: string
        }
        Update: {
          created_at?: string
          shown_date?: string
          slug?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_pulse: {
        Row: {
          created_at: string
          pulse_date: string
          question: string
          user_id: string
        }
        Insert: {
          created_at?: string
          pulse_date: string
          question: string
          user_id: string
        }
        Update: {
          created_at?: string
          pulse_date?: string
          question?: string
          user_id?: string
        }
        Relationships: []
      }
      experience_post_likes: {
        Row: {
          created_at: string
          liker_id: string
          post_id: string
        }
        Insert: {
          created_at?: string
          liker_id: string
          post_id: string
        }
        Update: {
          created_at?: string
          liker_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "experience_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_post_views: {
        Row: {
          created_at: string
          post_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "experience_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_posts: {
        Row: {
          ai_flag_reason: string | null
          ai_flagged: boolean
          content: string
          cover_image_path: string | null
          created_at: string
          crisis_flagged: boolean
          display_name: string
          id: string
          like_count: number
          status: Database["public"]["Enums"]["experience_post_status"]
          title: string | null
          topic_tags: string[]
          updated_at: string
          user_id: string
          view_count: number
          week_postpartum: number | null
        }
        Insert: {
          ai_flag_reason?: string | null
          ai_flagged?: boolean
          content: string
          cover_image_path?: string | null
          created_at?: string
          crisis_flagged?: boolean
          display_name: string
          id?: string
          like_count?: number
          status?: Database["public"]["Enums"]["experience_post_status"]
          title?: string | null
          topic_tags?: string[]
          updated_at?: string
          user_id: string
          view_count?: number
          week_postpartum?: number | null
        }
        Update: {
          ai_flag_reason?: string | null
          ai_flagged?: boolean
          content?: string
          cover_image_path?: string | null
          created_at?: string
          crisis_flagged?: boolean
          display_name?: string
          id?: string
          like_count?: number
          status?: Database["public"]["Enums"]["experience_post_status"]
          title?: string | null
          topic_tags?: string[]
          updated_at?: string
          user_id?: string
          view_count?: number
          week_postpartum?: number | null
        }
        Relationships: []
      }
      health_records: {
        Row: {
          created_at: string
          id: string
          is_abnormal: boolean
          notes: string | null
          record_type: string
          recorded_at: string
          source: Database["public"]["Enums"]["record_source"]
          source_document_id: string | null
          title: string | null
          unit: string | null
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          is_abnormal?: boolean
          notes?: string | null
          record_type: string
          recorded_at?: string
          source?: Database["public"]["Enums"]["record_source"]
          source_document_id?: string | null
          title?: string | null
          unit?: string | null
          updated_at?: string
          user_id: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          is_abnormal?: boolean
          notes?: string | null
          record_type?: string
          recorded_at?: string
          source?: Database["public"]["Enums"]["record_source"]
          source_document_id?: string | null
          title?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "health_records_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "scanned_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_cards_shown: {
        Row: {
          action_taken: string | null
          card_key: string
          context: Json
          dismissed_at: string | null
          id: string
          shown_at: string
          user_id: string
        }
        Insert: {
          action_taken?: string | null
          card_key: string
          context?: Json
          dismissed_at?: string | null
          id?: string
          shown_at?: string
          user_id: string
        }
        Update: {
          action_taken?: string | null
          card_key?: string
          context?: Json
          dismissed_at?: string | null
          id?: string
          shown_at?: string
          user_id?: string
        }
        Relationships: []
      }
      insight_extraction_log: {
        Row: {
          created_at: string
          extracted_insight_id: string | null
          id: string
          raw_excerpt: string | null
          source: string
          source_ref: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_insight_id?: string | null
          id?: string
          raw_excerpt?: string | null
          source: string
          source_ref?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_insight_id?: string | null
          id?: string
          raw_excerpt?: string | null
          source?: string
          source_ref?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_extraction_log_extracted_insight_id_fkey"
            columns: ["extracted_insight_id"]
            isOneToOne: false
            referencedRelation: "mother_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      mother_insights: {
        Row: {
          active: boolean
          confidence: Database["public"]["Enums"]["insight_confidence"]
          created_at: string
          first_observed_at: string
          id: string
          insight_text: string
          insight_type: Database["public"]["Enums"]["insight_type"]
          last_confirmed_at: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          confidence?: Database["public"]["Enums"]["insight_confidence"]
          created_at?: string
          first_observed_at?: string
          id?: string
          insight_text: string
          insight_type: Database["public"]["Enums"]["insight_type"]
          last_confirmed_at?: string
          source: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          confidence?: Database["public"]["Enums"]["insight_confidence"]
          created_at?: string
          first_observed_at?: string
          id?: string
          insight_text?: string
          insight_type?: Database["public"]["Enums"]["insight_type"]
          last_confirmed_at?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_care_alerts: {
        Row: {
          alert_context: string
          alert_type: string
          created_at: string
          id: string
          mother_user_id: string
          nima_guidance: Json
          partner_user_id: string
          seen_at: string | null
        }
        Insert: {
          alert_context: string
          alert_type: string
          created_at?: string
          id?: string
          mother_user_id: string
          nima_guidance?: Json
          partner_user_id: string
          seen_at?: string | null
        }
        Update: {
          alert_context?: string
          alert_type?: string
          created_at?: string
          id?: string
          mother_user_id?: string
          nima_guidance?: Json
          partner_user_id?: string
          seen_at?: string | null
        }
        Relationships: []
      }
      partner_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          mother_user_id: string
          partner_user_id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mother_user_id: string
          partner_user_id: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mother_user_id?: string
          partner_user_id?: string
          role?: string
        }
        Relationships: []
      }
      partner_consent_settings: {
        Row: {
          id: string
          mother_user_id: string
          share_appointments: boolean
          share_chat_summary: boolean
          share_checkin_streak: boolean
          share_mood: boolean
          share_symptoms: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          mother_user_id: string
          share_appointments?: boolean
          share_chat_summary?: boolean
          share_checkin_streak?: boolean
          share_mood?: boolean
          share_symptoms?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          mother_user_id?: string
          share_appointments?: boolean
          share_chat_summary?: boolean
          share_checkin_streak?: boolean
          share_mood?: boolean
          share_symptoms?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      partner_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invite_code: string
          mother_user_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invite_code: string
          mother_user_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invite_code?: string
          mother_user_id?: string
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_insights_enabled: boolean
          birth_date: string | null
          birth_traumatic: boolean | null
          created_at: string
          delivery_type: Database["public"]["Enums"]["delivery_type"] | null
          doctor_sharing_enabled: boolean
          due_date: string | null
          has_seen_intro: boolean
          id: string
          linked_user_id: string | null
          name: string | null
          nervous_tags: string[]
          nervous_text: string | null
          onboarded_at: string | null
          role: Database["public"]["Enums"]["account_role"]
          updated_at: string
          usage_analytics_enabled: boolean
        }
        Insert: {
          ai_insights_enabled?: boolean
          birth_date?: string | null
          birth_traumatic?: boolean | null
          created_at?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          doctor_sharing_enabled?: boolean
          due_date?: string | null
          has_seen_intro?: boolean
          id: string
          linked_user_id?: string | null
          name?: string | null
          nervous_tags?: string[]
          nervous_text?: string | null
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["account_role"]
          updated_at?: string
          usage_analytics_enabled?: boolean
        }
        Update: {
          ai_insights_enabled?: boolean
          birth_date?: string | null
          birth_traumatic?: boolean | null
          created_at?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          doctor_sharing_enabled?: boolean
          due_date?: string | null
          has_seen_intro?: boolean
          id?: string
          linked_user_id?: string | null
          name?: string | null
          nervous_tags?: string[]
          nervous_text?: string | null
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["account_role"]
          updated_at?: string
          usage_analytics_enabled?: boolean
        }
        Relationships: []
      }
      progress_reports: {
        Row: {
          data: Json
          generated_at: string
          id: string
          period_end: string
          period_start: string
          summary: string | null
          user_id: string
        }
        Insert: {
          data?: Json
          generated_at?: string
          id?: string
          period_end: string
          period_start: string
          summary?: string | null
          user_id: string
        }
        Update: {
          data?: Json
          generated_at?: string
          id?: string
          period_end?: string
          period_start?: string
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quiz_sessions: {
        Row: {
          answers: Json
          completed_at: string | null
          id: string
          questions: Json
          quiz_type: string
          result_summary: string | null
          score: Json | null
          started_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          id?: string
          questions?: Json
          quiz_type: string
          result_summary?: string | null
          score?: Json | null
          started_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          id?: string
          questions?: Json
          quiz_type?: string
          result_summary?: string | null
          score?: Json | null
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scanned_documents: {
        Row: {
          ai_model: string | null
          confirmed_at: string | null
          confirmed_data: Json | null
          created_at: string
          document_kind: string | null
          error_message: string | null
          extracted_data: Json
          id: string
          mime_type: string | null
          original_filename: string | null
          status: Database["public"]["Enums"]["scan_status"]
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          confirmed_at?: string | null
          confirmed_data?: Json | null
          created_at?: string
          document_kind?: string | null
          error_message?: string | null
          extracted_data?: Json
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          status?: Database["public"]["Enums"]["scan_status"]
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_model?: string | null
          confirmed_at?: string | null
          confirmed_data?: Json | null
          created_at?: string
          document_kind?: string | null
          error_message?: string | null
          extracted_data?: Json
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          status?: Database["public"]["Enums"]["scan_status"]
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      week_postpartum: { Args: { _birth_date: string }; Returns: number }
    }
    Enums: {
      account_role: "mother" | "partner"
      chat_role: "user" | "nima"
      checkin_mood: "good" | "great" | "okay" | "very_low" | "low" | "crisis"
      delivery_type: "vaginal" | "c_section" | "assisted" | "unknown"
      experience_post_status: "pending" | "published" | "rejected"
      insight_confidence: "low" | "medium" | "high"
      insight_type: "pattern" | "preference" | "context" | "concern"
      record_source:
        | "manual"
        | "scanned_document"
        | "ai_inferred"
        | "quiz_session"
      scan_status:
        | "uploaded"
        | "processing"
        | "awaiting_review"
        | "confirmed"
        | "rejected"
        | "failed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_role: ["mother", "partner"],
      chat_role: ["user", "nima"],
      checkin_mood: ["good", "great", "okay", "very_low", "low", "crisis"],
      delivery_type: ["vaginal", "c_section", "assisted", "unknown"],
      experience_post_status: ["pending", "published", "rejected"],
      insight_confidence: ["low", "medium", "high"],
      insight_type: ["pattern", "preference", "context", "concern"],
      record_source: [
        "manual",
        "scanned_document",
        "ai_inferred",
        "quiz_session",
      ],
      scan_status: [
        "uploaded",
        "processing",
        "awaiting_review",
        "confirmed",
        "rejected",
        "failed",
      ],
    },
  },
} as const
