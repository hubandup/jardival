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
      catalogue_extraction_stats: {
        Row: {
          aspect_ratio: number | null
          bbox_height: number | null
          bbox_width: number | null
          bbox_xmax: number
          bbox_xmin: number
          bbox_ymax: number
          bbox_ymin: number
          catalogue_id: string | null
          category: string | null
          created_at: string
          had_original_price: boolean
          had_price: boolean
          id: string
          page_number: number | null
        }
        Insert: {
          aspect_ratio?: number | null
          bbox_height?: number | null
          bbox_width?: number | null
          bbox_xmax: number
          bbox_xmin: number
          bbox_ymax: number
          bbox_ymin: number
          catalogue_id?: string | null
          category?: string | null
          created_at?: string
          had_original_price?: boolean
          had_price?: boolean
          id?: string
          page_number?: number | null
        }
        Update: {
          aspect_ratio?: number | null
          bbox_height?: number | null
          bbox_width?: number | null
          bbox_xmax?: number
          bbox_xmin?: number
          bbox_ymax?: number
          bbox_ymin?: number
          catalogue_id?: string | null
          category?: string | null
          created_at?: string
          had_original_price?: boolean
          had_price?: boolean
          id?: string
          page_number?: number | null
        }
        Relationships: []
      }
      catalogue_extractions: {
        Row: {
          catalogue_id: string
          created_at: string
          ends_at: string | null
          id: string
          promos: Json
          starts_at: string | null
          status: string
          step: string
          updated_at: string
        }
        Insert: {
          catalogue_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          promos?: Json
          starts_at?: string | null
          status?: string
          step?: string
          updated_at?: string
        }
        Update: {
          catalogue_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          promos?: Json
          starts_at?: string | null
          status?: string
          step?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalogues: {
        Row: {
          active: boolean
          cover_image: string | null
          created_at: string
          display_order: number
          ends_at: string | null
          hero_colors: Json | null
          id: string
          pdf_url: string | null
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cover_image?: string | null
          created_at?: string
          display_order?: number
          ends_at?: string | null
          hero_colors?: Json | null
          id?: string
          pdf_url?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cover_image?: string | null
          created_at?: string
          display_order?: number
          ends_at?: string | null
          hero_colors?: Json | null
          id?: string
          pdf_url?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          alt: string | null
          bucket: string
          caption: string | null
          created_at: string
          credit: string | null
          description: string | null
          height: number | null
          id: string
          mime_type: string | null
          path: string
          public_url: string
          seo_slug: string | null
          size_bytes: number | null
          tags: string[] | null
          title: string | null
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt?: string | null
          bucket: string
          caption?: string | null
          created_at?: string
          credit?: string | null
          description?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          path: string
          public_url: string
          seo_slug?: string | null
          size_bytes?: number | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt?: string | null
          bucket?: string
          caption?: string | null
          created_at?: string
          credit?: string | null
          description?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          path?: string
          public_url?: string
          seo_slug?: string | null
          size_bytes?: number | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          path: string
          referrer: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          discount: number
          display_order: number
          id: string
          image: string | null
          images: string[] | null
          is_new: boolean
          name: string
          old_price: number | null
          price: number | null
          ref: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          discount?: number
          display_order?: number
          id?: string
          image?: string | null
          images?: string[] | null
          is_new?: boolean
          name: string
          old_price?: number | null
          price?: number | null
          ref?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          discount?: number
          display_order?: number
          id?: string
          image?: string | null
          images?: string[] | null
          is_new?: boolean
          name?: string
          old_price?: number | null
          price?: number | null
          ref?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean
          catalogue_id: string | null
          created_at: string
          description: string | null
          display_order: number
          ends_at: string | null
          hero_featured: boolean
          id: string
          image: string | null
          original_price: number | null
          price: number | null
          slug: string | null
          starts_at: string | null
          store_ids: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          catalogue_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          ends_at?: string | null
          hero_featured?: boolean
          id?: string
          image?: string | null
          original_price?: number | null
          price?: number | null
          slug?: string | null
          starts_at?: string | null
          store_ids?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          catalogue_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          ends_at?: string | null
          hero_featured?: boolean
          id?: string
          image?: string | null
          original_price?: number | null
          price?: number | null
          slug?: string | null
          starts_at?: string | null
          store_ids?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_catalogue_id_fkey"
            columns: ["catalogue_id"]
            isOneToOne: false
            referencedRelation: "catalogues"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      stores: {
        Row: {
          address: string
          city: string
          created_at: string
          department: string
          hours: Json | null
          id: string
          image: string | null
          latitude: number
          longitude: number
          name: string
          phone: string | null
          postal_code: string | null
          services: string[] | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          department: string
          hours?: Json | null
          id: string
          image?: string | null
          latitude: number
          longitude: number
          name: string
          phone?: string | null
          postal_code?: string | null
          services?: string[] | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          department?: string
          hours?: Json | null
          id?: string
          image?: string | null
          latitude?: number
          longitude?: number
          name?: string
          phone?: string | null
          postal_code?: string | null
          services?: string[] | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      pageviews_daily: {
        Args: { _days: number }
        Returns: {
          day: string
          views: number
        }[]
      }
      pageviews_stats: {
        Args: { _days: number }
        Returns: {
          desktop_views: number
          mobile_views: number
          tablet_views: number
          total_views: number
          unique_sessions: number
        }[]
      }
      pageviews_top_paths: {
        Args: { _days: number; _limit?: number }
        Returns: {
          path: string
          views: number
        }[]
      }
      pageviews_top_products: {
        Args: { _days: number; _limit?: number }
        Returns: {
          product_id: string
          product_name: string
          views: number
        }[]
      }
      pageviews_top_stores: {
        Args: { _days: number; _limit?: number }
        Returns: {
          store_id: string
          store_name: string
          views: number
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      slugify: { Args: { _text: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "admin"
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
      app_role: ["super_admin", "admin"],
    },
  },
} as const
