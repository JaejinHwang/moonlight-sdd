/**
 * 파일 시스템 유틸리티
 */

import { existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, resolve, relative } from 'path';
import { glob } from 'glob';

/**
 * 프로젝트 루트 찾기 (specs 폴더가 있는 곳)
 */
export function findProjectRoot(startPath: string = process.cwd()): string | null {
  let current = resolve(startPath);
  
  while (current !== '/') {
    if (existsSync(join(current, 'specs')) || existsSync(join(current, 'CLAUDE.md'))) {
      return current;
    }
    current = resolve(current, '..');
  }
  
  return null;
}

/**
 * 스펙 파일 경로들 가져오기
 */
export function getSpecFiles(projectRoot: string): {
  discovery: string[];
  specification: string[];
  implementation: string[];
  root: string[];
} {
  const specsDir = join(projectRoot, 'specs');
  
  return {
    discovery: getYamlFiles(join(specsDir, '01-discovery')),
    specification: getYamlFiles(join(specsDir, '02-specification')),
    implementation: getYamlFiles(join(specsDir, '03-implementation')),
    root: getYamlFiles(specsDir, false), // 재귀 없이 루트만
  };
}

/**
 * 디렉토리에서 YAML 파일 목록 가져오기
 */
export function getYamlFiles(dir: string, recursive: boolean = true): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  
  try {
    const pattern = recursive ? '**/*.yaml' : '*.yaml';
    return glob.sync(pattern, { cwd: dir, absolute: true });
  } catch {
    return [];
  }
}

/**
 * 특정 스펙 파일 경로 가져오기
 */
export function getSpecFilePath(
  projectRoot: string,
  specName: 'idea-crystal' | 'problem-definition' | 'requirements' | 
            'functional-spec' | 'technical-spec' | 'ui-spec' |
            'task-queue' | 'traceability' | 'changelog'
): string {
  const paths: Record<string, string> = {
    'idea-crystal': 'specs/01-discovery/idea-crystal.yaml',
    'problem-definition': 'specs/01-discovery/problem-definition.yaml',
    'requirements': 'specs/01-discovery/requirements.yaml',
    'functional-spec': 'specs/02-specification/functional-spec.yaml',
    'technical-spec': 'specs/02-specification/technical-spec.yaml',
    'ui-spec': 'specs/02-specification/ui-spec.yaml',
    'task-queue': 'specs/03-implementation/task-queue.yaml',
    'traceability': 'specs/traceability.yaml',
    'changelog': 'specs/changelog.yaml',
  };
  
  return join(projectRoot, paths[specName] || specName);
}

/**
 * 디렉토리 생성 (재귀)
 */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * 파일 존재 여부 확인
 */
export function fileExists(filepath: string): boolean {
  return existsSync(filepath);
}

/**
 * 상대 경로로 변환
 */
export function toRelativePath(filepath: string, basePath: string = process.cwd()): string {
  return relative(basePath, filepath);
}

/**
 * 결과 파일 경로 생성
 */
export function getResultFilePath(projectRoot: string, taskId: string): string {
  return join(projectRoot, 'specs/03-implementation/results', `${taskId}.yaml`);
}

/**
 * 스펙 디렉토리 구조 확인
 */
export function checkSpecsStructure(projectRoot: string): {
  valid: boolean;
  missing: string[];
} {
  const requiredDirs = [
    'specs/01-discovery',
    'specs/02-specification',
    'specs/03-implementation',
  ];
  
  const missing = requiredDirs.filter(dir => !existsSync(join(projectRoot, dir)));
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * 타임스탬프 생성 (ISO 형식)
 */
export function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 날짜 문자열 생성 (YYYY-MM-DD)
 */
export function getDateString(): string {
  return new Date().toISOString().split('T')[0];
}