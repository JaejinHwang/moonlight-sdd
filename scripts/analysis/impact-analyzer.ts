/**
 * 영향 분석 스크립트
 * 사용법: npm run analyze <spec-file> <item-path>
 * 예시: npm run analyze requirements.yaml user_stories[0]
 */

import { readYaml, getValueByPath, extractIds } from '../utils/yaml-utils.js';
import { findProjectRoot, getSpecFilePath, fileExists, toRelativePath } from '../utils/file-utils.js';
import type {
  ImpactAnalysis,
  Requirements,
  FunctionalSpec,
  TechnicalSpec,
  UiSpec,
  TaskQueue,
  Traceability,
} from '../utils/types.js';
import chalk from 'chalk';

// ============================================================
// 메인 실행
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    printUsage();
    process.exit(1);
  }

  const [specFile, itemPath] = args;

  // 프로젝트 루트 찾기
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    console.error(chalk.red('❌ 프로젝트 루트를 찾을 수 없습니다.'));
    process.exit(1);
  }

  console.log(chalk.blue('🔍 영향 분석 시작\n'));

  // 스펙 파일 경로 결정
  const filepath = getSpecFilePath(projectRoot, specFile as any) || 
                   (specFile.startsWith('/') ? specFile : `${projectRoot}/specs/${specFile}`);

  if (!fileExists(filepath)) {
    console.error(chalk.red(`❌ 파일을 찾을 수 없습니다: ${specFile}`));
    process.exit(1);
  }

  // 영향 분석 수행
  const analysis = analyzeImpact(projectRoot, filepath, itemPath);

  // 결과 출력
  printAnalysis(analysis, projectRoot);
}

// ============================================================
// 영향 분석 메인 로직
// ============================================================

function analyzeImpact(
  projectRoot: string, 
  filepath: string, 
  itemPath: string
): ImpactAnalysis {
  const filename = filepath.split('/').pop() || '';
  
  // 현재 값 읽기
  const data = readYaml<any>(filepath);
  const currentValue = getValueByPath(data, itemPath);

  // 변경 대상 ID 추출
  const targetIds = extractTargetIds(data, itemPath);

  const analysis: ImpactAnalysis = {
    change: {
      file: toRelativePath(filepath, projectRoot),
      path: itemPath,
      from: currentValue,
      to: '[새 값]',
    },
    direct_impacts: [],
    cascading_impacts: [],
    affected_tests: [],
    risk_level: 'low',
    recommendation: '',
  };

  // 파일 타입별 영향 분석
  if (filename.includes('requirements')) {
    analyzeRequirementsImpact(projectRoot, targetIds, analysis);
  } else if (filename.includes('functional-spec')) {
    analyzeFunctionalImpact(projectRoot, targetIds, analysis);
  } else if (filename.includes('technical-spec')) {
    analyzeTechnicalImpact(projectRoot, targetIds, itemPath, analysis);
  } else if (filename.includes('ui-spec')) {
    analyzeUiImpact(projectRoot, targetIds, analysis);
  } else if (filename.includes('task-queue')) {
    analyzeTaskImpact(projectRoot, targetIds, analysis);
  }

  // Traceability 기반 추가 분석
  analyzeFromTraceability(projectRoot, targetIds, analysis);

  // 위험도 계산
  analysis.risk_level = calculateRiskLevel(analysis);
  analysis.recommendation = generateRecommendation(analysis);

  return analysis;
}

// ============================================================
// 대상 ID 추출
// ============================================================

function extractTargetIds(data: any, itemPath: string): string[] {
  const value = getValueByPath(data, itemPath);
  
  if (!value) return [];

  // 직접 ID인 경우
  if (typeof value === 'string' && /^(US|F|TASK|SCR|ADR)-\d+$/.test(value)) {
    return [value];
  }

  // 객체에서 ID 추출
  if (typeof value === 'object' && value !== null) {
    if ('id' in value && typeof value.id === 'string') {
      return [value.id];
    }
    // 배열인 경우 모든 ID 추출
    return extractIds(value);
  }

  return [];
}

// ============================================================
// Requirements 변경 영향 분석
// ============================================================

