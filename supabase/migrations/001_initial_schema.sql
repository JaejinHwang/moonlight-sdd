-- =============================================
-- TASK-001: 데이터베이스 스키마 구성
-- Moonlight SDD - 논문 분석 서비스
-- =============================================

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. USERS 테이블
-- Supabase Auth의 auth.users와 연동
-- =============================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users 테이블 코멘트
COMMENT ON TABLE public.users IS '서비스 사용자 정보';
COMMENT ON COLUMN public.users.id IS 'auth.users의 ID와 동일';
COMMENT ON COLUMN public.users.email IS '사용자 이메일';

-- =============================================
-- 2. PAPERS 테이블
-- 업로드된 논문 정보
-- =============================================
CREATE TABLE IF NOT EXISTS public.papers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    source_url TEXT,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 0,
    language VARCHAR(10) DEFAULT 'en',
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Papers 테이블 코멘트
COMMENT ON TABLE public.papers IS '업로드된 논문';
COMMENT ON COLUMN public.papers.user_id IS '논문 소유자';
COMMENT ON COLUMN public.papers.title IS '논문 제목';
COMMENT ON COLUMN public.papers.source_url IS '원본 URL (URL 업로드 시)';
COMMENT ON COLUMN public.papers.file_path IS 'Supabase Storage 경로';
COMMENT ON COLUMN public.papers.file_size IS '파일 크기 (bytes)';
COMMENT ON COLUMN public.papers.page_count IS '페이지 수';
COMMENT ON COLUMN public.papers.language IS '논문 언어 (ISO 639-1)';
COMMENT ON COLUMN public.papers.status IS '처리 상태: processing, ready, error';

-- =============================================
-- 3. SECTIONS 테이블
-- 논문의 섹션 (챕터)
-- =============================================
CREATE TABLE IF NOT EXISTS public.sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 6),
    order_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    page_start INTEGER NOT NULL,
    page_end INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sections 테이블 코멘트
COMMENT ON TABLE public.sections IS '논문의 섹션 (챕터)';
COMMENT ON COLUMN public.sections.paper_id IS '소속 논문';
COMMENT ON COLUMN public.sections.title IS '섹션 제목';
COMMENT ON COLUMN public.sections.level IS '섹션 깊이 (1=H1, 2=H2, ...)';
COMMENT ON COLUMN public.sections.order_index IS '섹션 순서';
COMMENT ON COLUMN public.sections.content IS '섹션 본문 텍스트';
COMMENT ON COLUMN public.sections.page_start IS '시작 페이지';
COMMENT ON COLUMN public.sections.page_end IS '종료 페이지';

-- =============================================
-- 4. TRANSLATIONS 테이블
-- 번역된 텍스트
-- =============================================
CREATE TABLE IF NOT EXISTS public.translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
    section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    source_lang VARCHAR(10) NOT NULL,
    target_lang VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Translations 테이블 코멘트
COMMENT ON TABLE public.translations IS '번역된 텍스트';
COMMENT ON COLUMN public.translations.paper_id IS '소속 논문';
COMMENT ON COLUMN public.translations.section_id IS '소속 섹션 (전체 번역 시 NULL)';
COMMENT ON COLUMN public.translations.original_text IS '원문';
COMMENT ON COLUMN public.translations.translated_text IS '번역문';
COMMENT ON COLUMN public.translations.source_lang IS '원본 언어 (ISO 639-1)';
COMMENT ON COLUMN public.translations.target_lang IS '번역 언어 (ISO 639-1)';

-- =============================================
-- 5. ANALYSIS 테이블
-- AI 분석 결과 (요약, 하이라이트, 키워드)
-- =============================================
CREATE TABLE IF NOT EXISTS public.analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id UUID UNIQUE NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
    overall_summary TEXT,
    section_summaries JSONB DEFAULT '[]'::jsonb,
    highlights JSONB DEFAULT '[]'::jsonb,
    keywords JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analysis 테이블 코멘트
COMMENT ON TABLE public.analysis IS 'AI 분석 결과';
COMMENT ON COLUMN public.analysis.paper_id IS '분석 대상 논문';
COMMENT ON COLUMN public.analysis.overall_summary IS '전체 요약';
COMMENT ON COLUMN public.analysis.section_summaries IS '섹션별 요약 [{sectionId, title, summary}]';
COMMENT ON COLUMN public.analysis.highlights IS '핵심 하이라이트 [{id, text, sectionId, importance, reason}]';
COMMENT ON COLUMN public.analysis.keywords IS '키워드 [{term, frequency, importance, definition, contextInPaper, relatedTerms}]';
COMMENT ON COLUMN public.analysis.status IS '분석 상태: pending, processing, completed, error';

