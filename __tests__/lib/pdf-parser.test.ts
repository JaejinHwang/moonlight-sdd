/**
 * Test specification for PDF Parser Service
 *
 * Based on:
 * - functional-spec.yaml#F-001 (PDF 파일 업로드 - parsing state)
 * - TASK-005 acceptance criteria
 *
 * Acceptance Criteria:
 * AC-1: Given PDF가 업로드되었을 때, When 파싱이 완료되면, Then 섹션별 텍스트가 추출된다
 * AC-2: Given 암호화된 PDF일 때, When 파싱을 시도하면, Then PDF_ENCRYPTED 에러가 반환된다
 */

// Mock types for test documentation
interface TestCase {
  name: string;
  given: string;
  when: string;
  then: string;
  expectedSuccess: boolean;
  expectedErrorCode?: string;
}

export const testCases: TestCase[] = [
  // Acceptance Criteria Tests
  {
    name: "AC-1: PDF 파싱 성공 - 섹션 추출",
    given: "유효한 PDF 파일 (텍스트와 섹션 헤더 포함)",
    when: "parsePdf() 호출",
    then: "success: true, 섹션 배열 반환 (title, level, content, page info)",
    expectedSuccess: true,
  },
  {
    name: "AC-2: 암호화된 PDF 처리",
    given: "암호화된 PDF 파일",
    when: "parsePdf() 호출",
    then: "success: false, PDF_ENCRYPTED 에러 반환",
    expectedSuccess: false,
    expectedErrorCode: "PDF_ENCRYPTED",
  },

  // Error Case Tests (from functional-spec.yaml#F-001.error_cases)
  {
    name: "ERR-NO_TEXT_CONTENT: 텍스트 없는 PDF",
    given: "스캔된 이미지 PDF (텍스트 없음)",
    when: "parsePdf() 호출",
    then: "success: false, NO_TEXT_CONTENT 에러 반환",
    expectedSuccess: false,
    expectedErrorCode: "NO_TEXT_CONTENT",
  },
  {
    name: "ERR-PARSING_FAILED: 손상된 PDF",
    given: "손상된 PDF 파일",
    when: "parsePdf() 호출",
    then: "success: false, PARSING_FAILED 에러 반환",
    expectedSuccess: false,
    expectedErrorCode: "PARSING_FAILED",
  },

  // Edge Case Tests (from functional-spec.yaml#F-001.edge_cases)
  {
    name: "EDGE-1: 다중 컬럼 레이아웃 PDF",
    given: "2컬럼 레이아웃 PDF",
    when: "parsePdf() 호출",
    then: "텍스트가 순서대로 추출됨",
    expectedSuccess: true,
  },
  {
    name: "EDGE-2: 수식이 포함된 PDF",
    given: "LaTeX 수식 포함 PDF",
    when: "parsePdf() 호출",
    then: "수식 텍스트가 보존됨",
    expectedSuccess: true,
  },
  {
    name: "EDGE-3: 섹션 헤더 없는 PDF",
    given: "섹션 헤더가 없는 일반 텍스트 PDF",
    when: "parsePdf() 호출",
    then: "전체 문서가 단일 'Full Document' 섹션으로 반환",
    expectedSuccess: true,
  },
  {
    name: "EDGE-4: 번호 매김 섹션 (1.1, 1.2)",
    given: "1.1, 1.2 형식의 서브섹션 포함 PDF",
    when: "parsePdf() 호출",
    then: "섹션 level이 올바르게 파싱됨 (1.1 -> level 2)",
    expectedSuccess: true,
  },
  {
    name: "EDGE-5: 로마 숫자 섹션 (I, II, III)",
    given: "로마 숫자 섹션 헤더 포함 PDF",
    when: "parsePdf() 호출",
    then: "로마 숫자가 섹션으로 인식됨",
    expectedSuccess: true,
  },
];

// Section parsing specific tests
export const sectionParsingTests: TestCase[] = [
  {
    name: "SEC-1: Introduction 섹션 인식",
    given: "PDF 내 '1. Introduction' 텍스트",
    when: "섹션 파싱",
    then: "title: '1. Introduction', level: 1",
    expectedSuccess: true,
  },
  {
    name: "SEC-2: Abstract 섹션 인식 (번호 없음)",
    given: "PDF 내 'Abstract' 텍스트 (번호 없이)",
    when: "섹션 파싱",
    then: "title: 'Abstract', level: 1",
    expectedSuccess: true,
  },
  {
    name: "SEC-3: 중첩 섹션 레벨",
    given: "PDF 내 '2.3.1 Details' 텍스트",
    when: "섹션 파싱",
    then: "title: '2.3.1. Details', level: 3 (최대 3까지)",
    expectedSuccess: true,
  },
];

