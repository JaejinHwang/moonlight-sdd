/**
 * Traceability 빌더 스크립트
 * 모든 스펙을 스캔하여 traceability.yaml을 자동 생성/업데이트
 * 
 * 사용법: npm run trace
 */

import { readYaml, writeYaml } from '../utils/yaml-utils.js';
import { 
  findProjectRoot, 
  getSpecFilePath, 
  fileExists, 
  getTimestamp,
  getYamlFiles,
} from '../utils/file-utils.js';
import type {
  Requirements,
  FunctionalSpec,
  TechnicalSpec,
  UiSpec,
  TaskQueue,
  Traceability,
} from '../utils/types.js';
import chalk from 'chalk';
import { join } from 'path';

// ============================================================
// 메인 실행
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const includeCode = args.includes('--include-code');
  const dryRun = args.includes('--dry-run');

  // 프로젝트 루트 찾기
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    console.error(chalk.red('❌ 프로젝트 루트를 찾을 수 없습니다.'));
    process.exit(1);
  }

  console.log(chalk.blue('🔗 Traceability 빌더 시작\n'));
  console.log(chalk.gray(`   프로젝트: ${projectRoot}`));
  console.log(chalk.gray(`   코드 포함: ${includeCode ? '예' : '아니오'}`));
  console.log(chalk.gray(`   Dry Run: ${dryRun ? '예' : '아니오'}\n`));

  // Traceability 빌드
  const traceability = buildTraceability(projectRoot, includeCode);

  // 결과 출력
  printSummary(traceability);

  // 파일 저장
  if (!dryRun) {
    const outputPath = getSpecFilePath(projectRoot, 'traceability');
    const success = writeYaml(outputPath, traceability);
    
    if (success) {
      console.log(chalk.green(`\n✅ 저장됨: specs/traceability.yaml`));
    } else {
      console.error(chalk.red(`\n❌ 저장 실패`));
      process.exit(1);
    }
  } else {
    console.log(chalk.yellow(`\n⚠️ Dry Run 모드: 파일이 저장되지 않았습니다.`));
  }
}

// ============================================================
// Traceability 빌드 메인 로직
// ============================================================

function buildTraceability(projectRoot: string, includeCode: boolean): Traceability {
  console.log(chalk.cyan('📋 스펙 파일 스캔 중...\n'));

  // 모든 스펙 파일 읽기
  const requirements = readYaml<Requirements>(
    getSpecFilePath(projectRoot, 'requirements')
  );
  const functionalSpec = readYaml<FunctionalSpec>(
    getSpecFilePath(projectRoot, 'functional-spec')
  );
  const technicalSpec = readYaml<TechnicalSpec>(
    getSpecFilePath(projectRoot, 'technical-spec')
  );
  const uiSpec = readYaml<UiSpec>(
    getSpecFilePath(projectRoot, 'ui-spec')
  );
  const taskQueue = readYaml<TaskQueue>(
    getSpecFilePath(projectRoot, 'task-queue')
  );

  // 기존 traceability 읽기 (코드 매핑 보존용)
  const existingTraceability = readYaml<Traceability>(
    getSpecFilePath(projectRoot, 'traceability')
  );

  // 매핑 빌드
  const requirementsToFeatures = buildRequirementsToFeatures(
    requirements, 
    functionalSpec
  );
  console.log(chalk.gray(`   ✓ requirements → features: ${Object.keys(requirementsToFeatures).length}개 매핑`));

  const featuresToTechnical = buildFeaturesToTechnical(
    functionalSpec,
    technicalSpec,
    uiSpec
  );
  console.log(chalk.gray(`   ✓ features → technical: ${Object.keys(featuresToTechnical).length}개 매핑`));

  const featuresToUi = buildFeaturesToUi(
    functionalSpec,
    uiSpec
  );
  console.log(chalk.gray(`   ✓ features → ui: ${Object.keys(featuresToUi).length}개 매핑`));

  // 코드 매핑
  let featuresToCode: Traceability['traceability']['features_to_code'] = {};
  
  if (includeCode) {
    featuresToCode = buildFeaturesToCode(projectRoot, functionalSpec, taskQueue);
    console.log(chalk.gray(`   ✓ features → code: ${Object.keys(featuresToCode).length}개 매핑`));
  } else if (existingTraceability?.traceability?.features_to_code) {
    // 기존 코드 매핑 보존
    featuresToCode = existingTraceability.traceability.features_to_code;
    console.log(chalk.gray(`   ✓ features → code: ${Object.keys(featuresToCode).length}개 (기존 유지)`));
  }

  // 역방향 매핑 생성
  const reverseMappings = buildReverseMappings(
    requirementsToFeatures,
    featuresToCode
  );
  console.log(chalk.gray(`   ✓ 역방향 매핑 생성 완료`));

  return {
    traceability: {
      requirements_to_features: requirementsToFeatures,
      features_to_technical: featuresToTechnical,
      features_to_ui: featuresToUi,
      features_to_code: featuresToCode,
    },
    reverse_mappings: reverseMappings,
    metadata: {
      created_at: existingTraceability?.metadata?.created_at || getTimestamp(),
      last_updated: getTimestamp(),
    },
  };
}

