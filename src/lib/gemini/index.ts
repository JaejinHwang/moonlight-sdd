/**
 * Gemini API Module
 * TASK-009: Gemini API 통합
 *
 * Re-exports all Gemini API utilities for convenient imports
 */

// Client
export { GeminiClient, getGeminiClient, resetGeminiClient } from "./client";

// Types
export type {
  GeminiTask,
  GeminiConfig,
  GeminiRequestOptions,
  GeminiResponse,
  GeminiError,
  GeminiErrorCode,
  TokenUsage,
  TranslationInput,
  TranslationOutput,
  SummaryInput,
  SummaryOutput,
  HighlightInput,
  HighlightOutput,
  KeywordInput,
  KeywordOutput,
  KeywordExplainInput,
  KeywordExplainOutput,
} from "./types";

// Prompts (exported for testing/customization)
export {
  buildTranslationPrompt,
  buildSummaryPrompt,
  buildHighlightPrompt,
  buildKeywordPrompt,
  buildKeywordExplainPrompt,
} from "./prompts";
