# /spec-discovery

아이디어를 받아 Discovery 단계(Stage 1-3) 스펙을 대화형으로 생성합니다.

## 개요

이 명령어는 다음 3개 파일을 순차적으로 생성합니다:
1. `specs/01-discovery/idea-crystal.yaml` (Stage 1)
2. `specs/01-discovery/problem-definition.yaml` (Stage 2)
3. `specs/01-discovery/requirements.yaml` (Stage 3)

## 실행 조건

- 프로젝트 루트에서 실행
- `specs/01-discovery/` 디렉토리가 존재해야 함

## 프로세스

### Stage 1: 아이디어 구체화 (idea-crystal.yaml)

사용자에게 순차적으로 질문합니다:

**질문 1**: "이 프로젝트의 아이디어를 한 줄로 설명해주세요."
- 예시 답변: "논문을 AI가 쉽게 설명해주는 웹페이지"

**질문 2**: "이 서비스의 주요 타겟 사용자는 누구인가요? 구체적인 특성으로 설명해주세요."
- 예시 답변: "비전공 분야 논문을 읽어야 하는 대학원생"

**질문 3**: "현재 이 문제를 어떻게 해결하고 있나요? 기존 방법의 한계는 무엇인가요?"
- 예시 답변: "ChatGPT에 붙여넣기 하는데, 맥락이 끊기고 논문 구조를 이해 못함"

수집한 정보로 `idea-crystal.yaml` 생성:
```yaml
idea_crystal:
  core_value: "[답변 1에서 추출한 핵심 가치, 동사형, 30자 이내]"
  target_user: "[답변 2 정리]"
  existing_alternatives:
    - name: "[답변 3에서 추출한 기존 방법]"
      limitation: "[답변 3에서 추출한 한계]"
  differentiation_hypothesis: "[기존 한계를 해결하는 가설 형태로 작성]"

metadata:
  created_at: "[현재 시간]"
  author: "user"
  status: "draft"
```

생성 후 사용자에게 확인:
"Stage 1 완료: idea-crystal.yaml을 생성했습니다. 내용을 확인해주세요. 수정이 필요하면 말씀해주세요. 다음 단계로 진행할까요?"

---

### Stage 2: 문제 정의 (problem-definition.yaml)

**질문 4**: "타겟 사용자가 현재 이 작업을 어떤 단계로 수행하나요? 각 단계와 소요 시간을 알려주세요."
- 예시: "1. PDF 다운로드(1분) → 2. Abstract 읽기(10분) → 3. 모르는 용어 검색(20분) → ..."

**질문 5**: "각 단계에서 가장 힘든 점(페인포인트)은 무엇인가요?"
- 예시: "용어 검색할 때 컨텍스트 스위칭이 힘들고, 수식은 아예 이해 불가"

**질문 6**: "이 서비스로 문제가 해결되면, 어떤 지표로 성공을 측정할 수 있을까요?"
- 예시: "논문 이해 시간 50% 단축, 외부 검색 횟수 80% 감소"

수집한 정보로 `problem-definition.yaml` 생성:
```yaml
problem_definition:
  as_is_workflow:
    - step: "[단계 이름]"
      pain_point: "[해당 단계의 페인포인트]"
      time_spent: "[소요 시간]"
    # ... 추가 단계들
    
  to_be_workflow:
    - step: "[개선된 단계]"
      improvement: "[어떻게 개선되는지]"
    # ... 추가 단계들
    
  success_metrics:
    - metric: "[지표 이름]"
      current: "[현재 값]"
      target: "[목표 값]"
      measurement_method: "[측정 방법]"

metadata:
  created_at: "[현재 시간]"
  author: "user"
  status: "draft"
  depends_on:
    - "idea-crystal.yaml"
```

생성 후 확인 요청.

---

### Stage 3: 요구사항 도출 (requirements.yaml)

**질문 7**: "반드시 있어야 하는 핵심 기능(Must-have)은 무엇인가요? 최대 5개까지 말씀해주세요."
- 예시: "PDF 업로드, 용어 클릭 시 설명, 섹션별 요약"

**질문 8**: "기술적 제약사항이 있나요? (기술 스택, 예산, 일정 등)"
- 예시: "Next.js 사용, MVP 4주, 월 API 비용 $500 이내"

**질문 9**: "법적/보안 요구사항이 있나요?"
- 예시: "논문 저작권 주의, 사용자 데이터 암호화"

수집한 정보로 `requirements.yaml` 생성:
```yaml
requirements:
  user_stories:
    - id: "US-001"
      as_a: "[target_user에서 가져옴]"
      i_want: "[기능 1]"
      so_that: "[기대 효과]"
      priority: "must"
      acceptance_criteria:
        - "Given [조건], When [행동], Then [결과]"
    # ... 추가 스토리들 (must-have 기능당 1개)

  non_functional:
    performance:
      - requirement: "[성능 요구사항]"
        threshold: "[구체적 수치]"
    security:
      - requirement: "[보안 요구사항]"
    accessibility:
      - requirement: "WCAG 2.1 AA 준수"

  constraints:
    technical:
      - "[기술 제약]"
    business:
      - "[비즈니스 제약]"
    legal:
      - "[법적 제약]"

metadata:
  created_at: "[현재 시간]"
  author: "user"
  status: "draft"
  depends_on:
    - "idea-crystal.yaml"
    - "problem-definition.yaml"
```

---

## 생성 규칙

1. **Given-When-Then 필수**: 모든 Must-have 스토리의 acceptance_criteria는 반드시 Given-When-Then 형식으로 작성

2. **측정 가능한 지표**: success_metrics의 target은 반드시 숫자로 측정 가능해야 함

3. **ID 자동 부여**: US-001부터 순차적으로 부여

4. **현재 시간 기록**: metadata.created_at에 ISO 형식으로 기록

## 완료 메시지

모든 단계 완료 후:
```
✅ Discovery 단계 완료!

생성된 파일:
- specs/01-discovery/idea-crystal.yaml
- specs/01-discovery/problem-definition.yaml  
- specs/01-discovery/requirements.yaml

다음 단계:
1. 생성된 파일들을 검토하고 필요시 수정하세요
2. `/spec-specification` 명령으로 상세 명세를 생성하세요

💡 팁: requirements.yaml의 acceptance_criteria가 구체적일수록 
   구현 단계에서 더 정확한 코드가 생성됩니다.
```

## 에러 처리

- `specs/01-discovery/` 디렉토리가 없으면: 생성 여부를 묻고 자동 생성
- 이미 파일이 존재하면: 덮어쓸지 확인
- 사용자가 질문에 불충분하게 답변하면: 추가 질문으로 명확히 함

## 도구 사용 (향후 MCP 연동 시)

스펙 파일 생성 후:
- `validate_spec` 도구가 있으면 사용하여 검증
- `build_traceability` 도구가 있으면 사용하여 매트릭스 업데이트
- `record_change` 도구가 있으면 사용하여 changelog 기록

도구가 없으면 직접 수행:
- YAML 형식 검증
- 필수 필드 확인
- 사용자에게 검토 요청