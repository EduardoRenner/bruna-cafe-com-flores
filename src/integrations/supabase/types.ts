// Tipos do schema do Supabase da Bruna Café com Flores.
// No Lovable Cloud este arquivo é regenerado automaticamente a partir do banco;
// mantido aqui à mão para o build local/tipagem das server functions.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          category: string
          image_url: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price: number
          category: string
          image_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price?: number
          category?: string
          image_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          order_number: string
          customer_name: string
          customer_phone: string
          customer_email: string | null
          delivery_type: string
          delivery_address: Json | null
          delivery_date: string | null
          delivery_time: string | null
          payment_method: string
          notes: string | null
          status: string
          total: number
          items: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number?: string
          customer_name: string
          customer_phone: string
          customer_email?: string | null
          delivery_type: string
          delivery_address?: Json | null
          delivery_date?: string | null
          delivery_time?: string | null
          payment_method: string
          notes?: string | null
          status?: string
          total: number
          items: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: string
          [key: string]: Json | undefined
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          value: Json
          is_public: boolean
          updated_at: string
        }
        Insert: {
          key: string
          value: Json
          is_public?: boolean
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Json
          is_public?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          id: string
          bairro: string
          fee: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          bairro: string
          fee: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          bairro?: string
          fee?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_login_attempts: {
        Row: { id: number; ip: string; attempted_at: string }
        Insert: { id?: never; ip: string; attempted_at?: string }
        Update: { id?: never; ip?: string; attempted_at?: string }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      set_admin_password: {
        Args: { _new_password: string }
        Returns: undefined
      }
      verify_admin_login: {
        Args: { _password: string; _ip: string }
        Returns: string
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