// Language detection tests
export const languageDetectionTests: TestCase[] = [
  {
    name: "LANG-1: 영어 감지",
    given: "영어 텍스트 PDF",
    when: "언어 감지",
    then: "language: 'en'",
    expectedSuccess: true,
  },
  {
    name: "LANG-2: 한국어 감지",
    given: "한국어 텍스트 PDF",
    when: "언어 감지",
    then: "language: 'ko'",
    expectedSuccess: true,
  },
  {
    name: "LANG-3: 일본어 감지",
    given: "일본어 텍스트 PDF (히라가나/가타카나 포함)",
    when: "언어 감지",
    then: "language: 'ja'",
    expectedSuccess: true,
  },
  {
    name: "LANG-4: 중국어 감지",
    given: "중국어 텍스트 PDF",
    when: "언어 감지",
    then: "language: 'zh'",
    expectedSuccess: true,
  },
];

/**
 * Example test implementation (requires Vitest/Jest setup):
 *
 * import { parsePdf, PdfErrorCodes } from '@/lib/pdf/parser';
 * import * as fs from 'fs';
 * import * as path from 'path';
 *
 * describe('PDF Parser Service', () => {
 *   describe('Acceptance Criteria', () => {
 *     it('AC-1: PDF 파싱 성공 - 섹션 추출', async () => {
 *       // Given: 유효한 PDF 파일
 *       const pdfBuffer = fs.readFileSync(path.join(__dirname, 'fixtures/sample-paper.pdf'));
 *
 *       // When: parsePdf() 호출
 *       const result = await parsePdf(pdfBuffer);
 *
 *       // Then: 섹션별 텍스트가 추출됨
 *       expect(result.success).toBe(true);
 *       if (result.success) {
 *         expect(result.sections.length).toBeGreaterThan(0);
 *         expect(result.sections[0]).toHaveProperty('title');
 *         expect(result.sections[0]).toHaveProperty('level');
 *         expect(result.sections[0]).toHaveProperty('content');
 *         expect(result.sections[0]).toHaveProperty('pageStart');
 *         expect(result.sections[0]).toHaveProperty('pageEnd');
 *       }
 *     });
 *
 *     it('AC-2: 암호화된 PDF 처리', async () => {
 *       // Given: 암호화된 PDF 파일
 *       const encryptedPdf = fs.readFileSync(path.join(__dirname, 'fixtures/encrypted.pdf'));
 *
 *       // When: parsePdf() 호출
 *       const result = await parsePdf(encryptedPdf);
 *
 *       // Then: PDF_ENCRYPTED 에러 반환
 *       expect(result.success).toBe(false);
 *       if (!result.success) {
 *         expect(result.error.code).toBe('PDF_ENCRYPTED');
 *       }
 *     });
 *   });
 *
 *   describe('Error Cases', () => {
 *     it('ERR-NO_TEXT_CONTENT: 텍스트 없는 PDF', async () => {
 *       // Given: 텍스트가 없는 이미지 PDF
 *       const imagePdf = fs.readFileSync(path.join(__dirname, 'fixtures/image-only.pdf'));
 *
 *       // When: parsePdf() 호출
 *       const result = await parsePdf(imagePdf);
 *
 *       // Then: NO_TEXT_CONTENT 에러 반환
 *       expect(result.success).toBe(false);
 *       if (!result.success) {
 *         expect(result.error.code).toBe('NO_TEXT_CONTENT');
 *       }
 *     });
 *   });
 *
 *   describe('Edge Cases', () => {
 *     it('EDGE-3: 섹션 헤더 없는 PDF', async () => {
 *       // Given: 섹션 헤더 없는 일반 텍스트 PDF
 *       const plainTextPdf = fs.readFileSync(path.join(__dirname, 'fixtures/plain-text.pdf'));
 *
 *       // When: parsePdf() 호출
 *       const result = await parsePdf(plainTextPdf);
 *
 *       // Then: 단일 'Full Document' 섹션으로 반환
 *       expect(result.success).toBe(true);
 *       if (result.success) {
 *         expect(result.sections.length).toBe(1);
 *         expect(result.sections[0].title).toBe('Full Document');
 *       }
 *     });
 *   });
 *
 *   describe('Section Parsing', () => {
 *     it('SEC-1: 번호 매김 섹션 인식', async () => {
 *       // Given: "1. Introduction" 형식의 섹션 헤더
 *       const text = "1. Introduction\nThis is the introduction.\n2. Methods\nThis is methods.";
 *       // 테스트에서는 parseSections 함수를 직접 테스트
 *
 *       // Then: 섹션이 올바르게 파싱됨
 *       // ...
 *     });
 *   });
 *
 *   describe('Language Detection', () => {
 *     it('LANG-2: 한국어 감지', async () => {
 *       // Given: 한국어 텍스트 PDF
 *       const koreanPdf = fs.readFileSync(path.join(__dirname, 'fixtures/korean-paper.pdf'));
 *
 *       // When: parsePdf() 호출
 *       const result = await parsePdf(koreanPdf);
 *
 *       // Then: 한국어로 감지됨
 *       expect(result.success).toBe(true);
 *       if (result.success) {
 *         expect(result.metadata.language).toBe('ko');
 *       }
 *     });
 *   });
 * });
 */