-- =============================================
-- 6. 인덱스 생성
-- =============================================

-- Papers 인덱스
CREATE INDEX IF NOT EXISTS idx_papers_user_id ON public.papers(user_id);
CREATE INDEX IF NOT EXISTS idx_papers_status ON public.papers(status);
CREATE INDEX IF NOT EXISTS idx_papers_created_at ON public.papers(created_at DESC);

-- Sections 인덱스
CREATE INDEX IF NOT EXISTS idx_sections_paper_id ON public.sections(paper_id);
CREATE INDEX IF NOT EXISTS idx_sections_order ON public.sections(paper_id, order_index);

-- Translations 인덱스
CREATE INDEX IF NOT EXISTS idx_translations_paper_id ON public.translations(paper_id);
CREATE INDEX IF NOT EXISTS idx_translations_section_id ON public.translations(section_id);
CREATE INDEX IF NOT EXISTS idx_translations_lang ON public.translations(paper_id, target_lang);

-- Analysis 인덱스
CREATE INDEX IF NOT EXISTS idx_analysis_paper_id ON public.analysis(paper_id);
CREATE INDEX IF NOT EXISTS idx_analysis_status ON public.analysis(status);

-- =============================================
-- 7. updated_at 자동 갱신 트리거
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users updated_at 트리거
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Papers updated_at 트리거
CREATE TRIGGER update_papers_updated_at
    BEFORE UPDATE ON public.papers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Analysis updated_at 트리거
CREATE TRIGGER update_analysis_updated_at
    BEFORE UPDATE ON public.analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 8. RLS (Row Level Security) 정책
-- =============================================

-- 모든 테이블에 RLS 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis ENABLE ROW LEVEL SECURITY;

-- USERS 테이블 정책
-- 사용자는 자신의 정보만 조회/수정 가능
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

-- PAPERS 테이블 정책
-- 사용자는 자신의 논문만 CRUD 가능
CREATE POLICY "Users can view own papers"
    ON public.papers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own papers"
    ON public.papers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own papers"
    ON public.papers FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own papers"
    ON public.papers FOR DELETE
    USING (auth.uid() = user_id);

-- SECTIONS 테이블 정책
-- 논문 소유자만 섹션 접근 가능
CREATE POLICY "Users can view own paper sections"
    ON public.sections FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.papers
            WHERE papers.id = sections.paper_id
            AND papers.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own paper sections"
    ON public.sections FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.papers
            WHERE papers.id = sections.paper_id
            AND papers.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own paper sections"
    ON public.sections FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.papers
            WHERE papers.id = sections.paper_id
            AND papers.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own paper sections"
    ON public.sections FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.papers
            WHERE papers.id = sections.paper_id
            AND papers.user_id = auth.uid()
        )
    );

-- TRANSLATIONS 테이블 정책
-- 논문 소유자만 번역 접근 가능
CREATE POLICY "Users can view own paper translations"
    ON public.translations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.papers
            WHERE papers.id = translations.paper_id
            AND papers.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own paper translations"
    ON public.translations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.papers
            WHERE papers.id = translations.paper_id
            AND papers.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own paper translations"
    ON public.translations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.papers
            WHERE papers.id = translations.paper_id
            AND papers.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own paper translations"
    ON public.translations FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.papers
            WHERE papers.id = translations.paper_id
            AND papers.user_id = auth.uid()
        )
    );

-- ANALYSIS 테이블 정책
-- 논문 소유자만 분석 결과 접근 가능
CREATE POLICY "Users can view own paper analysis"
    ON public.analysis FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.papers
            WHERE papers.id = analysis.paper_id
            AND papers.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own paper analysis"
    ON public.analysis FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.papers
            WHERE papers.id = analysis.paper_id
            AND papers.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own paper analysis"
    ON public.analysis FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.papers
            WHERE papers.id = analysis.paper_id
            AND papers.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own paper analysis"
    ON public.analysis FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.papers
            WHERE papers.id = analysis.paper_id
            AND papers.user_id = auth.uid()
        )
    );

-- =============================================
-- 9. 신규 사용자 자동 등록 트리거
-- auth.users에 새 사용자 생성 시 public.users에도 자동 생성
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users 테이블에 트리거 생성
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 10. Storage 버킷 설정 (PDF 파일용)
-- Supabase Dashboard에서 수동 설정 필요
-- =============================================
-- 버킷명: papers
-- 공개 여부: private
-- 허용 MIME 타입: application/pdf
-- 최대 파일 크기: 10MB
