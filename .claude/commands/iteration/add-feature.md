# /add-feature [feature-name]

새로운 기능을 스펙에 추가하고 구현 태스크를 생성합니다.

## 개요

기존 스펙에 새 기능을 추가합니다. 다음 파일들이 순차적으로 업데이트됩니다:
1. `requirements.yaml` - 새 User Story 추가
2. `functional-spec.yaml` - 새 Feature 추가
3. `technical-spec.yaml` - 필요시 API/모델 추가
4. `ui-spec.yaml` - 필요시 화면/컴포넌트 추가
5. `task-queue.yaml` - 구현 태스크 추가
6. `traceability.yaml` - 매핑 업데이트
7. `changelog.yaml` - 변경 기록

## 실행 조건

- 기존 스펙 파일들이 존재해야 함
- 최소 1회 이상 `/spec-specification` 완료 상태

## 프로세스

### 1. 기능 정보 수집
```
🆕 새 기능 추가: [feature-name]

현재 프로젝트: [idea-crystal.core_value]
기존 기능 수: [functional-spec.features.length]개

새 기능에 대해 알려주세요.
```

**질문 1**: "이 기능이 무엇을 하나요? 한 문장으로 설명해주세요."
- 예시: "논문의 특정 섹션을 북마크하여 나중에 빠르게 접근할 수 있다"

**질문 2**: "이 기능의 우선순위는 무엇인가요?"
- must: 필수 (없으면 서비스 불가)
- should: 중요 (있으면 훨씬 좋음)
- could: 있으면 좋음

**질문 3**: "기존 기능과 연관이 있나요? 있다면 어떤 기능인가요?"
- 예시: "F-001 (PDF 파싱)이 완료된 후에 북마크 가능"

### 2. User Story 생성
```yaml
# requirements.yaml에 추가
user_stories:
  - id: "US-[다음 번호]"
    as_a: "[기존 target_user]"
    i_want: "[질문 1 답변 기반]"
    so_that: "[사용자 가치]"
    priority: "[질문 2 답변]"
    acceptance_criteria:
      - "Given [조건], When [행동], Then [결과]"
```

**확인**: "다음 User Story를 추가합니다. 맞나요?"

### 3. Feature 분해

User Story를 Feature로 분해:
```yaml
# functional-spec.yaml에 추가
features:
  - id: "F-[다음 번호]"
    name: "[기능명]"
    description: "[설명]"
    parent_story: "US-[번호]"
    dependencies: ["[질문 3에서 파악한 의존성]"]
    
    states:
      - name: "idle"
        transitions:
          - trigger: "[트리거]"
            target: "[다음상태]"
      # ... 최소 3개 상태
    
    inputs:
      - name: "[입력]"
        type: "[타입]"
        validation: "[검증]"
    
    outputs:
      - name: "[출력]"
        type: "[타입]"
    
    error_cases:  # 최소 3개
      - condition: "[조건]"
        error_code: "[코드]"
        user_message: "[메시지]"
        recovery_action: "[복구]"
    
    edge_cases:  # 최소 2개
      - scenario: "[시나리오]"
        expected_behavior: "[동작]"
```

### 4. 기술 스펙 업데이트 (필요시)

**확인**: "이 기능에 새 API 엔드포인트가 필요한가요?"

필요하면:
```yaml
# technical-spec.yaml에 추가
api_spec:
  endpoints:
    - path: "/api/[새 경로]"
      method: "[메서드]"
      # ...
```

**확인**: "새 데이터 모델이 필요한가요?"

필요하면:
```yaml
# technical-spec.yaml에 추가
data_model:
  entities:
    - name: "[새 엔티티]"
      # ...
```

### 5. UI 스펙 업데이트 (필요시)

**확인**: "새 화면이 필요한가요, 기존 화면에 추가하나요?"
```yaml
# ui-spec.yaml 업데이트
screens:
  - id: "SCR-[기존 또는 신규]"
    components:
      - id: "[새 컴포넌트]"
        # ...
```

### 6. 태스크 생성
```yaml
# task-queue.yaml에 추가
task_queue:
  - id: "TASK-[다음 번호]"
    feature_id: "F-[번호]"
    name: "[태스크명]"
    type: "[frontend|backend|fullstack]"
    priority: [기존 태스크 다음]
    dependencies: ["[의존 태스크]"]
    status: "pending"
    spec_refs:
      functional: "functional-spec.yaml#F-[번호]"
      technical: "technical-spec.yaml#..."
      ui: "ui-spec.yaml#..."
    acceptance_criteria:
      - "[US에서 복사]"
```

### 7. Traceability 업데이트
```yaml
# traceability.yaml 업데이트
traceability:
  requirements_to_features:
    US-[번호]: ["F-[번호]"]
  
  features_to_technical:
    F-[번호]:
      api_endpoints: ["/api/[경로]"]
      data_models: ["[엔티티]"]
  
  features_to_ui:
    F-[번호]: ["SCR-[번호].[컴포넌트]"]
```

### 8. Changelog 기록
```yaml
# changelog.yaml에 추가
changelog:
  - version: "[다음 마이너 버전]"
    date: "[오늘]"
    changes:
      - type: "feature"
        id: "US-[번호]"
        description: "[기능 설명]"
        affected_specs:
          - "requirements.yaml"
          - "functional-spec.yaml"
          - "technical-spec.yaml"
          - "ui-spec.yaml"
        tasks: ["TASK-[번호]"]
```

## 완료 메시지
```
✅ 새 기능 추가 완료!

추가된 항목:
- User Story: US-006 "[i_want 요약]"
- Feature: F-008 "[기능명]"
- API: POST /api/bookmarks (신규)
- Component: BookmarkButton (SCR-002에 추가)
- Task: TASK-015, TASK-016

업데이트된 파일:
- specs/01-discovery/requirements.yaml
- specs/02-specification/functional-spec.yaml
- specs/02-specification/technical-spec.yaml
- specs/02-specification/ui-spec.yaml
- specs/03-implementation/task-queue.yaml
- specs/traceability.yaml
- specs/changelog.yaml

다음 단계:
- `/implement TASK-015`로 구현 시작
- 또는 스펙 파일들을 먼저 검토

💡 새 버전: 0.1.0 → 0.2.0
```