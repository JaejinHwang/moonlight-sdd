/**
 * Gemini API Client (via Vertex AI)
 * TASK-009: Gemini API 통합
 *
 * spec_refs:
 * - technical-spec.yaml#architecture.components (Gemini API via Vertex AI)
 *
 * Acceptance Criteria:
 * - AC-1: Given gcloud auth가 설정되었을 때, When Vertex AI API를 호출하면, Then 응답이 반환된다
 * - AC-2: Given API 호출 실패 시, When 재시도하면, Then 최대 3회까지 재시도한다
 */

import {
  VertexAI,
  GenerativeModel,
  GenerateContentResult,
} from "@google-cloud/vertexai";
import type {
  VertexAIConfig,
  GeminiRequestOptions,
  GeminiResponse,
  GeminiError,
  GeminiErrorCode,
  TokenUsage,
  GeminiTask,
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
import {
  buildTranslationPrompt,
  buildSummaryPrompt,
  buildHighlightPrompt,
  buildKeywordPrompt,
  buildKeywordExplainPrompt,
} from "./prompts";

// Default configuration
const DEFAULT_CONFIG: Partial<VertexAIConfig> = {
  model: "gemini-2.0-flash-001",
  maxRetries: 3,
  retryDelayMs: 1000,
  maxTokens: 8192,
  location: "us-central1",
};

// Error code mapping from Gemini API errors
const ERROR_CODE_MAP: Record<string, GeminiErrorCode> = {
  PERMISSION_DENIED: "API_KEY_INVALID",
  RESOURCE_EXHAUSTED: "RATE_LIMIT_EXCEEDED",
  INVALID_ARGUMENT: "CONTENT_FILTERED",
  NOT_FOUND: "MODEL_NOT_FOUND",
};

// Retryable error codes
const RETRYABLE_ERRORS: Set<GeminiErrorCode> = new Set([
  "RATE_LIMIT_EXCEEDED",
  "NETWORK_ERROR",
  "TIMEOUT",
]);

/**
 * Gemini API Client class (via Vertex AI)
 * Handles all interactions with Google's Vertex AI Gemini API
 * Uses Application Default Credentials (gcloud auth login)
 */
export class GeminiClient {
  private client: VertexAI;
  private model: GenerativeModel;
  private config: VertexAIConfig;

  constructor(config?: Partial<VertexAIConfig>) {
    const projectId = config?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
    const location = config?.location || process.env.GOOGLE_CLOUD_LOCATION || DEFAULT_CONFIG.location!;

    if (!projectId) {
      throw new Error(
        "GOOGLE_CLOUD_PROJECT is required. Set it in environment variables or pass it in config."
      );
    }

    this.config = {
      projectId,
      location,
      model: config?.model || DEFAULT_CONFIG.model!,
      maxRetries: config?.maxRetries ?? DEFAULT_CONFIG.maxRetries!,
      retryDelayMs: config?.retryDelayMs ?? DEFAULT_CONFIG.retryDelayMs!,
      maxTokens: config?.maxTokens ?? DEFAULT_CONFIG.maxTokens,
    };

    this.client = new VertexAI({
      project: this.config.projectId,
      location: this.config.location,
    });

    this.model = this.client.getGenerativeModel({
      model: this.config.model,
    });
  }

  /**
   * Generate content with retry logic
   * AC-2: 최대 3회까지 재시도
   */
  private async generateWithRetry(
    prompt: string,
    options: GeminiRequestOptions
  ): Promise<GeminiResponse<string>> {
    let lastError: GeminiError | null = null;
    let totalUsage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const result: GenerateContentResult = await this.model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens ?? this.config.maxTokens,
            topP: options.topP,
            topK: options.topK,
          },
        });

        const response = result.response;

        // Extract text from Vertex AI response
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

        // Extract usage metadata if available
        const usageMetadata = response.usageMetadata;
        if (usageMetadata) {
          totalUsage = {
            promptTokens: usageMetadata.promptTokenCount ?? 0,
            completionTokens: usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata.totalTokenCount ?? 0,
          };
        }

        // Log token usage
        this.logTokenUsage(options.task, totalUsage);

        return {
          success: true,
          data: text,
          error: null,
          usage: totalUsage,
        };
      } catch (error) {
        lastError = this.parseError(error);

        // Only retry if error is retryable
        if (!lastError.retryable) {
          break;
        }

        // Log retry attempt
        console.warn(
          `[GeminiClient] Retry ${attempt + 1}/${this.config.maxRetries} for ${options.task}:`,
          lastError.message
        );

        // Wait before retry with exponential backoff
        if (attempt < this.config.maxRetries - 1) {
          await this.delay(this.config.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }

    return {
      success: false,
      data: null,
      error: lastError,
      usage: totalUsage,
    };
  }

  /**
   * Parse error from Gemini API
   */
  private parseError(error: unknown): GeminiError {
    // Handle GoogleGenerativeAI specific errors
    if (error instanceof Error) {
      const message = error.message;

      // Check for known error patterns
      for (const [pattern, code] of Object.entries(ERROR_CODE_MAP)) {
        if (message.includes(pattern)) {
          return {
            code,
            message: message,
            retryable: RETRYABLE_ERRORS.has(code),
            originalError: error,
          };
        }
      }

      // Network errors
      if (message.includes("fetch") || message.includes("network")) {
        return {
          code: "NETWORK_ERROR",
          message: "Network error occurred while calling Gemini API",
          retryable: true,
          originalError: error,
        };
      }

      // Timeout errors
      if (message.includes("timeout") || message.includes("TIMEOUT")) {
        return {
          code: "TIMEOUT",
          message: "Request timed out",
          retryable: true,
          originalError: error,
        };
      }

      return {
        code: "UNKNOWN_ERROR",
        message: message,
        retryable: false,
        originalError: error,
      };
    }

    return {
      code: "UNKNOWN_ERROR",
      message: "An unknown error occurred",
      retryable: false,
      originalError: error,
    };
  }

  /**
   * Log token usage for monitoring
   */
  private logTokenUsage(task: GeminiTask, usage: TokenUsage): void {
    console.log(
      `[GeminiClient] Token usage for ${task}: ` +
        `prompt=${usage.promptTokens}, completion=${usage.completionTokens}, total=${usage.totalTokens}`
    );
  }

  /**
   * Delay utility for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Parse JSON response with error handling
   */
  private parseJsonResponse<T>(
    text: string,
    defaultValue: T
  ): { success: boolean; data: T; error?: string } {
    try {
      // Remove markdown code blocks if present
      const cleanedText = text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      const data = JSON.parse(cleanedText) as T;
      return { success: true, data };
    } catch (error) {
      console.error("[GeminiClient] JSON parse error:", error);
      return {
        success: false,
        data: defaultValue,
        error: error instanceof Error ? error.message : "Parse error",
      };
    }
  }

  // ============================================================
  // Public API Methods
  // ============================================================

  /**
   * Translate text (F-005)
   */
  async translate(input: TranslationInput): Promise<GeminiResponse<TranslationOutput>> {
    const prompt = buildTranslationPrompt(input);
    const response = await this.generateWithRetry(prompt, {
      task: "translate",
      temperature: 0.3, // Lower temperature for more consistent translations
    });

    if (!response.success || !response.data) {
      return {
        ...response,
        data: null,
      };
    }

    return {
      ...response,
      data: {
        translatedText: response.data,
      },
    };
  }

  /**
   * Generate summary (F-007)
   */
  async summarize(input: SummaryInput): Promise<GeminiResponse<SummaryOutput>> {
    const prompt = buildSummaryPrompt(input);
    const response = await this.generateWithRetry(prompt, {
      task: "summarize",
      temperature: 0.5,
    });

    if (!response.success || !response.data) {
      return {
        ...response,
        data: null,
      };
    }

    return {
      ...response,
      data: {
        summary: response.data,
      },
    };
  }

  /**
   * Extract highlights (F-006)
   */
  async extractHighlights(input: HighlightInput): Promise<GeminiResponse<HighlightOutput>> {
    const prompt = buildHighlightPrompt(input);
    const response = await this.generateWithRetry(prompt, {
      task: "highlight",
      temperature: 0.4,
    });

    if (!response.success || !response.data) {
      return {
        ...response,
        data: null,
      };
    }

    const parsed = this.parseJsonResponse<HighlightOutput>(response.data, {
      highlights: [],
    });

    if (!parsed.success) {
      return {
        ...response,
        success: false,
        data: null,
        error: {
          code: "PARSE_ERROR",
          message: `Failed to parse highlights: ${parsed.error}`,
          retryable: false,
        },
      };
    }

    return {
      ...response,
      data: parsed.data,
    };
  }

  /**
   * Extract keywords (F-008)
   */
  async extractKeywords(input: KeywordInput): Promise<GeminiResponse<KeywordOutput>> {
    const prompt = buildKeywordPrompt(input);
    const response = await this.generateWithRetry(prompt, {
      task: "extract_keywords",
      temperature: 0.4,
    });

    if (!response.success || !response.data) {
      return {
        ...response,
        data: null,
      };
    }

    const parsed = this.parseJsonResponse<KeywordOutput>(response.data, {
      keywords: [],
    });

    if (!parsed.success) {
      return {
        ...response,
        success: false,
        data: null,
        error: {
          code: "PARSE_ERROR",
          message: `Failed to parse keywords: ${parsed.error}`,
          retryable: false,
        },
      };
    }

    return {
      ...response,
      data: parsed.data,
    };
  }

  /**
   * Explain a keyword (F-008)
   */
  async explainKeyword(
    input: KeywordExplainInput
  ): Promise<GeminiResponse<KeywordExplainOutput>> {
    const prompt = buildKeywordExplainPrompt(input);
    const response = await this.generateWithRetry(prompt, {
      task: "explain_keyword",
      temperature: 0.5,
    });

    if (!response.success || !response.data) {
      return {
        ...response,
        data: null,
      };
    }

    const parsed = this.parseJsonResponse<KeywordExplainOutput>(response.data, {
      term: input.term,
      definition: "",
      contextInPaper: "",
      relatedTerms: [],
    });

    if (!parsed.success) {
      return {
        ...response,
        success: false,
        data: null,
        error: {
          code: "PARSE_ERROR",
          message: `Failed to parse keyword explanation: ${parsed.error}`,
          retryable: false,
        },
      };
    }

    return {
      ...response,
      data: parsed.data,
    };
  }

  /**
   * Health check - verify API connection
   * AC-1: Given gcloud auth가 설정되었을 때, When Vertex AI API를 호출하면, Then 응답이 반환된다
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: "Hello" }] }],
        generationConfig: {
          maxOutputTokens: 10,
        },
      });

      const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
      return !!text;
    } catch (error) {
      console.error("[GeminiClient] Health check failed:", error);
      return false;
    }
  }
}

// Singleton instance for convenience
let defaultClient: GeminiClient | null = null;

/**
 * Get or create the default Gemini client
 */
export function getGeminiClient(config?: Partial<VertexAIConfig>): GeminiClient {
  if (!defaultClient || config) {
    defaultClient = new GeminiClient(config);
  }
  return defaultClient;
}

/**
 * Reset the default client (useful for testing)
 */
export function resetGeminiClient(): void {
  defaultClient = null;
}