function analyzeRequirementsImpact(
  projectRoot: string,
  targetIds: string[],
  analysis: ImpactAnalysis
): void {
  // Functional Spec에서 이 US를 참조하는 Feature 찾기
  const functionalSpec = readYaml<FunctionalSpec>(
    getSpecFilePath(projectRoot, 'functional-spec')
  );

  if (functionalSpec?.functional_spec?.features) {
    const affectedFeatures = functionalSpec.functional_spec.features.filter(f =>
      targetIds.includes(f.parent_story)
    );

    if (affectedFeatures.length > 0) {
      analysis.direct_impacts.push({
        file: 'specs/02-specification/functional-spec.yaml',
        items: affectedFeatures.map(f => f.id),
        reason: '이 요구사항을 구현하는 기능',
      });

      // 연쇄 영향: 이 Feature들의 영향도 분석
      const featureIds = affectedFeatures.map(f => f.id);
      analyzeFunctionalImpact(projectRoot, featureIds, analysis, true);
    }
  }

  // Task Queue에서 이 US를 참조하는 태스크 찾기
  const taskQueue = readYaml<TaskQueue>(
    getSpecFilePath(projectRoot, 'task-queue')
  );

  if (taskQueue?.task_queue) {
    const affectedTasks = taskQueue.task_queue.filter(t =>
      t.acceptance_criteria?.some(ac => 
        targetIds.some(id => ac.includes(id))
      )
    );

    if (affectedTasks.length > 0) {
      analysis.cascading_impacts.push({
        file: 'specs/03-implementation/task-queue.yaml',
        items: affectedTasks.map(t => t.id),
        reason: '관련 acceptance criteria 포함',
      });
    }
  }
}

// ============================================================
// Functional Spec 변경 영향 분석
// ============================================================

function analyzeFunctionalImpact(
  projectRoot: string,
  targetIds: string[],
  analysis: ImpactAnalysis,
  isCascading: boolean = false
): void {
  const targetList = isCascading ? analysis.cascading_impacts : analysis.direct_impacts;

  // Technical Spec 영향
  const technicalSpec = readYaml<TechnicalSpec>(
    getSpecFilePath(projectRoot, 'technical-spec')
  );

  // Traceability에서 매핑 확인
  const traceability = readYaml<Traceability>(
    getSpecFilePath(projectRoot, 'traceability')
  );

  if (traceability?.traceability?.features_to_technical) {
    const affectedTechnical: string[] = [];
    
    for (const featureId of targetIds) {
      const mapping = traceability.traceability.features_to_technical[featureId];
      if (mapping) {
        if (mapping.api_endpoints) {
          affectedTechnical.push(...mapping.api_endpoints);
        }
        if (mapping.data_models) {
          affectedTechnical.push(...mapping.data_models);
        }
      }
    }

    if (affectedTechnical.length > 0) {
      targetList.push({
        file: 'specs/02-specification/technical-spec.yaml',
        items: affectedTechnical,
        reason: '이 기능이 사용하는 API/모델',
      });
    }
  }

  // UI Spec 영향
  const uiSpec = readYaml<UiSpec>(
    getSpecFilePath(projectRoot, 'ui-spec')
  );

  if (uiSpec?.ui_spec?.screens) {
    const affectedScreens = uiSpec.ui_spec.screens.filter(s =>
      s.implements_features?.some(f => targetIds.includes(f))
    );

    if (affectedScreens.length > 0) {
      targetList.push({
        file: 'specs/02-specification/ui-spec.yaml',
        items: affectedScreens.map(s => s.id),
        reason: '이 기능을 구현하는 화면',
      });
    }
  }

  // Task Queue 영향
  const taskQueue = readYaml<TaskQueue>(
    getSpecFilePath(projectRoot, 'task-queue')
  );

  if (taskQueue?.task_queue) {
    const affectedTasks = taskQueue.task_queue.filter(t =>
      targetIds.includes(t.feature_id)
    );

    if (affectedTasks.length > 0) {
      targetList.push({
        file: 'specs/03-implementation/task-queue.yaml',
        items: affectedTasks.map(t => t.id),
        reason: '이 기능의 구현 태스크',
      });
    }
  }

  // 코드 파일 영향 (Traceability에서)
  if (traceability?.traceability?.features_to_code) {
    for (const featureId of targetIds) {
      const mapping = traceability.traceability.features_to_code[featureId];
      if (mapping?.files) {
        analysis.cascading_impacts.push({
          file: '구현 코드',
          items: mapping.files,
          reason: `${featureId} 구현 코드`,
        });
      }
      if (mapping?.tests) {
        analysis.affected_tests.push(...mapping.tests);
      }
    }
  }
}

// ============================================================
// Technical Spec 변경 영향 분석
// ============================================================

