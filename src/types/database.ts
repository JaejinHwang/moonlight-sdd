export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      papers: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          source_url: string | null;
          file_path: string;
          file_size: number;
          page_count: number;
          language: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          source_url?: string | null;
          file_path: string;
          file_size: number;
          page_count: number;
          language?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          source_url?: string | null;
          file_path?: string;
          file_size?: number;
          page_count?: number;
          language?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      sections: {
        Row: {
          id: string;
          paper_id: string;
          title: string;
          level: number;
          order_index: number;
          content: string;
          page_start: number;
          page_end: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          paper_id: string;
          title: string;
          level?: number;
          order_index: number;
          content: string;
          page_start: number;
          page_end: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          paper_id?: string;
          title?: string;
          level?: number;
          order_index?: number;
          content?: string;
          page_start?: number;
          page_end?: number;
          created_at?: string;
        };
      };
      translations: {
        Row: {
          id: string;
          paper_id: string;
          section_id: string | null;
          original_text: string;
          translated_text: string;
          source_lang: string;
          target_lang: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          paper_id: string;
          section_id?: string | null;
          original_text: string;
          translated_text: string;
          source_lang: string;
          target_lang: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          paper_id?: string;
          section_id?: string | null;
          original_text?: string;
          translated_text?: string;
          source_lang?: string;
          target_lang?: string;
          created_at?: string;
        };
      };
      analysis: {
        Row: {
          id: string;
          paper_id: string;
          overall_summary: string | null;
          section_summaries: Json;
          highlights: Json;
          keywords: Json;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_id: string;
          overall_summary?: string | null;
          section_summaries?: Json;
          highlights?: Json;
          keywords?: Json;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paper_id?: string;
          overall_summary?: string | null;
          section_summaries?: Json;
          highlights?: Json;
          keywords?: Json;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
