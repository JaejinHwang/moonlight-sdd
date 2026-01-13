# moonlight-sdd

## 프로젝트 개요
이 프로젝트는 Spec-Driven Development(SDD) 방식으로 개발됩니다.

## 기술 스택
- 프리셋: nextjs-supabase

## SDD 명령어
- `/spec-discovery` - 새 기능 발견 및 정의
- `/spec-specification` - 상세 스펙 작성
- `/implement` - 구현 시작
- `/validate` - 스펙 검증
- `/status` - 진행 상황 확인

## 폴더 구조
```
specs/
├── 01-discovery/      # 아이디어, 문제정의, 요구사항
├── 02-specification/  # 기능명세, 기술명세, UI명세
│   └── adrs/          # 아키텍처 결정 기록
└── 03-implementation/ # 작업 큐, 결과 기록
```

## 작업 규칙
1. 모든 기능은 스펙 문서로 시작한다
2. 스펙 없이 코드를 작성하지 않는다
3. 변경 시 영향 분석을 먼저 수행한다
