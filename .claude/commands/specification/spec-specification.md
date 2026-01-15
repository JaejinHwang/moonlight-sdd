# /spec-specification

Discovery 단계 결과를 바탕으로 Specification 단계(Stage 4-6) 스펙을 생성합니다.

## 개요

이 명령어는 다음 파일들을 생성합니다:
1. `specs/02-specification/functional-spec.yaml` (Stage 4)
2. `specs/02-specification/technical-spec.yaml` (Stage 5)
3. `specs/02-specification/ui-spec.yaml` (Stage 6)
4. `specs/02-specification/adrs/ADR-001-*.md` (필요시)

## 실행 조건

- `specs/01-discovery/requirements.yaml`이 존재해야 함
- 없으면 `/spec-discovery`를 먼저 실행하라고 안내

## 사전 확인

실행 시 먼저 Discovery 스펙들을 읽고 요약을 보여줍니다:
```
📋 Discovery 스펙 확인

프로젝트: [idea-crystal.core_value]
타겟 사용자: [idea-crystal.target_user]
핵심 지표: [problem-definition.success_metrics 요약]

User Stories (Must-have):
- US-001: [i_want 요약]
- US-002: [i_want 요약]
...

기술 제약: [constraints.technical 요약]

이 내용을 기반으로 상세 명세를 생성합니다. 진행할까요?
```

---

## 프로세스

### Stage 4: 기능 명세 (functional-spec.yaml)

requirements.yaml의 각 user_story를 분석하여 기능으로 분해합니다.

**분해 규칙:**
1. 하나의 User Story는 1~3개의 Feature로 분해
2. 각 Feature는 독립적으로 구현/테스트 가능해야 함
3. Feature 간 의존성을 명시

**사용자 확인 질문:**
"US-001을 다음과 같이 분해했습니다:
- F-001: PDF 업로드 처리
- F-002: PDF 파싱 및 구조화
맞나요? 수정이 필요하면 말씀해주세요."

---

### Stage 4-1: 모호성 스캔 및 명확화 (Clarification)

Feature 분해 확인 후, 각 Feature에 대해 모호성 스캔을 수행합니다.

> **참조:** `templates/clarification-taxonomy.yaml`

**모호성 스캔 프로세스:**

1. 각 Feature의 name, description을 Taxonomy의 8개 카테고리로 분석
2. 각 카테고리를 **Clear / Partial / Missing** 중 하나로 평가
3. Partial 또는 Missing인 카테고리에서 질문 후보 생성
4. **Impact × Uncertainty** 점수로 우선순위 정렬
5. Feature당 **최대 5개** 질문만 선택

**Taxonomy 카테고리:**

| ID | 카테고리 | 감지 키워드 |
|----|----------|------------|
| CAT-001 | Rendering & Display | 뷰어, 표시, 렌더링, 보여 |
| CAT-002 | Data Source & Flow | 가져오, 조회, 데이터, 불러 |
| CAT-003 | State Persistence | 저장, 기억, 유지, 보관 |
| CAT-004 | User Interaction | 입력, 선택, 클릭, 드래그 |
| CAT-005 | Error Recovery | 실패, 에러, 재시도 |
| CAT-006 | Performance Tradeoff | 처리, 변환, 분석, 대량 |
| CAT-007 | Scope Boundary | 관리, 지원, 기능 |
| CAT-008 | External Dependency | API, 서비스, 외부, 연동 |

**질문 형식:**

각 질문은 한 번에 하나씩, 다음 형식으로 제시:

```markdown
**F-003 "PDF 뷰어"에 대해 확인이 필요합니다.**

📌 **렌더링 방식**

**Recommended:** Option A - PDF 원본을 그대로 보여주는 것이 "뷰어"의 일반적 의미에 부합합니다.

| Option | Description |
|--------|-------------|
| A | 원본 PDF를 그대로 표시 (PDF.js 사용) |
| B | PDF에서 추출한 텍스트/이미지를 표시 |
| Short | 다른 방식 직접 입력 (5단어 이내) |

옵션 문자(A, B)로 답하거나, "yes"로 추천안을 수락하세요.
```

**답변 처리 규칙:**

- 사용자가 "yes", "recommended" 응답 → 추천안 채택
- 사용자가 옵션 문자 응답 (A, B 등) → 해당 옵션 채택
- 사용자가 직접 입력 → 5단어 이내인지 확인 후 채택
- 모호한 답변 → 재질문 (질문 카운트에 포함 안 됨)

