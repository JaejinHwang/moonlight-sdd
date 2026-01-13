# /implement [TASK-ID]

스펙을 기반으로 특정 태스크를 구현합니다.

## 개요

이 명령어는 task-queue.yaml의 태스크를 하나씩 구현합니다.
- TASK-ID 지정 시: 해당 태스크 구현
- TASK-ID 미지정 시: 다음 실행 가능한 태스크 자동 선택

## 실행 조건

- `specs/02-specification/functional-spec.yaml` 존재
- `specs/03-implementation/task-queue.yaml` 존재
- 태스크의 dependencies가 모두 completed 상태

## 프로세스

### 1. 태스크 로드
```
📋 태스크 정보

ID: TASK-001
Name: [태스크 이름]
Feature: F-001 ([기능 이름])
Type: [frontend|backend|fullstack]
Dependencies: [완료된 의존성 목록]

관련 스펙:
- functional-spec.yaml#F-001
- technical-spec.yaml#api_spec.endpoints[0]
- ui-spec.yaml#SCR-001

Acceptance Criteria:
1. Given [조건], When [행동], Then [결과]
2. ...

이 태스크를 구현합니다. 진행할까요?
```

### 2. 스펙 읽기

태스크의 spec_refs에 명시된 모든 스펙을 읽고 핵심 정보 추출:

**functional-spec에서:**
- states (구현할 상태 머신)
- inputs/outputs (타입 정의)
- error_cases (에러 처리)
- edge_cases (예외 처리)

**technical-spec에서:**
- api_spec (API 구현 시)
- data_model (DB 스키마)

**ui-spec에서:**
- components (컴포넌트 구조)
- states (UI 상태)
- interactions (이벤트 핸들링)

### 3. 테스트 먼저 작성 (TDD)

acceptance_criteria를 테스트 코드로 변환:
```typescript
// Given-When-Then → 테스트 구조
describe('[Feature 이름]', () => {
  describe('Acceptance Criteria', () => {
    it('AC-1: [criteria 설명]', async () => {
      // Given: [조건 설정]
      
      // When: [행동 실행]
      
      // Then: [결과 검증]
    });
  });

  describe('Error Cases', () => {
    it('ERR-[CODE]: [에러 설명]', async () => {
      // Given: [에러 유발 조건]
      
      // When: [행동]
      
      // Then: [에러 처리 검증]
    });
  });

  describe('Edge Cases', () => {
    it('EDGE-1: [엣지케이스 설명]', async () => {
      // Given: [경계 조건]
      
      // When: [행동]
      
      // Then: [예상 동작]
    });
  });
});
```

### 4. 구현

**상태 머신 구현 (states 기반):**
```typescript
// functional-spec의 states를 그대로 구현
type State = 'idle' | 'processing' | 'completed' | 'error';

const transitions = {
  idle: { start: 'processing' },
  processing: { success: 'completed', error: 'error' },
  completed: { reset: 'idle' },
  error: { retry: 'idle' }
};
```

**에러 처리 구현 (error_cases 기반):**
```typescript
// functional-spec의 error_cases를 그대로 구현
const ErrorCodes = {
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    message: '파일이 너무 큽니다. 50MB 이하 파일을 업로드해주세요.',
    recovery: '파일 선택 화면으로 복귀'
  },
  // ... 모든 error_cases
};
```

**API 구현 (api_spec 기반):**
```typescript
// technical-spec의 api_spec을 그대로 구현
// - 경로, 메서드 일치
// - request body 스키마 일치
// - response 형식 일치
// - error 응답 형식 일치
```

### 5. 구현 원칙

**절대 규칙:**
1. 스펙에 없는 기능을 임의로 추가하지 않는다
2. 스펙의 states를 정확히 구현한다
3. 스펙의 모든 error_cases를 처리한다
4. 스펙의 모든 edge_cases를 처리한다
5. API 응답 형식을 스펙과 정확히 일치시킨다

**Deviation 발생 시:**
스펙과 다르게 구현해야 할 경우:
1. 즉시 사용자에게 알린다
2. 이유를 설명한다
3. 승인을 받는다
4. 승인 없이 진행하지 않는다
```
⚠️ Deviation 발견

스펙: "응답 시간 500ms 이내"
현실: "외부 API 지연으로 평균 800ms 예상"

선택지:
1. 캐싱 레이어 추가하여 스펙 준수 (추가 작업 필요)
2. 스펙 수정 요청 (threshold를 1000ms로)
3. 현재 상태로 진행 (deviation 기록)

어떻게 할까요?
```

### 6. 결과 기록

구현 완료 후 `specs/03-implementation/results/TASK-XXX.yaml` 생성:
```yaml
implementation_result:
  task_id: "TASK-001"
  feature_id: "F-001"
  completed_at: "[현재 시간]"
  implemented_by: "claude-code"
  
  files_created:
    - path: "src/components/PdfUploader.tsx"
      lines: 145
      purpose: "PDF 업로드 UI 컴포넌트"
    - path: "src/lib/pdf-parser.ts"
      lines: 89
      purpose: "PDF 파싱 로직"
  
  files_modified: []
  
  test_results:
    total: 12
    passed: 12
    failed: 0
    
  spec_compliance:
    states:
      - name: "idle"
        implemented: true
      - name: "processing"
        implemented: true
      - name: "completed"
        implemented: true
      - name: "error"
        implemented: true
    error_cases:
      - code: "FILE_TOO_LARGE"
        implemented: true
      - code: "INVALID_FILE_TYPE"
        implemented: true
    edge_cases:
      - scenario: "빈 파일 업로드"
        implemented: true
  
  deviations: []
  
  next_tasks:
    unblocked: ["TASK-003"]
```

### 7. task-queue 업데이트

해당 태스크 상태를 completed로 변경:
```yaml
task_queue:
  - id: "TASK-001"
    status: "completed"  # pending → completed
    completed_at: "[현재 시간]"
```

## 완료 메시지
```
✅ TASK-001 구현 완료!

생성된 파일:
- src/components/PdfUploader.tsx (145 lines)
- src/lib/pdf-parser.ts (89 lines)
- tests/components/PdfUploader.test.tsx (210 lines)

테스트 결과: 12/12 통과

스펙 준수:
- States: 4/4 구현됨
- Error Cases: 3/3 처리됨
- Edge Cases: 2/2 처리됨

Deviations: 없음

다음 단계:
1. `/verify TASK-001`로 상세 검증
2. 또는 `/implement TASK-002`로 다음 태스크 진행

💡 팁: 구현된 코드를 직접 확인하고 테스트를 실행해보세요.
```

## 에러 처리

- 스펙 파일이 없으면: `/spec-specification` 먼저 실행 안내
- task-queue가 없으면: 생성 여부 확인
- 의존성 미충족 시: 먼저 완료해야 할 태스크 안내
- 이미 completed인 태스크: 재구현 여부 확인