// ============================================================
// Requirements → Features 매핑
// ============================================================

function buildRequirementsToFeatures(
  requirements: Requirements | null,
  functionalSpec: FunctionalSpec | null
): Record<string, string[]> {
  const mapping: Record<string, string[]> = {};

  if (!requirements?.requirements?.user_stories) return mapping;
  if (!functionalSpec?.functional_spec?.features) return mapping;

  // 모든 User Story ID 수집
  const userStoryIds = requirements.requirements.user_stories
    .map(us => us.id)
    .filter(Boolean);

  // 각 Feature의 parent_story로 매핑
  for (const feature of functionalSpec.functional_spec.features) {
    if (feature.parent_story && userStoryIds.includes(feature.parent_story)) {
      if (!mapping[feature.parent_story]) {
        mapping[feature.parent_story] = [];
      }
      if (feature.id) {
        mapping[feature.parent_story].push(feature.id);
      }
    }
  }

  return mapping;
}

// ============================================================
// Features → Technical 매핑
// ============================================================

function buildFeaturesToTechnical(
  functionalSpec: FunctionalSpec | null,
  technicalSpec: TechnicalSpec | null,
  uiSpec: UiSpec | null
): Record<string, { api_endpoints: string[]; data_models: string[]; components: string[] }> {
  const mapping: Record<string, { api_endpoints: string[]; data_models: string[]; components: string[] }> = {};

  if (!functionalSpec?.functional_spec?.features) return mapping;

  for (const feature of functionalSpec.functional_spec.features) {
    if (!feature.id) continue;

    mapping[feature.id] = {
      api_endpoints: [],
      data_models: [],
      components: [],
    };

    // API 엔드포인트 매핑 (기능 이름 기반 휴리스틱)
    if (technicalSpec?.technical_spec?.api_spec?.endpoints) {
      const featureKeywords = extractKeywords(feature.name, feature.description);
      
      for (const endpoint of technicalSpec.technical_spec.api_spec.endpoints) {
        const endpointKeywords = extractKeywords(endpoint.path, endpoint.description);
        
        if (hasOverlap(featureKeywords, endpointKeywords)) {
          mapping[feature.id].api_endpoints.push(endpoint.path);
        }
      }
    }

    // 데이터 모델 매핑
    if (technicalSpec?.technical_spec?.data_model?.entities) {
      const featureKeywords = extractKeywords(feature.name, feature.description);
      
      for (const entity of technicalSpec.technical_spec.data_model.entities) {
        const entityKeywords = extractKeywords(entity.name, entity.description);
        
        if (hasOverlap(featureKeywords, entityKeywords)) {
          mapping[feature.id].data_models.push(entity.name);
        }
      }
    }

    // 아키텍처 컴포넌트 매핑
    if (technicalSpec?.technical_spec?.architecture?.components) {
      const featureKeywords = extractKeywords(feature.name, feature.description);
      
      for (const component of technicalSpec.technical_spec.architecture.components) {
        const componentKeywords = extractKeywords(component.name, component.responsibility);
        
        if (hasOverlap(featureKeywords, componentKeywords)) {
          mapping[feature.id].components.push(component.name);
        }
      }
    }
  }

  return mapping;
}