**스펙 기록:**

답변이 확정되면 즉시 Feature의 `clarifications` 섹션에 기록:

```yaml
clarifications:
  - category: "Rendering & Display"
    question: "렌더링 방식"
    options_considered:
      - "원본 PDF를 그대로 표시 (PDF.js)"
      - "PDF에서 추출한 텍스트/이미지를 표시"
    decision: "원본 PDF를 그대로 표시 (PDF.js)"
    rationale: "사용자가 논문의 원본 레이아웃 보존 원함"
    asked_at: "2024-01-15T10:30:00Z"
```

**동시에 관련 섹션도 업데이트:**

| 카테고리 | 업데이트 대상 |
|----------|--------------|
| Rendering & Display | description, outputs.format |
| Data Source & Flow | inputs, states |
| State Persistence | outputs, states |
| Error Recovery | error_cases, states |

**질문 스킵 조건:**

다음 경우 질문하지 않음:
- 구현/검증에 영향 없는 사소한 디테일
- technical-spec이나 ui-spec에서 결정될 사항
- 명백한 베스트 프랙티스가 있는 경우
- 이미 다른 Feature에서 동일한 질문에 답변한 경우

**조기 종료:**

- 사용자가 "done", "skip", "proceed" 응답 시 해당 Feature의 질문 종료
- 5개 질문 완료 시 자동 종료

---

각 Feature에 대해 자동 생성:
```yaml
features:
  - id: "F-001"
    name: "[기능 이름]"
    description: "[기능 설명]"
    parent_story: "US-001"
    dependencies: []
    
    # 상태 다이어그램 - 필수!
    states:
      - name: "idle"
        description: "초기 상태"
        transitions:
          - trigger: "[이벤트]"
            target: "[다음 상태]"
            condition: null
      - name: "processing"
        description: "처리 중"
        transitions:
          - trigger: "success"
            target: "completed"
            condition: null
          - trigger: "error"
            target: "error"
            condition: null
      - name: "completed"
        description: "완료"
        transitions:
          - trigger: "reset"
            target: "idle"
            condition: null
      - name: "error"
        description: "에러 상태"
        transitions:
          - trigger: "retry"
            target: "idle"
            condition: null
    
    # 입출력 정의
    inputs:
      - name: "[입력명]"
        type: "[타입]"
        validation: "[검증 규칙]"
        required: true
    
    outputs:
      - name: "[출력명]"
        type: "[타입]"
        format: |
          {
            "field": "type"
          }
    
    # 에러 케이스 - 최소 3개 필수!
    error_cases:
      - condition: "[에러 조건 1]"
        error_code: "[ERROR_CODE_1]"
        user_message: "[사용자 메시지]"
        recovery_action: "[복구 방법]"
      - condition: "[에러 조건 2]"
        error_code: "[ERROR_CODE_2]"
        user_message: "[사용자 메시지]"
        recovery_action: "[복구 방법]"
      - condition: "[에러 조건 3]"
        error_code: "[ERROR_CODE_3]"
        user_message: "[사용자 메시지]"
        recovery_action: "[복구 방법]"
    
    # 엣지 케이스 - 최소 2개 필수!
    edge_cases:
      - scenario: "[경계 조건 1]"
        expected_behavior: "[예상 동작]"
      - scenario: "[경계 조건 2]"
        expected_behavior: "[예상 동작]"
    
    # 성능 요구사항
    performance:
      - metric: "[지표]"
        threshold: "[기준값]"
```

**생성 규칙:**
- 모든 Feature는 반드시 `states` 포함 (상태 다이어그램)
- 모든 Feature는 반드시 `error_cases` 3개 이상
- 모든 Feature는 반드시 `edge_cases` 2개 이상
- acceptance_criteria의 Given-When-Then을 states와 매핑

---

### Stage 5: 기술 명세 (technical-spec.yaml)

**사용자 확인 질문:**
"기술 스택을 확인합니다. constraints.technical에서 다음을 확인했습니다:
- Framework: Next.js
- 추가로 확인이 필요한 것:
  - 데이터베이스는 무엇을 사용하나요? (예: Supabase, PostgreSQL, MongoDB)
  - AI API는 무엇을 사용하나요? (예: Claude API, OpenAI)"

