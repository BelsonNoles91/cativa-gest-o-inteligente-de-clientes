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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "owner"
        | "manager"
        | "frontdesk"
        | "professional"
        | "client"
      client_package_status: "active" | "completed" | "expired" | "canceled"
      client_photo_type: "before" | "after" | "general"
      client_risk_level: "low" | "medium" | "high"
      client_status: "active" | "inactive" | "blocked"
      client_subscription_status: "active" | "paused" | "canceled" | "expired"
      consent_response_status: "pending" | "signed" | "declined"
      custom_field_type:
        | "text"
        | "number"
        | "date"
        | "boolean"
        | "select"
        | "multiselect"
        | "textarea"
      membership_billing_cycle: "monthly" | "quarterly" | "yearly"
      membership_status: "active" | "invited" | "suspended"
      package_kind: "package" | "combo"
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
      timeline_event_type:
        | "note"
        | "file"
        | "photo"
        | "consent"
        | "manual"
        | "status_change"
        | "appointment"
        | "system"
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
      client_package_status: ["active", "completed", "expired", "canceled"],
      client_photo_type: ["before", "after", "general"],
      client_risk_level: ["low", "medium", "high"],
      client_status: ["active", "inactive", "blocked"],
      client_subscription_status: ["active", "paused", "canceled", "expired"],
      consent_response_status: ["pending", "signed", "declined"],
      custom_field_type: [
        "text",
        "number",
        "date",
        "boolean",
        "select",
        "multiselect",
        "textarea",
      ],
      membership_billing_cycle: ["monthly", "quarterly", "yearly"],
      membership_status: ["active", "invited", "suspended"],
      package_kind: ["package", "combo"],
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
    },
  },
} as const
