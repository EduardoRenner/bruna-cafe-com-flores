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
      admin_login_attempts: {
        Row: {
          attempted_at: string
          id: number
          ip: string
        }
        Insert: {
          attempted_at?: string
          id?: never
          ip: string
        }
        Update: {
          attempted_at?: string
          id?: never
          ip?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          active: boolean
          bairro: string
          created_at: string
          fee: number
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bairro: string
          created_at?: string
          fee: number
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bairro?: string
          created_at?: string
          fee?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_rate_limit: {
        Row: {
          created_at: string
          id: number
          ip: string
        }
        Insert: {
          created_at?: string
          id?: never
          ip: string
        }
        Update: {
          created_at?: string
          id?: never
          ip?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_address: Json | null
          delivery_date: string | null
          delivery_time: string | null
          delivery_type: string
          id: string
          items: Json
          mp_payment_id: string | null
          mp_preference_id: string | null
          notes: string | null
          order_number: string
          payment_method: string
          payment_provider: string | null
          payment_status: string
          public_token: string
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivery_address?: Json | null
          delivery_date?: string | null
          delivery_time?: string | null
          delivery_type: string
          id?: string
          items: Json
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          notes?: string | null
          order_number: string
          payment_method: string
          payment_provider?: string | null
          payment_status?: string
          public_token?: string
          status?: string
          total: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_address?: Json | null
          delivery_date?: string | null
          delivery_time?: string | null
          delivery_type?: string
          id?: string
          items?: Json
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          notes?: string | null
          order_number?: string
          payment_method?: string
          payment_provider?: string | null
          payment_status?: string
          public_token?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          error: string | null
          event_type: string | null
          id: number
          payload: Json | null
          payment_id: string | null
          processed: boolean
          provider: string
          provider_event_id: string
          received_at: string
          signature_valid: boolean
        }
        Insert: {
          error?: string | null
          event_type?: string | null
          id?: never
          payload?: Json | null
          payment_id?: string | null
          processed?: boolean
          provider: string
          provider_event_id: string
          received_at?: string
          signature_valid?: boolean
        }
        Update: {
          error?: string | null
          event_type?: string | null
          id?: never
          payload?: Json | null
          payment_id?: string | null
          processed?: boolean
          provider?: string
          provider_event_id?: string
          received_at?: string
          signature_valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          method: string | null
          order_id: string
          paid_at: string | null
          provider: string
          provider_payment_id: string | null
          provider_preference_id: string | null
          status: string
          status_detail: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          order_id: string
          paid_at?: string | null
          provider: string
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          status?: string
          status_detail?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          order_id?: string
          paid_at?: string | null
          provider?: string
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          status?: string
          status_detail?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          created_at: string
          draft_order: Json | null
          history: Json
          human_takeover: boolean
          id: string
          last_message_at: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft_order?: Json | null
          history?: Json
          human_takeover?: boolean
          id?: string
          last_message_at?: string
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft_order?: Json | null
          history?: Json
          human_takeover?: boolean
          id?: string
          last_message_at?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_message_events: {
        Row: {
          id: number
          message_id: string
          phone: string
          received_at: string
        }
        Insert: {
          id?: never
          message_id: string
          phone: string
          received_at?: string
        }
        Update: {
          id?: never
          message_id?: string
          phone?: string
          received_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_order_rate_limit: { Args: { _ip: string }; Returns: boolean }
      check_whatsapp_rate_limit: { Args: { _phone: string }; Returns: boolean }
      confirm_payment: {
        Args: {
          _gateway_amount_cents: number
          _gateway_status: string
          _method?: string
          _payment_id: string
          _provider_payment_id: string
          _status_detail?: string
        }
        Returns: string
      }
      get_order_public_status: {
        Args: { _token: string }
        Returns: {
          created_at: string
          order_number: string
          payment_status: string
          status: string
          total: number
        }[]
      }
      set_admin_password: {
        Args: { _new_password: string }
        Returns: undefined
      }
      verify_admin_login: {
        Args: { _ip: string; _password: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
