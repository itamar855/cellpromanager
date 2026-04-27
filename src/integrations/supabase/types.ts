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
      audit_logs: {
        Row: {
          action: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          store_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          store_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          store_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_closures: {
        Row: {
          cash_register_id: string
          closed_at: string
          created_at: string
          difference: number
          id: string
          notes: string | null
          opened_at: string
          reported_cash: number
          status: string
          store_id: string
          system_cash: number
          user_id: string
        }
        Insert: {
          cash_register_id: string
          closed_at?: string
          created_at?: string
          difference: number
          id?: string
          notes?: string | null
          opened_at: string
          reported_cash: number
          status?: string
          store_id: string
          system_cash: number
          user_id: string
        }
        Update: {
          cash_register_id?: string
          closed_at?: string
          created_at?: string
          difference?: number
          id?: string
          notes?: string | null
          opened_at?: string
          reported_cash?: number
          status?: string
          store_id?: string
          system_cash?: number
          user_id?: string
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
          },
        ]
      }
      cash_entries: {
        Row: {
          amount: number
          cash_register_id: string
          category: string | null
          confirmed: boolean | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          payment_method: string | null
          receipt_url: string | null
          sale_id: string | null
          service_order_id: string | null
          store_id: string
          type: string
        }
        Insert: {
          amount: number
          cash_register_id: string
          category?: string | null
          confirmed?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          receipt_url?: string | null
          sale_id?: string | null
          service_order_id?: string | null
          store_id: string
          type: string
        }
        Update: {
          amount?: number
          cash_register_id?: string
          category?: string | null
          confirmed?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          receipt_url?: string | null
          sale_id?: string | null
          service_order_id?: string | null
          store_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_entries_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          closed_at: string | null
          closing_amount: number | null
          closing_note: string | null
          closing_receipt_url: string | null
          created_at: string
          current_balance: number
          difference: number | null
          difference_reason: string | null
          expected_amount: number | null
          id: string
          opened_at: string | null
          opened_by: string | null
          opening_amount: number
          opening_receipt_url: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closing_amount?: number | null
          closing_note?: string | null
          closing_receipt_url?: string | null
          created_at?: string
          current_balance?: number
          difference?: number | null
          difference_reason?: string | null
          expected_amount?: number | null
          id?: string
          opened_at?: string | null
          opened_by?: string | null
          opening_amount?: number
          opening_receipt_url?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closing_amount?: number | null
          closing_note?: string | null
          closing_receipt_url?: string | null
          created_at?: string
          current_balance?: number
          difference?: number | null
          difference_reason?: string | null
          expected_amount?: number | null
          id?: string
          opened_at?: string | null
          opened_by?: string | null
          opening_amount?: number
          opening_receipt_url?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_store_id_fkey"
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
          birth_date: string | null
          cpf: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_expenses: {
        Row: {
          active: boolean | null
          amount: number
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string
          due_day: number | null
          id: string
          is_pf: boolean | null
          store_id: string | null
        }
        Insert: {
          active?: boolean | null
          amount: number
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          due_day?: number | null
          id?: string
          is_pf?: boolean | null
          store_id?: string | null
        }
        Update: {
          active?: boolean | null
          amount?: number
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          due_day?: number | null
          id?: string
          is_pf?: boolean | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_expenses_store_id_fkey"
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
          lead_id: string
          media_url: string | null
          message_type: string | null
          sender: string
          sender_user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          lead_id: string
          media_url?: string | null
          message_type?: string | null
          sender: string
          sender_user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          media_url?: string | null
          message_type?: string | null
          sender?: string
          sender_user_id?: string | null
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
      lead_responses: {
        Row: {
          content: string
          created_at: string
          id: string
          lead_id: string
          status: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lead_id: string
          status?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lead_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          last_message_at: string | null
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          status: string | null
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          last_message_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          last_message_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          battery_percentage: number | null
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
          ram: string | null
          sale_price: number | null
          serial_number: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          battery_percentage?: number | null
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
          ram?: string | null
          sale_price?: number | null
          serial_number?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          battery_percentage?: number | null
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
          ram?: string | null
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
      service_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          service_order_id: string
          unit_cost: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          service_order_id: string
          unit_cost: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          service_order_id?: string
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_photos: {
        Row: {
          created_at: string
          id: string
          photo_url: string
          service_order_id: string
          stage: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_url: string
          service_order_id: string
          stage: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_url?: string
          service_order_id?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_photos_service_order_id_fkey"
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
          exit_checklist: Json | null
          exit_signature: string | null
          final_price: number | null
          id: string
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
          exit_checklist?: Json | null
          exit_signature?: string | null
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
          exit_checklist?: Json | null
          exit_signature?: string | null
          final_price?: number | null
          id?: string
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
          receipt_url: string | null
          reconciled: boolean | null
          source_account_id: string | null
          status: string | null
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
          receipt_url?: string | null
          reconciled?: boolean | null
          source_account_id?: string | null
          status?: string | null
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
          receipt_url?: string | null
          reconciled?: boolean | null
          source_account_id?: string | null
          status?: string | null
          store_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "store_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "store_bank_accounts"
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
      whatsapp_config: {
        Row: {
          api_key: string
          api_url: string
          created_at: string | null
          id: string
          instance_name: string
          is_active: boolean | null
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string | null
          id?: string
          instance_name: string
          is_active?: boolean | null
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string | null
          id?: string
          instance_name?: string
          is_active?: boolean | null
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
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
      app_role: "admin" | "gerente" | "vendedor"
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
      app_role: ["admin", "gerente", "vendedor"],
    },
  },
} as const