// ============================================================
// Features → UI 매핑
// ============================================================

function buildFeaturesToUi(
  functionalSpec: FunctionalSpec | null,
  uiSpec: UiSpec | null
): Record<string, string[]> {
  const mapping: Record<string, string[]> = {};

  if (!functionalSpec?.functional_spec?.features) return mapping;
  if (!uiSpec?.ui_spec?.screens) return mapping;

  // UI 스펙의 implements_features를 역으로 매핑
  for (const screen of uiSpec.ui_spec.screens) {
    if (!screen.implements_features) continue;

    for (const featureId of screen.implements_features) {
      if (!mapping[featureId]) {
        mapping[featureId] = [];
      }
      
      // 화면 ID와 컴포넌트들 추가
      mapping[featureId].push(screen.id);
      
      // 컴포넌트별 상세 매핑
      if (screen.components) {
        for (const component of screen.components) {
          if (component.id) {
            mapping[featureId].push(`${screen.id}.${component.id}`);
          }
        }
      }
    }
  }

  // 중복 제거
  for (const featureId of Object.keys(mapping)) {
    mapping[featureId] = [...new Set(mapping[featureId])];
  }

  return mapping;
}

// ============================================================
// Features → Code 매핑
// ============================================================

function buildFeaturesToCode(
  projectRoot: string,
  functionalSpec: FunctionalSpec | null,
  taskQueue: TaskQueue | null
): Record<string, { files: string[]; tests: string[] }> {
  const mapping: Record<string, { files: string[]; tests: string[] }> = {};

  if (!functionalSpec?.functional_spec?.features) return mapping;

  // Implementation results에서 코드 매핑 추출
  const resultsDir = join(projectRoot, 'specs/03-implementation/results');
  const resultFiles = getYamlFiles(resultsDir, false);

  for (const resultFile of resultFiles) {
    const result = readYaml<any>(resultFile);
    
    if (!result?.implementation_result) continue;

    const featureId = result.implementation_result.feature_id;
    if (!featureId) continue;

    if (!mapping[featureId]) {
      mapping[featureId] = { files: [], tests: [] };
    }

    // 생성된 파일 추가
    if (result.implementation_result.files_created) {
      for (const file of result.implementation_result.files_created) {
        if (file.path) {
          if (file.path.includes('test')) {
            mapping[featureId].tests.push(file.path);
          } else {
            mapping[featureId].files.push(file.path);
          }
        }
      }
    }

    // 수정된 파일 추가
    if (result.implementation_result.files_modified) {
      for (const file of result.implementation_result.files_modified) {
        if (file.path && !mapping[featureId].files.includes(file.path)) {
          mapping[featureId].files.push(file.path);
        }
      }
    }
  }

  // Task Queue의 expected_outputs에서 추가 매핑
  if (taskQueue?.task_queue) {
    for (const task of taskQueue.task_queue) {
      if (!task.feature_id || task.status !== 'completed') continue;

      if (!mapping[task.feature_id]) {
        mapping[task.feature_id] = { files: [], tests: [] };
      }

      if (task.expected_outputs) {
        for (const output of task.expected_outputs) {
          if (output.path) {
            if (output.type === 'test' || output.path.includes('test')) {
              if (!mapping[task.feature_id].tests.includes(output.path)) {
                mapping[task.feature_id].tests.push(output.path);
              }
            } else {
              if (!mapping[task.feature_id].files.includes(output.path)) {
                mapping[task.feature_id].files.push(output.path);
              }
            }
          }
        }
      }
    }
  }

  return mapping;
}

// ============================================================
// 역방향 매핑 생성
// ============================================================

