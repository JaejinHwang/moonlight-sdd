// Re-export database types
export type { Database, Json } from "./database";

// Paper types
export interface Paper {
  id: string;
  user_id: string;
  title: string;
  source_url: string | null;
  file_path: string;
  file_size: number;
  page_count: number;
  language: string;
  status: PaperStatus;
  created_at: string;
  updated_at: string;
  sections?: Section[];
  analysis?: Analysis;
}

export type PaperStatus = "processing" | "ready" | "error";

// Section types
export interface Section {
  id: string;
  paper_id: string;
  title: string;
  level: number;
  order_index: number;
  content: string;
  page_start: number;
  page_end: number;
  created_at?: string;
}

// Translation types
export interface Translation {
  id: string;
  paper_id: string;
  section_id: string | null;
  original_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  created_at: string;
}

export interface TranslationResult {
  original: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
}

// Analysis types
export interface Analysis {
  id: string;
  paper_id: string;
  overall_summary: string | null;
  section_summaries: SectionSummary[];
  highlights: Highlight[];
  keywords: Keyword[];
  status: AnalysisStatus;
  created_at: string;
  updated_at: string;
}

export type AnalysisStatus = "pending" | "processing" | "completed" | "error";

export interface SectionSummary {
  sectionId: string;
  title: string;
  summary: string;
}

export interface Highlight {
  id: string;
  text: string;
  sectionId: string;
  importance: "high" | "medium" | "low";
  reason: string;
}

export interface Keyword {
  term: string;
  frequency: number;
  importance: "high" | "medium" | "low";
  definition: string;
  contextInPaper: string;
  relatedTerms: string[];
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  recovery_action?: string;
}

// Upload state types
export type UploadState =
  | "idle"
  | "validating"
  | "uploading"
  | "parsing"
  | "completed"
  | "error";

// Translation state types
export type TranslationState =
  | "idle"
  | "translating"
  | "translated"
  | "showing_both"
  | "error";