사용자 답변 후 생성:
```yaml
technical_spec:
  architecture:
    type: "[monolith|serverless]"
    
    diagram: |
      flowchart TB
        Client[Next.js Client]
        API[API Routes]
        DB[(Database)]
        AI[AI Service]
        
        Client --> API
        API --> DB
        API --> AI
    
    components:
      - name: "[컴포넌트명]"
        responsibility: "[역할]"
        technology: "[기술]"
        interfaces:
          provides: ["[제공 인터페이스]"]
          consumes: ["[사용 인터페이스]"]

  data_model:
    entities:
      - name: "[엔티티명]"
        description: "[설명]"
        attributes:
          - name: "id"
            type: "UUID"
            constraints: "PRIMARY KEY"
          - name: "[속성명]"
            type: "[타입]"
            constraints: "[제약조건]"
        relationships:
          - type: "[1:1|1:N|M:N]"
            target: "[대상 엔티티]"
            description: "[관계 설명]"

  api_spec:
    base_url: "/api"
    
    endpoints:
      # 각 Feature당 최소 1개 엔드포인트
      - path: "/[경로]"
        method: "[GET|POST|PUT|DELETE]"
        description: "[설명]"
        auth_required: true
        
        request:
          headers:
            Content-Type: "application/json"
          body:
            "[필드]": "[타입]"
        
        response:
          success:
            status: 200
            body:
              "[필드]": "[타입]"
          errors:
            - status: 400
              code: "[ERROR_CODE]"
              body:
                message: "[에러 메시지]"

  adrs:
    - id: "ADR-001"
      title: "[결정 제목]"
      status: "accepted"
      reference: "./adrs/ADR-001-[slug].md"
```

**ADR 자동 생성 조건:**
- 데이터베이스 선택 시 → ADR-001
- AI 모델 선택 시 → ADR-002
- 주요 라이브러리 선택 시 → ADR-003

---

### Stage 6: UI 명세 (ui-spec.yaml)

기능 명세를 기반으로 필요한 화면과 컴포넌트를 도출합니다.

> **⚠️ 중요: 디자인 시스템 사용 필수**
>
> 모든 UI는 반드시 **@qanda/qds4-web** 디자인 시스템만 사용해야 합니다.
> - 공식 문서: https://github.com/mathpresso/qanda-design-system-docs
> - 데모 페이지: https://mathpresso.github.io/qanda-design-system-docs
> - 로컬 레퍼런스: `templates/design-system/qds4-web.yaml`

**디자인 시스템 규칙:**
| 항목 | 필수 사항 |
|------|----------|
| 컴포넌트 | qds4-web 컴포넌트만 사용 (Button, TopAppBar, BottomSheet 등) |
| 색상 | COLOR 토큰만 사용 (예: blue_50, gray_100) - 하드코딩 금지 |
| 타이포그래피 | typography() 함수만 사용 (예: body_1, title_2) |
| 브레이크포인트 | BREAKPOINT 상수 사용 (SMALL, MEDIUM, LARGE, EXTRA_LARGE) |
| 금지 | shadcn/ui, MUI 등 다른 UI 라이브러리 사용 금지 |

**사용 가능한 컴포넌트:**
- **버튼**: Button, TextButton, IconButton, FloatingActionButton
- **폼**: Checkbox, Checkmark, Radio, Switch
- **네비게이션**: TopAppBar, Tabs, SegmentedControl
- **다이얼로그**: AlertDialog, StandardDialog, FullScreenDialog, BottomSheet
- **피드백**: Spinner, LoadingAnimation, Badge, Tag
- **레이아웃**: BottomFixedArea, Divider
- **유틸리티**: Icon, Typography, Shadow, StateLayer

