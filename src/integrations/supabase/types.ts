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
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          performed_by: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          performed_by?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          performed_by?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      autisti: {
        Row: {
          assicurazione: number | null
          attivo: boolean
          buono_pasto: number | null
          calcola_riposi: boolean
          cellulare: string | null
          codice_fiscale: string | null
          cognome: string
          created_at: string
          email: string | null
          id: string
          mansione: string | null
          nome: string
          note: string | null
          numero_ore_ord: number | null
          org_id: string
          password: string | null
          patente: string | null
          percentuale_notturno: number | null
          prezzo_ora_ord: number | null
          prezzo_ora_straord: number | null
          telefono: string | null
          trasferta: number | null
          trasferta_2: number | null
          updated_at: string
        }
        Insert: {
          assicurazione?: number | null
          attivo?: boolean
          buono_pasto?: number | null
          calcola_riposi?: boolean
          cellulare?: string | null
          codice_fiscale?: string | null
          cognome: string
          created_at?: string
          email?: string | null
          id?: string
          mansione?: string | null
          nome: string
          note?: string | null
          numero_ore_ord?: number | null
          org_id?: string
          password?: string | null
          patente?: string | null
          percentuale_notturno?: number | null
          prezzo_ora_ord?: number | null
          prezzo_ora_straord?: number | null
          telefono?: string | null
          trasferta?: number | null
          trasferta_2?: number | null
          updated_at?: string
        }
        Update: {
          assicurazione?: number | null
          attivo?: boolean
          buono_pasto?: number | null
          calcola_riposi?: boolean
          cellulare?: string | null
          codice_fiscale?: string | null
          cognome?: string
          created_at?: string
          email?: string | null
          id?: string
          mansione?: string | null
          nome?: string
          note?: string | null
          numero_ore_ord?: number | null
          org_id?: string
          password?: string | null
          patente?: string | null
          percentuale_notturno?: number | null
          prezzo_ora_ord?: number | null
          prezzo_ora_straord?: number | null
          telefono?: string | null
          trasferta?: number | null
          trasferta_2?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      autisti_esterni: {
        Row: {
          attivo: boolean
          banca: string | null
          calcola_riposi: boolean
          cellulare: string | null
          codice_fiscale: string | null
          created_at: string
          email: string | null
          iban: string | null
          id: string
          km_voucher: number | null
          level: string | null
          lingua: string | null
          modello_veicolo: string | null
          nome: string
          note: string | null
          numero_compto: string | null
          org_id: string
          password: string | null
          patente: string | null
          percentuale_last_minute: number | null
          percentuale_network: number | null
          targa: string | null
          tariffario_nome: string | null
          tariffario_url: string | null
          tipo_macchina: string | null
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          banca?: string | null
          calcola_riposi?: boolean
          cellulare?: string | null
          codice_fiscale?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          id?: string
          km_voucher?: number | null
          level?: string | null
          lingua?: string | null
          modello_veicolo?: string | null
          nome: string
          note?: string | null
          numero_compto?: string | null
          org_id?: string
          password?: string | null
          patente?: string | null
          percentuale_last_minute?: number | null
          percentuale_network?: number | null
          targa?: string | null
          tariffario_nome?: string | null
          tariffario_url?: string | null
          tipo_macchina?: string | null
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          banca?: string | null
          calcola_riposi?: boolean
          cellulare?: string | null
          codice_fiscale?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          id?: string
          km_voucher?: number | null
          level?: string | null
          lingua?: string | null
          modello_veicolo?: string | null
          nome?: string
          note?: string | null
          numero_compto?: string | null
          org_id?: string
          password?: string | null
          patente?: string | null
          percentuale_last_minute?: number | null
          percentuale_network?: number | null
          targa?: string | null
          tariffario_nome?: string | null
          tariffario_url?: string | null
          tipo_macchina?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      autisti_spese: {
        Row: {
          autista_id: string
          created_at: string
          data_intervento: string | null
          data_scadenza: string | null
          id: string
          importo_spese: number | null
          note: string | null
          org_id: string
          tipo: string
          totale_fattura: number | null
          updated_at: string
        }
        Insert: {
          autista_id: string
          created_at?: string
          data_intervento?: string | null
          data_scadenza?: string | null
          id?: string
          importo_spese?: number | null
          note?: string | null
          org_id?: string
          tipo: string
          totale_fattura?: number | null
          updated_at?: string
        }
        Update: {
          autista_id?: string
          created_at?: string
          data_intervento?: string | null
          data_scadenza?: string | null
          id?: string
          importo_spese?: number | null
          note?: string | null
          org_id?: string
          tipo?: string
          totale_fattura?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autisti_spese_autista_id_fkey"
            columns: ["autista_id"]
            isOneToOne: false
            referencedRelation: "autisti"
            referencedColumns: ["id"]
          },
        ]
      }
      client_utenze: {
        Row: {
          attivo: boolean
          auth_user_id: string | null
          cellulare: string | null
          cognome: string
          created_at: string
          email: string
          id: string
          nome: string
          parent_client_id: string
          password: string | null
          password_hash: string
          tipo: Database["public"]["Enums"]["utenza_tipo"]
          tutorial_completato_at: string | null
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          auth_user_id?: string | null
          cellulare?: string | null
          cognome: string
          created_at?: string
          email: string
          id?: string
          nome: string
          parent_client_id: string
          password?: string | null
          password_hash: string
          tipo?: Database["public"]["Enums"]["utenza_tipo"]
          tutorial_completato_at?: string | null
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          auth_user_id?: string | null
          cellulare?: string | null
          cognome?: string
          created_at?: string
          email?: string
          id?: string
          nome?: string
          parent_client_id?: string
          password?: string | null
          password_hash?: string
          tipo?: Database["public"]["Enums"]["utenza_tipo"]
          tutorial_completato_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_utenze_parent_client_id_fkey"
            columns: ["parent_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          auth_user_id: string | null
          cap: string | null
          citta: string | null
          codice_fiscale: string | null
          cognome_rappresentante: string | null
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          fax: string | null
          gdpr_accepted_at: string | null
          id: string
          name: string
          nazione: string | null
          nome_rappresentante: string | null
          notes: string | null
          org_id: string | null
          p_iva: string | null
          password_cliente: string | null
          phone: string | null
          provincia: string | null
          sede_legale: string | null
          societa_fattura: string | null
          telefono_urg1: string | null
          telefono_urg1_nota: string | null
          telefono_urg2: string | null
          telefono_urg2_nota: string | null
          telefono_urg3: string | null
          telefono_urg3_nota: string | null
          tutorial_completato_at: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          cognome_rappresentante?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          fax?: string | null
          gdpr_accepted_at?: string | null
          id?: string
          name: string
          nazione?: string | null
          nome_rappresentante?: string | null
          notes?: string | null
          org_id?: string | null
          p_iva?: string | null
          password_cliente?: string | null
          phone?: string | null
          provincia?: string | null
          sede_legale?: string | null
          societa_fattura?: string | null
          telefono_urg1?: string | null
          telefono_urg1_nota?: string | null
          telefono_urg2?: string | null
          telefono_urg2_nota?: string | null
          telefono_urg3?: string | null
          telefono_urg3_nota?: string | null
          tutorial_completato_at?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          cognome_rappresentante?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          fax?: string | null
          gdpr_accepted_at?: string | null
          id?: string
          name?: string
          nazione?: string | null
          nome_rappresentante?: string | null
          notes?: string | null
          org_id?: string | null
          p_iva?: string | null
          password_cliente?: string | null
          phone?: string | null
          provincia?: string | null
          sede_legale?: string | null
          societa_fattura?: string | null
          telefono_urg1?: string | null
          telefono_urg1_nota?: string | null
          telefono_urg2?: string | null
          telefono_urg2_nota?: string | null
          telefono_urg3?: string | null
          telefono_urg3_nota?: string | null
          tutorial_completato_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fornitori_cs: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
          note: string | null
          org_id: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          note?: string | null
          org_id?: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          note?: string | null
          org_id?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      line_items: {
        Row: {
          amount: number | null
          created_at: string
          description: string
          discount: number | null
          id: string
          proposal_id: string
          quantity: number
          rate: number
          sort_order: number
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description: string
          discount?: number | null
          id?: string
          proposal_id: string
          quantity?: number
          rate?: number
          sort_order?: number
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string
          discount?: number | null
          id?: string
          proposal_id?: string
          quantity?: number
          rate?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "line_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      notifiche: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          letta: boolean
          messaggio: string | null
          org_id: string
          servizio_id: string | null
          tipo: string
          titolo: string
          utenza_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          letta?: boolean
          messaggio?: string | null
          org_id: string
          servizio_id?: string | null
          tipo: string
          titolo: string
          utenza_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          letta?: boolean
          messaggio?: string | null
          org_id?: string
          servizio_id?: string | null
          tipo?: string
          titolo?: string
          utenza_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifiche_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifiche_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifiche_utenza_id_fkey"
            columns: ["utenza_id"]
            isOneToOne: false
            referencedRelation: "client_utenze"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          brand_font: string | null
          brand_primary_color: string | null
          brand_secondary_color: string | null
          created_at: string
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          brand_font?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          brand_font?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      passeggeri_rubrica: {
        Row: {
          client_id: string
          cognome: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          nome: string
          note: string | null
          org_id: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          cognome?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nome: string
          note?: string | null
          org_id: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          cognome?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nome?: string
          note?: string | null
          org_id?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "passeggeri_rubrica_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department_id: string | null
          full_name: string | null
          id: string
          org_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          full_name?: string | null
          id?: string
          org_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          full_name?: string | null
          id?: string
          org_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          proposal_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          proposal_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          proposal_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_versions: {
        Row: {
          content: Json
          created_at: string
          id: string
          pricing: Json
          proposal_id: string
          version_number: number
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          pricing?: Json
          proposal_id: string
          version_number: number
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          pricing?: Json
          proposal_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_versions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          client_id: string | null
          content: Json
          created_at: string
          department_id: string | null
          discount_total: number | null
          id: string
          notes: string | null
          org_id: string | null
          pricing: Json
          share_expires_at: string | null
          share_id: string | null
          share_password_hash: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          subtotal: number | null
          tax_rate: number | null
          template_id: string | null
          title: string
          total: number | null
          updated_at: string
          user_id: string
          valid_until: string | null
          version_number: number
        }
        Insert: {
          client_id?: string | null
          content?: Json
          created_at?: string
          department_id?: string | null
          discount_total?: number | null
          id?: string
          notes?: string | null
          org_id?: string | null
          pricing?: Json
          share_expires_at?: string | null
          share_id?: string | null
          share_password_hash?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          subtotal?: number | null
          tax_rate?: number | null
          template_id?: string | null
          title?: string
          total?: number | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
          version_number?: number
        }
        Update: {
          client_id?: string | null
          content?: Json
          created_at?: string
          department_id?: string | null
          discount_total?: number | null
          id?: string
          notes?: string | null
          org_id?: string | null
          pricing?: Json
          share_expires_at?: string | null
          share_id?: string | null
          share_password_hash?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          subtotal?: number | null
          tax_rate?: number | null
          template_id?: string | null
          title?: string
          total?: number | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      servizi: {
        Row: {
          accessori: string | null
          allegato_nome: string | null
          allegato_path: string | null
          autista_esterno_id: string | null
          autista_id: string | null
          centro_costo: string | null
          citta: string | null
          client_id: string | null
          codice: string | null
          contatto: string | null
          costo_autista: number | null
          costo_commissione: number | null
          costo_cs: number | null
          created_at: string
          created_by: string | null
          data_servizio: string
          disposizione_oraria: string | null
          email_contatto: string | null
          foglio: string | null
          fornitore_cs_id: string | null
          id: string
          incasso: number | null
          info_autista: string | null
          itinerario: string | null
          luogo_fine: string | null
          luogo_inizio: string | null
          modificato_at: string | null
          modificato_da_cliente: boolean
          n_bagagli: number | null
          n_passeggeri: number | null
          note: string | null
          ora_inizio: string | null
          org_id: string
          prezzo: number | null
          stato: Database["public"]["Enums"]["servizio_stato"]
          telefono_contatto: string | null
          tipo_pagamento: string | null
          tipologia: Database["public"]["Enums"]["servizio_tipologia"] | null
          tour_tipo: string | null
          transfer_tipo: string | null
          updated_at: string
          utenza_id: string | null
          veicolo_id: string | null
          veicolo_tipo: string | null
        }
        Insert: {
          accessori?: string | null
          allegato_nome?: string | null
          allegato_path?: string | null
          autista_esterno_id?: string | null
          autista_id?: string | null
          centro_costo?: string | null
          citta?: string | null
          client_id?: string | null
          codice?: string | null
          contatto?: string | null
          costo_autista?: number | null
          costo_commissione?: number | null
          costo_cs?: number | null
          created_at?: string
          created_by?: string | null
          data_servizio?: string
          disposizione_oraria?: string | null
          email_contatto?: string | null
          foglio?: string | null
          fornitore_cs_id?: string | null
          id?: string
          incasso?: number | null
          info_autista?: string | null
          itinerario?: string | null
          luogo_fine?: string | null
          luogo_inizio?: string | null
          modificato_at?: string | null
          modificato_da_cliente?: boolean
          n_bagagli?: number | null
          n_passeggeri?: number | null
          note?: string | null
          ora_inizio?: string | null
          org_id?: string
          prezzo?: number | null
          stato?: Database["public"]["Enums"]["servizio_stato"]
          telefono_contatto?: string | null
          tipo_pagamento?: string | null
          tipologia?: Database["public"]["Enums"]["servizio_tipologia"] | null
          tour_tipo?: string | null
          transfer_tipo?: string | null
          updated_at?: string
          utenza_id?: string | null
          veicolo_id?: string | null
          veicolo_tipo?: string | null
        }
        Update: {
          accessori?: string | null
          allegato_nome?: string | null
          allegato_path?: string | null
          autista_esterno_id?: string | null
          autista_id?: string | null
          centro_costo?: string | null
          citta?: string | null
          client_id?: string | null
          codice?: string | null
          contatto?: string | null
          costo_autista?: number | null
          costo_commissione?: number | null
          costo_cs?: number | null
          created_at?: string
          created_by?: string | null
          data_servizio?: string
          disposizione_oraria?: string | null
          email_contatto?: string | null
          foglio?: string | null
          fornitore_cs_id?: string | null
          id?: string
          incasso?: number | null
          info_autista?: string | null
          itinerario?: string | null
          luogo_fine?: string | null
          luogo_inizio?: string | null
          modificato_at?: string | null
          modificato_da_cliente?: boolean
          n_bagagli?: number | null
          n_passeggeri?: number | null
          note?: string | null
          ora_inizio?: string | null
          org_id?: string
          prezzo?: number | null
          stato?: Database["public"]["Enums"]["servizio_stato"]
          telefono_contatto?: string | null
          tipo_pagamento?: string | null
          tipologia?: Database["public"]["Enums"]["servizio_tipologia"] | null
          tour_tipo?: string | null
          transfer_tipo?: string | null
          updated_at?: string
          utenza_id?: string | null
          veicolo_id?: string | null
          veicolo_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servizi_autista_esterno_id_fkey"
            columns: ["autista_esterno_id"]
            isOneToOne: false
            referencedRelation: "autisti_esterni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_autista_id_fkey"
            columns: ["autista_id"]
            isOneToOne: false
            referencedRelation: "autisti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_fornitore_cs_id_fkey"
            columns: ["fornitore_cs_id"]
            isOneToOne: false
            referencedRelation: "fornitori_cs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_utenza_id_fkey"
            columns: ["utenza_id"]
            isOneToOne: false
            referencedRelation: "client_utenze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_veicolo_id_fkey"
            columns: ["veicolo_id"]
            isOneToOne: false
            referencedRelation: "veicoli"
            referencedColumns: ["id"]
          },
        ]
      }
      servizi_modifiche: {
        Row: {
          changed_by: string | null
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          org_id: string
          servizio_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          org_id: string
          servizio_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          org_id?: string
          servizio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "servizi_modifiche_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: Database["public"]["Enums"]["template_category"]
          created_at: string
          default_pricing_items: Json
          description: string | null
          id: string
          is_default: boolean
          name: string
          org_id: string | null
          sections: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["template_category"]
          created_at?: string
          default_pricing_items?: Json
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          org_id?: string | null
          sections?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["template_category"]
          created_at?: string
          default_pricing_items?: Json
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string | null
          sections?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      veicoli: {
        Row: {
          attivo: boolean
          colore: string | null
          created_at: string
          data_immatricolazione: string | null
          dati_tecnici: string | null
          id: string
          km_attuale: number | null
          km_prima_scadenza: number | null
          marca: string | null
          modello: string | null
          note: string | null
          org_id: string
          posti: number | null
          targa: string
          telaio: string | null
          tipo_macchina: string | null
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          colore?: string | null
          created_at?: string
          data_immatricolazione?: string | null
          dati_tecnici?: string | null
          id?: string
          km_attuale?: number | null
          km_prima_scadenza?: number | null
          marca?: string | null
          modello?: string | null
          note?: string | null
          org_id?: string
          posti?: number | null
          targa: string
          telaio?: string | null
          tipo_macchina?: string | null
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          colore?: string | null
          created_at?: string
          data_immatricolazione?: string | null
          dati_tecnici?: string | null
          id?: string
          km_attuale?: number | null
          km_prima_scadenza?: number | null
          marca?: string | null
          modello?: string | null
          note?: string | null
          org_id?: string
          posti?: number | null
          targa?: string
          telaio?: string | null
          tipo_macchina?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_servizi_annullati: { Args: never; Returns: undefined }
      client_portal_update_servizio: {
        Args: {
          _accessori?: string
          _allegato_nome?: string
          _allegato_path?: string
          _cancel?: boolean
          _centro_costo?: string
          _citta?: string
          _data_servizio?: string
          _disposizione_oraria?: string
          _info_autista?: string
          _itinerario?: string
          _luogo_fine?: string
          _luogo_inizio?: string
          _n_bagagli?: number
          _n_passeggeri?: number
          _note?: string
          _ora_inizio?: string
          _remove_allegato?: boolean
          _servizio_id: string
          _tipo_pagamento?: string
          _tipologia?: Database["public"]["Enums"]["servizio_tipologia"]
          _tour_tipo?: string
          _transfer_tipo?: string
          _veicolo_tipo?: string
        }
        Returns: {
          accessori: string | null
          allegato_nome: string | null
          allegato_path: string | null
          autista_esterno_id: string | null
          autista_id: string | null
          centro_costo: string | null
          citta: string | null
          client_id: string | null
          codice: string | null
          contatto: string | null
          costo_autista: number | null
          costo_commissione: number | null
          costo_cs: number | null
          created_at: string
          created_by: string | null
          data_servizio: string
          disposizione_oraria: string | null
          email_contatto: string | null
          foglio: string | null
          fornitore_cs_id: string | null
          id: string
          incasso: number | null
          info_autista: string | null
          itinerario: string | null
          luogo_fine: string | null
          luogo_inizio: string | null
          modificato_at: string | null
          modificato_da_cliente: boolean
          n_bagagli: number | null
          n_passeggeri: number | null
          note: string | null
          ora_inizio: string | null
          org_id: string
          prezzo: number | null
          stato: Database["public"]["Enums"]["servizio_stato"]
          telefono_contatto: string | null
          tipo_pagamento: string | null
          tipologia: Database["public"]["Enums"]["servizio_tipologia"] | null
          tour_tipo: string | null
          transfer_tipo: string | null
          updated_at: string
          utenza_id: string | null
          veicolo_id: string | null
          veicolo_tipo: string | null
        }
        SetofOptions: {
          from: "*"
          to: "servizi"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_active_utenza_id: { Args: { _user_id: string }; Returns: string }
      get_client_org_id: { Args: { _user_id: string }; Returns: string }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      get_utenza_parent_client_id: {
        Args: { _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_share_password: { Args: { _password: string }; Returns: string }
      hash_utenza_password: { Args: { _password: string }; Returns: string }
      is_client_user: { Args: { _user_id: string }; Returns: boolean }
      verify_share_password: {
        Args: { _password: string; _share_id: string }
        Returns: boolean
      }
      verify_utenza_password: {
        Args: { _password: string; _utenza_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "agent"
      proposal_status: "draft" | "sent" | "viewed" | "accepted" | "rejected"
      servizio_stato:
        | "nuovo"
        | "confermato"
        | "in_corso"
        | "completato"
        | "annullato"
      servizio_tipologia:
        | "transfer"
        | "disposizione"
        | "tour"
        | "evento"
        | "altro"
      template_category:
        | "web_design"
        | "consulting"
        | "development"
        | "marketing"
        | "general"
      utenza_tipo: "singolo" | "gruppo"
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
      app_role: ["admin", "manager", "agent"],
      proposal_status: ["draft", "sent", "viewed", "accepted", "rejected"],
      servizio_stato: [
        "nuovo",
        "confermato",
        "in_corso",
        "completato",
        "annullato",
      ],
      servizio_tipologia: [
        "transfer",
        "disposizione",
        "tour",
        "evento",
        "altro",
      ],
      template_category: [
        "web_design",
        "consulting",
        "development",
        "marketing",
        "general",
      ],
      utenza_tipo: ["singolo", "gruppo"],
    },
  },
} as const