function buildReverseMappings(
  requirementsToFeatures: Record<string, string[]>,
  featuresToCode: Record<string, { files: string[]; tests: string[] }>
): Traceability['reverse_mappings'] {
  const codesToFeatures: Record<string, string[]> = {};
  const featuresToRequirements: Record<string, string[]> = {};

  // features → requirements (역방향)
  for (const [usId, featureIds] of Object.entries(requirementsToFeatures)) {
    for (const featureId of featureIds) {
      if (!featuresToRequirements[featureId]) {
        featuresToRequirements[featureId] = [];
      }
      featuresToRequirements[featureId].push(usId);
    }
  }

  // code → features (역방향)
  for (const [featureId, { files, tests }] of Object.entries(featuresToCode)) {
    const allFiles = [...files, ...tests];
    for (const file of allFiles) {
      if (!codesToFeatures[file]) {
        codesToFeatures[file] = [];
      }
      if (!codesToFeatures[file].includes(featureId)) {
        codesToFeatures[file].push(featureId);
      }
    }
  }

  return {
    code_to_features: codesToFeatures,
    features_to_requirements: featuresToRequirements,
  };
}

// ============================================================
// 헬퍼 함수들
// ============================================================

/**
 * 텍스트에서 키워드 추출
 */
function extractKeywords(...texts: (string | undefined)[]): Set<string> {
  const keywords = new Set<string>();
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'to', 'for', 'of', 'and', 'or', 'in', 'on']);

  for (const text of texts) {
    if (!text) continue;
    
    // 소문자 변환 및 특수문자 제거
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
    
    words.forEach(word => keywords.add(word));
  }

  return keywords;
}

/**
 * 두 키워드 집합이 겹치는지 확인
 */
function hasOverlap(set1: Set<string>, set2: Set<string>): boolean {
  for (const item of set1) {
    if (set2.has(item)) return true;
  }
  return false;
}

// ============================================================
// 결과 출력
// ============================================================

function printSummary(traceability: Traceability): void {
  console.log(chalk.blue('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.blue('📊 Traceability 빌드 결과'));
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  const t = traceability.traceability;

  // Requirements → Features
  const reqCount = Object.keys(t.requirements_to_features).length;
  const featureCount = Object.values(t.requirements_to_features).flat().length;
  console.log(chalk.white('Requirements → Features:'));
  console.log(chalk.gray(`   ${reqCount}개 요구사항 → ${featureCount}개 기능 매핑`));
  
  if (reqCount > 0) {
    const sample = Object.entries(t.requirements_to_features).slice(0, 3);
    sample.forEach(([us, features]) => {
      console.log(chalk.gray(`   예: ${us} → [${features.join(', ')}]`));
    });
  }
  console.log();

  // Features → Technical
  const techCount = Object.keys(t.features_to_technical).length;
  console.log(chalk.white('Features → Technical:'));
  console.log(chalk.gray(`   ${techCount}개 기능에 대한 기술 매핑`));
  
  if (techCount > 0) {
    const sample = Object.entries(t.features_to_technical).slice(0, 2);
    sample.forEach(([f, mapping]) => {
      const parts = [];
      if (mapping.api_endpoints.length) parts.push(`API ${mapping.api_endpoints.length}개`);
      if (mapping.data_models.length) parts.push(`모델 ${mapping.data_models.length}개`);
      if (mapping.components.length) parts.push(`컴포넌트 ${mapping.components.length}개`);
      console.log(chalk.gray(`   예: ${f} → ${parts.join(', ') || '(매핑 없음)'}`));
    });
  }
  console.log();

  // Features → UI
  const uiCount = Object.keys(t.features_to_ui).length;
  const screenCount = new Set(Object.values(t.features_to_ui).flat()).size;
  console.log(chalk.white('Features → UI:'));
  console.log(chalk.gray(`   ${uiCount}개 기능 → ${screenCount}개 화면/컴포넌트 매핑`));
  console.log();

  // Features → Code
  const codeCount = Object.keys(t.features_to_code).length;
  const fileCount = Object.values(t.features_to_code)
    .reduce((sum, m) => sum + m.files.length + m.tests.length, 0);
  console.log(chalk.white('Features → Code:'));
  console.log(chalk.gray(`   ${codeCount}개 기능 → ${fileCount}개 파일 매핑`));
  console.log();

  // 역방향 매핑
  if (traceability.reverse_mappings) {
    const codeToFeaturesCount = Object.keys(traceability.reverse_mappings.code_to_features || {}).length;
    console.log(chalk.white('역방향 매핑:'));
    console.log(chalk.gray(`   ${codeToFeaturesCount}개 코드 파일 → 기능 매핑`));
  }
}

// ============================================================
// 실행
// ============================================================

main().catch(console.error);