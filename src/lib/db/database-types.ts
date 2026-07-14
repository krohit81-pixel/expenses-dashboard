/**
 * Generated-style types for the `finance` Postgres schema.
 *
 * IMPORTANT: This file is a hand-authored BOOTSTRAP, not the real output of
 * `supabase gen types typescript`. It was written by reading the three applied
 * migrations in supabase/migrations/ column-by-column, but it has not been
 * verified against the live Vitals database and may drift.
 *
 * Replace it with the real generated file as soon as you can run:
 *
 *   npx supabase login
 *   npx supabase link --project-ref <vitals-project-ref>
 *   npm run db:types
 *
 * `npm run db:types` (see package.json) writes this exact path, so replacing
 * it is a zero-diff-format operation once you have CLI access to Vitals.
 *
 * Do not hand-maintain this file going forward (see docs/08-engineering-standards.md);
 * treat any future schema change as "write a migration, then regenerate."
 *
 * Note on numeric columns: Postgres `numeric`/`bigint` are generated here as
 * `number`, matching the Supabase CLI's default codegen behavior. This is a
 * deliberate boundary type, not the app-level representation: docs/03 and
 * docs/08 require money to be handled as fixed-precision decimal strings
 * everywhere else in the app. Convert at the boundary (see src/lib/money/,
 * to be added in Milestone 1) — never pass a raw `Row["amount"]` number into
 * arithmetic or across the API contract.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  finance: {
    Tables: {
      user_settings: {
        Row: {
          user_id: string;
          base_currency: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          base_currency?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          base_currency?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      institutions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          website: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          website?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          website?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          institution_id: string | null;
          name: string;
          account_type: Database["finance"]["Enums"]["account_type"];
          currency_code: string;
          opening_balance: number;
          opening_balance_date: string | null;
          external_reference: string | null;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          institution_id?: string | null;
          name: string;
          account_type: Database["finance"]["Enums"]["account_type"];
          currency_code?: string;
          opening_balance?: number;
          opening_balance_date?: string | null;
          external_reference?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          institution_id?: string | null;
          name?: string;
          account_type?: Database["finance"]["Enums"]["account_type"];
          currency_code?: string;
          opening_balance?: number;
          opening_balance_date?: string | null;
          external_reference?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_cards: {
        Row: {
          account_id: string;
          user_id: string;
          credit_limit: number | null;
          statement_day: number | null;
          payment_due_day: number | null;
          annual_percentage_rate: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          user_id?: string;
          credit_limit?: number | null;
          statement_day?: number | null;
          payment_due_day?: number | null;
          annual_percentage_rate?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          user_id?: string;
          credit_limit?: number | null;
          statement_day?: number | null;
          payment_due_day?: number | null;
          annual_percentage_rate?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_cards_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: true;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          parent_id: string | null;
          kind: Database["finance"]["Enums"]["category_kind"];
          name: string;
          color: string | null;
          icon: string | null;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          parent_id?: string | null;
          kind: Database["finance"]["Enums"]["category_kind"];
          name: string;
          color?: string | null;
          icon?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          parent_id?: string | null;
          kind?: Database["finance"]["Enums"]["category_kind"];
          name?: string;
          color?: string | null;
          icon?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          currency_code: string;
          period_start: string;
          period_end: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          currency_code?: string;
          period_start: string;
          period_end: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          currency_code?: string;
          period_start?: string;
          period_end?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      budget_lines: {
        Row: {
          id: string;
          user_id: string;
          budget_id: string;
          category_id: string;
          planned_amount: number;
          rollover_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          budget_id: string;
          category_id: string;
          planned_amount: number;
          rollover_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          budget_id?: string;
          category_id?: string;
          planned_amount?: number;
          rollover_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_lines_budget_id_fkey";
            columns: ["budget_id"];
            isOneToOne: false;
            referencedRelation: "budgets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_lines_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          transfer_account_id: string | null;
          kind: Database["finance"]["Enums"]["transaction_kind"];
          amount: number;
          currency_code: string;
          payee: string | null;
          memo: string | null;
          frequency: Database["finance"]["Enums"]["recurrence_frequency"];
          interval_count: number;
          starts_on: string;
          ends_on: string | null;
          next_occurrence_on: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          account_id: string;
          transfer_account_id?: string | null;
          kind: Database["finance"]["Enums"]["transaction_kind"];
          amount: number;
          currency_code: string;
          payee?: string | null;
          memo?: string | null;
          frequency: Database["finance"]["Enums"]["recurrence_frequency"];
          interval_count?: number;
          starts_on: string;
          ends_on?: string | null;
          next_occurrence_on: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          transfer_account_id?: string | null;
          kind?: Database["finance"]["Enums"]["transaction_kind"];
          amount?: number;
          currency_code?: string;
          payee?: string | null;
          memo?: string | null;
          frequency?: Database["finance"]["Enums"]["recurrence_frequency"];
          interval_count?: number;
          starts_on?: string;
          ends_on?: string | null;
          next_occurrence_on?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_transactions_transfer_account_id_fkey";
            columns: ["transfer_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_transaction_splits: {
        Row: {
          id: string;
          user_id: string;
          recurring_transaction_id: string;
          category_id: string;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          recurring_transaction_id: string;
          category_id: string;
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recurring_transaction_id?: string;
          category_id?: string;
          amount?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_transaction_splits_recurring_transaction_id_fkey";
            columns: ["recurring_transaction_id"];
            isOneToOne: false;
            referencedRelation: "recurring_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_transaction_splits_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          transfer_account_id: string | null;
          recurring_transaction_id: string | null;
          kind: Database["finance"]["Enums"]["transaction_kind"];
          status: Database["finance"]["Enums"]["transaction_status"];
          amount: number;
          currency_code: string;
          exchange_rate: number | null;
          occurred_on: string;
          payee: string | null;
          memo: string | null;
          cycle_month: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          account_id: string;
          transfer_account_id?: string | null;
          recurring_transaction_id?: string | null;
          kind: Database["finance"]["Enums"]["transaction_kind"];
          status?: Database["finance"]["Enums"]["transaction_status"];
          amount: number;
          currency_code: string;
          exchange_rate?: number | null;
          occurred_on: string;
          payee?: string | null;
          memo?: string | null;
          cycle_month?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          transfer_account_id?: string | null;
          recurring_transaction_id?: string | null;
          kind?: Database["finance"]["Enums"]["transaction_kind"];
          status?: Database["finance"]["Enums"]["transaction_status"];
          amount?: number;
          currency_code?: string;
          exchange_rate?: number | null;
          occurred_on?: string;
          payee?: string | null;
          memo?: string | null;
          cycle_month?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_transfer_account_id_fkey";
            columns: ["transfer_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_recurring_transaction_id_fkey";
            columns: ["recurring_transaction_id"];
            isOneToOne: false;
            referencedRelation: "recurring_transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      transaction_splits: {
        Row: {
          id: string;
          user_id: string;
          transaction_id: string;
          category_id: string;
          amount: number;
          memo: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          transaction_id: string;
          category_id: string;
          amount: number;
          memo?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          transaction_id?: string;
          category_id?: string;
          amount?: number;
          memo?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_splits_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_splits_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      loans: {
        Row: {
          account_id: string;
          user_id: string;
          original_principal: number;
          interest_rate: number | null;
          originated_on: string | null;
          maturity_on: string | null;
          payment_amount: number | null;
          payment_due_day: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          user_id?: string;
          original_principal: number;
          interest_rate?: number | null;
          originated_on?: string | null;
          maturity_on?: string | null;
          payment_amount?: number | null;
          payment_due_day?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          user_id?: string;
          original_principal?: number;
          interest_rate?: number | null;
          originated_on?: string | null;
          maturity_on?: string | null;
          payment_amount?: number | null;
          payment_due_day?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loans_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: true;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          id: string;
          user_id: string;
          account_id: string | null;
          asset_type: Database["finance"]["Enums"]["asset_type"];
          name: string;
          acquired_on: string | null;
          acquisition_cost: number | null;
          currency_code: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          account_id?: string | null;
          asset_type: Database["finance"]["Enums"]["asset_type"];
          name: string;
          acquired_on?: string | null;
          acquisition_cost?: number | null;
          currency_code?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string | null;
          asset_type?: Database["finance"]["Enums"]["asset_type"];
          name?: string;
          acquired_on?: string | null;
          acquisition_cost?: number | null;
          currency_code?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assets_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: true;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      liabilities: {
        Row: {
          id: string;
          user_id: string;
          account_id: string | null;
          liability_type: Database["finance"]["Enums"]["liability_type"];
          name: string;
          original_amount: number | null;
          interest_rate: number | null;
          currency_code: string;
          due_on: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          account_id?: string | null;
          liability_type: Database["finance"]["Enums"]["liability_type"];
          name: string;
          original_amount?: number | null;
          interest_rate?: number | null;
          currency_code?: string;
          due_on?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string | null;
          liability_type?: Database["finance"]["Enums"]["liability_type"];
          name?: string;
          original_amount?: number | null;
          interest_rate?: number | null;
          currency_code?: string;
          due_on?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "liabilities_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: true;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      securities: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          name: string;
          exchange: string | null;
          currency_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          symbol: string;
          name: string;
          exchange?: string | null;
          currency_code?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          symbol?: string;
          name?: string;
          exchange?: string | null;
          currency_code?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      investment_transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          security_id: string;
          kind: Database["finance"]["Enums"]["investment_transaction_type"];
          occurred_on: string;
          quantity: number;
          unit_price: number | null;
          fees: number;
          total_amount: number;
          currency_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          account_id: string;
          security_id: string;
          kind: Database["finance"]["Enums"]["investment_transaction_type"];
          occurred_on: string;
          quantity: number;
          unit_price?: number | null;
          fees?: number;
          total_amount: number;
          currency_code: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          security_id?: string;
          kind?: Database["finance"]["Enums"]["investment_transaction_type"];
          occurred_on?: string;
          quantity?: number;
          unit_price?: number | null;
          fees?: number;
          total_amount?: number;
          currency_code?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "investment_transactions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investment_transactions_security_id_fkey";
            columns: ["security_id"];
            isOneToOne: false;
            referencedRelation: "securities";
            referencedColumns: ["id"];
          },
        ];
      };
      attachments: {
        Row: {
          id: string;
          user_id: string;
          storage_bucket: string;
          storage_path: string;
          file_name: string;
          content_type: string | null;
          byte_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          storage_bucket?: string;
          storage_path: string;
          file_name: string;
          content_type?: string | null;
          byte_size?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          storage_bucket?: string;
          storage_path?: string;
          file_name?: string;
          content_type?: string | null;
          byte_size?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      transaction_attachments: {
        Row: {
          user_id: string;
          transaction_id: string;
          attachment_id: string;
          created_at: string;
        };
        Insert: {
          user_id?: string;
          transaction_id: string;
          attachment_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          transaction_id?: string;
          attachment_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_attachments_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_attachments_attachment_id_fkey";
            columns: ["attachment_id"];
            isOneToOne: false;
            referencedRelation: "attachments";
            referencedColumns: ["id"];
          },
        ];
      };
      account_attachments: {
        Row: {
          user_id: string;
          account_id: string;
          attachment_id: string;
          created_at: string;
        };
        Insert: {
          user_id?: string;
          account_id: string;
          attachment_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          account_id?: string;
          attachment_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_attachments_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_attachments_attachment_id_fkey";
            columns: ["attachment_id"];
            isOneToOne: false;
            referencedRelation: "attachments";
            referencedColumns: ["id"];
          },
        ];
      };
      asset_attachments: {
        Row: {
          user_id: string;
          asset_id: string;
          attachment_id: string;
          created_at: string;
        };
        Insert: {
          user_id?: string;
          asset_id: string;
          attachment_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          asset_id?: string;
          attachment_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asset_attachments_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_attachments_attachment_id_fkey";
            columns: ["attachment_id"];
            isOneToOne: false;
            referencedRelation: "attachments";
            referencedColumns: ["id"];
          },
        ];
      };
      liability_attachments: {
        Row: {
          user_id: string;
          liability_id: string;
          attachment_id: string;
          created_at: string;
        };
        Insert: {
          user_id?: string;
          liability_id: string;
          attachment_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          liability_id?: string;
          attachment_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "liability_attachments_liability_id_fkey";
            columns: ["liability_id"];
            isOneToOne: false;
            referencedRelation: "liabilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "liability_attachments_attachment_id_fkey";
            columns: ["attachment_id"];
            isOneToOne: false;
            referencedRelation: "attachments";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      account_type:
        | "checking"
        | "savings"
        | "cash"
        | "credit_card"
        | "investment"
        | "loan"
        | "asset"
        | "liability";
      category_kind: "income" | "expense";
      transaction_kind: "income" | "expense" | "transfer" | "adjustment";
      transaction_status: "pending" | "posted" | "void";
      recurrence_frequency:
        "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
      asset_type: "real_estate" | "vehicle" | "valuable" | "other";
      liability_type: "personal" | "tax" | "medical" | "other";
      investment_transaction_type:
        "buy" | "sell" | "dividend" | "interest" | "fee" | "split";
    };
    CompositeTypes: Record<string, never>;
  };
};
