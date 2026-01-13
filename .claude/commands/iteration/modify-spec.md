# /modify-spec [spec-path] [item-path]

기존 스펙을 수정하고 영향 분석을 수행합니다.

## 개요

기존 스펙 항목을 변경할 때 사용합니다.
- 변경 전 영향 분석 필수
- 연쇄적으로 영향받는 항목 자동 식별
- 사용자 확인 후 일괄 수정

## 사용법
```
/modify-spec [파일명] [항목 경로]

예시:
/modify-spec requirements.yaml user_stories[0].priority
/modify-spec functional-spec.yaml features[0].error_cases
/modify-spec technical-spec.yaml api_spec.endpoints[0].response
```

## 실행 조건

- traceability.yaml이 존재해야 함 (영향 분석용)
- 변경할 스펙 파일이 존재해야 함

## 프로세스

### 1. 현재 값 표시
```
📝 스펙 수정: [파일명]#[항목경로]

현재 값:
┌─────────────────────────────────
│ priority: "must"
└─────────────────────────────────

어떻게 변경할까요?
```

### 2. 새 값 입력

사용자가 새 값을 입력하면 확인:
```
변경 내용:
- 이전: priority: "must"
- 이후: priority: "should"

영향 분석을 수행합니다...
```

### 3. 영향 분석

traceability.yaml을 기반으로 연쇄 영향 파악:
```
🔍 영향 분석 결과

변경 항목: requirements.yaml#user_stories[0].priority
변경 내용: "must" → "should"

📋 직접 영향 (2개)
├─ functional-spec.yaml
│  └─ F-001, F-002 (이 요구사항을 구현하는 기능)
└─ task-queue.yaml
   └─ TASK-001, TASK-002 (이 기능의 구현 태스크)

🔗 연쇄 영향 (3개)
├─ technical-spec.yaml
│  └─ api_spec.endpoints[0] (F-001이 사용하는 API)
├─ ui-spec.yaml
│  └─ SCR-001.upload-zone (F-001의 UI)
└─ 구현 코드
   └─ src/components/PdfUploader.tsx

⚠️ 위험도: 중간
   - 우선순위 변경으로 개발 순서 조정 필요
   - 기존 구현에는 영향 없음
```

### 4. 영향 유형별 처리

#### 단순 변경 (우선순위, 설명 등)
```
이 변경은 단순 메타데이터 수정입니다.
직접 수정만 진행하면 됩니다.

진행할까요? (y/n)
```

#### 구조적 변경 (states, error_cases 등)
```
⚠️ 이 변경은 구현에 영향을 줍니다.

영향받는 코드:
- src/components/PdfUploader.tsx
- tests/components/PdfUploader.test.tsx

선택지:
1. 스펙만 수정 (코드는 수동 수정)
2. 스펙 수정 + 코드 수정 태스크 생성
3. 취소

선택: 
```

#### Breaking Change (API 경로, 데이터 모델 등)
```
🚨 Breaking Change 감지!

이 변경은 기존 데이터/API와 호환되지 않습니다.
- API 경로 변경: /api/documents → /api/papers
- 영향: 기존 클라이언트 코드 모두 수정 필요

선택지:
1. 진행 (마이그레이션 가이드 작성)
2. 버전 분기 (/api/v2/papers로 신규 생성)
3. 취소

선택:
```

### 5. 수정 실행

확인 후 수정 진행:
```
수정 진행 중...

✅ requirements.yaml 수정됨
✅ task-queue.yaml 우선순위 재정렬됨
✅ traceability.yaml 업데이트됨
✅ changelog.yaml 기록됨

수정된 태스크 우선순위:
- TASK-001: 1 → 3
- TASK-002: 2 → 4
- TASK-003: 3 → 1 (must 기능이므로 앞으로)
```

### 6. Changelog 기록
```yaml
# changelog.yaml에 자동 추가
changelog:
  - version: "[패치 버전 증가]"
    date: "[오늘]"
    changes:
      - type: "modification"
        id: "US-001"
        description: "우선순위 must → should로 변경"
        affected_specs:
          - "requirements.yaml"
          - "task-queue.yaml"
        reason: "[사용자가 입력한 이유]"
        breaking: false
```

## 완료 메시지
```
✅ 스펙 수정 완료!

변경 사항:
- requirements.yaml#user_stories[0].priority: "must" → "should"

연쇄 업데이트:
- task-queue.yaml: 우선순위 재정렬

다음 단계:
- 변경된 스펙 파일 검토
- 필요시 `/implement`로 재구현

💡 버전: 0.2.0 → 0.2.1
```

## 에러 처리

- traceability.yaml이 없으면: 영향 분석 불가 경고, 수동 확인 요청
- 참조 무결성 깨짐: 수정 전 해결 필요
- 존재하지 않는 경로: 올바른 경로 안내