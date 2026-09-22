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
      appointments: {
        Row: {
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          confirmed: boolean
          created_at: string
          id: string
          lead_id: string | null
          scheduled_for: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          confirmed?: boolean
          created_at?: string
          id?: string
          lead_id?: string | null
          scheduled_for: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          confirmed?: boolean
          created_at?: string
          id?: string
          lead_id?: string | null
          scheduled_for?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_name: string | null
          body: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          body?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          body?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          filter_query: string
          id: string
          image_url: string | null
          position: number
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          filter_query?: string
          id?: string
          image_url?: string | null
          position?: number
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          filter_query?: string
          id?: string
          image_url?: string | null
          position?: number
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          created_at: string
          details: Json
          email: string
          full_name: string
          id: string
          internal_notes: string | null
          lead_type: Database["public"]["Enums"]["lead_type"]
          message: string | null
          phone: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          user_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          details?: Json
          email: string
          full_name: string
          id?: string
          internal_notes?: string | null
          lead_type: Database["public"]["Enums"]["lead_type"]
          message?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          user_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          details?: Json
          email?: string
          full_name?: string
          id?: string
          internal_notes?: string | null
          lead_type?: Database["public"]["Enums"]["lead_type"]
          message?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          user_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          legacy_user_id: number | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          legacy_user_id?: number | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          legacy_user_id?: number | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          alerts_enabled: boolean
          created_at: string
          id: string
          name: string
          query: string
          user_id: string
        }
        Insert: {
          alerts_enabled?: boolean
          created_at?: string
          id?: string
          name: string
          query: string
          user_id: string
        }
        Update: {
          alerts_enabled?: boolean
          created_at?: string
          id?: string
          name?: string
          query?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_vehicles: {
        Row: {
          created_at: string
          id: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_vehicles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_areas: {
        Row: {
          active: boolean
          body: string | null
          created_at: string
          id: string
          intro: string | null
          name: string
          position: number
          slug: string
          state: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string | null
          created_at?: string
          id?: string
          intro?: string | null
          name: string
          position?: number
          slug: string
          state?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string | null
          created_at?: string
          id?: string
          intro?: string | null
          name?: string
          position?: number
          slug?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          address_line: string
          dealership_name: string
          email: string
          finance_apr: number
          finance_disclosure: string
          finance_down_percent: number
          finance_term_months: number
          hours: Json
          id: number
          phone: string
          social: Json
          trust_badges: Json
          updated_at: string
        }
        Insert: {
          address_line?: string
          dealership_name?: string
          email?: string
          finance_apr?: number
          finance_disclosure?: string
          finance_down_percent?: number
          finance_term_months?: number
          hours?: Json
          id?: number
          phone?: string
          social?: Json
          trust_badges?: Json
          updated_at?: string
        }
        Update: {
          address_line?: string
          dealership_name?: string
          email?: string
          finance_apr?: number
          finance_disclosure?: string
          finance_down_percent?: number
          finance_term_months?: number
          hours?: Json
          id?: number
          phone?: string
          social?: Json
          trust_badges?: Json
          updated_at?: string
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
      vehicle_photos: {
        Row: {
          alt: string | null
          created_at: string
          id: string
          position: number
          url: string
          vehicle_id: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          position?: number
          url: string
          vehicle_id: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
          position?: number
          url?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_photos_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          body_style: Database["public"]["Enums"]["body_style"]
          created_at: string
          currency: string
          date_received: string
          description: string | null
          drivetrain: Database["public"]["Enums"]["drivetrain"] | null
          engine: string | null
          exterior_color: string | null
          features: string[]
          fuel_type: Database["public"]["Enums"]["fuel_type"] | null
          history_report_url: string | null
          id: string
          interior_color: string | null
          is_featured: boolean
          last_synced_at: string | null
          make: string
          mileage: number
          model: string
          mpg_combined: number | null
          price_cents: number
          prior_price_cents: number | null
          slug: string
          status: Database["public"]["Enums"]["vehicle_status"]
          stock_number: string
          transmission: string | null
          trim: string | null
          updated_at: string
          vin: string
          year: number
        }
        Insert: {
          body_style: Database["public"]["Enums"]["body_style"]
          created_at?: string
          currency?: string
          date_received?: string
          description?: string | null
          drivetrain?: Database["public"]["Enums"]["drivetrain"] | null
          engine?: string | null
          exterior_color?: string | null
          features?: string[]
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null
          history_report_url?: string | null
          id?: string
          interior_color?: string | null
          is_featured?: boolean
          last_synced_at?: string | null
          make: string
          mileage?: number
          model: string
          mpg_combined?: number | null
          price_cents: number
          prior_price_cents?: number | null
          slug: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          stock_number: string
          transmission?: string | null
          trim?: string | null
          updated_at?: string
          vin: string
          year: number
        }
        Update: {
          body_style?: Database["public"]["Enums"]["body_style"]
          created_at?: string
          currency?: string
          date_received?: string
          description?: string | null
          drivetrain?: Database["public"]["Enums"]["drivetrain"] | null
          engine?: string | null
          exterior_color?: string | null
          features?: string[]
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null
          history_report_url?: string | null
          id?: string
          interior_color?: string | null
          is_featured?: boolean
          last_synced_at?: string | null
          make?: string
          mileage?: number
          model?: string
          mpg_combined?: number | null
          price_cents?: number
          prior_price_cents?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          stock_number?: string
          transmission?: string | null
          trim?: string | null
          updated_at?: string
          vin?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "editor" | "shopper"
      appointment_type:
        | "test_drive"
        | "trade_appraisal"
        | "financing"
        | "general"
      body_style:
        | "SUV"
        | "Sedan"
        | "Truck"
        | "Coupe"
        | "Hatchback"
        | "Convertible"
        | "Minivan"
        | "Wagon"
        | "Van"
      drivetrain: "AWD/4WD" | "FWD" | "RWD"
      fuel_type: "Gas" | "Electric" | "Hybrid" | "Plug-in Hybrid" | "Diesel"
      lead_status: "new" | "contacted" | "working" | "won" | "lost"
      lead_type:
        | "finance"
        | "trade"
        | "appointment"
        | "contact"
        | "availability"
      vehicle_status: "available" | "pending" | "sold" | "draft"
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
      app_role: ["owner", "editor", "shopper"],
      appointment_type: [
        "test_drive",
        "trade_appraisal",
        "financing",
        "general",
      ],
      body_style: [
        "SUV",
        "Sedan",
        "Truck",
        "Coupe",
        "Hatchback",
        "Convertible",
        "Minivan",
        "Wagon",
        "Van",
      ],
      drivetrain: ["AWD/4WD", "FWD", "RWD"],
      fuel_type: ["Gas", "Electric", "Hybrid", "Plug-in Hybrid", "Diesel"],
      lead_status: ["new", "contacted", "working", "won", "lost"],
      lead_type: ["finance", "trade", "appointment", "contact", "availability"],
      vehicle_status: ["available", "pending", "sold", "draft"],
    },
  },
} as const