function analyzeTechnicalImpact(
  projectRoot: string,
  targetIds: string[],
  itemPath: string,
  analysis: ImpactAnalysis
): void {
  // API 변경인 경우
  if (itemPath.includes('api_spec') || itemPath.includes('endpoints')) {
    analysis.direct_impacts.push({
      file: '프론트엔드 코드',
      items: ['API 호출 부분'],
      reason: 'API 스펙 변경으로 호출 코드 수정 필요',
    });

    // Breaking change 가능성
    if (itemPath.includes('path') || itemPath.includes('method')) {
      analysis.cascading_impacts.push({
        file: '클라이언트 코드 전체',
        reason: 'API 경로/메서드 변경은 Breaking Change',
      });
    }
  }

  // 데이터 모델 변경인 경우
  if (itemPath.includes('data_model') || itemPath.includes('entities')) {
    analysis.direct_impacts.push({
      file: '데이터베이스',
      items: ['스키마 마이그레이션 필요'],
      reason: '데이터 모델 변경',
    });

    analysis.cascading_impacts.push({
      file: 'API 응답 형식',
      reason: '엔티티 구조 변경 시 API 응답도 변경',
    });
  }
}

// ============================================================
// UI Spec 변경 영향 분석
// ============================================================

function analyzeUiImpact(
  projectRoot: string,
  targetIds: string[],
  analysis: ImpactAnalysis
): void {
  const traceability = readYaml<Traceability>(
    getSpecFilePath(projectRoot, 'traceability')
  );

  // UI 변경은 주로 프론트엔드 코드에 영향
  analysis.direct_impacts.push({
    file: 'src/components/',
    items: targetIds.map(id => `${id} 관련 컴포넌트`),
    reason: 'UI 스펙 변경',
  });

  // 관련 테스트
  analysis.affected_tests.push(
    ...targetIds.map(id => `tests/components/${id}.test.tsx`)
  );
}

// ============================================================
// Task 변경 영향 분석
// ============================================================

function analyzeTaskImpact(
  projectRoot: string,
  targetIds: string[],
  analysis: ImpactAnalysis
): void {
  const taskQueue = readYaml<TaskQueue>(
    getSpecFilePath(projectRoot, 'task-queue')
  );

  if (!taskQueue?.task_queue) return;

  // 이 태스크에 의존하는 다른 태스크 찾기
  const dependentTasks = taskQueue.task_queue.filter(t =>
    t.dependencies?.some(dep => targetIds.includes(dep))
  );

  if (dependentTasks.length > 0) {
    analysis.direct_impacts.push({
      file: 'specs/03-implementation/task-queue.yaml',
      items: dependentTasks.map(t => t.id),
      reason: '이 태스크에 의존하는 태스크들',
    });
  }
}

// ============================================================
// Traceability 기반 분석
// ============================================================

function analyzeFromTraceability(
  projectRoot: string,
  targetIds: string[],
  analysis: ImpactAnalysis
): void {
  const traceability = readYaml<Traceability>(
    getSpecFilePath(projectRoot, 'traceability')
  );

  if (!traceability?.traceability) return;

  const trace = traceability.traceability;

  // US → Feature 매핑
  for (const [usId, featureIds] of Object.entries(trace.requirements_to_features || {})) {
    if (targetIds.includes(usId)) {
      const existing = analysis.direct_impacts.find(i => 
        i.file.includes('functional-spec')
      );
      if (!existing) {
        analysis.direct_impacts.push({
          file: 'specs/02-specification/functional-spec.yaml',
          items: featureIds,
          reason: `${usId}를 구현하는 기능 (traceability)`,
        });
      }
    }
  }

  // Feature → Code 매핑
  for (const [featureId, mapping] of Object.entries(trace.features_to_code || {})) {
    if (targetIds.includes(featureId)) {
      if (mapping.files?.length) {
        const existing = analysis.cascading_impacts.find(i =>
          i.file === '구현 코드'
        );
        if (!existing) {
          analysis.cascading_impacts.push({
            file: '구현 코드',
            items: mapping.files,
            reason: `${featureId} 구현 파일`,
          });
        }
      }
      if (mapping.tests?.length) {
        analysis.affected_tests.push(...mapping.tests);
      }
    }
  }
}

// ============================================================
// 위험도 계산
// ============================================================

