# /verify [TASK-ID]

구현 결과가 스펙과 일치하는지 검증합니다.

## 개요

이 명령어는 구현된 코드가 스펙을 정확히 따르는지 검증합니다.
- 모든 acceptance criteria 충족 여부
- 모든 states 구현 여부
- 모든 error_cases 처리 여부
- 모든 edge_cases 처리 여부
- API 응답 형식 일치 여부

## 실행 조건

- 해당 태스크가 구현 완료 상태
- `specs/03-implementation/results/TASK-XXX.yaml` 존재

## 프로세스

### 1. 검증 대상 로드
```
🔍 검증 시작: TASK-001

구현 결과 파일: specs/03-implementation/results/TASK-001.yaml
관련 스펙: functional-spec.yaml#F-001
생성된 코드:
- src/components/PdfUploader.tsx
- src/lib/pdf-parser.ts
- tests/components/PdfUploader.test.tsx

검증을 시작합니다...
```

### 2. 검증 항목

#### 2.1 Acceptance Criteria 검증

각 acceptance criteria에 대해:
- 해당하는 테스트가 존재하는가?
- 테스트가 통과하는가?
- 테스트가 criteria를 정확히 반영하는가?
```
✅ AC-1: "Given PDF 파일을 드래그할 때, When 드롭존에 놓으면, Then 5초 이내 파싱 완료"
   → 테스트: PdfUploader.test.tsx:15
   → 상태: 통과

❌ AC-2: "Given 암호화된 PDF일 때, When 업로드하면, Then 비밀번호 입력 모달 표시"
   → 테스트: 없음
   → 조치 필요: 테스트 추가 필요
```

#### 2.2 States 검증

functional-spec의 모든 states가 구현되었는지:
```
States 검증:
✅ idle: 구현됨 (PdfUploader.tsx:23)
✅ processing: 구현됨 (PdfUploader.tsx:45)
✅ completed: 구현됨 (PdfUploader.tsx:67)
✅ error: 구현됨 (PdfUploader.tsx:89)

Transitions 검증:
✅ idle → processing (trigger: file_drop)
✅ processing → completed (trigger: parse_success)
✅ processing → error (trigger: parse_error)
⚠️ error → idle (trigger: retry) - 구현되었으나 테스트 없음
```

#### 2.3 Error Cases 검증

모든 error_cases가 처리되는지:
```
Error Cases 검증:
✅ FILE_TOO_LARGE: 구현됨, 테스트됨
✅ INVALID_FILE_TYPE: 구현됨, 테스트됨
❌ PDF_CORRUPTED: 구현됨, 테스트 없음
```

#### 2.4 Edge Cases 검증

모든 edge_cases가 처리되는지:
```
Edge Cases 검증:
✅ 빈 파일 업로드: 처리됨
⚠️ 200페이지 초과 PDF: 처리되나 성능 테스트 없음
```

#### 2.5 API 스펙 일치 검증 (해당 시)
```
API 검증: POST /api/documents
✅ 경로 일치
✅ 메서드 일치
✅ Request body 스키마 일치
✅ Success response 형식 일치
⚠️ Error response: FILE_TOO_LARGE의 status가 400이어야 하나 413 반환
```

### 3. 검증 결과 리포트
```
📊 검증 결과: TASK-001

전체 준수율: 87%

✅ 통과 (15개)
- Acceptance Criteria: 4/5
- States: 4/4
- Error Cases: 2/3
- Edge Cases: 1/2
- API Spec: 4/5

❌ 미통과 (3개)
1. [AC-2] 암호화 PDF 테스트 누락
2. [ERR] PDF_CORRUPTED 테스트 누락
3. [API] Error status 코드 불일치 (413 → 400)

⚠️ 경고 (2개)
1. error → idle 전이 테스트 없음
2. 200페이지 초과 성능 테스트 없음

권장 조치:
1. 누락된 테스트 3개 추가
2. API status 코드 수정
3. 경고 항목 테스트 추가 (선택)
```

### 4. 수정 제안

미통과 항목에 대해 수정 코드 제안:
```
수정이 필요합니다. 자동으로 수정할까요?

1. [AC-2] 테스트 추가
2. [ERR] PDF_CORRUPTED 테스트 추가  
3. [API] status 코드 수정

(y: 전체 수정 / n: 수동 수정 / 1,2: 선택 수정)
```

### 5. 결과 업데이트

검증 완료 후 result 파일에 검증 결과 추가:
```yaml
# TASK-001.yaml에 추가
verification:
  verified_at: "[현재 시간]"
  compliance_rate: 87
  passed: 15
  failed: 3
  warnings: 2
  
  issues:
    - type: "missing_test"
      item: "AC-2"
      status: "fixed"  # fixed | pending | wont_fix
    - type: "missing_test"
      item: "ERR-PDF_CORRUPTED"
      status: "fixed"
    - type: "spec_mismatch"
      item: "API-status"
      expected: 400
      actual: 413
      status: "fixed"
```

## 완료 메시지
```
✅ TASK-001 검증 완료!

최종 준수율: 100% (수정 후)

모든 항목 통과:
- Acceptance Criteria: 5/5
- States: 4/4 (전이 포함)
- Error Cases: 3/3
- Edge Cases: 2/2
- API Spec: 5/5

이 태스크는 스펙을 완전히 준수합니다.

다음 단계:
- `/implement TASK-002`로 다음 태스크 진행
- 또는 `/status`로 전체 진행 상황 확인
```

## 검증 실패 시

준수율이 80% 미만이면:
```
❌ 검증 실패: 준수율 65%

이 태스크는 스펙을 충분히 준수하지 않습니다.
다음 태스크로 진행하기 전에 수정이 필요합니다.

선택지:
1. 자동 수정 시도
2. 수동으로 수정 후 다시 /verify
3. 스펙 수정 요청 (/modify-spec)
```