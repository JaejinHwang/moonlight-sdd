# ADR-002: AI 모델 선택

## Status
Accepted (Updated: Vertex AI 방식으로 전환)

## Context
논문 번역, 요약, 키워드 추출, 하이라이트 분석을 위한 AI 모델/API를 선택해야 한다. 다음 요구사항을 충족해야 한다:
- 긴 논문 텍스트 처리 가능 (긴 컨텍스트)
- 다국어 번역 지원
- 학술 텍스트 이해 능력
- API 비용 최소화
- 빠른 응답 속도

## Decision
**Google Vertex AI (Gemini)**를 AI 서비스로 선택한다.

### Update (2025-01)
기존 Gemini API Key 방식에서 **Vertex AI** 방식으로 전환하였다:
- 인증: API Key → Application Default Credentials (gcloud auth login)
- 패키지: @google/generative-ai → @google-cloud/vertexai
- 모델: gemini-2.0-flash → gemini-2.0-flash-001

## Alternatives Considered

### 1. Google Gemini API (선택됨)
- **장점**:
  - 매우 긴 컨텍스트 지원 (Gemini 1.5 Pro: 1M tokens)
  - 경쟁력 있는 가격 ($0.00025/1K input tokens)
  - 다국어 처리 우수
  - Google의 학술 데이터 학습
  - 무료 티어 제공 (분당 15 요청)
- **단점**:
  - OpenAI 대비 생태계 작음
  - 일부 기능 베타 상태

### 2. OpenAI GPT-4
- **장점**:
  - 가장 넓은 생태계
  - 안정적인 API
  - 우수한 품질
- **단점**:
  - 높은 비용 ($0.01/1K input tokens)
  - 컨텍스트 제한 (128K tokens)

### 3. Claude API
- **장점**:
  - 긴 컨텍스트 (200K tokens)
  - 학술 텍스트 강점
- **단점**:
  - 비용 중간 ($0.003/1K input)
  - 일부 지역 제한

### 4. Self-hosted LLM (Llama 등)
- **장점**:
  - 비용 통제 가능
  - 데이터 프라이버시
- **단점**:
  - 인프라 관리 필요
  - 품질 저하 가능성
  - 초기 비용 높음

## Consequences

### Positive
- 긴 논문도 단일 요청으로 처리 가능
- 비용 효율적 (무료 티어로 MVP 테스트)
- 빠른 응답 속도
- 다국어 번역 품질 우수

### Negative
- Google 서비스 의존성
- API 변경/중단 리스크
- Rate limit 관리 필요

## Implementation Notes
- Gemini 2.0 Flash를 기본으로 사용 (빠른 응답, 저비용)
- 복잡한 분석은 Gemini 1.5 Pro 사용 가능
- 요청 실패 시 재시도 로직 구현 (최대 3회, exponential backoff)
- 토큰 사용량 모니터링 로깅 구현

### Vertex AI 설정
```bash
# 1. gcloud CLI 인증
gcloud auth login
gcloud auth application-default login

# 2. 환경 변수 설정
export GOOGLE_CLOUD_PROJECT=your-project-id
export GOOGLE_CLOUD_LOCATION=us-central1  # optional, default: us-central1
```

### 코드 예시
```typescript
import { getGeminiClient } from "@/lib/gemini";

// Application Default Credentials 사용 (gcloud auth login)
const client = getGeminiClient();
const result = await client.translate({
  text: "Hello, world!",
  targetLang: "ko",
});
```

## References
- [Vertex AI Gemini Documentation](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [Vertex AI Pricing](https://cloud.google.com/vertex-ai/pricing)
- [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)