function calculateRiskLevel(analysis: ImpactAnalysis): 'low' | 'medium' | 'high' {
  const totalImpacts = 
    analysis.direct_impacts.length + 
    analysis.cascading_impacts.length;

  const hasCodeImpact = analysis.cascading_impacts.some(i =>
    i.file.includes('코드') || i.file.includes('src/')
  );

  const hasBreakingChange = analysis.cascading_impacts.some(i =>
    i.reason?.includes('Breaking')
  );

  if (hasBreakingChange || totalImpacts > 5) {
    return 'high';
  } else if (hasCodeImpact || totalImpacts > 2) {
    return 'medium';
  }
  return 'low';
}

// ============================================================
// 권장 사항 생성
// ============================================================

function generateRecommendation(analysis: ImpactAnalysis): string {
  const parts: string[] = [];

  const totalFiles = new Set([
    ...analysis.direct_impacts.map(i => i.file),
    ...analysis.cascading_impacts.map(i => i.file),
  ]).size;

  parts.push(`${totalFiles}개 영역에 영향`);

  if (analysis.risk_level === 'high') {
    parts.push('신중한 검토 필요');
  }

  if (analysis.affected_tests.length > 0) {
    parts.push(`${analysis.affected_tests.length}개 테스트 확인 필요`);
  }

  if (analysis.direct_impacts.length > 0) {
    const firstImpact = analysis.direct_impacts[0];
    parts.push(`먼저 ${firstImpact.file} 수정`);
  }

  return parts.join(', ');
}

// ============================================================
// 결과 출력
// ============================================================

function printAnalysis(analysis: ImpactAnalysis, projectRoot: string): void {
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.blue('🔍 영향 분석 결과'));
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  // 변경 대상
  console.log(chalk.white('변경 대상:'));
  console.log(chalk.gray(`   파일: ${analysis.change.file}`));
  console.log(chalk.gray(`   경로: ${analysis.change.path}`));
  console.log();

  // 위험도
  const riskColors = {
    low: chalk.green,
    medium: chalk.yellow,
    high: chalk.red,
  };
  const riskLabels = {
    low: '낮음',
    medium: '중간',
    high: '높음 ⚠️',
  };
  console.log(chalk.white('위험도: ') + riskColors[analysis.risk_level](riskLabels[analysis.risk_level]));
  console.log();

  // 직접 영향
  if (analysis.direct_impacts.length > 0) {
    console.log(chalk.cyan('📋 직접 영향:'));
    analysis.direct_impacts.forEach(impact => {
      console.log(chalk.white(`   ${impact.file}`));
      if (impact.items) {
        impact.items.forEach(item => {
          console.log(chalk.gray(`      └─ ${item}`));
        });
      }
      console.log(chalk.gray(`      (${impact.reason})`));
    });
    console.log();
  }

  // 연쇄 영향
  if (analysis.cascading_impacts.length > 0) {
    console.log(chalk.yellow('🔗 연쇄 영향:'));
    analysis.cascading_impacts.forEach(impact => {
      console.log(chalk.white(`   ${impact.file}`));
      if (impact.items) {
        impact.items.forEach(item => {
          console.log(chalk.gray(`      └─ ${item}`));
        });
      }
      console.log(chalk.gray(`      (${impact.reason})`));
    });
    console.log();
  }

  // 영향받는 테스트
  if (analysis.affected_tests.length > 0) {
    console.log(chalk.magenta('🧪 영향받는 테스트:'));
    // 중복 제거
    const uniqueTests = [...new Set(analysis.affected_tests)];
    uniqueTests.forEach(test => {
      console.log(chalk.gray(`   └─ ${test}`));
    });
    console.log();
  }

  // 영향 없음
  if (analysis.direct_impacts.length === 0 && analysis.cascading_impacts.length === 0) {
    console.log(chalk.green('✅ 다른 스펙에 영향 없음'));
    console.log();
  }

  // 권장 사항
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.white('💡 권장: ') + chalk.gray(analysis.recommendation));
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
}

// ============================================================
// 사용법 출력
// ============================================================

function printUsage(): void {
  console.log(chalk.blue('사용법:'));
  console.log(chalk.gray('  npm run analyze <spec-file> <item-path>'));
  console.log();
  console.log(chalk.blue('예시:'));
  console.log(chalk.gray('  npm run analyze requirements.yaml user_stories[0]'));
  console.log(chalk.gray('  npm run analyze functional-spec.yaml features[0].states'));
  console.log(chalk.gray('  npm run analyze technical-spec.yaml api_spec.endpoints[0]'));
}

// ============================================================
// 실행
// ============================================================

main().catch(console.error);