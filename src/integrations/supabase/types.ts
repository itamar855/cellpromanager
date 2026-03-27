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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      product_history: {
        Row: {
          action: string
          created_at: string
          created_by: string
          id: string
          new_cost: number | null
          notes: string | null
          old_cost: number | null
          product_id: string
        }
        Insert: {
          action: string
          created_at?: string
          created_by: string
          id?: string
          new_cost?: number | null
          notes?: string | null
          old_cost?: number | null
          product_id: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string
          id?: string
          new_cost?: number | null
          notes?: string | null
          old_cost?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          event_type: string
          id: string
          is_active: boolean
          store_id: string
          url: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          is_active?: boolean
          store_id: string
          url: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          is_active?: boolean
          store_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          cpf: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cpf?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          status: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          lead_id: string | null
          sender: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          sender?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          sender?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string
          capacity: string | null
          color: string | null
          condition: string | null
          cost_price: number
          created_at: string
          created_by: string
          id: string
          imei: string | null
          model: string
          name: string
          product_type: string | null
          sale_price: number | null
          serial_number: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          brand: string
          capacity?: string | null
          color?: string | null
          condition?: string | null
          cost_price: number
          created_at?: string
          created_by: string
          id?: string
          imei?: string | null
          model: string
          name: string
          product_type?: string | null
          sale_price?: number | null
          serial_number?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          brand?: string
          capacity?: string | null
          color?: string | null
          condition?: string | null
          cost_price?: number
          created_at?: string
          created_by?: string
          id?: string
          imei?: string | null
          model?: string
          name?: string
          product_type?: string | null
          sale_price?: number | null
          serial_number?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          store_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          store_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          store_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          commission_percent: number | null
          commission_value: number | null
          created_at: string
          created_by: string
          customer_name: string | null
          customer_phone: string | null
          has_trade_in: boolean
          id: string
          notes: string | null
          payment_card: number
          payment_cash: number
          payment_pix: number
          product_id: string
          sale_price: number
          store_id: string
          trade_in_device_brand: string | null
          trade_in_device_imei: string | null
          trade_in_device_model: string | null
          trade_in_device_name: string | null
          trade_in_product_id: string | null
          trade_in_value: number | null
        }
        Insert: {
          commission_percent?: number | null
          commission_value?: number | null
          created_at?: string
          created_by: string
          customer_name?: string | null
          customer_phone?: string | null
          has_trade_in?: boolean
          id?: string
          notes?: string | null
          payment_card?: number
          payment_cash?: number
          payment_pix?: number
          product_id: string
          sale_price: number
          store_id: string
          trade_in_device_brand?: string | null
          trade_in_device_imei?: string | null
          trade_in_device_model?: string | null
          trade_in_device_name?: string | null
          trade_in_product_id?: string | null
          trade_in_value?: number | null
        }
        Update: {
          commission_percent?: number | null
          commission_value?: number | null
          created_at?: string
          created_by?: string
          customer_name?: string | null
          customer_phone?: string | null
          has_trade_in?: boolean
          id?: string
          notes?: string | null
          payment_card?: number
          payment_cash?: number
          payment_pix?: number
          product_id?: string
          sale_price?: number
          store_id?: string
          trade_in_device_brand?: string | null
          trade_in_device_imei?: string | null
          trade_in_device_model?: string | null
          trade_in_device_name?: string | null
          trade_in_product_id?: string | null
          trade_in_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_trade_in_product_id_fkey"
            columns: ["trade_in_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_history: {
        Row: {
          created_at: string
          created_by: string
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
          service_order_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          service_order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          service_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_history_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          customer_cpf: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          delivered_at: string | null
          device_accessories: string | null
          device_brand: string
          device_color: string | null
          device_condition: string | null
          device_imei: string | null
          device_model: string
          device_password: string | null
          entry_checklist: Json | null
          entry_signature: string | null
          estimated_completion: string | null
          estimated_price: number | null
          final_price: number | null
          id: string
          exit_checklist: Json | null
          exit_signature: string | null
          internal_notes: string | null
          order_number: number
          reported_defect: string
          requested_service: string
          signature_data: string | null
          status: string
          store_id: string | null
          technician_id: string | null
          terms_accepted: boolean | null
          terms_text: string | null
          updated_at: string
          warranty_end_date: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          customer_cpf?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          delivered_at?: string | null
          device_accessories?: string | null
          device_brand: string
          device_color?: string | null
          device_condition?: string | null
          device_imei?: string | null
          device_model: string
          device_password?: string | null
          entry_checklist?: Json | null
          entry_signature?: string | null
          estimated_completion?: string | null
          estimated_price?: number | null
          final_price?: number | null
          id?: string
          internal_notes?: string | null
          order_number?: number
          reported_defect: string
          requested_service: string
          signature_data?: string | null
          status?: string
          store_id?: string | null
          technician_id?: string | null
          terms_accepted?: boolean | null
          terms_text?: string | null
          updated_at?: string
          warranty_end_date?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          customer_cpf?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivered_at?: string | null
          device_accessories?: string | null
          device_brand?: string
          device_color?: string | null
          device_condition?: string | null
          device_imei?: string | null
          device_model?: string
          device_password?: string | null
          entry_checklist?: Json | null
          entry_signature?: string | null
          estimated_completion?: string | null
          estimated_price?: number | null
          final_price?: number | null
          id?: string
          exit_checklist?: Json | null
          exit_signature?: string | null
          internal_notes?: string | null
          order_number?: number
          reported_defect?: string
          requested_service?: string
          signature_data?: string | null
          status?: string
          store_id?: string | null
          technician_id?: string | null
          terms_accepted?: boolean | null
          terms_text?: string | null
          updated_at?: string
          warranty_end_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string
          agency: string | null
          bank_name: string
          created_at: string
          credit_fee_percent: number | null
          credit_settlement_days: number | null
          debit_fee_percent: number | null
          debit_settlement_days: number | null
          holder_cpf_cnpj: string | null
          holder_name: string | null
          id: string
          is_cashbox: boolean | null
          is_primary: boolean | null
          owner_type: string | null
          pix_fee_percent: number | null
          pix_key: string | null
          pix_settlement_days: number | null
          store_id: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string
          agency?: string | null
          bank_name: string
          created_at?: string
          credit_fee_percent?: number | null
          credit_settlement_days?: number | null
          debit_fee_percent?: number | null
          debit_settlement_days?: number | null
          holder_cpf_cnpj?: string | null
          holder_name?: string | null
          id?: string
          is_cashbox?: boolean | null
          is_primary?: boolean | null
          owner_type?: string | null
          pix_fee_percent?: number | null
          pix_key?: string | null
          pix_settlement_days?: number | null
          store_id: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_type?: string
          agency?: string | null
          bank_name?: string
          created_at?: string
          credit_fee_percent?: number | null
          credit_settlement_days?: number | null
          debit_fee_percent?: number | null
          debit_settlement_days?: number | null
          holder_cpf_cnpj?: string | null
          holder_name?: string | null
          id?: string
          is_cashbox?: boolean | null
          is_primary?: boolean | null
          owner_type?: string | null
          pix_fee_percent?: number | null
          pix_key?: string | null
          pix_settlement_days?: number | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_bank_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          destination_account_id: string | null
          expected_settlement_date: string | null
          id: string
          net_amount: number | null
          product_id: string | null
          reconciled: boolean | null
          source_account_id: string | null
          store_id: string | null
          type: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          destination_account_id?: string | null
          expected_settlement_date?: string | null
          id?: string
          net_amount?: number | null
          product_id?: string | null
          reconciled?: boolean | null
          source_account_id?: string | null
          store_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          destination_account_id?: string | null
          expected_settlement_date?: string | null
          id?: string
          net_amount?: number | null
          product_id?: string | null
          reconciled?: boolean | null
          source_account_id?: string | null
          store_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      cash_registers: {
        Row: {
          id: string
          store_id: string
          user_id: string | null
          status: string
          opened_at: string | null
          closed_at: string | null
          current_balance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          user_id?: string | null
          status?: string
          opened_at?: string | null
          closed_at?: string | null
          current_balance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          user_id?: string | null
          status?: string
          opened_at?: string | null
          closed_at?: string | null
          current_balance?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          }
        ]
      }
      cash_closures: {
        Row: {
          id: string
          cash_register_id: string
          store_id: string
          user_id: string
          opened_at: string
          closed_at: string
          reported_cash: number
          system_cash: number
          difference: number
          status: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cash_register_id: string
          store_id: string
          user_id: string
          opened_at: string
          closed_at?: string
          reported_cash: number
          system_cash: number
          difference: number
          status?: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cash_register_id?: string
          store_id?: string
          user_id?: string
          opened_at?: string
          closed_at?: string
          reported_cash?: number
          system_cash?: number
          difference?: number
          status?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_closures_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_closures_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          before_state: Json | null
          after_state: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          before_state?: Json | null
          after_state?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          before_state?: Json | null
          after_state?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      service_order_photos: {
        Row: {
          id: string
          service_order_id: string
          photo_url: string
          stage: string
          created_at: string
        }
        Insert: {
          id?: string
          service_order_id: string
          photo_url: string
          stage: string
          created_at?: string
        }
        Update: {
          id?: string
          service_order_id?: string
          photo_url?: string
          stage?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_photos_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          }
        ]
      }
      service_order_items: {
        Row: {
          id: string
          service_order_id: string
          product_id: string
          quantity: number
          unit_price: number
          unit_cost: number
          created_at: string
        }
        Insert: {
          id?: string
          service_order_id: string
          product_id: string
          quantity?: number
          unit_price: number
          unit_cost: number
          created_at?: string
        }
        Update: {
          id?: string
          service_order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          unit_cost?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_items_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
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
    }
    Enums: {
      app_role: "admin" | "gerente" | "vendedor" | "tecnico"
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
      app_role: ["admin", "gerente", "vendedor", "tecnico"],
    },
  },
} as const
