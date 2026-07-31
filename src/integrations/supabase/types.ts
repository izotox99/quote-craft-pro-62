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
      accessori_catalogo: {
        Row: {
          attivo: boolean
          created_at: string
          id: string
          nome: string
          org_id: string
          prezzo: number
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          created_at?: string
          id?: string
          nome: string
          org_id: string
          prezzo?: number
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          created_at?: string
          id?: string
          nome?: string
          org_id?: string
          prezzo?: number
          updated_at?: string
        }
        Relationships: []
      }
      agenda_eventi: {
        Row: {
          categoria: Database["public"]["Enums"]["agenda_categoria"]
          completato: boolean
          created_at: string
          created_by: string
          data_fine: string | null
          data_inizio: string
          descrizione: string | null
          id: string
          org_id: string
          promemoria_minuti: number[]
          servizio_id: string | null
          titolo: string
          tutto_il_giorno: boolean
          updated_at: string
          visibilita: Database["public"]["Enums"]["agenda_visibilita"]
        }
        Insert: {
          categoria?: Database["public"]["Enums"]["agenda_categoria"]
          completato?: boolean
          created_at?: string
          created_by: string
          data_fine?: string | null
          data_inizio: string
          descrizione?: string | null
          id?: string
          org_id: string
          promemoria_minuti?: number[]
          servizio_id?: string | null
          titolo: string
          tutto_il_giorno?: boolean
          updated_at?: string
          visibilita?: Database["public"]["Enums"]["agenda_visibilita"]
        }
        Update: {
          categoria?: Database["public"]["Enums"]["agenda_categoria"]
          completato?: boolean
          created_at?: string
          created_by?: string
          data_fine?: string | null
          data_inizio?: string
          descrizione?: string | null
          id?: string
          org_id?: string
          promemoria_minuti?: number[]
          servizio_id?: string | null
          titolo?: string
          tutto_il_giorno?: boolean
          updated_at?: string
          visibilita?: Database["public"]["Enums"]["agenda_visibilita"]
        }
        Relationships: [
          {
            foreignKeyName: "agenda_eventi_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_eventi_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_eventi_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi_autista_view"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_promemoria_inviati: {
        Row: {
          evento_id: string
          id: string
          inviato_at: string
          promemoria_minuti: number
        }
        Insert: {
          evento_id: string
          id?: string
          inviato_at?: string
          promemoria_minuti: number
        }
        Update: {
          evento_id?: string
          id?: string
          inviato_at?: string
          promemoria_minuti?: number
        }
        Relationships: [
          {
            foreignKeyName: "agenda_promemoria_inviati_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "agenda_eventi"
            referencedColumns: ["id"]
          },
        ]
      }
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
          auth_user_id: string | null
          buono_pasto: number | null
          calcola_riposi: boolean
          cellulare: string | null
          codice_fiscale: string | null
          cognome: string
          created_at: string
          email: string | null
          foto_consenso: boolean
          foto_url: string | null
          id: string
          mansione: string | null
          max_ferie_mese: number | null
          max_permessi_mese: number | null
          max_riposi_mese: number | null
          nome: string
          note: string | null
          numero_ore_ord: number | null
          org_id: string
          password: string | null
          password_cambiata_at: string | null
          patente: string | null
          percentuale_notturno: number | null
          prezzo_ora_ord: number | null
          prezzo_ora_straord: number | null
          privacy_accettata_at: string | null
          telefono: string | null
          trasferta: number | null
          trasferta_2: number | null
          ultimo_accesso_at: string | null
          updated_at: string
        }
        Insert: {
          assicurazione?: number | null
          attivo?: boolean
          auth_user_id?: string | null
          buono_pasto?: number | null
          calcola_riposi?: boolean
          cellulare?: string | null
          codice_fiscale?: string | null
          cognome: string
          created_at?: string
          email?: string | null
          foto_consenso?: boolean
          foto_url?: string | null
          id?: string
          mansione?: string | null
          max_ferie_mese?: number | null
          max_permessi_mese?: number | null
          max_riposi_mese?: number | null
          nome: string
          note?: string | null
          numero_ore_ord?: number | null
          org_id?: string
          password?: string | null
          password_cambiata_at?: string | null
          patente?: string | null
          percentuale_notturno?: number | null
          prezzo_ora_ord?: number | null
          prezzo_ora_straord?: number | null
          privacy_accettata_at?: string | null
          telefono?: string | null
          trasferta?: number | null
          trasferta_2?: number | null
          ultimo_accesso_at?: string | null
          updated_at?: string
        }
        Update: {
          assicurazione?: number | null
          attivo?: boolean
          auth_user_id?: string | null
          buono_pasto?: number | null
          calcola_riposi?: boolean
          cellulare?: string | null
          codice_fiscale?: string | null
          cognome?: string
          created_at?: string
          email?: string | null
          foto_consenso?: boolean
          foto_url?: string | null
          id?: string
          mansione?: string | null
          max_ferie_mese?: number | null
          max_permessi_mese?: number | null
          max_riposi_mese?: number | null
          nome?: string
          note?: string | null
          numero_ore_ord?: number | null
          org_id?: string
          password?: string | null
          password_cambiata_at?: string | null
          patente?: string | null
          percentuale_notturno?: number | null
          prezzo_ora_ord?: number | null
          prezzo_ora_straord?: number | null
          privacy_accettata_at?: string | null
          telefono?: string | null
          trasferta?: number | null
          trasferta_2?: number | null
          ultimo_accesso_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      autisti_assenze: {
        Row: {
          autista_id: string
          created_at: string
          data_fine: string
          data_inizio: string
          deciso_at: string | null
          deciso_da: string | null
          id: string
          motivazione: string | null
          note_ufficio: string | null
          org_id: string
          origine: string
          richiesta_da: string | null
          stato: Database["public"]["Enums"]["assenza_stato"]
          tipo: Database["public"]["Enums"]["assenza_tipo"]
          updated_at: string
        }
        Insert: {
          autista_id: string
          created_at?: string
          data_fine: string
          data_inizio: string
          deciso_at?: string | null
          deciso_da?: string | null
          id?: string
          motivazione?: string | null
          note_ufficio?: string | null
          org_id: string
          origine?: string
          richiesta_da?: string | null
          stato?: Database["public"]["Enums"]["assenza_stato"]
          tipo: Database["public"]["Enums"]["assenza_tipo"]
          updated_at?: string
        }
        Update: {
          autista_id?: string
          created_at?: string
          data_fine?: string
          data_inizio?: string
          deciso_at?: string | null
          deciso_da?: string | null
          id?: string
          motivazione?: string | null
          note_ufficio?: string | null
          org_id?: string
          origine?: string
          richiesta_da?: string | null
          stato?: Database["public"]["Enums"]["assenza_stato"]
          tipo?: Database["public"]["Enums"]["assenza_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autisti_assenze_autista_id_fkey"
            columns: ["autista_id"]
            isOneToOne: false
            referencedRelation: "autisti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autisti_assenze_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      autisti_carte: {
        Row: {
          autista_id: string
          created_at: string
          id: string
          intestazione: string
          note: string | null
          org_id: string
          plafond: number | null
          scadenza: string | null
          stato: string
          ultime_quattro: string | null
          updated_at: string
        }
        Insert: {
          autista_id: string
          created_at?: string
          id?: string
          intestazione: string
          note?: string | null
          org_id: string
          plafond?: number | null
          scadenza?: string | null
          stato?: string
          ultime_quattro?: string | null
          updated_at?: string
        }
        Update: {
          autista_id?: string
          created_at?: string
          id?: string
          intestazione?: string
          note?: string | null
          org_id?: string
          plafond?: number | null
          scadenza?: string | null
          stato?: string
          ultime_quattro?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autisti_carte_autista_id_fkey"
            columns: ["autista_id"]
            isOneToOne: false
            referencedRelation: "autisti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autisti_carte_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      autisti_esterni: {
        Row: {
          attivo: boolean
          auth_user_id: string | null
          banca: string | null
          calcola_riposi: boolean
          cellulare: string | null
          codice_fiscale: string | null
          created_at: string
          email: string | null
          foto_url: string | null
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
          password_cambiata_at: string | null
          patente: string | null
          percentuale_last_minute: number | null
          percentuale_network: number | null
          privacy_accettata_at: string | null
          targa: string | null
          tariffario_nome: string | null
          tariffario_url: string | null
          tipo_macchina: string | null
          ultimo_accesso_at: string | null
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          auth_user_id?: string | null
          banca?: string | null
          calcola_riposi?: boolean
          cellulare?: string | null
          codice_fiscale?: string | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
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
          password_cambiata_at?: string | null
          patente?: string | null
          percentuale_last_minute?: number | null
          percentuale_network?: number | null
          privacy_accettata_at?: string | null
          targa?: string | null
          tariffario_nome?: string | null
          tariffario_url?: string | null
          tipo_macchina?: string | null
          ultimo_accesso_at?: string | null
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          auth_user_id?: string | null
          banca?: string | null
          calcola_riposi?: boolean
          cellulare?: string | null
          codice_fiscale?: string | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
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
          password_cambiata_at?: string | null
          patente?: string | null
          percentuale_last_minute?: number | null
          percentuale_network?: number | null
          privacy_accettata_at?: string | null
          targa?: string | null
          tariffario_nome?: string | null
          tariffario_url?: string | null
          tipo_macchina?: string | null
          ultimo_accesso_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      autisti_feedback: {
        Row: {
          autista_id: string
          created_at: string
          data: string
          id: string
          org_id: string
          risposta: string | null
          risposto_at: string | null
          risposto_da: string | null
          stato: string
          testo: string
          updated_at: string
        }
        Insert: {
          autista_id: string
          created_at?: string
          data?: string
          id?: string
          org_id: string
          risposta?: string | null
          risposto_at?: string | null
          risposto_da?: string | null
          stato?: string
          testo: string
          updated_at?: string
        }
        Update: {
          autista_id?: string
          created_at?: string
          data?: string
          id?: string
          org_id?: string
          risposta?: string | null
          risposto_at?: string | null
          risposto_da?: string | null
          stato?: string
          testo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autisti_feedback_autista_id_fkey"
            columns: ["autista_id"]
            isOneToOne: false
            referencedRelation: "autisti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autisti_feedback_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      autisti_ore: {
        Row: {
          autista_id: string
          buono_pasto: boolean
          corretta_at: string | null
          corretta_da: string | null
          created_at: string
          data: string
          id: string
          note: string | null
          ore_notturne: number
          ore_ordinarie: number
          ore_straordinarie: number
          org_id: string
          servizio_id: string | null
          tipologia_partenza:
            | Database["public"]["Enums"]["tipologia_partenza"]
            | null
          trasferta_tipo: Database["public"]["Enums"]["trasferta_tipo"]
          updated_at: string
        }
        Insert: {
          autista_id: string
          buono_pasto?: boolean
          corretta_at?: string | null
          corretta_da?: string | null
          created_at?: string
          data: string
          id?: string
          note?: string | null
          ore_notturne?: number
          ore_ordinarie?: number
          ore_straordinarie?: number
          org_id: string
          servizio_id?: string | null
          tipologia_partenza?:
            | Database["public"]["Enums"]["tipologia_partenza"]
            | null
          trasferta_tipo?: Database["public"]["Enums"]["trasferta_tipo"]
          updated_at?: string
        }
        Update: {
          autista_id?: string
          buono_pasto?: boolean
          corretta_at?: string | null
          corretta_da?: string | null
          created_at?: string
          data?: string
          id?: string
          note?: string | null
          ore_notturne?: number
          ore_ordinarie?: number
          ore_straordinarie?: number
          org_id?: string
          servizio_id?: string | null
          tipologia_partenza?:
            | Database["public"]["Enums"]["tipologia_partenza"]
            | null
          trasferta_tipo?: Database["public"]["Enums"]["trasferta_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autisti_ore_autista_id_fkey"
            columns: ["autista_id"]
            isOneToOne: false
            referencedRelation: "autisti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autisti_ore_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autisti_ore_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi_autista_view"
            referencedColumns: ["id"]
          },
        ]
      }
      autisti_ore_modifiche: {
        Row: {
          changed_at: string
          changed_by: string | null
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          ore_id: string
          org_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ore_id: string
          org_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ore_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autisti_ore_modifiche_ore_id_fkey"
            columns: ["ore_id"]
            isOneToOne: false
            referencedRelation: "autisti_ore"
            referencedColumns: ["id"]
          },
        ]
      }
      autisti_preferenze: {
        Row: {
          autista_id: string
          created_at: string
          notifiche: Json
          org_id: string
          tasti: Json
          updated_at: string
        }
        Insert: {
          autista_id: string
          created_at?: string
          notifiche?: Json
          org_id: string
          tasti?: Json
          updated_at?: string
        }
        Update: {
          autista_id?: string
          created_at?: string
          notifiche?: Json
          org_id?: string
          tasti?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autisti_preferenze_autista_id_fkey"
            columns: ["autista_id"]
            isOneToOne: true
            referencedRelation: "autisti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autisti_preferenze_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      autisti_presenze: {
        Row: {
          autista_id: string
          corretta_at: string | null
          corretta_da: string | null
          created_at: string
          data: string
          fine_at: string | null
          id: string
          inizio_at: string
          note: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          autista_id: string
          corretta_at?: string | null
          corretta_da?: string | null
          created_at?: string
          data: string
          fine_at?: string | null
          id?: string
          inizio_at: string
          note?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          autista_id?: string
          corretta_at?: string | null
          corretta_da?: string | null
          created_at?: string
          data?: string
          fine_at?: string | null
          id?: string
          inizio_at?: string
          note?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autisti_presenze_autista_id_fkey"
            columns: ["autista_id"]
            isOneToOne: false
            referencedRelation: "autisti"
            referencedColumns: ["id"]
          },
        ]
      }
      autisti_presenze_modifiche: {
        Row: {
          changed_at: string
          changed_by: string | null
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          org_id: string
          presenza_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          org_id: string
          presenza_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          org_id?: string
          presenza_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autisti_presenze_modifiche_presenza_id_fkey"
            columns: ["presenza_id"]
            isOneToOne: false
            referencedRelation: "autisti_presenze"
            referencedColumns: ["id"]
          },
        ]
      }
      autisti_spese: {
        Row: {
          autista_id: string
          categoria: string | null
          created_at: string
          data_intervento: string | null
          data_scadenza: string | null
          foto_path: string | null
          id: string
          importo_spese: number | null
          note: string | null
          org_id: string
          origine: string
          servizio_id: string | null
          tipo: string
          totale_fattura: number | null
          updated_at: string
          veicolo_id: string | null
        }
        Insert: {
          autista_id: string
          categoria?: string | null
          created_at?: string
          data_intervento?: string | null
          data_scadenza?: string | null
          foto_path?: string | null
          id?: string
          importo_spese?: number | null
          note?: string | null
          org_id?: string
          origine?: string
          servizio_id?: string | null
          tipo: string
          totale_fattura?: number | null
          updated_at?: string
          veicolo_id?: string | null
        }
        Update: {
          autista_id?: string
          categoria?: string | null
          created_at?: string
          data_intervento?: string | null
          data_scadenza?: string | null
          foto_path?: string | null
          id?: string
          importo_spese?: number | null
          note?: string | null
          org_id?: string
          origine?: string
          servizio_id?: string | null
          tipo?: string
          totale_fattura?: number | null
          updated_at?: string
          veicolo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autisti_spese_autista_id_fkey"
            columns: ["autista_id"]
            isOneToOne: false
            referencedRelation: "autisti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autisti_spese_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autisti_spese_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi_autista_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autisti_spese_veicolo_id_fkey"
            columns: ["veicolo_id"]
            isOneToOne: false
            referencedRelation: "veicoli"
            referencedColumns: ["id"]
          },
        ]
      }
      autisti_veicolo_sessioni: {
        Row: {
          aperta_at: string
          autista_id: string
          chiusa_at: string | null
          created_at: string
          id: string
          km_fine: number | null
          km_inizio: number | null
          org_id: string
          updated_at: string
          veicolo_id: string
        }
        Insert: {
          aperta_at?: string
          autista_id: string
          chiusa_at?: string | null
          created_at?: string
          id?: string
          km_fine?: number | null
          km_inizio?: number | null
          org_id: string
          updated_at?: string
          veicolo_id: string
        }
        Update: {
          aperta_at?: string
          autista_id?: string
          chiusa_at?: string | null
          created_at?: string
          id?: string
          km_fine?: number | null
          km_inizio?: number | null
          org_id?: string
          updated_at?: string
          veicolo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autisti_veicolo_sessioni_autista_id_fkey"
            columns: ["autista_id"]
            isOneToOne: false
            referencedRelation: "autisti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autisti_veicolo_sessioni_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autisti_veicolo_sessioni_veicolo_id_fkey"
            columns: ["veicolo_id"]
            isOneToOne: false
            referencedRelation: "veicoli"
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
          attivo: boolean
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
          network_org_id: string | null
          nome_rappresentante: string | null
          nota_tariffario: string | null
          notes: string | null
          org_id: string | null
          p_iva: string | null
          password_cliente: string | null
          phone: string | null
          provincia: string | null
          sede_legale: string | null
          societa_fattura: string | null
          tariffario_nome: string | null
          tariffario_url: string | null
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
          attivo?: boolean
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
          network_org_id?: string | null
          nome_rappresentante?: string | null
          nota_tariffario?: string | null
          notes?: string | null
          org_id?: string | null
          p_iva?: string | null
          password_cliente?: string | null
          phone?: string | null
          provincia?: string | null
          sede_legale?: string | null
          societa_fattura?: string | null
          tariffario_nome?: string | null
          tariffario_url?: string | null
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
          attivo?: boolean
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
          network_org_id?: string | null
          nome_rappresentante?: string | null
          nota_tariffario?: string | null
          notes?: string | null
          org_id?: string | null
          p_iva?: string | null
          password_cliente?: string | null
          phone?: string | null
          provincia?: string | null
          sede_legale?: string | null
          societa_fattura?: string | null
          tariffario_nome?: string | null
          tariffario_url?: string | null
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
            foreignKeyName: "clients_network_org_id_fkey"
            columns: ["network_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicazioni: {
        Row: {
          allegato_nome: string | null
          allegato_path: string | null
          autista_id: string | null
          created_at: string
          created_by: string | null
          destinatari: string
          id: string
          org_id: string
          priorita: string
          pubblicata_at: string
          scade_at: string | null
          testo: string
          titolo: string
          updated_at: string
        }
        Insert: {
          allegato_nome?: string | null
          allegato_path?: string | null
          autista_id?: string | null
          created_at?: string
          created_by?: string | null
          destinatari?: string
          id?: string
          org_id: string
          priorita?: string
          pubblicata_at?: string
          scade_at?: string | null
          testo: string
          titolo: string
          updated_at?: string
        }
        Update: {
          allegato_nome?: string | null
          allegato_path?: string | null
          autista_id?: string | null
          created_at?: string
          created_by?: string | null
          destinatari?: string
          id?: string
          org_id?: string
          priorita?: string
          pubblicata_at?: string
          scade_at?: string | null
          testo?: string
          titolo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicazioni_autista_id_fkey"
            columns: ["autista_id"]
            isOneToOne: false
            referencedRelation: "autisti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicazioni_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicazioni_letture: {
        Row: {
          autista_id: string
          comunicazione_id: string
          id: string
          letta_at: string
          org_id: string
        }
        Insert: {
          autista_id: string
          comunicazione_id: string
          id?: string
          letta_at?: string
          org_id: string
        }
        Update: {
          autista_id?: string
          comunicazione_id?: string
          id?: string
          letta_at?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicazioni_letture_autista_id_fkey"
            columns: ["autista_id"]
            isOneToOne: false
            referencedRelation: "autisti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicazioni_letture_comunicazione_id_fkey"
            columns: ["comunicazione_id"]
            isOneToOne: false
            referencedRelation: "comunicazioni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicazioni_letture_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      config_assenze: {
        Row: {
          created_at: string
          max_ferie_mese: number
          max_permessi_mese: number
          max_riposi_mese: number
          mezzi_richiesti_giorno: number
          mezzi_totali: number
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          max_ferie_mese?: number
          max_permessi_mese?: number
          max_riposi_mese?: number
          mezzi_richiesti_giorno?: number
          mezzi_totali?: number
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          max_ferie_mese?: number
          max_permessi_mese?: number
          max_riposi_mese?: number
          mezzi_richiesti_giorno?: number
          mezzi_totali?: number
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_assenze_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_viste: {
        Row: {
          colonne: Json
          created_at: string
          font_level: number | null
          id: string
          nome: string
          org_id: string
          predefinita: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          colonne?: Json
          created_at?: string
          font_level?: number | null
          id?: string
          nome: string
          org_id: string
          predefinita?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          colonne?: Json
          created_at?: string
          font_level?: number | null
          id?: string
          nome?: string
          org_id?: string
          predefinita?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_viste_org_id_fkey"
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
          partner_org_id: string | null
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
          partner_org_id?: string | null
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
          partner_org_id?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornitori_cs_partner_org_id_fkey"
            columns: ["partner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      link_utili: {
        Row: {
          attivo: boolean
          created_at: string
          etichetta: string
          evidenza: boolean
          icona: string | null
          id: string
          ordine: number
          org_id: string
          updated_at: string
          url: string
        }
        Insert: {
          attivo?: boolean
          created_at?: string
          etichetta: string
          evidenza?: boolean
          icona?: string | null
          id?: string
          ordine?: number
          org_id: string
          updated_at?: string
          url: string
        }
        Update: {
          attivo?: boolean
          created_at?: string
          etichetta?: string
          evidenza?: boolean
          icona?: string | null
          id?: string
          ordine?: number
          org_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_utili_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      network_partners: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          invited_at: string
          invited_by_email: string | null
          invited_by_user: string | null
          org_a: string
          org_b: string | null
          responded_at: string | null
          responded_by_user: string | null
          stato: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code: string
          invited_at?: string
          invited_by_email?: string | null
          invited_by_user?: string | null
          org_a: string
          org_b?: string | null
          responded_at?: string | null
          responded_by_user?: string | null
          stato?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          invited_at?: string
          invited_by_email?: string | null
          invited_by_user?: string | null
          org_a?: string
          org_b?: string | null
          responded_at?: string | null
          responded_by_user?: string | null
          stato?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_partners_org_a_fkey"
            columns: ["org_a"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_partners_org_b_fkey"
            columns: ["org_b"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifiche: {
        Row: {
          autista_id: string | null
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
          autista_id?: string | null
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
          autista_id?: string | null
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
            foreignKeyName: "notifiche_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi_autista_view"
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
          p_iva: string | null
          phone: string | null
          sede_legale: string | null
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
          p_iva?: string | null
          phone?: string | null
          sede_legale?: string | null
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
          p_iva?: string | null
          phone?: string | null
          sede_legale?: string | null
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
      password_fingerprints: {
        Row: {
          created_at: string
          fingerprint: string
          org_id: string
          owner_id: string
          owner_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fingerprint: string
          org_id: string
          owner_id: string
          owner_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          org_id?: string
          owner_id?: string
          owner_type?: string
          updated_at?: string
        }
        Relationships: []
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
          archiviato: boolean
          autista_esterno_id: string | null
          autista_id: string | null
          cartello: string | null
          centro_costo: string | null
          citta: string | null
          client_id: string | null
          codice: string | null
          com_cliente: number | null
          con_assistente: boolean
          con_guida: boolean
          contatto: string | null
          costo_autista: number | null
          costo_centro: number | null
          costo_commissione: number | null
          costo_cs: number | null
          created_at: string
          created_by: string | null
          data_servizio: string
          dispo_conclusa_at: string | null
          dispo_nota_chiusura: string | null
          disposizione_oraria: string | null
          email_contatto: string | null
          foglio: string | null
          fornitore_cs_id: string | null
          id: string
          incasso: number | null
          info_autista: string | null
          info_cliente: string | null
          info_cliente_autista: string | null
          info_interne: string | null
          itinerario: string | null
          km_fine_servizio: number | null
          km_inizio_servizio: number | null
          luogo_fine: string | null
          luogo_inizio: string | null
          modificato_at: string | null
          modificato_da_cliente: boolean
          n_bagagli: number | null
          n_passeggeri: number | null
          network_autista_nome: string | null
          network_autista_targa: string | null
          network_autista_telefono: string | null
          non_incassato: number | null
          note: string | null
          ora_inizio: string | null
          org_id: string
          permesso_effettuato: boolean
          prezzo: number | null
          prezzo_ccredito: number | null
          prezzo_contante: number | null
          prezzo_fattura: number | null
          ritirare_voucher: boolean
          stato: Database["public"]["Enums"]["servizio_stato"]
          stato_autista: string
          telefono_contatto: string | null
          telefono_d: string | null
          tipo_pagamento: string | null
          tipologia: Database["public"]["Enums"]["servizio_tipologia"] | null
          tour_tipo: string | null
          transfer_concluso_at: string | null
          transfer_nota_chiusura: string | null
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
          archiviato?: boolean
          autista_esterno_id?: string | null
          autista_id?: string | null
          cartello?: string | null
          centro_costo?: string | null
          citta?: string | null
          client_id?: string | null
          codice?: string | null
          com_cliente?: number | null
          con_assistente?: boolean
          con_guida?: boolean
          contatto?: string | null
          costo_autista?: number | null
          costo_centro?: number | null
          costo_commissione?: number | null
          costo_cs?: number | null
          created_at?: string
          created_by?: string | null
          data_servizio?: string
          dispo_conclusa_at?: string | null
          dispo_nota_chiusura?: string | null
          disposizione_oraria?: string | null
          email_contatto?: string | null
          foglio?: string | null
          fornitore_cs_id?: string | null
          id?: string
          incasso?: number | null
          info_autista?: string | null
          info_cliente?: string | null
          info_cliente_autista?: string | null
          info_interne?: string | null
          itinerario?: string | null
          km_fine_servizio?: number | null
          km_inizio_servizio?: number | null
          luogo_fine?: string | null
          luogo_inizio?: string | null
          modificato_at?: string | null
          modificato_da_cliente?: boolean
          n_bagagli?: number | null
          n_passeggeri?: number | null
          network_autista_nome?: string | null
          network_autista_targa?: string | null
          network_autista_telefono?: string | null
          non_incassato?: number | null
          note?: string | null
          ora_inizio?: string | null
          org_id?: string
          permesso_effettuato?: boolean
          prezzo?: number | null
          prezzo_ccredito?: number | null
          prezzo_contante?: number | null
          prezzo_fattura?: number | null
          ritirare_voucher?: boolean
          stato?: Database["public"]["Enums"]["servizio_stato"]
          stato_autista?: string
          telefono_contatto?: string | null
          telefono_d?: string | null
          tipo_pagamento?: string | null
          tipologia?: Database["public"]["Enums"]["servizio_tipologia"] | null
          tour_tipo?: string | null
          transfer_concluso_at?: string | null
          transfer_nota_chiusura?: string | null
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
          archiviato?: boolean
          autista_esterno_id?: string | null
          autista_id?: string | null
          cartello?: string | null
          centro_costo?: string | null
          citta?: string | null
          client_id?: string | null
          codice?: string | null
          com_cliente?: number | null
          con_assistente?: boolean
          con_guida?: boolean
          contatto?: string | null
          costo_autista?: number | null
          costo_centro?: number | null
          costo_commissione?: number | null
          costo_cs?: number | null
          created_at?: string
          created_by?: string | null
          data_servizio?: string
          dispo_conclusa_at?: string | null
          dispo_nota_chiusura?: string | null
          disposizione_oraria?: string | null
          email_contatto?: string | null
          foglio?: string | null
          fornitore_cs_id?: string | null
          id?: string
          incasso?: number | null
          info_autista?: string | null
          info_cliente?: string | null
          info_cliente_autista?: string | null
          info_interne?: string | null
          itinerario?: string | null
          km_fine_servizio?: number | null
          km_inizio_servizio?: number | null
          luogo_fine?: string | null
          luogo_inizio?: string | null
          modificato_at?: string | null
          modificato_da_cliente?: boolean
          n_bagagli?: number | null
          n_passeggeri?: number | null
          network_autista_nome?: string | null
          network_autista_targa?: string | null
          network_autista_telefono?: string | null
          non_incassato?: number | null
          note?: string | null
          ora_inizio?: string | null
          org_id?: string
          permesso_effettuato?: boolean
          prezzo?: number | null
          prezzo_ccredito?: number | null
          prezzo_contante?: number | null
          prezzo_fattura?: number | null
          ritirare_voucher?: boolean
          stato?: Database["public"]["Enums"]["servizio_stato"]
          stato_autista?: string
          telefono_contatto?: string | null
          telefono_d?: string | null
          tipo_pagamento?: string | null
          tipologia?: Database["public"]["Enums"]["servizio_tipologia"] | null
          tour_tipo?: string | null
          transfer_concluso_at?: string | null
          transfer_nota_chiusura?: string | null
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
      servizi_accessori: {
        Row: {
          accessorio_id: string
          created_at: string
          id: string
          prezzo_unitario: number
          quantita: number
          servizio_id: string
          updated_at: string
        }
        Insert: {
          accessorio_id: string
          created_at?: string
          id?: string
          prezzo_unitario?: number
          quantita?: number
          servizio_id: string
          updated_at?: string
        }
        Update: {
          accessorio_id?: string
          created_at?: string
          id?: string
          prezzo_unitario?: number
          quantita?: number
          servizio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servizi_accessori_accessorio_id_fkey"
            columns: ["accessorio_id"]
            isOneToOne: false
            referencedRelation: "accessori_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_accessori_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_accessori_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi_autista_view"
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
          {
            foreignKeyName: "servizi_modifiche_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi_autista_view"
            referencedColumns: ["id"]
          },
        ]
      }
      servizi_network: {
        Row: {
          created_at: string
          dispatched_at: string
          dispatched_by: string | null
          id: string
          org_a: string
          org_b: string
          partnership_id: string
          prezzo_concordato: number
          responded_at: string | null
          servizio_a_id: string
          servizio_b_id: string | null
          snapshot: Json
          stato: Database["public"]["Enums"]["network_dispatch_stato"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          dispatched_at?: string
          dispatched_by?: string | null
          id?: string
          org_a: string
          org_b: string
          partnership_id: string
          prezzo_concordato: number
          responded_at?: string | null
          servizio_a_id: string
          servizio_b_id?: string | null
          snapshot: Json
          stato?: Database["public"]["Enums"]["network_dispatch_stato"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          dispatched_at?: string
          dispatched_by?: string | null
          id?: string
          org_a?: string
          org_b?: string
          partnership_id?: string
          prezzo_concordato?: number
          responded_at?: string | null
          servizio_a_id?: string
          servizio_b_id?: string | null
          snapshot?: Json
          stato?: Database["public"]["Enums"]["network_dispatch_stato"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servizi_network_org_a_fkey"
            columns: ["org_a"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_network_org_b_fkey"
            columns: ["org_b"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_network_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "network_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_network_servizio_a_id_fkey"
            columns: ["servizio_a_id"]
            isOneToOne: false
            referencedRelation: "servizi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_network_servizio_a_id_fkey"
            columns: ["servizio_a_id"]
            isOneToOne: false
            referencedRelation: "servizi_autista_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_network_servizio_b_id_fkey"
            columns: ["servizio_b_id"]
            isOneToOne: false
            referencedRelation: "servizi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_network_servizio_b_id_fkey"
            columns: ["servizio_b_id"]
            isOneToOne: false
            referencedRelation: "servizi_autista_view"
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
          autorizzazione_comune: string | null
          autorizzazione_numero: string | null
          colore: string | null
          consumo_km_litro: number | null
          created_at: string
          data_immatricolazione: string | null
          data_inizio_credito: string | null
          data_ultima_quota_credito: string | null
          dati_tecnici: string | null
          id: string
          intervallo_tagliando_km: number
          km_attuale: number | null
          km_iniziale: number | null
          km_prima_scadenza: number | null
          km_voucher: number | null
          manutenzione_ordinaria: string | null
          marca: string | null
          modello: string | null
          note: string | null
          org_id: string
          photo_url: string | null
          posti: number | null
          prezzo_acquisto: number | null
          quota_mensile_credito: number | null
          tagliando_alert_at: string | null
          tagliando_alert_stato: string
          tagliando_ultimo_at: string | null
          tagliando_ultimo_km: number | null
          targa: string
          telaio: string | null
          telepass: string | null
          tipo_macchina: string | null
          updated_at: string
          viacard: string | null
          visibile_magazzino: boolean
          visibile_servizi: boolean
        }
        Insert: {
          attivo?: boolean
          autorizzazione_comune?: string | null
          autorizzazione_numero?: string | null
          colore?: string | null
          consumo_km_litro?: number | null
          created_at?: string
          data_immatricolazione?: string | null
          data_inizio_credito?: string | null
          data_ultima_quota_credito?: string | null
          dati_tecnici?: string | null
          id?: string
          intervallo_tagliando_km?: number
          km_attuale?: number | null
          km_iniziale?: number | null
          km_prima_scadenza?: number | null
          km_voucher?: number | null
          manutenzione_ordinaria?: string | null
          marca?: string | null
          modello?: string | null
          note?: string | null
          org_id?: string
          photo_url?: string | null
          posti?: number | null
          prezzo_acquisto?: number | null
          quota_mensile_credito?: number | null
          tagliando_alert_at?: string | null
          tagliando_alert_stato?: string
          tagliando_ultimo_at?: string | null
          tagliando_ultimo_km?: number | null
          targa: string
          telaio?: string | null
          telepass?: string | null
          tipo_macchina?: string | null
          updated_at?: string
          viacard?: string | null
          visibile_magazzino?: boolean
          visibile_servizi?: boolean
        }
        Update: {
          attivo?: boolean
          autorizzazione_comune?: string | null
          autorizzazione_numero?: string | null
          colore?: string | null
          consumo_km_litro?: number | null
          created_at?: string
          data_immatricolazione?: string | null
          data_inizio_credito?: string | null
          data_ultima_quota_credito?: string | null
          dati_tecnici?: string | null
          id?: string
          intervallo_tagliando_km?: number
          km_attuale?: number | null
          km_iniziale?: number | null
          km_prima_scadenza?: number | null
          km_voucher?: number | null
          manutenzione_ordinaria?: string | null
          marca?: string | null
          modello?: string | null
          note?: string | null
          org_id?: string
          photo_url?: string | null
          posti?: number | null
          prezzo_acquisto?: number | null
          quota_mensile_credito?: number | null
          tagliando_alert_at?: string | null
          tagliando_alert_stato?: string
          tagliando_ultimo_at?: string | null
          tagliando_ultimo_km?: number | null
          targa?: string
          telaio?: string | null
          telepass?: string | null
          tipo_macchina?: string | null
          updated_at?: string
          viacard?: string | null
          visibile_magazzino?: boolean
          visibile_servizi?: boolean
        }
        Relationships: []
      }
      veicoli_documenti: {
        Row: {
          created_at: string
          file_name: string | null
          file_path: string
          id: string
          mime_type: string | null
          org_id: string
          titolo: string
          uploaded_by: string | null
          veicolo_id: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_path: string
          id?: string
          mime_type?: string | null
          org_id: string
          titolo: string
          uploaded_by?: string | null
          veicolo_id: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_path?: string
          id?: string
          mime_type?: string | null
          org_id?: string
          titolo?: string
          uploaded_by?: string | null
          veicolo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "veicoli_documenti_veicolo_id_fkey"
            columns: ["veicolo_id"]
            isOneToOne: false
            referencedRelation: "veicoli"
            referencedColumns: ["id"]
          },
        ]
      }
      veicoli_gasolio: {
        Row: {
          autista_id: string | null
          autista_nome: string | null
          confidence: number | null
          consumo_calcolato: number | null
          created_at: string
          data: string
          distributore: string | null
          foto_path: string | null
          id: string
          km: number | null
          luogo: string | null
          org_id: string
          origine: string
          prezzo_totale: number | null
          prezzo_unitario: number | null
          quantita: number | null
          raw_ocr: Json | null
          registrato_da: string | null
          tipo_carburante: string | null
          updated_at: string
          veicolo_id: string
        }
        Insert: {
          autista_id?: string | null
          autista_nome?: string | null
          confidence?: number | null
          consumo_calcolato?: number | null
          created_at?: string
          data?: string
          distributore?: string | null
          foto_path?: string | null
          id?: string
          km?: number | null
          luogo?: string | null
          org_id: string
          origine?: string
          prezzo_totale?: number | null
          prezzo_unitario?: number | null
          quantita?: number | null
          raw_ocr?: Json | null
          registrato_da?: string | null
          tipo_carburante?: string | null
          updated_at?: string
          veicolo_id: string
        }
        Update: {
          autista_id?: string | null
          autista_nome?: string | null
          confidence?: number | null
          consumo_calcolato?: number | null
          created_at?: string
          data?: string
          distributore?: string | null
          foto_path?: string | null
          id?: string
          km?: number | null
          luogo?: string | null
          org_id?: string
          origine?: string
          prezzo_totale?: number | null
          prezzo_unitario?: number | null
          quantita?: number | null
          raw_ocr?: Json | null
          registrato_da?: string | null
          tipo_carburante?: string | null
          updated_at?: string
          veicolo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "veicoli_gasolio_veicolo_id_fkey"
            columns: ["veicolo_id"]
            isOneToOne: false
            referencedRelation: "veicoli"
            referencedColumns: ["id"]
          },
        ]
      }
      veicoli_manutenzione_ord: {
        Row: {
          created_at: string
          data: string
          fornitore: string | null
          id: string
          km: number | null
          note: string | null
          org_id: string
          ricambi: string | null
          tipo: string | null
          totale: number | null
          updated_at: string
          veicolo_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          fornitore?: string | null
          id?: string
          km?: number | null
          note?: string | null
          org_id: string
          ricambi?: string | null
          tipo?: string | null
          totale?: number | null
          updated_at?: string
          veicolo_id: string
        }
        Update: {
          created_at?: string
          data?: string
          fornitore?: string | null
          id?: string
          km?: number | null
          note?: string | null
          org_id?: string
          ricambi?: string | null
          tipo?: string | null
          totale?: number | null
          updated_at?: string
          veicolo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "veicoli_manutenzione_ord_veicolo_id_fkey"
            columns: ["veicolo_id"]
            isOneToOne: false
            referencedRelation: "veicoli"
            referencedColumns: ["id"]
          },
        ]
      }
      veicoli_manutenzione_straord: {
        Row: {
          created_at: string
          data: string
          fornitore: string | null
          id: string
          km_attuale: number | null
          note: string | null
          ordine: string | null
          org_id: string
          ricambi: string | null
          tipo: string | null
          tipo_riparazione: string | null
          totale: number | null
          updated_at: string
          veicolo_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          fornitore?: string | null
          id?: string
          km_attuale?: number | null
          note?: string | null
          ordine?: string | null
          org_id: string
          ricambi?: string | null
          tipo?: string | null
          tipo_riparazione?: string | null
          totale?: number | null
          updated_at?: string
          veicolo_id: string
        }
        Update: {
          created_at?: string
          data?: string
          fornitore?: string | null
          id?: string
          km_attuale?: number | null
          note?: string | null
          ordine?: string | null
          org_id?: string
          ricambi?: string | null
          tipo?: string | null
          tipo_riparazione?: string | null
          totale?: number | null
          updated_at?: string
          veicolo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "veicoli_manutenzione_straord_veicolo_id_fkey"
            columns: ["veicolo_id"]
            isOneToOne: false
            referencedRelation: "veicoli"
            referencedColumns: ["id"]
          },
        ]
      }
      veicoli_spese: {
        Row: {
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
          veicolo_id: string
        }
        Insert: {
          created_at?: string
          data_intervento?: string | null
          data_scadenza?: string | null
          id?: string
          importo_spese?: number | null
          note?: string | null
          org_id: string
          tipo: string
          totale_fattura?: number | null
          updated_at?: string
          veicolo_id: string
        }
        Update: {
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
          veicolo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "veicoli_spese_veicolo_id_fkey"
            columns: ["veicolo_id"]
            isOneToOne: false
            referencedRelation: "veicoli"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      servizi_autista_view: {
        Row: {
          accessori: string | null
          allegato_nome: string | null
          allegato_path: string | null
          autista_id: string | null
          cartello: string | null
          citta: string | null
          codice: string | null
          con_assistente: boolean | null
          con_guida: boolean | null
          contatto: string | null
          created_at: string | null
          data_servizio: string | null
          dispo_conclusa_at: string | null
          dispo_nota_chiusura: string | null
          disposizione_oraria: string | null
          email_contatto: string | null
          foglio: string | null
          id: string | null
          info_autista: string | null
          info_cliente_autista: string | null
          itinerario: string | null
          km_fine_servizio: number | null
          km_inizio_servizio: number | null
          luogo_fine: string | null
          luogo_inizio: string | null
          modificato_at: string | null
          modificato_da_cliente: boolean | null
          n_bagagli: number | null
          n_passeggeri: number | null
          network_autista_nome: string | null
          network_autista_targa: string | null
          network_autista_telefono: string | null
          note: string | null
          ora_inizio: string | null
          org_id: string | null
          permesso_effettuato: boolean | null
          ritirare_voucher: boolean | null
          stato: Database["public"]["Enums"]["servizio_stato"] | null
          stato_autista: string | null
          telefono_contatto: string | null
          telefono_d: string | null
          tipo_pagamento: string | null
          tipologia: Database["public"]["Enums"]["servizio_tipologia"] | null
          tour_tipo: string | null
          transfer_concluso_at: string | null
          transfer_nota_chiusura: string | null
          transfer_tipo: string | null
          updated_at: string | null
          veicolo_id: string | null
          veicolo_tipo: string | null
        }
        Insert: {
          accessori?: string | null
          allegato_nome?: string | null
          allegato_path?: string | null
          autista_id?: string | null
          cartello?: string | null
          citta?: string | null
          codice?: string | null
          con_assistente?: boolean | null
          con_guida?: boolean | null
          contatto?: string | null
          created_at?: string | null
          data_servizio?: string | null
          dispo_conclusa_at?: string | null
          dispo_nota_chiusura?: string | null
          disposizione_oraria?: string | null
          email_contatto?: string | null
          foglio?: string | null
          id?: string | null
          info_autista?: string | null
          info_cliente_autista?: string | null
          itinerario?: string | null
          km_fine_servizio?: number | null
          km_inizio_servizio?: number | null
          luogo_fine?: string | null
          luogo_inizio?: string | null
          modificato_at?: string | null
          modificato_da_cliente?: boolean | null
          n_bagagli?: number | null
          n_passeggeri?: number | null
          network_autista_nome?: string | null
          network_autista_targa?: string | null
          network_autista_telefono?: string | null
          note?: string | null
          ora_inizio?: string | null
          org_id?: string | null
          permesso_effettuato?: boolean | null
          ritirare_voucher?: boolean | null
          stato?: Database["public"]["Enums"]["servizio_stato"] | null
          stato_autista?: string | null
          telefono_contatto?: string | null
          telefono_d?: string | null
          tipo_pagamento?: string | null
          tipologia?: Database["public"]["Enums"]["servizio_tipologia"] | null
          tour_tipo?: string | null
          transfer_concluso_at?: string | null
          transfer_nota_chiusura?: string | null
          transfer_tipo?: string | null
          updated_at?: string | null
          veicolo_id?: string | null
          veicolo_tipo?: string | null
        }
        Update: {
          accessori?: string | null
          allegato_nome?: string | null
          allegato_path?: string | null
          autista_id?: string | null
          cartello?: string | null
          citta?: string | null
          codice?: string | null
          con_assistente?: boolean | null
          con_guida?: boolean | null
          contatto?: string | null
          created_at?: string | null
          data_servizio?: string | null
          dispo_conclusa_at?: string | null
          dispo_nota_chiusura?: string | null
          disposizione_oraria?: string | null
          email_contatto?: string | null
          foglio?: string | null
          id?: string | null
          info_autista?: string | null
          info_cliente_autista?: string | null
          itinerario?: string | null
          km_fine_servizio?: number | null
          km_inizio_servizio?: number | null
          luogo_fine?: string | null
          luogo_inizio?: string | null
          modificato_at?: string | null
          modificato_da_cliente?: boolean | null
          n_bagagli?: number | null
          n_passeggeri?: number | null
          network_autista_nome?: string | null
          network_autista_targa?: string | null
          network_autista_telefono?: string | null
          note?: string | null
          ora_inizio?: string | null
          org_id?: string | null
          permesso_effettuato?: boolean | null
          ritirare_voucher?: boolean | null
          stato?: Database["public"]["Enums"]["servizio_stato"] | null
          stato_autista?: string | null
          telefono_contatto?: string | null
          telefono_d?: string | null
          tipo_pagamento?: string | null
          tipologia?: Database["public"]["Enums"]["servizio_tipologia"] | null
          tour_tipo?: string | null
          transfer_concluso_at?: string | null
          transfer_nota_chiusura?: string | null
          transfer_tipo?: string | null
          updated_at?: string | null
          veicolo_id?: string | null
          veicolo_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servizi_autista_id_fkey"
            columns: ["autista_id"]
            isOneToOne: false
            referencedRelation: "autisti"
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
    }
    Functions: {
      agenda_process_promemoria: { Args: never; Returns: undefined }
      annulla_assenza: {
        Args: { _id: string }
        Returns: {
          autista_id: string
          created_at: string
          data_fine: string
          data_inizio: string
          deciso_at: string | null
          deciso_da: string | null
          id: string
          motivazione: string | null
          note_ufficio: string | null
          org_id: string
          origine: string
          richiesta_da: string | null
          stato: Database["public"]["Enums"]["assenza_stato"]
          tipo: Database["public"]["Enums"]["assenza_tipo"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "autisti_assenze"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approva_assenza: {
        Args: { _id: string; _note?: string }
        Returns: {
          autista_id: string
          created_at: string
          data_fine: string
          data_inizio: string
          deciso_at: string | null
          deciso_da: string | null
          id: string
          motivazione: string | null
          note_ufficio: string | null
          org_id: string
          origine: string
          richiesta_da: string | null
          stato: Database["public"]["Enums"]["assenza_stato"]
          tipo: Database["public"]["Enums"]["assenza_tipo"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "autisti_assenze"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assenze_calendario_mese: {
        Args: { _anno: number; _mese: number }
        Returns: {
          autista_nome: string
          giorno: string
          stato: Database["public"]["Enums"]["assenza_stato"]
          tipo: Database["public"]["Enums"]["assenza_tipo"]
        }[]
      }
      assenze_conteggia_mese: {
        Args: {
          _anno: number
          _autista_id: string
          _exclude_id?: string
          _mese: number
          _tipo: Database["public"]["Enums"]["assenza_tipo"]
        }
        Returns: number
      }
      assenze_copertura_giorno: {
        Args: { _giorno: string; _org: string }
        Returns: Json
      }
      assenze_get_effective_limits: {
        Args: { _autista_id: string }
        Returns: Json
      }
      autista_apri_sessione_veicolo: {
        Args: { _km_inizio?: number; _veicolo_id: string }
        Returns: {
          aperta_at: string
          autista_id: string
          chiusa_at: string | null
          created_at: string
          id: string
          km_fine: number | null
          km_inizio: number | null
          org_id: string
          updated_at: string
          veicolo_id: string
        }
        SetofOptions: {
          from: "*"
          to: "autisti_veicolo_sessioni"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      autista_chiudi_sessione_veicolo: {
        Args: { _km_fine?: number }
        Returns: undefined
      }
      autista_registra_rifornimento: {
        Args: {
          _confidence: number
          _data: string
          _distributore: string
          _foto_path: string
          _km: number
          _litri: number
          _prezzo_totale: number
          _prezzo_unitario: number
          _raw_ocr: Json
          _tipo_carburante: string
          _veicolo_id: string
        }
        Returns: {
          autista_id: string | null
          autista_nome: string | null
          confidence: number | null
          consumo_calcolato: number | null
          created_at: string
          data: string
          distributore: string | null
          foto_path: string | null
          id: string
          km: number | null
          luogo: string | null
          org_id: string
          origine: string
          prezzo_totale: number | null
          prezzo_unitario: number | null
          quantita: number | null
          raw_ocr: Json | null
          registrato_da: string | null
          tipo_carburante: string | null
          updated_at: string
          veicolo_id: string
        }
        SetofOptions: {
          from: "*"
          to: "veicoli_gasolio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      autista_update_servizio: {
        Args: {
          _action: string
          _km?: number
          _nota?: string
          _ora_fine?: string
          _servizio_id: string
        }
        Returns: {
          accessori: string | null
          allegato_nome: string | null
          allegato_path: string | null
          archiviato: boolean
          autista_esterno_id: string | null
          autista_id: string | null
          cartello: string | null
          centro_costo: string | null
          citta: string | null
          client_id: string | null
          codice: string | null
          com_cliente: number | null
          con_assistente: boolean
          con_guida: boolean
          contatto: string | null
          costo_autista: number | null
          costo_centro: number | null
          costo_commissione: number | null
          costo_cs: number | null
          created_at: string
          created_by: string | null
          data_servizio: string
          dispo_conclusa_at: string | null
          dispo_nota_chiusura: string | null
          disposizione_oraria: string | null
          email_contatto: string | null
          foglio: string | null
          fornitore_cs_id: string | null
          id: string
          incasso: number | null
          info_autista: string | null
          info_cliente: string | null
          info_cliente_autista: string | null
          info_interne: string | null
          itinerario: string | null
          km_fine_servizio: number | null
          km_inizio_servizio: number | null
          luogo_fine: string | null
          luogo_inizio: string | null
          modificato_at: string | null
          modificato_da_cliente: boolean
          n_bagagli: number | null
          n_passeggeri: number | null
          network_autista_nome: string | null
          network_autista_targa: string | null
          network_autista_telefono: string | null
          non_incassato: number | null
          note: string | null
          ora_inizio: string | null
          org_id: string
          permesso_effettuato: boolean
          prezzo: number | null
          prezzo_ccredito: number | null
          prezzo_contante: number | null
          prezzo_fattura: number | null
          ritirare_voucher: boolean
          stato: Database["public"]["Enums"]["servizio_stato"]
          stato_autista: string
          telefono_contatto: string | null
          telefono_d: string | null
          tipo_pagamento: string | null
          tipologia: Database["public"]["Enums"]["servizio_tipologia"] | null
          tour_tipo: string | null
          transfer_concluso_at: string | null
          transfer_nota_chiusura: string | null
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
      calcola_compenso_autista: {
        Args: { _autista_id: string; _from: string; _to: string }
        Returns: Json
      }
      cleanup_servizi_annullati: { Args: never; Returns: undefined }
      client_portal_update_servizio: {
        Args: {
          _accessori?: string
          _accessori_items?: Json
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
          archiviato: boolean
          autista_esterno_id: string | null
          autista_id: string | null
          cartello: string | null
          centro_costo: string | null
          citta: string | null
          client_id: string | null
          codice: string | null
          com_cliente: number | null
          con_assistente: boolean
          con_guida: boolean
          contatto: string | null
          costo_autista: number | null
          costo_centro: number | null
          costo_commissione: number | null
          costo_cs: number | null
          created_at: string
          created_by: string | null
          data_servizio: string
          dispo_conclusa_at: string | null
          dispo_nota_chiusura: string | null
          disposizione_oraria: string | null
          email_contatto: string | null
          foglio: string | null
          fornitore_cs_id: string | null
          id: string
          incasso: number | null
          info_autista: string | null
          info_cliente: string | null
          info_cliente_autista: string | null
          info_interne: string | null
          itinerario: string | null
          km_fine_servizio: number | null
          km_inizio_servizio: number | null
          luogo_fine: string | null
          luogo_inizio: string | null
          modificato_at: string | null
          modificato_da_cliente: boolean
          n_bagagli: number | null
          n_passeggeri: number | null
          network_autista_nome: string | null
          network_autista_targa: string | null
          network_autista_telefono: string | null
          non_incassato: number | null
          note: string | null
          ora_inizio: string | null
          org_id: string
          permesso_effettuato: boolean
          prezzo: number | null
          prezzo_ccredito: number | null
          prezzo_contante: number | null
          prezzo_fattura: number | null
          ritirare_voucher: boolean
          stato: Database["public"]["Enums"]["servizio_stato"]
          stato_autista: string
          telefono_contatto: string | null
          telefono_d: string | null
          tipo_pagamento: string | null
          tipologia: Database["public"]["Enums"]["servizio_tipologia"] | null
          tour_tipo: string | null
          transfer_concluso_at: string | null
          transfer_nota_chiusura: string | null
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
      current_user_email: { Args: never; Returns: string }
      get_active_utenza_id: { Args: { _user_id: string }; Returns: string }
      get_autista_esterno_id: { Args: { _user_id: string }; Returns: string }
      get_autista_id: { Args: { _user_id: string }; Returns: string }
      get_autista_org_id: { Args: { _user_id: string }; Returns: string }
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
      inserisci_assenza_ufficio: {
        Args: {
          _autista_id: string
          _data_fine: string
          _data_inizio: string
          _force?: boolean
          _note?: string
          _tipo: Database["public"]["Enums"]["assenza_tipo"]
        }
        Returns: {
          autista_id: string
          created_at: string
          data_fine: string
          data_inizio: string
          deciso_at: string | null
          deciso_da: string | null
          id: string
          motivazione: string | null
          note_ufficio: string | null
          org_id: string
          origine: string
          richiesta_da: string | null
          stato: Database["public"]["Enums"]["assenza_stato"]
          tipo: Database["public"]["Enums"]["assenza_tipo"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "autisti_assenze"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_autista_user: { Args: { _user_id: string }; Returns: boolean }
      is_client_user: { Args: { _user_id: string }; Returns: boolean }
      network_dispatch_servizio: {
        Args: {
          _partner_org_id: string
          _prezzo_concordato: number
          _servizio_id: string
        }
        Returns: {
          created_at: string
          dispatched_at: string
          dispatched_by: string | null
          id: string
          org_a: string
          org_b: string
          partnership_id: string
          prezzo_concordato: number
          responded_at: string | null
          servizio_a_id: string
          servizio_b_id: string | null
          snapshot: Json
          stato: Database["public"]["Enums"]["network_dispatch_stato"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "servizi_network"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      network_invite_partner: {
        Args: { _email?: string; _org_b?: string }
        Returns: {
          created_at: string
          id: string
          invite_code: string
          invited_at: string
          invited_by_email: string | null
          invited_by_user: string | null
          org_a: string
          org_b: string | null
          responded_at: string | null
          responded_by_user: string | null
          stato: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "network_partners"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      network_respond_invite: {
        Args: {
          _accept?: boolean
          _invite_code?: string
          _partnership_id?: string
        }
        Returns: {
          created_at: string
          id: string
          invite_code: string
          invited_at: string
          invited_by_email: string | null
          invited_by_user: string | null
          org_a: string
          org_b: string | null
          responded_at: string | null
          responded_by_user: string | null
          stato: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "network_partners"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      network_revoke_partnership: {
        Args: { _partnership_id: string }
        Returns: {
          created_at: string
          id: string
          invite_code: string
          invited_at: string
          invited_by_email: string | null
          invited_by_user: string | null
          org_a: string
          org_b: string | null
          responded_at: string | null
          responded_by_user: string | null
          stato: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "network_partners"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      network_visible_orgs: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      network_withdraw_servizio: {
        Args: { _servizio_id: string }
        Returns: {
          created_at: string
          dispatched_at: string
          dispatched_by: string | null
          id: string
          org_a: string
          org_b: string
          partnership_id: string
          prezzo_concordato: number
          responded_at: string | null
          servizio_a_id: string
          servizio_b_id: string | null
          snapshot: Json
          stato: Database["public"]["Enums"]["network_dispatch_stato"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "servizi_network"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      presenza_apri_turno: {
        Args: { _note?: string }
        Returns: {
          autista_id: string
          corretta_at: string | null
          corretta_da: string | null
          created_at: string
          data: string
          fine_at: string | null
          id: string
          inizio_at: string
          note: string | null
          org_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "autisti_presenze"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      presenza_chiudi_turno: {
        Args: { _note?: string }
        Returns: {
          autista_id: string
          corretta_at: string | null
          corretta_da: string | null
          created_at: string
          data: string
          fine_at: string | null
          id: string
          inizio_at: string
          note: string | null
          org_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "autisti_presenze"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      presenza_correggi_oggi: {
        Args: {
          _fine_at?: string
          _inizio_at?: string
          _note?: string
          _presenza_id: string
        }
        Returns: {
          autista_id: string
          corretta_at: string | null
          corretta_da: string | null
          created_at: string
          data: string
          fine_at: string | null
          id: string
          inizio_at: string
          note: string | null
          org_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "autisti_presenze"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      richiedi_assenza: {
        Args: {
          _data_fine: string
          _data_inizio: string
          _motivazione?: string
          _tipo: Database["public"]["Enums"]["assenza_tipo"]
        }
        Returns: {
          autista_id: string
          created_at: string
          data_fine: string
          data_inizio: string
          deciso_at: string | null
          deciso_da: string | null
          id: string
          motivazione: string | null
          note_ufficio: string | null
          org_id: string
          origine: string
          richiesta_da: string | null
          stato: Database["public"]["Enums"]["assenza_stato"]
          tipo: Database["public"]["Enums"]["assenza_tipo"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "autisti_assenze"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rifiuta_assenza: {
        Args: { _id: string; _note?: string }
        Returns: {
          autista_id: string
          created_at: string
          data_fine: string
          data_inizio: string
          deciso_at: string | null
          deciso_da: string | null
          id: string
          motivazione: string | null
          note_ufficio: string | null
          org_id: string
          origine: string
          richiesta_da: string | null
          stato: Database["public"]["Enums"]["assenza_stato"]
          tipo: Database["public"]["Enums"]["assenza_tipo"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "autisti_assenze"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      veicoli_check_tagliandi: { Args: never; Returns: undefined }
      veicoli_occupati: {
        Args: never
        Returns: {
          aperta_at: string
          autista_id: string
          autista_nome: string
          veicolo_id: string
        }[]
      }
      veicolo_tagliando_eseguito: {
        Args: { _intervallo?: number; _km?: number; _veicolo_id: string }
        Returns: {
          attivo: boolean
          autorizzazione_comune: string | null
          autorizzazione_numero: string | null
          colore: string | null
          consumo_km_litro: number | null
          created_at: string
          data_immatricolazione: string | null
          data_inizio_credito: string | null
          data_ultima_quota_credito: string | null
          dati_tecnici: string | null
          id: string
          intervallo_tagliando_km: number
          km_attuale: number | null
          km_iniziale: number | null
          km_prima_scadenza: number | null
          km_voucher: number | null
          manutenzione_ordinaria: string | null
          marca: string | null
          modello: string | null
          note: string | null
          org_id: string
          photo_url: string | null
          posti: number | null
          prezzo_acquisto: number | null
          quota_mensile_credito: number | null
          tagliando_alert_at: string | null
          tagliando_alert_stato: string
          tagliando_ultimo_at: string | null
          tagliando_ultimo_km: number | null
          targa: string
          telaio: string | null
          telepass: string | null
          tipo_macchina: string | null
          updated_at: string
          viacard: string | null
          visibile_magazzino: boolean
          visibile_servizi: boolean
        }
        SetofOptions: {
          from: "*"
          to: "veicoli"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      veicolo_valuta_tagliando: {
        Args: { _veicolo_id: string }
        Returns: string
      }
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
      agenda_categoria: "appuntamento" | "scadenza" | "nota" | "altro"
      agenda_visibilita: "personale" | "organizzazione"
      app_role: "admin" | "manager" | "agent"
      assenza_stato: "richiesta" | "approvata" | "rifiutata" | "annullata"
      assenza_tipo: "ferie" | "riposo" | "permesso" | "malattia"
      network_dispatch_stato:
        | "inviato"
        | "accettato"
        | "rifiutato"
        | "completato"
        | "ritirato"
      proposal_status: "draft" | "sent" | "viewed" | "accepted" | "rejected"
      servizio_stato:
        | "nuovo"
        | "da_confermare"
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
      tipologia_partenza:
        | "altro_luogo"
        | "aeroporto"
        | "civitavecchia"
        | "stazione"
      trasferta_tipo: "nessuna" | "trasferta" | "trasferta_2"
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
      agenda_categoria: ["appuntamento", "scadenza", "nota", "altro"],
      agenda_visibilita: ["personale", "organizzazione"],
      app_role: ["admin", "manager", "agent"],
      assenza_stato: ["richiesta", "approvata", "rifiutata", "annullata"],
      assenza_tipo: ["ferie", "riposo", "permesso", "malattia"],
      network_dispatch_stato: [
        "inviato",
        "accettato",
        "rifiutato",
        "completato",
        "ritirato",
      ],
      proposal_status: ["draft", "sent", "viewed", "accepted", "rejected"],
      servizio_stato: [
        "nuovo",
        "da_confermare",
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
      tipologia_partenza: [
        "altro_luogo",
        "aeroporto",
        "civitavecchia",
        "stazione",
      ],
      trasferta_tipo: ["nessuna", "trasferta", "trasferta_2"],
      utenza_tipo: ["singolo", "gruppo"],
    },
  },
} as const
