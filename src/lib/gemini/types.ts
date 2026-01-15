/**
 * Gemini API Types (via Vertex AI)
 * TASK-009: Gemini API 통합
 *
 * spec_refs:
 * - technical-spec.yaml#architecture.components (Gemini API via Vertex AI)
 */

// Supported tasks for Gemini API
export type GeminiTask =
  | "translate"
  | "summarize"
  | "highlight"
  | "extract_keywords"
  | "explain_keyword";

// Configuration for Vertex AI Gemini client
export interface VertexAIConfig {
  projectId: string;
  location: string;
  model: string;
  maxRetries: number;
  retryDelayMs: number;
  maxTokens?: number;
}

// Legacy alias for backwards compatibility
/** @deprecated Use VertexAIConfig instead */
export type GeminiConfig = VertexAIConfig;

// Request options for Gemini API
export interface GeminiRequestOptions {
  task: GeminiTask;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

// Response from Gemini API
export interface GeminiResponse<T = string> {
  success: boolean;
  data: T | null;
  error: GeminiError | null;
  usage: TokenUsage;
}

// Token usage tracking
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Error types
export interface GeminiError {
  code: GeminiErrorCode;
  message: string;
  retryable: boolean;
  originalError?: unknown;
}

export type GeminiErrorCode =
  | "API_KEY_INVALID"
  | "RATE_LIMIT_EXCEEDED"
  | "QUOTA_EXCEEDED"
  | "MODEL_NOT_FOUND"
  | "CONTENT_FILTERED"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "PARSE_ERROR"
  | "UNKNOWN_ERROR";

// Translation types
export interface TranslationInput {
  text: string;
  sourceLang?: string;
  targetLang: string;
}

export interface TranslationOutput {
  translatedText: string;
  detectedSourceLang?: string;
}

// Summary types
export interface SummaryInput {
  text: string;
  type: "overall" | "section";
  sectionTitle?: string;
  targetLang?: string; // ISO 639-1 language code, default "ko"
}

export interface SummaryOutput {
  summary: string;
}

// Highlight types
export interface HighlightInput {
  text: string;
  sectionId: string;
}

export interface HighlightOutput {
  highlights: {
    text: string;
    importance: "high" | "medium" | "low";
    reason: string;
  }[];
}

// Keyword types
export interface KeywordInput {
  text: string;
}

export interface KeywordOutput {
  keywords: {
    term: string;
    importance: "high" | "medium" | "low";
    definition: string;
    contextInPaper: string;
  }[];
}

// Keyword explanation types
export interface KeywordExplainInput {
  term: string;
  paperContext: string;
}

export interface KeywordExplainOutput {
  term: string;
  definition: string;
  contextInPaper: string;
  relatedTerms: string[];
}
