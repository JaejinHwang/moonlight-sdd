# ADR-001: 데이터베이스 선택

## Status
Accepted

## Context
논문 읽기 보조 서비스를 위한 데이터베이스를 선택해야 한다. 다음 요구사항을 충족해야 한다:
- 사용자 인증 및 세션 관리
- PDF 파일 저장
- 논문 메타데이터 및 분석 결과 저장
- MVP 단계에서 비용 최소화
- Next.js와의 통합 용이성

## Decision
**Supabase**를 데이터베이스 및 백엔드 서비스로 선택한다.

## Alternatives Considered

### 1. Supabase (선택됨)
- **장점**:
  - PostgreSQL 기반으로 안정적
  - 내장 인증 시스템 (Auth)
  - 파일 스토리지 기본 제공
  - 실시간 구독 기능
  - 관대한 무료 티어 (500MB DB, 1GB Storage)
  - Next.js 공식 지원
- **단점**:
  - 벤더 종속성
  - 복잡한 쿼리는 제한적

### 2. PlanetScale + Clerk + S3
- **장점**:
  - MySQL 기반, 브랜칭 기능
  - 각 서비스가 특화됨
- **단점**:
  - 3개 서비스 통합 필요
  - 총 비용 증가
  - 설정 복잡도 높음

### 3. MongoDB Atlas + Auth0
- **장점**:
  - 유연한 스키마
  - 강력한 인증 서비스
- **단점**:
  - 관계형 데이터에 부적합
  - Auth0 무료 티어 제한적

## Consequences

### Positive
- 단일 서비스로 DB, Auth, Storage 해결
- 빠른 MVP 개발 가능
- 비용 효율적 (무료 티어로 시작)
- Row Level Security로 보안 강화

### Negative
- Supabase 장애 시 전체 서비스 영향
- PostgreSQL 지식 필요
- 대규모 확장 시 마이그레이션 고려 필요

## References
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase + Next.js Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
