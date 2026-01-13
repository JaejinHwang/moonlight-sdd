/**
 * YAML 파일 읽기/쓰기 유틸리티
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { parse, stringify } from 'yaml';

/**
 * YAML 파일 읽기
 */
export function readYaml<T>(filepath: string): T | null {
  try {
    if (!existsSync(filepath)) {
      return null;
    }
    const content = readFileSync(filepath, 'utf-8');
    return parse(content) as T;
  } catch (error) {
    console.error(`Error reading YAML file: ${filepath}`, error);
    return null;
  }
}

/**
 * YAML 파일 쓰기
 */
export function writeYaml<T>(filepath: string, data: T): boolean {
  try {
    const content = stringify(data, {
      indent: 2,
      lineWidth: 120,
      nullStr: 'null',
    });
    writeFileSync(filepath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error(`Error writing YAML file: ${filepath}`, error);
    return false;
  }
}

/**
 * YAML 문법 검증
 */
export function validateYamlSyntax(filepath: string): { 
  valid: boolean; 
  error?: string;
  line?: number;
} {
  try {
    if (!existsSync(filepath)) {
      return { valid: false, error: 'File not found' };
    }
    const content = readFileSync(filepath, 'utf-8');
    parse(content);
    return { valid: true };
  } catch (error: unknown) {
    const yamlError = error as { message?: string; linePos?: [{ line: number }] };
    return {
      valid: false,
      error: yamlError.message || 'Unknown YAML error',
      line: yamlError.linePos?.[0]?.line,
    };
  }
}

/**
 * 객체의 특정 경로 값 가져오기
 * 예: getValueByPath(obj, 'user_stories[0].id')
 */
export function getValueByPath(obj: unknown, path: string): unknown {
  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  
  return current;
}

/**
 * 객체의 특정 경로에 값 설정하기
 */
export function setValueByPath(obj: unknown, path: string, value: unknown): boolean {
  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current === null || current === undefined) {
      return false;
    }
    current = (current as Record<string, unknown>)[key];
  }
  
  if (current === null || current === undefined) {
    return false;
  }
  
  const lastKey = keys[keys.length - 1];
  (current as Record<string, unknown>)[lastKey] = value;
  return true;
}

/**
 * 모든 ID 추출 (재귀적)
 */
export function extractIds(obj: unknown, pattern: RegExp = /^(US|F|TASK|SCR|ADR)-\d+$/): string[] {
  const ids: string[] = [];
  
  function traverse(current: unknown): void {
    if (typeof current === 'string' && pattern.test(current)) {
      ids.push(current);
    } else if (Array.isArray(current)) {
      current.forEach(traverse);
    } else if (typeof current === 'object' && current !== null) {
      // id 필드 특별 처리
      if ('id' in current && typeof (current as Record<string, unknown>).id === 'string') {
        const id = (current as Record<string, unknown>).id as string;
        if (pattern.test(id)) {
          ids.push(id);
        }
      }
      Object.values(current).forEach(traverse);
    }
  }
  
  traverse(obj);
  return [...new Set(ids)]; // 중복 제거
}

/**
 * ID 참조 추출 (parent_story, dependencies 등에서)
 */
export function extractReferences(obj: unknown): string[] {
  const refs: string[] = [];
  const refFields = ['parent_story', 'dependencies', 'implements_features', 'feature_id'];
  
  function traverse(current: unknown): void {
    if (Array.isArray(current)) {
      current.forEach(item => {
        if (typeof item === 'string' && /^(US|F|TASK|SCR)-\d+$/.test(item)) {
          refs.push(item);
        } else {
          traverse(item);
        }
      });
    } else if (typeof current === 'object' && current !== null) {
      for (const [key, value] of Object.entries(current)) {
        if (refFields.includes(key)) {
          if (typeof value === 'string') {
            refs.push(value);
          } else if (Array.isArray(value)) {
            refs.push(...value.filter((v): v is string => typeof v === 'string'));
          }
        } else {
          traverse(value);
        }
      }
    }
  }
  
  traverse(obj);
  return [...new Set(refs)];
}