**도출 규칙:**
1. 각 Feature의 states를 UI 상태로 매핑
2. 각 Feature의 inputs를 폼/입력 컴포넌트로 매핑
3. 각 Feature의 error_cases를 에러 UI로 매핑
4. **컴포넌트 type은 qds4-web 컴포넌트명 사용**
```yaml
ui_spec:
  # 디자인 시스템 정보 (필수)
  design_system:
    package: "@qanda/qds4-web"
    version: "^0.0.2"
    reference: "templates/design-system/qds4-web.yaml"

    # 프로젝트에서 사용할 색상 매핑 (COLOR 토큰만 사용)
    color_palette:
      primary: "blue_50"
      secondary: "gray_60"
      error: "red_50"
      warning: "orange_50"
      success: "green_50"
      background: "gray_100"
      text_primary: "gray_10"

    # 사용할 브레이크포인트
    breakpoints:
      SMALL: "360px"
      MEDIUM: "640px"
      LARGE: "1200px"
      EXTRA_LARGE: "1600px"

  screens:
    - id: "SCR-001"
      name: "[화면 이름]"
      route: "/[경로]"
      description: "[화면 설명]"
      implements_features: ["F-001", "F-002"]
      
      # 컴포넌트는 qds4-web 컴포넌트만 사용
      components:
        - id: "submit-btn"
          type: "Button"  # qds4-web 컴포넌트명
          description: "제출 버튼"

          # props는 qds4-web 컴포넌트 props 참조
          props:
            variant: "accent"  # neutral|accent|danger|tonal|outlined
            size: "m"          # l|m|s|xs
            children: "제출"

          states:
            - name: "default"
              appearance: "accent 색상, 활성화 상태"
              behavior: "클릭 시 폼 제출"
            - name: "loading"
              appearance: "loading=true, 스피너 표시"
              behavior: "클릭 비활성화"
            - name: "disabled"
              appearance: "disabled=true, 비활성화 스타일"
              behavior: "클릭 불가"

        - id: "confirm-dialog"
          type: "AlertDialog"  # qds4-web 다이얼로그
          description: "확인 다이얼로그"

          props:
            title: "확인"
            confirmButton: { text: "확인", onClick: "handleConfirm" }
            cancelButton: { text: "취소", onClick: "handleCancel" }
      
      interactions:
        - trigger: "[사용자 액션]"
          action: "[시스템 동작]"
          feedback: "[사용자 피드백]"
      
      responsive:
        mobile: "[모바일 레이아웃]"
        tablet: "[태블릿 레이아웃]"
        desktop: "[데스크톱 레이아웃]"
      
      accessibility:
        focus_order: ["[컴포넌트 순서]"]
        aria_labels:
          "[컴포넌트ID]": "[접근성 레이블]"
```

---

## 생성 규칙 요약

| 항목 | 규칙 |
|------|------|
| Feature 분해 | User Story당 1~3개 |
| States | 모든 Feature 필수, 최소 3개 상태 |
| Error Cases | Feature당 최소 3개 |
| Edge Cases | Feature당 최소 2개 |
| API Endpoints | Feature당 최소 1개 |
| ADR | 주요 기술 선택마다 1개 |
| Screen | 관련 Feature들을 그룹핑 |

## 완료 메시지
```
✅ Specification 단계 완료!

생성된 파일:
- specs/02-specification/functional-spec.yaml
  - Features: 5개
  - 총 States: 18개
  - 총 Error Cases: 15개
  
- specs/02-specification/technical-spec.yaml
  - Components: 4개
  - Entities: 3개
  - API Endpoints: 6개
  
- specs/02-specification/ui-spec.yaml
  - Screens: 3개
  - Components: 12개

- specs/02-specification/adrs/
  - ADR-001-database-selection.md
  - ADR-002-ai-model-selection.md

다음 단계:
1. 생성된 파일들을 검토하세요
2. 특히 error_cases와 edge_cases가 충분한지 확인하세요
3. `/implement TASK-001` 명령으로 구현을 시작하세요

💡 팁: functional-spec.yaml의 states가 정확할수록
   구현 시 상태 관리 코드가 정확하게 생성됩니다.
```

## 에러 처리

- Discovery 스펙이 없으면: `/spec-discovery`를 먼저 실행하라고 안내
- requirements.yaml이 불완전하면: 누락된 부분 지적 후 수정 요청
- 이미 파일이 존재하면: 덮어쓸지 확인

## 도구 사용 (향후 MCP 연동 시)

스펙 파일 생성 후:
- `validate_spec` 도구가 있으면 각 파일 검증
- `check_references` 도구가 있으면 US↔F 매핑 검증
- `build_traceability` 도구가 있으면 매트릭스 업데이트

도구가 없으면:
- ID 참조 수동 확인 (US-001 → F-001 등)
- 필수 필드 존재 확인
- 사용자에게 검토 요청