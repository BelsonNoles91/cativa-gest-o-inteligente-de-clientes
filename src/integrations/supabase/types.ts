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
      appointment_items: {
        Row: {
          appointment_id: string
          created_at: string
          duration_minutes: number
          id: string
          membership_balance_id: string | null
          notes: string | null
          package_balance_id: string | null
          position: number
          price_cents: number
          service_id: string
          tenant_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          duration_minutes: number
          id?: string
          membership_balance_id?: string | null
          notes?: string | null
          package_balance_id?: string | null
          position?: number
          price_cents?: number
          service_id: string
          tenant_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          membership_balance_id?: string | null
          notes?: string | null
          package_balance_id?: string | null
          position?: number
          price_cents?: number
          service_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_items_membership_balance_id_fkey"
            columns: ["membership_balance_id"]
            isOneToOne: false
            referencedRelation: "client_membership_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_items_package_balance_id_fkey"
            columns: ["package_balance_id"]
            isOneToOne: false
            referencedRelation: "client_package_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_logs: {
        Row: {
          action: string
          actor_id: string | null
          appointment_id: string
          created_at: string
          id: string
          metadata: Json
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          appointment_id: string
          created_at?: string
          id?: string
          metadata?: Json
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          appointment_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_status_history: {
        Row: {
          actor_id: string | null
          appointment_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["appointment_status"] | null
          id: string
          reason: string | null
          tenant_id: string
          to_status: Database["public"]["Enums"]["appointment_status"]
        }
        Insert: {
          actor_id?: string | null
          appointment_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["appointment_status"] | null
          id?: string
          reason?: string | null
          tenant_id: string
          to_status: Database["public"]["Enums"]["appointment_status"]
        }
        Update: {
          actor_id?: string | null
          appointment_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["appointment_status"] | null
          id?: string
          reason?: string | null
          tenant_id?: string
          to_status?: Database["public"]["Enums"]["appointment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "appointment_status_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_status_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          arrived_at: string | null
          buffer_after_minutes: number
          buffer_before_minutes: number
          canceled_at: string | null
          canceled_reason: string | null
          cancellation_policy_id: string | null
          client_id: string
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number
          ends_at: string
          id: string
          internal_notes: string | null
          is_overbooked: boolean
          is_walk_in: boolean
          no_show_at: string | null
          notes: string | null
          professional_id: string
          reminded_at: string | null
          resource_id: string | null
          source: Database["public"]["Enums"]["appointment_source"]
          started_at: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          total_price_cents: number
          unit_id: string
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          canceled_at?: string | null
          canceled_reason?: string | null
          cancellation_policy_id?: string | null
          client_id: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes: number
          ends_at: string
          id?: string
          internal_notes?: string | null
          is_overbooked?: boolean
          is_walk_in?: boolean
          no_show_at?: string | null
          notes?: string | null
          professional_id: string
          reminded_at?: string | null
          resource_id?: string | null
          source?: Database["public"]["Enums"]["appointment_source"]
          started_at?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          total_price_cents?: number
          unit_id: string
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          canceled_at?: string | null
          canceled_reason?: string | null
          cancellation_policy_id?: string | null
          client_id?: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          ends_at?: string
          id?: string
          internal_notes?: string | null
          is_overbooked?: boolean
          is_walk_in?: boolean
          no_show_at?: string | null
          notes?: string | null
          professional_id?: string
          reminded_at?: string | null
          resource_id?: string | null
          source?: Database["public"]["Enums"]["appointment_source"]
          started_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          tenant_id?: string
          total_price_cents?: number
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_cancellation_policy_id_fkey"
            columns: ["cancellation_policy_id"]
            isOneToOne: false
            referencedRelation: "cancellation_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          appointment_id: string | null
          called_at: string
          called_by: string | null
          client_id: string
          created_at: string
          duration_seconds: number | null
          id: string
          notes: string | null
          outcome: Database["public"]["Enums"]["call_outcome"]
          queue_id: string | null
          tenant_id: string
        }
        Insert: {
          appointment_id?: string | null
          called_at?: string
          called_by?: string | null
          client_id: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          outcome: Database["public"]["Enums"]["call_outcome"]
          queue_id?: string | null
          tenant_id: string
        }
        Update: {
          appointment_id?: string | null
          called_at?: string
          called_by?: string | null
          client_id?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          outcome?: Database["public"]["Enums"]["call_outcome"]
          queue_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "confirmation_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_policies: {
        Row: {
          created_at: string
          description: string | null
          hours_before_no_charge: number
          id: string
          is_default: boolean
          late_cancel_fee_pct: number
          name: string
          no_show_fee_pct: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hours_before_no_charge?: number
          id?: string
          is_default?: boolean
          late_cancel_fee_pct?: number
          name: string
          no_show_fee_pct?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hours_before_no_charge?: number
          id?: string
          is_default?: boolean
          late_cancel_fee_pct?: number
          name?: string
          no_show_fee_pct?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_preferences: {
        Row: {
          client_id: string
          created_at: string
          do_not_disturb: boolean
          fallback_channel:
            | Database["public"]["Enums"]["message_channel"]
            | null
          id: string
          notes: string | null
          preferred_channel: Database["public"]["Enums"]["message_channel"]
          preferred_window_end: string | null
          preferred_window_start: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          do_not_disturb?: boolean
          fallback_channel?:
            | Database["public"]["Enums"]["message_channel"]
            | null
          id?: string
          notes?: string | null
          preferred_channel?: Database["public"]["Enums"]["message_channel"]
          preferred_window_end?: string | null
          preferred_window_start?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          do_not_disturb?: boolean
          fallback_channel?:
            | Database["public"]["Enums"]["message_channel"]
            | null
          id?: string
          notes?: string | null
          preferred_channel?: Database["public"]["Enums"]["message_channel"]
          preferred_window_end?: string | null
          preferred_window_start?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_preferences_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_custom_field_values: {
        Row: {
          client_id: string
          created_at: string
          definition_id: string
          id: string
          tenant_id: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          client_id: string
          created_at?: string
          definition_id: string
          id?: string
          tenant_id: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          client_id?: string
          created_at?: string
          definition_id?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "client_custom_field_values_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_custom_field_values_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_custom_field_values_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_files: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_membership_balances: {
        Row: {
          created_at: string
          cycle_end: string | null
          cycle_start: string
          id: string
          service_id: string
          sessions_total: number
          sessions_used: number
          subscription_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_end?: string | null
          cycle_start?: string
          id?: string
          service_id: string
          sessions_total?: number
          sessions_used?: number
          subscription_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_end?: string | null
          cycle_start?: string
          id?: string
          service_id?: string
          sessions_total?: number
          sessions_used?: number
          subscription_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_membership_balances_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_membership_balances_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "client_membership_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_membership_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_membership_subscriptions: {
        Row: {
          canceled_at: string | null
          client_id: string
          created_at: string
          current_cycle_end: string | null
          current_cycle_start: string
          id: string
          membership_id: string
          notes: string | null
          started_at: string
          status: Database["public"]["Enums"]["client_subscription_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          client_id: string
          created_at?: string
          current_cycle_end?: string | null
          current_cycle_start?: string
          id?: string
          membership_id: string
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["client_subscription_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          client_id?: string
          created_at?: string
          current_cycle_end?: string | null
          current_cycle_start?: string
          id?: string
          membership_id?: string
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["client_subscription_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_membership_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_membership_subscriptions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_membership_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          author_id: string | null
          body: string
          client_id: string
          created_at: string
          id: string
          is_pinned: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          client_id: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_package_balances: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          package_id: string
          purchased_at: string
          service_id: string | null
          sessions_total: number
          sessions_used: number
          status: Database["public"]["Enums"]["client_package_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          package_id: string
          purchased_at?: string
          service_id?: string | null
          sessions_total?: number
          sessions_used?: number
          status?: Database["public"]["Enums"]["client_package_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          package_id?: string
          purchased_at?: string
          service_id?: string | null
          sessions_total?: number
          sessions_used?: number
          status?: Database["public"]["Enums"]["client_package_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_package_balances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_package_balances_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_package_balances_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_package_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_photos: {
        Row: {
          caption: string | null
          client_id: string
          created_at: string
          id: string
          pair_id: string | null
          photo_type: Database["public"]["Enums"]["client_photo_type"]
          storage_path: string
          taken_at: string | null
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          client_id: string
          created_at?: string
          id?: string
          pair_id?: string | null
          photo_type?: Database["public"]["Enums"]["client_photo_type"]
          storage_path: string
          taken_at?: string | null
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          client_id?: string
          created_at?: string
          id?: string
          pair_id?: string | null
          photo_type?: Database["public"]["Enums"]["client_photo_type"]
          storage_path?: string
          taken_at?: string | null
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_photos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_photos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reviews: {
        Row: {
          appointment_id: string
          client_id: string
          comment: string | null
          created_at: string
          id: string
          is_public: boolean
          professional_id: string | null
          rating: number
          tenant_id: string
          updated_at: string
          would_recommend: boolean | null
        }
        Insert: {
          appointment_id: string
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          professional_id?: string | null
          rating: number
          tenant_id: string
          updated_at?: string
          would_recommend?: boolean | null
        }
        Update: {
          appointment_id?: string
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          professional_id?: string | null
          rating?: number
          tenant_id?: string
          updated_at?: string
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "client_reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tag_relations: {
        Row: {
          client_id: string
          created_at: string
          tag_id: string
          tenant_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          tag_id: string
          tenant_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          tag_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tag_relations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tag_relations_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "client_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tag_relations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_timeline_events: {
        Row: {
          actor_id: string | null
          client_id: string
          created_at: string
          description: string | null
          event_type: Database["public"]["Enums"]["timeline_event_type"]
          id: string
          metadata: Json
          occurred_at: string
          reference_id: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          actor_id?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          event_type: Database["public"]["Enums"]["timeline_event_type"]
          id?: string
          metadata?: Json
          occurred_at?: string
          reference_id?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          actor_id?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          event_type?: Database["public"]["Enums"]["timeline_event_type"]
          id?: string
          metadata?: Json
          occurred_at?: string
          reference_id?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_timeline_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_timeline_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          client_id: string
          created_at: string
          id: string
          last_seen_at: string | null
          linked_at: string
          status: Database["public"]["Enums"]["client_user_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          last_seen_at?: string | null
          linked_at?: string
          status?: Database["public"]["Enums"]["client_user_status"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          last_seen_at?: string | null
          linked_at?: string
          status?: Database["public"]["Enums"]["client_user_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          allergies: string | null
          birth_date: string | null
          city: string | null
          contraindications: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          is_vip: boolean
          last_visit_at: string | null
          needs_reactivation: boolean
          next_visit_at: string | null
          notes: string | null
          origin: string | null
          phone: string | null
          postal_code: string | null
          preferences: string | null
          preferred_professional_id: string | null
          preferred_unit_id: string | null
          referred_by_client_id: string | null
          risk_level: Database["public"]["Enums"]["client_risk_level"]
          state: string | null
          status: Database["public"]["Enums"]["client_status"]
          tenant_id: string
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          allergies?: string | null
          birth_date?: string | null
          city?: string | null
          contraindications?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_vip?: boolean
          last_visit_at?: string | null
          needs_reactivation?: boolean
          next_visit_at?: string | null
          notes?: string | null
          origin?: string | null
          phone?: string | null
          postal_code?: string | null
          preferences?: string | null
          preferred_professional_id?: string | null
          preferred_unit_id?: string | null
          referred_by_client_id?: string | null
          risk_level?: Database["public"]["Enums"]["client_risk_level"]
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tenant_id: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          allergies?: string | null
          birth_date?: string | null
          city?: string | null
          contraindications?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_vip?: boolean
          last_visit_at?: string | null
          needs_reactivation?: boolean
          next_visit_at?: string | null
          notes?: string | null
          origin?: string | null
          phone?: string | null
          postal_code?: string | null
          preferences?: string | null
          preferred_professional_id?: string | null
          preferred_unit_id?: string | null
          referred_by_client_id?: string | null
          risk_level?: Database["public"]["Enums"]["client_risk_level"]
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tenant_id?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_preferred_professional_id_fkey"
            columns: ["preferred_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_preferred_unit_id_fkey"
            columns: ["preferred_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_referred_by_client_id_fkey"
            columns: ["referred_by_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      confirmation_queue: {
        Row: {
          appointment_id: string
          appointment_starts_at: string
          assigned_to: string | null
          attempts_count: number
          client_id: string
          closed_at: string | null
          created_at: string
          follow_up_at: string | null
          id: string
          last_attempt_at: string | null
          notes: string | null
          priority: number
          rule_id: string | null
          scheduled_for: string
          stage: Database["public"]["Enums"]["confirmation_stage"]
          status: Database["public"]["Enums"]["confirmation_queue_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          appointment_starts_at: string
          assigned_to?: string | null
          attempts_count?: number
          client_id: string
          closed_at?: string | null
          created_at?: string
          follow_up_at?: string | null
          id?: string
          last_attempt_at?: string | null
          notes?: string | null
          priority?: number
          rule_id?: string | null
          scheduled_for?: string
          stage: Database["public"]["Enums"]["confirmation_stage"]
          status?: Database["public"]["Enums"]["confirmation_queue_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          appointment_starts_at?: string
          assigned_to?: string | null
          attempts_count?: number
          client_id?: string
          closed_at?: string | null
          created_at?: string
          follow_up_at?: string | null
          id?: string
          last_attempt_at?: string | null
          notes?: string | null
          priority?: number
          rule_id?: string | null
          scheduled_for?: string
          stage?: Database["public"]["Enums"]["confirmation_stage"]
          status?: Database["public"]["Enums"]["confirmation_queue_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "confirmation_queue_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmation_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmation_queue_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "confirmation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmation_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      confirmation_rules: {
        Row: {
          applies_to_high_risk: boolean
          applies_to_protocol: boolean
          applies_to_vip: boolean
          base_priority: number
          created_at: string
          hours_before_appointment: number
          id: string
          is_active: boolean
          min_appointment_value_cents: number | null
          name: string
          skip_if_already_confirmed: boolean
          stage: Database["public"]["Enums"]["confirmation_stage"]
          tenant_id: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          applies_to_high_risk?: boolean
          applies_to_protocol?: boolean
          applies_to_vip?: boolean
          base_priority?: number
          created_at?: string
          hours_before_appointment?: number
          id?: string
          is_active?: boolean
          min_appointment_value_cents?: number | null
          name: string
          skip_if_already_confirmed?: boolean
          stage: Database["public"]["Enums"]["confirmation_stage"]
          tenant_id: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          applies_to_high_risk?: boolean
          applies_to_protocol?: boolean
          applies_to_vip?: boolean
          base_priority?: number
          created_at?: string
          hours_before_appointment?: number
          id?: string
          is_active?: boolean
          min_appointment_value_cents?: number | null
          name?: string
          skip_if_already_confirmed?: boolean
          stage?: Database["public"]["Enums"]["confirmation_stage"]
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "confirmation_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmation_rules_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_form_responses: {
        Row: {
          client_id: string
          created_at: string
          id: string
          metadata: Json
          signed_at: string | null
          signed_by: string | null
          signed_name: string | null
          signed_text: string | null
          status: Database["public"]["Enums"]["consent_response_status"]
          template_id: string
          template_version: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          metadata?: Json
          signed_at?: string | null
          signed_by?: string | null
          signed_name?: string | null
          signed_text?: string | null
          status?: Database["public"]["Enums"]["consent_response_status"]
          template_id: string
          template_version?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          signed_at?: string | null
          signed_by?: string | null
          signed_name?: string | null
          signed_text?: string | null
          status?: Database["public"]["Enums"]["consent_response_status"]
          template_id?: string
          template_version?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_form_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_form_responses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "consent_form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_form_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_form_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          tenant_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          tenant_id: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          tenant_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "consent_form_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_attempts: {
        Row: {
          appointment_id: string | null
          attempted_at: string
          attempted_by: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          client_id: string
          created_at: string
          follow_up_at: string | null
          id: string
          message_preview: string | null
          notes: string | null
          queue_id: string | null
          result: Database["public"]["Enums"]["contact_attempt_result"]
          template_id: string | null
          tenant_id: string
        }
        Insert: {
          appointment_id?: string | null
          attempted_at?: string
          attempted_by?: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          client_id: string
          created_at?: string
          follow_up_at?: string | null
          id?: string
          message_preview?: string | null
          notes?: string | null
          queue_id?: string | null
          result?: Database["public"]["Enums"]["contact_attempt_result"]
          template_id?: string | null
          tenant_id: string
        }
        Update: {
          appointment_id?: string | null
          attempted_at?: string
          attempted_by?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          client_id?: string
          created_at?: string
          follow_up_at?: string | null
          id?: string
          message_preview?: string | null
          notes?: string | null
          queue_id?: string | null
          result?: Database["public"]["Enums"]["contact_attempt_result"]
          template_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_attempts_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_attempts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_attempts_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "confirmation_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_attempts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_attempts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          entity: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id: string
          is_required: boolean
          key: string
          label: string
          options: Json
          position: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity?: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_required?: boolean
          key: string
          label: string
          options?: Json
          position?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity?: string
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_required?: boolean
          key?: string
          label?: string
          options?: Json
          position?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          flag_key: string
          id: string
          is_global: boolean
          label: string
          tenant_id: string | null
          updated_at: string
          value: Json
          value_type: Database["public"]["Enums"]["feature_flag_value_type"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          flag_key: string
          id?: string
          is_global?: boolean
          label: string
          tenant_id?: string | null
          updated_at?: string
          value?: Json
          value_type?: Database["public"]["Enums"]["feature_flag_value_type"]
        }
        Update: {
          created_at?: string
          description?: string | null
          flag_key?: string
          id?: string
          is_global?: boolean
          label?: string
          tenant_id?: string | null
          updated_at?: string
          value?: Json
          value_type?: Database["public"]["Enums"]["feature_flag_value_type"]
        }
        Relationships: []
      }
      membership_benefits: {
        Row: {
          created_at: string
          discount_pct: number
          id: string
          membership_id: string
          service_id: string
          sessions_per_cycle: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          discount_pct?: number
          id?: string
          membership_id: string
          service_id: string
          sessions_per_cycle?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          discount_pct?: number
          id?: string
          membership_id?: string
          service_id?: string
          sessions_per_cycle?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_benefits_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_benefits_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_benefits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["membership_billing_cycle"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          price_cents: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["membership_billing_cycle"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          price_cents?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["membership_billing_cycle"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          price_cents?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          service_id: string | null
          stage: Database["public"]["Enums"]["message_template_stage"]
          tenant_id: string
          unit_id: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          body: string
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          service_id?: string | null
          stage: Database["public"]["Enums"]["message_template_stage"]
          tenant_id: string
          unit_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          service_id?: string | null
          stage?: Database["public"]["Enums"]["message_template_stage"]
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      package_items: {
        Row: {
          created_at: string
          id: string
          package_id: string
          position: number
          service_id: string
          sessions: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          package_id: string
          position?: number
          service_id: string
          sessions?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          package_id?: string
          position?: number
          service_id?: string
          sessions?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["package_kind"]
          name: string
          notes: string | null
          price_cents: number
          recommended_interval_days: number | null
          tenant_id: string
          updated_at: string
          usage_rules: string | null
          validity_days: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["package_kind"]
          name: string
          notes?: string | null
          price_cents?: number
          recommended_interval_days?: number | null
          tenant_id: string
          updated_at?: string
          usage_rules?: string | null
          validity_days?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["package_kind"]
          name?: string
          notes?: string | null
          price_cents?: number
          recommended_interval_days?: number | null
          tenant_id?: string
          updated_at?: string
          usage_rules?: string | null
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string
          key: string
        }
        Insert: {
          created_at?: string
          description: string
          key: string
        }
        Update: {
          created_at?: string
          description?: string
          key?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          created_at: string
          display_order: number
          feature_key: string
          id: string
          label: string
          plan_id: string
          value: Json
          value_type: Database["public"]["Enums"]["feature_flag_value_type"]
        }
        Insert: {
          created_at?: string
          display_order?: number
          feature_key: string
          id?: string
          label: string
          plan_id: string
          value?: Json
          value_type?: Database["public"]["Enums"]["feature_flag_value_type"]
        }
        Update: {
          created_at?: string
          display_order?: number
          feature_key?: string
          id?: string
          label?: string
          plan_id?: string
          value?: Json
          value_type?: Database["public"]["Enums"]["feature_flag_value_type"]
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_period: Database["public"]["Enums"]["plan_billing_period"]
          code: string
          created_at: string
          currency: string
          description: string | null
          display_order: number
          grace_period_days: number
          id: string
          is_default: boolean
          max_active_clients: number | null
          max_professionals: number | null
          max_storage_mb: number | null
          max_units: number | null
          metadata: Json
          name: string
          price_cents: number
          status: Database["public"]["Enums"]["plan_status"]
          trial_days: number
          updated_at: string
        }
        Insert: {
          billing_period?: Database["public"]["Enums"]["plan_billing_period"]
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          grace_period_days?: number
          id?: string
          is_default?: boolean
          max_active_clients?: number | null
          max_professionals?: number | null
          max_storage_mb?: number | null
          max_units?: number | null
          metadata?: Json
          name: string
          price_cents?: number
          status?: Database["public"]["Enums"]["plan_status"]
          trial_days?: number
          updated_at?: string
        }
        Update: {
          billing_period?: Database["public"]["Enums"]["plan_billing_period"]
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          grace_period_days?: number
          id?: string
          is_default?: boolean
          max_active_clients?: number | null
          max_professionals?: number | null
          max_storage_mb?: number | null
          max_units?: number | null
          metadata?: Json
          name?: string
          price_cents?: number
          status?: Database["public"]["Enums"]["plan_status"]
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      professional_availability: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          professional_id: string
          starts_at: string
          tenant_id: string
          unit_id: string | null
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          is_active?: boolean
          professional_id: string
          starts_at: string
          tenant_id: string
          unit_id?: string | null
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          professional_id?: string
          starts_at?: string
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_availability_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_availability_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_availability_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          bio: string | null
          color: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          role_title: string | null
          tenant_id: string
          unit_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          color?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          role_title?: string | null
          tenant_id: string
          unit_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          color?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          role_title?: string | null
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_super_admin: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_super_admin?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_super_admin?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      protocol_sessions: {
        Row: {
          created_at: string
          id: string
          interval_days: number | null
          notes: string | null
          protocol_id: string
          service_id: string
          step: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interval_days?: number | null
          notes?: string | null
          protocol_id: string
          service_id: string
          step?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interval_days?: number | null
          notes?: string | null
          protocol_id?: string
          service_id?: string
          step?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_sessions_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_sessions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      protocols: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          post_instructions: string | null
          pre_instructions: string | null
          recommended_interval_days: number | null
          tenant_id: string
          total_price_cents: number | null
          total_sessions: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          post_instructions?: string | null
          pre_instructions?: string | null
          recommended_interval_days?: number | null
          tenant_id: string
          total_price_cents?: number | null
          total_sessions?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          post_instructions?: string | null
          pre_instructions?: string | null
          recommended_interval_days?: number | null
          tenant_id?: string
          total_price_cents?: number | null
          total_sessions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocols_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_blocks: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          professional_id: string | null
          reason: string | null
          starts_at: string
          tenant_id: string
          unit_id: string | null
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          is_active?: boolean
          professional_id?: string | null
          reason?: string | null
          starts_at: string
          tenant_id: string
          unit_id?: string | null
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          professional_id?: string | null
          reason?: string | null
          starts_at?: string
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_blocks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_blocks_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          resource_type: Database["public"]["Enums"]["resource_type"]
          tenant_id: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          resource_type?: Database["public"]["Enums"]["resource_type"]
          tenant_id: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          resource_type?: Database["public"]["Enums"]["resource_type"]
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          permission_key?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      segment_templates: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          payload: Json
          segment: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          payload?: Json
          segment: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          payload?: Json
          segment?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          position: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          position?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          position?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_prices: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          is_default: boolean
          service_id: string
          tenant_id: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          service_id: string
          tenant_id: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          service_id?: string
          tenant_id?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_professional_prices: {
        Row: {
          amount_cents: number
          created_at: string
          duration_minutes: number | null
          id: string
          professional_id: string
          service_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          duration_minutes?: number | null
          id?: string
          professional_id: string
          service_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          duration_minutes?: number | null
          id?: string
          professional_id?: string
          service_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_professional_prices_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_professional_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_professional_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_unit_prices: {
        Row: {
          amount_cents: number
          created_at: string
          duration_minutes: number | null
          id: string
          service_id: string
          tenant_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          duration_minutes?: number | null
          id?: string
          service_id: string
          tenant_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          duration_minutes?: number | null
          id?: string
          service_id?: string
          tenant_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_unit_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_unit_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_unit_prices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          buffer_after_minutes: number
          buffer_before_minutes: number
          cancellation_policy_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          eligible_for_membership: boolean
          eligible_for_package: boolean
          id: string
          ideal_return_window_days: number | null
          internal_code: string | null
          is_active: boolean
          is_featured: boolean
          max_advance_days: number
          min_advance_hours: number
          name: string
          position: number
          post_appointment_instructions: string | null
          pre_appointment_instructions: string | null
          processing_minutes: number
          requires_resource: boolean
          resource_label: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          cancellation_policy_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          eligible_for_membership?: boolean
          eligible_for_package?: boolean
          id?: string
          ideal_return_window_days?: number | null
          internal_code?: string | null
          is_active?: boolean
          is_featured?: boolean
          max_advance_days?: number
          min_advance_hours?: number
          name: string
          position?: number
          post_appointment_instructions?: string | null
          pre_appointment_instructions?: string | null
          processing_minutes?: number
          requires_resource?: boolean
          resource_label?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          cancellation_policy_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          eligible_for_membership?: boolean
          eligible_for_package?: boolean
          id?: string
          ideal_return_window_days?: number | null
          internal_code?: string | null
          is_active?: boolean
          is_featured?: boolean
          max_advance_days?: number
          min_advance_hours?: number
          name?: string
          position?: number
          post_appointment_instructions?: string | null
          pre_appointment_instructions?: string | null
          processing_minutes?: number
          requires_resource?: boolean
          resource_label?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_cancellation_policy_id_fkey"
            columns: ["cancellation_policy_id"]
            isOneToOne: false
            referencedRelation: "cancellation_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["subscription_event_type"]
          from_plan_id: string | null
          from_status: Database["public"]["Enums"]["subscription_status"] | null
          id: string
          metadata: Json
          notes: string | null
          subscription_id: string | null
          tenant_id: string
          to_plan_id: string | null
          to_status: Database["public"]["Enums"]["subscription_status"] | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["subscription_event_type"]
          from_plan_id?: string | null
          from_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          id?: string
          metadata?: Json
          notes?: string | null
          subscription_id?: string | null
          tenant_id: string
          to_plan_id?: string | null
          to_status?: Database["public"]["Enums"]["subscription_status"] | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["subscription_event_type"]
          from_plan_id?: string | null
          from_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          id?: string
          metadata?: Json
          notes?: string | null
          subscription_id?: string | null
          tenant_id?: string
          to_plan_id?: string | null
          to_status?: Database["public"]["Enums"]["subscription_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_from_plan_id_fkey"
            columns: ["from_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "tenant_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_to_plan_id_fkey"
            columns: ["to_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_memberships: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string | null
          invited_email: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_email?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_email?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          appointment_buffer_minutes: number
          brand_accent: string | null
          brand_primary: string | null
          brand_secondary: string | null
          cancellation_policy: string | null
          created_at: string
          default_unit_id: string | null
          logo_url: string | null
          preferences: Json
          tenant_id: string
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          appointment_buffer_minutes?: number
          brand_accent?: string | null
          brand_primary?: string | null
          brand_secondary?: string | null
          cancellation_policy?: string | null
          created_at?: string
          default_unit_id?: string | null
          logo_url?: string | null
          preferences?: Json
          tenant_id: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          appointment_buffer_minutes?: number
          brand_accent?: string | null
          brand_primary?: string | null
          brand_secondary?: string | null
          cancellation_policy?: string | null
          created_at?: string
          default_unit_id?: string | null
          logo_url?: string | null
          preferences?: Json
          tenant_id?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_default_unit_id_fkey"
            columns: ["default_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          discount_cents: number
          discount_reason: string | null
          id: string
          notes: string | null
          overdue_since: string | null
          override_limits: Json
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          suspended_at: string | null
          tenant_id: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          discount_cents?: number
          discount_reason?: string | null
          id?: string
          notes?: string | null
          overdue_since?: string | null
          override_limits?: Json
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          suspended_at?: string | null
          tenant_id: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          discount_cents?: number
          discount_reason?: string | null
          id?: string
          notes?: string | null
          overdue_since?: string | null
          override_limits?: Json
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          suspended_at?: string | null
          tenant_id?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          locale: string
          name: string
          segment: Database["public"]["Enums"]["tenant_segment"]
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          locale?: string
          name: string
          segment: Database["public"]["Enums"]["tenant_segment"]
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          locale?: string
          name?: string
          segment?: Database["public"]["Enums"]["tenant_segment"]
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      time_off_blocks: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          professional_id: string | null
          reason: string | null
          scope: Database["public"]["Enums"]["time_off_scope"]
          starts_at: string
          tenant_id: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          scope: Database["public"]["Enums"]["time_off_scope"]
          starts_at: string
          tenant_id: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          scope?: Database["public"]["Enums"]["time_off_scope"]
          starts_at?: string
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_blocks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_blocks_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_business_hours: {
        Row: {
          closes_at: string
          created_at: string
          id: string
          is_closed: boolean
          opens_at: string
          tenant_id: string
          unit_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          closes_at: string
          created_at?: string
          id?: string
          is_closed?: boolean
          opens_at: string
          tenant_id: string
          unit_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          closes_at?: string
          created_at?: string
          id?: string
          is_closed?: boolean
          opens_at?: string
          tenant_id?: string
          unit_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "unit_business_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_business_hours_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_settings: {
        Row: {
          created_at: string
          opening_hours: Json
          preferences: Json
          tenant_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          opening_hours?: Json
          preferences?: Json
          tenant_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          opening_hours?: Json
          preferences?: Json
          tenant_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_settings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          phone: string | null
          postal_code: string | null
          state: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_snapshots: {
        Row: {
          active_clients_count: number
          appointments_last_30d: number
          captured_at: string
          id: string
          metadata: Json
          professionals_count: number
          storage_mb: number
          tenant_id: string
          units_count: number
        }
        Insert: {
          active_clients_count?: number
          appointments_last_30d?: number
          captured_at?: string
          id?: string
          metadata?: Json
          professionals_count?: number
          storage_mb?: number
          tenant_id: string
          units_count?: number
        }
        Update: {
          active_clients_count?: number
          appointments_last_30d?: number
          captured_at?: string
          id?: string
          metadata?: Json
          professionals_count?: number
          storage_mb?: number
          tenant_id?: string
          units_count?: number
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          client_id: string
          contacted_at: string | null
          created_at: string
          created_by: string | null
          desired_window_end: string | null
          desired_window_start: string | null
          id: string
          notes: string | null
          preferred_professional_id: string | null
          preferred_unit_id: string | null
          priority: number
          scheduled_appointment_id: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["waitlist_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          contacted_at?: string | null
          created_at?: string
          created_by?: string | null
          desired_window_end?: string | null
          desired_window_start?: string | null
          id?: string
          notes?: string | null
          preferred_professional_id?: string | null
          preferred_unit_id?: string | null
          priority?: number
          scheduled_appointment_id?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          contacted_at?: string | null
          created_at?: string
          created_by?: string | null
          desired_window_end?: string | null
          desired_window_start?: string | null
          id?: string
          notes?: string | null
          preferred_professional_id?: string | null
          preferred_unit_id?: string | null
          priority?: number
          scheduled_appointment_id?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_preferred_professional_id_fkey"
            columns: ["preferred_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_preferred_unit_id_fkey"
            columns: ["preferred_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_scheduled_appointment_id_fkey"
            columns: ["scheduled_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_queue_priority: {
        Args: {
          _appointment_id: string
          _base_priority?: number
          _client_id: string
          _stage: Database["public"]["Enums"]["confirmation_stage"]
          _tenant_id: string
        }
        Returns: number
      }
      claim_portal_links_for_current_user: { Args: never; Returns: number }
      client_owns_appointment: {
        Args: { _appointment_id: string; _user_id: string }
        Returns: boolean
      }
      client_user_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: string
      }
      effective_subscription_limits: {
        Args: { _tenant_id: string }
        Returns: Json
      }
      get_available_slots: {
        Args: {
          _day: string
          _professional_id: string
          _service_id: string
          _slot_step_minutes?: number
          _tenant_id: string
          _unit_id: string
        }
        Returns: {
          slot_end: string
          slot_start: string
        }[]
      }
      has_any_tenant_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_portal_client_of: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      touch_portal_last_seen: { Args: { _link_id: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "owner"
        | "manager"
        | "frontdesk"
        | "professional"
        | "client"
      appointment_source:
        | "frontdesk"
        | "professional"
        | "client_portal"
        | "walk_in"
        | "phone"
        | "whatsapp"
        | "recurring"
        | "system"
      appointment_status:
        | "requested"
        | "pending"
        | "confirmed"
        | "reminded"
        | "arrived"
        | "in_service"
        | "completed"
        | "canceled"
        | "no_show"
      call_outcome:
        | "answered"
        | "no_answer"
        | "voicemail"
        | "wrong_number"
        | "busy"
        | "callback_requested"
      client_package_status: "active" | "completed" | "expired" | "canceled"
      client_photo_type: "before" | "after" | "general"
      client_risk_level: "low" | "medium" | "high"
      client_status: "active" | "inactive" | "blocked"
      client_subscription_status: "active" | "paused" | "canceled" | "expired"
      client_user_status: "active" | "pending" | "blocked"
      confirmation_queue_status:
        | "pending"
        | "in_progress"
        | "confirmed"
        | "reschedule_requested"
        | "canceled"
        | "no_response"
        | "follow_up_scheduled"
        | "closed"
      confirmation_stage:
        | "today"
        | "tomorrow"
        | "upcoming"
        | "high_risk"
        | "premium"
        | "reschedule"
        | "recovery"
      consent_response_status: "pending" | "signed" | "declined"
      contact_attempt_result:
        | "pending"
        | "sent"
        | "confirmed"
        | "reschedule_requested"
        | "canceled"
        | "no_response"
        | "call_made"
        | "follow_up_scheduled"
      custom_field_type:
        | "text"
        | "number"
        | "date"
        | "boolean"
        | "select"
        | "multiselect"
        | "textarea"
      feature_flag_value_type: "boolean" | "number" | "string" | "json"
      membership_billing_cycle: "monthly" | "quarterly" | "yearly"
      membership_status: "active" | "invited" | "suspended"
      message_channel: "whatsapp" | "phone" | "email" | "sms" | "in_person"
      message_template_stage:
        | "confirmation"
        | "reminder"
        | "reschedule"
        | "cancellation"
        | "recovery"
        | "reactivation"
        | "thanks"
        | "custom"
      package_kind: "package" | "combo"
      plan_billing_period:
        | "monthly"
        | "quarterly"
        | "semiannual"
        | "annual"
        | "custom"
      plan_status: "public" | "private" | "archived"
      resource_type: "room" | "equipment" | "chair" | "station" | "other"
      subscription_event_type:
        | "created"
        | "trial_started"
        | "trial_extended"
        | "activated"
        | "renewed"
        | "upgraded"
        | "downgraded"
        | "suspended"
        | "reactivated"
        | "canceled"
        | "overdue"
        | "note"
      subscription_status:
        | "trialing"
        | "active"
        | "overdue"
        | "suspended"
        | "canceled"
      tenant_segment:
        | "salao"
        | "clinica_estetica"
        | "lash_brow"
        | "barbearia"
        | "esmalteria"
        | "wellness"
      tenant_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "suspended"
      time_off_scope: "professional" | "unit"
      timeline_event_type:
        | "note"
        | "file"
        | "photo"
        | "consent"
        | "manual"
        | "status_change"
        | "appointment"
        | "system"
      waitlist_status:
        | "open"
        | "contacted"
        | "scheduled"
        | "expired"
        | "canceled"
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
      app_role: [
        "super_admin",
        "owner",
        "manager",
        "frontdesk",
        "professional",
        "client",
      ],
      appointment_source: [
        "frontdesk",
        "professional",
        "client_portal",
        "walk_in",
        "phone",
        "whatsapp",
        "recurring",
        "system",
      ],
      appointment_status: [
        "requested",
        "pending",
        "confirmed",
        "reminded",
        "arrived",
        "in_service",
        "completed",
        "canceled",
        "no_show",
      ],
      call_outcome: [
        "answered",
        "no_answer",
        "voicemail",
        "wrong_number",
        "busy",
        "callback_requested",
      ],
      client_package_status: ["active", "completed", "expired", "canceled"],
      client_photo_type: ["before", "after", "general"],
      client_risk_level: ["low", "medium", "high"],
      client_status: ["active", "inactive", "blocked"],
      client_subscription_status: ["active", "paused", "canceled", "expired"],
      client_user_status: ["active", "pending", "blocked"],
      confirmation_queue_status: [
        "pending",
        "in_progress",
        "confirmed",
        "reschedule_requested",
        "canceled",
        "no_response",
        "follow_up_scheduled",
        "closed",
      ],
      confirmation_stage: [
        "today",
        "tomorrow",
        "upcoming",
        "high_risk",
        "premium",
        "reschedule",
        "recovery",
      ],
      consent_response_status: ["pending", "signed", "declined"],
      contact_attempt_result: [
        "pending",
        "sent",
        "confirmed",
        "reschedule_requested",
        "canceled",
        "no_response",
        "call_made",
        "follow_up_scheduled",
      ],
      custom_field_type: [
        "text",
        "number",
        "date",
        "boolean",
        "select",
        "multiselect",
        "textarea",
      ],
      feature_flag_value_type: ["boolean", "number", "string", "json"],
      membership_billing_cycle: ["monthly", "quarterly", "yearly"],
      membership_status: ["active", "invited", "suspended"],
      message_channel: ["whatsapp", "phone", "email", "sms", "in_person"],
      message_template_stage: [
        "confirmation",
        "reminder",
        "reschedule",
        "cancellation",
        "recovery",
        "reactivation",
        "thanks",
        "custom",
      ],
      package_kind: ["package", "combo"],
      plan_billing_period: [
        "monthly",
        "quarterly",
        "semiannual",
        "annual",
        "custom",
      ],
      plan_status: ["public", "private", "archived"],
      resource_type: ["room", "equipment", "chair", "station", "other"],
      subscription_event_type: [
        "created",
        "trial_started",
        "trial_extended",
        "activated",
        "renewed",
        "upgraded",
        "downgraded",
        "suspended",
        "reactivated",
        "canceled",
        "overdue",
        "note",
      ],
      subscription_status: [
        "trialing",
        "active",
        "overdue",
        "suspended",
        "canceled",
      ],
      tenant_segment: [
        "salao",
        "clinica_estetica",
        "lash_brow",
        "barbearia",
        "esmalteria",
        "wellness",
      ],
      tenant_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "suspended",
      ],
      time_off_scope: ["professional", "unit"],
      timeline_event_type: [
        "note",
        "file",
        "photo",
        "consent",
        "manual",
        "status_change",
        "appointment",
        "system",
      ],
      waitlist_status: [
        "open",
        "contacted",
        "scheduled",
        "expired",
        "canceled",
      ],
    },
  },
} as const
