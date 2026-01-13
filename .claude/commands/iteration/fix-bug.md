# /fix-bug [description]

버그를 분석하고 스펙 준수 여부를 확인한 뒤 수정합니다.

## 개요

버그 리포트를 받아서:
1. 관련 스펙을 찾고
2. 스펙 vs 구현 불일치를 진단하고
3. 적절한 수정 방향을 제시합니다

## 사용법
```
/fix-bug [버그 설명]

예시:
/fix-bug "암호화된 PDF 업로드 시 비밀번호 모달이 안 뜸"
/fix-bug "50MB 파일 업로드 시 에러 메시지가 영어로 나옴"
```

## 프로세스

### 1. 버그 분석
```
🐛 버그 분석: "[버그 설명]"

키워드 추출: 암호화, PDF, 비밀번호, 모달
관련 스펙 검색 중...
```

### 2. 관련 스펙 찾기

버그 설명에서 키워드를 추출하여 관련 스펙 검색:
```
📋 관련 스펙 발견

Feature: F-001 (PDF 업로드 및 파싱)
관련 항목:
- error_cases[1]: PDF_ENCRYPTED
  → "비밀번호 입력 모달 표시"

- states: processing → error
  → condition: "암호화된 PDF"

스펙에 정의되어 있습니다. 구현을 확인합니다...
```

### 3. 스펙 vs 구현 비교
```
🔍 구현 확인

스펙 정의:
┌─────────────────────────────────
│ error_cases:
│   - condition: "암호화된 PDF"
│     error_code: "PDF_ENCRYPTED"
│     recovery_action: "비밀번호 입력 모달 표시"
└─────────────────────────────────

실제 구현: src/components/PdfUploader.tsx:89
┌─────────────────────────────────
│ if (error.code === 'PDF_ENCRYPTED') {
│   setError('이 PDF는 암호로 보호되어 있습니다.');
│   // 모달 호출 없음!
│ }
└─────────────────────────────────
```

### 4. 진단 결과

#### Case A: 구현이 스펙을 따르지 않음 (구현 버그)
```
🔴 진단: 구현 버그

스펙: "비밀번호 입력 모달 표시"
구현: 에러 메시지만 표시 (모달 없음)

원인: 스펙의 recovery_action이 구현되지 않음

수정 방안:
1. PdfUploader.tsx에 PasswordModal 호출 추가
2. 테스트 케이스 추가

자동으로 수정할까요? (y/n)
```

#### Case B: 스펙이 불완전함 (스펙 버그)
```
🟡 진단: 스펙 불완전

버그: "50MB 파일 에러 메시지가 영어로 나옴"

스펙 확인:
- error_cases에 FILE_TOO_LARGE 있음
- user_message: "File is too large" ← 영어!

원인: 스펙의 user_message가 한글이 아님

수정 방안:
1. 스펙의 user_message 한글로 수정
2. 구현도 함께 수정

스펙부터 수정할까요? (y/n)
```

#### Case C: 스펙에 없는 케이스 (스펙 누락)
```
🟠 진단: 스펙 누락

버그: "PDF 업로드 중 네트워크 끊기면 무한 로딩"

스펙 확인:
- error_cases에 NETWORK_ERROR 없음!
- states에 timeout 처리 없음!

원인: 네트워크 에러 케이스가 스펙에 정의되지 않음

수정 방안:
1. functional-spec.yaml에 에러 케이스 추가
2. states에 timeout 전이 추가
3. 구현 수정

스펙에 추가할까요? (y/n)
```

### 5. 수정 실행

#### 구현만 수정 (Case A)
```
구현 수정 중...

파일: src/components/PdfUploader.tsx

변경 전:
│ if (error.code === 'PDF_ENCRYPTED') {
│   setError('이 PDF는 암호로 보호되어 있습니다.');
│ }

변경 후:
│ if (error.code === 'PDF_ENCRYPTED') {
│   setError('이 PDF는 암호로 보호되어 있습니다.');
│   setShowPasswordModal(true);  // 추가
│ }

테스트 추가: tests/components/PdfUploader.test.tsx
│ it('암호화된 PDF 업로드 시 비밀번호 모달 표시', ...)

✅ 수정 완료
```

#### 스펙 + 구현 수정 (Case B, C)
```
스펙 수정 중...

1. functional-spec.yaml 수정됨
   - error_cases[0].user_message: "파일이 너무 큽니다..."

2. 구현 수정됨
   - src/lib/errors.ts 메시지 수정

3. 테스트 수정됨
   - 에러 메시지 assertion 업데이트

✅ 스펙 + 구현 수정 완료
```

### 6. 회귀 방지
```
🛡️ 회귀 방지 조치

1. acceptance_criteria에 테스트 케이스 추가됨:
   "Given 암호화된 PDF, When 업로드, Then 비밀번호 모달 표시"

2. 테스트 파일에 케이스 추가됨:
   tests/components/PdfUploader.test.tsx

3. 동일 버그 재발 시 테스트 실패로 감지됨
```

### 7. 기록
```yaml
# changelog.yaml에 추가
changelog:
  - version: "[패치 버전]"
    date: "[오늘]"
    changes:
      - type: "bugfix"
        description: "암호화된 PDF 업로드 시 비밀번호 모달 미표시 수정"
        affected_specs:
          - "functional-spec.yaml"  # Case B, C인 경우
        affected_code:
          - "src/components/PdfUploader.tsx"
        root_cause: "recovery_action 미구현"
        regression_test: "tests/components/PdfUploader.test.tsx:45"
```

## 완료 메시지
```
✅ 버그 수정 완료!

버그: "암호화된 PDF 업로드 시 비밀번호 모달이 안 뜸"
진단: 구현 버그 (스펙 미준수)
원인: recovery_action 미구현

수정 내용:
- src/components/PdfUploader.tsx: 모달 호출 추가
- tests/components/PdfUploader.test.tsx: 테스트 추가

회귀 방지:
- 테스트 케이스 추가됨
- acceptance_criteria 업데이트됨

💡 버전: 0.2.1 → 0.2.2
```

## 에러 처리

- 관련 스펙을 찾지 못함: 키워드 재입력 요청 또는 수동 지정
- 여러 스펙이 관련됨: 목록 표시 후 선택 요청
- 구현 파일을 찾지 못함: traceability.yaml 업데이트 필요 안내