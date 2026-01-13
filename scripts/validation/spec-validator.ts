/**
 * 스펙 검증 스크립트
 * 사용법: npm run validate [파일명]
 */

import { readYaml, validateYamlSyntax, extractIds, extractReferences } from '../utils/yaml-utils.js';
import { findProjectRoot, getSpecFiles, getSpecFilePath, fileExists, toRelativePath } from '../utils/file-utils.js';
import type { 
  ValidationResult, 
  ValidationIssue,
  Requirements,
  FunctionalSpec,
  TechnicalSpec,
  UiSpec,
  TaskQueue,
  Traceability,
  UserStory,
  Feature,
} from '../utils/types.js';
import chalk from 'chalk';

// ============================================================
// 메인 실행
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const targetFile = args.find(arg => !arg.startsWith('--'));
  const validateAll = args.includes('--all') || !targetFile;

  // 프로젝트 루트 찾기
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    console.error(chalk.red('❌ 프로젝트 루트를 찾을 수 없습니다.'));
    console.error(chalk.gray('   specs/ 폴더가 있는 디렉토리에서 실행하세요.'));
    process.exit(1);
  }

  console.log(chalk.blue('🔍 스펙 검증 시작\n'));
  console.log(chalk.gray(`   프로젝트: ${projectRoot}\n`));

  let results: ValidationResult[] = [];

  if (validateAll) {
    results = validateAllSpecs(projectRoot);
  } else {
    const filepath = getSpecFilePath(projectRoot, targetFile as any) || targetFile!;
    const result = validateSpecFile(filepath, projectRoot);
    if (result) {
      results = [result];
    }
  }

  // 결과 출력
  printResults(results, projectRoot);

  // 종료 코드
  const hasErrors = results.some(r => r.errors.length > 0);
  process.exit(hasErrors ? 1 : 0);
}

// ============================================================
// 전체 스펙 검증
// ============================================================

function validateAllSpecs(projectRoot: string): ValidationResult[] {
  const specFiles = getSpecFiles(projectRoot);
  const results: ValidationResult[] = [];

  // Discovery 단계
  console.log(chalk.cyan('📋 Discovery 단계 검증'));
  for (const file of specFiles.discovery) {
    const result = validateSpecFile(file, projectRoot);
    if (result) results.push(result);
  }

  // Specification 단계
  console.log(chalk.cyan('\n📋 Specification 단계 검증'));
  for (const file of specFiles.specification) {
    const result = validateSpecFile(file, projectRoot);
    if (result) results.push(result);
  }

  // Implementation 단계
  console.log(chalk.cyan('\n📋 Implementation 단계 검증'));
  for (const file of specFiles.implementation) {
    const result = validateSpecFile(file, projectRoot);
    if (result) results.push(result);
  }

  // 루트 레벨 파일들
  console.log(chalk.cyan('\n📋 루트 레벨 파일 검증'));
  for (const file of specFiles.root) {
    const result = validateSpecFile(file, projectRoot);
    if (result) results.push(result);
  }

  // 크로스 파일 검증
  console.log(chalk.cyan('\n🔗 참조 무결성 검증'));
  const crossFileResults = validateCrossFileReferences(projectRoot);
  results.push(...crossFileResults);

  return results;
}

// ============================================================
// 단일 파일 검증
// ============================================================

function validateSpecFile(filepath: string, projectRoot: string): ValidationResult | null {
  const relativePath = toRelativePath(filepath, projectRoot);
  
  // 파일 존재 확인
  if (!fileExists(filepath)) {
    console.log(chalk.gray(`   ⊘ ${relativePath} (없음)`));
    return null;
  }

  const result: ValidationResult = {
    valid: true,
    file: relativePath,
    errors: [],
    warnings: [],
  };

  // 1. YAML 문법 검증
  const syntaxResult = validateYamlSyntax(filepath);
  if (!syntaxResult.valid) {
    result.valid = false;
    result.errors.push({
      path: `line ${syntaxResult.line || '?'}`,
      message: syntaxResult.error || 'YAML 문법 오류',
      severity: 'critical',
    });
    console.log(chalk.red(`   ✗ ${relativePath}`));
    return result;
  }

  // 2. 파일 타입별 검증
  const data = readYaml<any>(filepath);
  if (!data) {
    result.valid = false;
    result.errors.push({
      path: '',
      message: '파일을 읽을 수 없습니다',
      severity: 'critical',
    });
    return result;
  }

  // 파일 이름으로 타입 판단
  const filename = filepath.split('/').pop() || '';
  
  if (filename.includes('requirements')) {
    validateRequirements(data as Requirements, result);
  } else if (filename.includes('functional-spec')) {
    validateFunctionalSpec(data as FunctionalSpec, result);
  } else if (filename.includes('technical-spec')) {
    validateTechnicalSpec(data as TechnicalSpec, result);
  } else if (filename.includes('ui-spec')) {
    validateUiSpec(data as UiSpec, result);
  } else if (filename.includes('task-queue')) {
    validateTaskQueue(data as TaskQueue, result);
  } else if (filename.includes('traceability')) {
    validateTraceability(data as Traceability, result);
  }

  // 결과 출력
  const icon = result.errors.length > 0 ? chalk.red('✗') : 
               result.warnings.length > 0 ? chalk.yellow('⚠') : 
               chalk.green('✓');
  console.log(`   ${icon} ${relativePath}`);

  if (result.errors.length > 0) {
    result.valid = false;
  }

  return result;
}

// ============================================================
// Requirements 검증
// ============================================================

function validateRequirements(data: Requirements, result: ValidationResult): void {
  const req = data.requirements;
  if (!req) {
    result.errors.push({
      path: 'requirements',
      message: 'requirements 필드가 없습니다',
      severity: 'critical',
    });
    return;
  }

  // User Stories 검증
  if (!req.user_stories || req.user_stories.length === 0) {
    result.errors.push({
      path: 'requirements.user_stories',
      message: 'user_stories가 비어있습니다',
      severity: 'error',
    });
    return;
  }

  const seenIds = new Set<string>();

  req.user_stories.forEach((story, index) => {
    const basePath = `user_stories[${index}]`;

    // 필수 필드 검증
    if (!story.id) {
      result.errors.push({
        path: `${basePath}.id`,
        message: 'id 필드가 없습니다',
        severity: 'error',
      });
    } else {
      // ID 중복 검사
      if (seenIds.has(story.id)) {
        result.errors.push({
          path: `${basePath}.id`,
          message: `ID "${story.id}"가 중복됩니다`,
          severity: 'error',
        });
      }
      seenIds.add(story.id);

      // ID 형식 검사
      if (!/^US-\d{3}$/.test(story.id)) {
        result.warnings.push({
          path: `${basePath}.id`,
          message: `ID 형식이 "US-001" 형태가 아닙니다: ${story.id}`,
          severity: 'warning',
        });
      }
    }

    if (!story.as_a) {
      result.errors.push({
        path: `${basePath}.as_a`,
        message: 'as_a 필드가 없습니다',
        severity: 'error',
      });
    }

    if (!story.i_want) {
      result.errors.push({
        path: `${basePath}.i_want`,
        message: 'i_want 필드가 없습니다',
        severity: 'error',
      });
    }

    if (!story.so_that) {
      result.warnings.push({
        path: `${basePath}.so_that`,
        message: 'so_that 필드가 없습니다',
        severity: 'warning',
      });
    }

    // Acceptance Criteria 검증
    if (!story.acceptance_criteria || story.acceptance_criteria.length === 0) {
      result.errors.push({
        path: `${basePath}.acceptance_criteria`,
        message: 'acceptance_criteria가 없습니다',
        severity: 'error',
      });
    } else {
      // Given-When-Then 형식 검증
      story.acceptance_criteria.forEach((ac, acIndex) => {
        if (!isGivenWhenThen(ac)) {
          result.warnings.push({
            path: `${basePath}.acceptance_criteria[${acIndex}]`,
            message: 'Given-When-Then 형식이 아닙니다',
            severity: 'warning',
            suggestion: '"Given [조건], When [행동], Then [결과]" 형식으로 작성하세요',
          });
        }
      });
    }
  });
}

// ============================================================
// Functional Spec 검증
// ============================================================

function validateFunctionalSpec(data: FunctionalSpec, result: ValidationResult): void {
  const spec = data.functional_spec;
  if (!spec) {
    result.errors.push({
      path: 'functional_spec',
      message: 'functional_spec 필드가 없습니다',
      severity: 'critical',
    });
    return;
  }

  if (!spec.features || spec.features.length === 0) {
    result.errors.push({
      path: 'functional_spec.features',
      message: 'features가 비어있습니다',
      severity: 'error',
    });
    return;
  }

  const seenIds = new Set<string>();

  spec.features.forEach((feature, index) => {
    const basePath = `features[${index}]`;

    // ID 검증
    if (!feature.id) {
      result.errors.push({
        path: `${basePath}.id`,
        message: 'id 필드가 없습니다',
        severity: 'error',
      });
    } else {
      if (seenIds.has(feature.id)) {
        result.errors.push({
          path: `${basePath}.id`,
          message: `ID "${feature.id}"가 중복됩니다`,
          severity: 'error',
        });
      }
      seenIds.add(feature.id);
    }

    // States 검증 (필수)
    if (!feature.states || feature.states.length === 0) {
      result.errors.push({
        path: `${basePath}.states`,
        message: 'states가 없습니다 (필수)',
        severity: 'error',
      });
    } else {
      // 최소 3개 상태 권장
      if (feature.states.length < 3) {
        result.warnings.push({
          path: `${basePath}.states`,
          message: `상태가 ${feature.states.length}개입니다 (권장: 3개 이상)`,
          severity: 'warning',
        });
      }

      // 상태 전이 검증
      validateStateTransitions(feature.states, `${basePath}.states`, result);
    }

    // Error Cases 검증 (필수)
    if (!feature.error_cases || feature.error_cases.length === 0) {
      result.errors.push({
        path: `${basePath}.error_cases`,
        message: 'error_cases가 없습니다 (필수)',
        severity: 'error',
      });
    } else if (feature.error_cases.length < 3) {
      result.warnings.push({
        path: `${basePath}.error_cases`,
        message: `error_cases가 ${feature.error_cases.length}개입니다 (권장: 3개 이상)`,
        severity: 'warning',
      });
    }

    // Edge Cases 검증
    if (!feature.edge_cases || feature.edge_cases.length === 0) {
      result.warnings.push({
        path: `${basePath}.edge_cases`,
        message: 'edge_cases가 없습니다 (권장)',
        severity: 'warning',
      });
    } else if (feature.edge_cases.length < 2) {
      result.warnings.push({
        path: `${basePath}.edge_cases`,
        message: `edge_cases가 ${feature.edge_cases.length}개입니다 (권장: 2개 이상)`,
        severity: 'warning',
      });
    }

    // parent_story 검증
    if (!feature.parent_story) {
      result.warnings.push({
        path: `${basePath}.parent_story`,
        message: 'parent_story가 없습니다',
        severity: 'warning',
      });
    }
  });
}

// ============================================================
// 상태 전이 검증
// ============================================================

function validateStateTransitions(
  states: Feature['states'], 
  basePath: string, 
  result: ValidationResult
): void {
  const stateNames = new Set(states.map(s => s.name));

  states.forEach((state, index) => {
    if (!state.transitions || state.transitions.length === 0) {
      // 최종 상태가 아닌데 전이가 없으면 경고
      if (!['completed', 'error', 'done', 'finished'].includes(state.name)) {
        result.warnings.push({
          path: `${basePath}[${index}]`,
          message: `"${state.name}" 상태에서 나가는 전이가 없습니다`,
          severity: 'warning',
        });
      }
      return;
    }

    // 전이 대상이 유효한지 검증
    state.transitions.forEach((transition, tIndex) => {
      if (!stateNames.has(transition.target)) {
        result.errors.push({
          path: `${basePath}[${index}].transitions[${tIndex}]`,
          message: `전이 대상 "${transition.target}"이 정의되지 않았습니다`,
          severity: 'error',
        });
      }
    });
  });
}

// ============================================================
// Technical Spec 검증
// ============================================================

function validateTechnicalSpec(data: TechnicalSpec, result: ValidationResult): void {
  const spec = data.technical_spec;
  if (!spec) {
    result.errors.push({
      path: 'technical_spec',
      message: 'technical_spec 필드가 없습니다',
      severity: 'critical',
    });
    return;
  }

  // API 엔드포인트 검증
  if (spec.api_spec?.endpoints) {
    spec.api_spec.endpoints.forEach((endpoint, index) => {
      const basePath = `api_spec.endpoints[${index}]`;

      if (!endpoint.path) {
        result.errors.push({
          path: `${basePath}.path`,
          message: 'path가 없습니다',
          severity: 'error',
        });
      }

      if (!endpoint.method) {
        result.errors.push({
          path: `${basePath}.method`,
          message: 'method가 없습니다',
          severity: 'error',
        });
      }

      if (!endpoint.response?.success) {
        result.warnings.push({
          path: `${basePath}.response.success`,
          message: 'success 응답이 정의되지 않았습니다',
          severity: 'warning',
        });
      }

      if (!endpoint.response?.errors || endpoint.response.errors.length === 0) {
        result.warnings.push({
          path: `${basePath}.response.errors`,
          message: 'error 응답이 정의되지 않았습니다',
          severity: 'warning',
        });
      }
    });
  }

  // 데이터 모델 검증
  if (spec.data_model?.entities) {
    spec.data_model.entities.forEach((entity, index) => {
      if (!entity.name) {
        result.errors.push({
          path: `data_model.entities[${index}].name`,
          message: 'name이 없습니다',
          severity: 'error',
        });
      }

      if (!entity.attributes || entity.attributes.length === 0) {
        result.warnings.push({
          path: `data_model.entities[${index}].attributes`,
          message: 'attributes가 비어있습니다',
          severity: 'warning',
        });
      }
    });
  }
}

// ============================================================
// UI Spec 검증
// ============================================================

// QDS4 디자인 시스템에서 허용된 컴포넌트 목록
const QDS4_ALLOWED_COMPONENTS = new Set([
  // Buttons
  'Button', 'TextButton', 'IconButton', 'FloatingActionButton',
  // Forms
  'Checkbox', 'Checkmark', 'Radio', 'Switch',
  // Navigation
  'TopAppBar', 'Tabs', 'SegmentedControl',
  // Dialogs
  'AlertDialog', 'StandardDialog', 'FullScreenDialog', 'BottomSheet',
  // Feedback
  'Spinner', 'LoadingAnimation', 'Badge', 'Tag',
  // Layout
  'BottomFixedArea', 'Divider',
  // Utilities
  'Icon', 'Typography', 'Shadow', 'StateLayer', 'DesignSystemProvider',
]);

// QDS4 COLOR 토큰 목록
const QDS4_COLOR_TOKENS = new Set([
  // Gray scale
  'gray_0', 'gray_5', 'gray_10', 'gray_20', 'gray_30', 'gray_40',
  'gray_50', 'gray_60', 'gray_70', 'gray_80', 'gray_90', 'gray_95', 'gray_100',
  // Blue
  'blue_5', 'blue_10', 'blue_20', 'blue_30', 'blue_40', 'blue_50',
  'blue_60', 'blue_70', 'blue_80', 'blue_90', 'blue_95',
  // Orange
  'orange_5', 'orange_10', 'orange_20', 'orange_30', 'orange_40', 'orange_50',
  'orange_60', 'orange_70', 'orange_80', 'orange_90', 'orange_95',
  // Red
  'red_5', 'red_10', 'red_20', 'red_30', 'red_40', 'red_50',
  'red_60', 'red_70', 'red_80', 'red_90', 'red_95',
  // Yellow
  'yellow_5', 'yellow_10', 'yellow_20', 'yellow_30', 'yellow_40', 'yellow_50',
  'yellow_60', 'yellow_70', 'yellow_80', 'yellow_90', 'yellow_95',
  // Green
  'green_5', 'green_10', 'green_20', 'green_30', 'green_40', 'green_50',
  'green_60', 'green_70', 'green_80', 'green_90', 'green_95',
]);

// QDS4 Typography 토큰 목록
const QDS4_TYPOGRAPHY_TOKENS = new Set([
  'large_title',
  'title_1_strong', 'title_1',
  'title_2_strong', 'title_2',
  'title_3_strong', 'title_3',
  'body_1_strong', 'body_1',
  'body_2_strong', 'body_2',
  'caption_1', 'caption_2',
]);

function validateUiSpec(data: UiSpec, result: ValidationResult): void {
  const spec = data.ui_spec;
  if (!spec) {
    result.errors.push({
      path: 'ui_spec',
      message: 'ui_spec 필드가 없습니다',
      severity: 'critical',
    });
    return;
  }

  // ============================================================
  // 디자인 시스템 검증
  // ============================================================
  validateDesignSystem(spec, result);

  if (!spec.screens || spec.screens.length === 0) {
    result.warnings.push({
      path: 'ui_spec.screens',
      message: 'screens가 비어있습니다',
      severity: 'warning',
    });
    return;
  }

  const seenIds = new Set<string>();

  spec.screens.forEach((screen, index) => {
    const basePath = `screens[${index}]`;

    if (!screen.id) {
      result.errors.push({
        path: `${basePath}.id`,
        message: 'id가 없습니다',
        severity: 'error',
      });
    } else {
      if (seenIds.has(screen.id)) {
        result.errors.push({
          path: `${basePath}.id`,
          message: `ID "${screen.id}"가 중복됩니다`,
          severity: 'error',
        });
      }
      seenIds.add(screen.id);
    }

    if (!screen.route) {
      result.warnings.push({
        path: `${basePath}.route`,
        message: 'route가 없습니다',
        severity: 'warning',
      });
    }

    if (!screen.implements_features || screen.implements_features.length === 0) {
      result.warnings.push({
        path: `${basePath}.implements_features`,
        message: 'implements_features가 없습니다',
        severity: 'warning',
      });
    }

    // 컴포넌트 검증 (QDS4 디자인 시스템 준수 여부)
    if (screen.components) {
      validateScreenComponents(screen.components, `${basePath}.components`, result);
    }
  });
}

// ============================================================
// 디자인 시스템 설정 검증
// ============================================================

function validateDesignSystem(spec: any, result: ValidationResult): void {
  // design_system 필드 확인
  if (!spec.design_system) {
    result.warnings.push({
      path: 'ui_spec.design_system',
      message: 'design_system 필드가 없습니다. @qanda/qds4-web 사용을 명시하세요.',
      severity: 'warning',
      suggestion: 'design_system: { package: "@qanda/qds4-web", version: "^0.0.2" } 추가',
    });
    return;
  }

  const ds = spec.design_system;

  // 패키지 확인
  if (ds.package && ds.package !== '@qanda/qds4-web') {
    result.errors.push({
      path: 'ui_spec.design_system.package',
      message: `허용되지 않은 디자인 시스템입니다: "${ds.package}"`,
      severity: 'error',
      suggestion: '@qanda/qds4-web만 사용 가능합니다',
    });
  }

  // color_palette 검증
  if (ds.color_palette) {
    Object.entries(ds.color_palette).forEach(([key, value]) => {
      if (typeof value === 'string' && !QDS4_COLOR_TOKENS.has(value)) {
        // 하드코딩된 색상 검사 (#으로 시작하는 경우)
        if (value.startsWith('#')) {
          result.errors.push({
            path: `ui_spec.design_system.color_palette.${key}`,
            message: `하드코딩된 색상값 사용 금지: "${value}"`,
            severity: 'error',
            suggestion: 'COLOR 토큰을 사용하세요 (예: blue_50, gray_100)',
          });
        } else if (!QDS4_COLOR_TOKENS.has(value)) {
          result.warnings.push({
            path: `ui_spec.design_system.color_palette.${key}`,
            message: `알 수 없는 색상 토큰: "${value}"`,
            severity: 'warning',
            suggestion: 'qds4-web.yaml의 color_tokens 참조',
          });
        }
      }
    });
  }
}

// ============================================================
// 화면 컴포넌트 검증 (QDS4 준수)
// ============================================================

function validateScreenComponents(
  components: any[],
  basePath: string,
  result: ValidationResult
): void {
  components.forEach((component, index) => {
    const compPath = `${basePath}[${index}]`;

    // type 필드 검증 (QDS4 컴포넌트만 허용)
    if (component.type) {
      if (!QDS4_ALLOWED_COMPONENTS.has(component.type)) {
        // 일반적인 HTML 요소가 아닌 경우에만 경고
        const htmlElements = ['div', 'span', 'form', 'input', 'section', 'header', 'footer', 'nav', 'main', 'article'];
        if (!htmlElements.includes(component.type.toLowerCase())) {
          result.errors.push({
            path: `${compPath}.type`,
            message: `허용되지 않은 컴포넌트입니다: "${component.type}"`,
            severity: 'error',
            suggestion: `@qanda/qds4-web 컴포넌트만 사용하세요. 허용된 컴포넌트: Button, TopAppBar, BottomSheet 등`,
          });
        }
      }
    }

    // props에서 색상값 검증
    if (component.props) {
      validateComponentProps(component.props, `${compPath}.props`, result);
    }

    // 중첩된 컴포넌트가 있는 경우 재귀적으로 검증
    if (component.children && Array.isArray(component.children)) {
      validateScreenComponents(component.children, `${compPath}.children`, result);
    }
  });
}

// ============================================================
// 컴포넌트 Props 검증
// ============================================================

function validateComponentProps(
  props: Record<string, any>,
  basePath: string,
  result: ValidationResult
): void {
  Object.entries(props).forEach(([key, value]) => {
    // 색상 관련 props 검증
    if (['color', 'backgroundColor', 'borderColor', 'textColor'].includes(key)) {
      if (typeof value === 'string') {
        // 하드코딩된 색상 검사
        if (value.startsWith('#') || value.startsWith('rgb')) {
          result.errors.push({
            path: `${basePath}.${key}`,
            message: `하드코딩된 색상값 사용 금지: "${value}"`,
            severity: 'error',
            suggestion: 'COLOR 토큰을 사용하세요 (예: blue_50, gray_100)',
          });
        }
      }
    }

    // typography 관련 검증
    if (key === 'typography' && typeof value === 'string') {
      if (!QDS4_TYPOGRAPHY_TOKENS.has(value)) {
        result.warnings.push({
          path: `${basePath}.${key}`,
          message: `알 수 없는 타이포그래피 토큰: "${value}"`,
          severity: 'warning',
          suggestion: 'typography() 함수와 유효한 토큰 사용 (예: body_1, title_2)',
        });
      }
    }
  });
}

// ============================================================
// Task Queue 검증
// ============================================================

function validateTaskQueue(data: TaskQueue, result: ValidationResult): void {
  const queue = data.task_queue;
  if (!queue) {
    result.errors.push({
      path: 'task_queue',
      message: 'task_queue 필드가 없습니다',
      severity: 'critical',
    });
    return;
  }

  const seenIds = new Set<string>();
  const allTaskIds = new Set(queue.map(t => t.id));

  queue.forEach((task, index) => {
    const basePath = `task_queue[${index}]`;

    // ID 검증
    if (!task.id) {
      result.errors.push({
        path: `${basePath}.id`,
        message: 'id가 없습니다',
        severity: 'error',
      });
    } else {
      if (seenIds.has(task.id)) {
        result.errors.push({
          path: `${basePath}.id`,
          message: `ID "${task.id}"가 중복됩니다`,
          severity: 'error',
        });
      }
      seenIds.add(task.id);
    }

    // 의존성 검증
    if (task.dependencies) {
      task.dependencies.forEach((dep, depIndex) => {
        if (!allTaskIds.has(dep)) {
          result.errors.push({
            path: `${basePath}.dependencies[${depIndex}]`,
            message: `의존성 "${dep}"가 존재하지 않습니다`,
            severity: 'error',
          });
        }
      });

      // 순환 의존성 검사 (간단한 버전)
      if (task.id && task.dependencies.includes(task.id)) {
        result.errors.push({
          path: `${basePath}.dependencies`,
          message: '자기 자신을 의존하고 있습니다',
          severity: 'error',
        });
      }
    }

    // feature_id 검증
    if (!task.feature_id) {
      result.warnings.push({
        path: `${basePath}.feature_id`,
        message: 'feature_id가 없습니다',
        severity: 'warning',
      });
    }

    // acceptance_criteria 검증
    if (!task.acceptance_criteria || task.acceptance_criteria.length === 0) {
      result.warnings.push({
        path: `${basePath}.acceptance_criteria`,
        message: 'acceptance_criteria가 없습니다',
        severity: 'warning',
      });
    }
  });

  // 순환 의존성 상세 검사
  const cycles = detectCycles(queue);
  cycles.forEach(cycle => {
    result.errors.push({
      path: 'task_queue',
      message: `순환 의존성 발견: ${cycle.join(' → ')}`,
      severity: 'error',
    });
  });
}

// ============================================================
// Traceability 검증
// ============================================================

function validateTraceability(data: Traceability, result: ValidationResult): void {
  const trace = data.traceability;
  if (!trace) {
    result.errors.push({
      path: 'traceability',
      message: 'traceability 필드가 없습니다',
      severity: 'critical',
    });
    return;
  }

  // 기본 구조 확인
  if (!trace.requirements_to_features) {
    result.warnings.push({
      path: 'traceability.requirements_to_features',
      message: 'requirements_to_features가 없습니다',
      severity: 'warning',
    });
  }

  if (!trace.features_to_technical) {
    result.warnings.push({
      path: 'traceability.features_to_technical',
      message: 'features_to_technical가 없습니다',
      severity: 'warning',
    });
  }
}

// ============================================================
// 크로스 파일 참조 검증
// ============================================================

function validateCrossFileReferences(projectRoot: string): ValidationResult[] {
  const results: ValidationResult[] = [];

  // 모든 스펙 파일 읽기
  const requirements = readYaml<Requirements>(getSpecFilePath(projectRoot, 'requirements'));
  const functionalSpec = readYaml<FunctionalSpec>(getSpecFilePath(projectRoot, 'functional-spec'));
  const taskQueue = readYaml<TaskQueue>(getSpecFilePath(projectRoot, 'task-queue'));

  // 정의된 ID들 수집
  const definedUserStories = new Set<string>();
  const definedFeatures = new Set<string>();
  const definedTasks = new Set<string>();

  if (requirements?.requirements?.user_stories) {
    requirements.requirements.user_stories.forEach(us => {
      if (us.id) definedUserStories.add(us.id);
    });
  }

  if (functionalSpec?.functional_spec?.features) {
    functionalSpec.functional_spec.features.forEach(f => {
      if (f.id) definedFeatures.add(f.id);
    });
  }

  if (taskQueue?.task_queue) {
    taskQueue.task_queue.forEach(t => {
      if (t.id) definedTasks.add(t.id);
    });
  }

  // 참조 무결성 검증
  const crossFileResult: ValidationResult = {
    valid: true,
    file: '크로스 파일 참조',
    errors: [],
    warnings: [],
  };

  // Feature → User Story 참조 검증
  if (functionalSpec?.functional_spec?.features) {
    functionalSpec.functional_spec.features.forEach((f, index) => {
      if (f.parent_story && !definedUserStories.has(f.parent_story)) {
        crossFileResult.errors.push({
          path: `functional-spec.yaml#features[${index}].parent_story`,
          message: `"${f.parent_story}"가 requirements.yaml에 정의되지 않았습니다`,
          severity: 'error',
        });
      }
    });
  }

  // Task → Feature 참조 검증
  if (taskQueue?.task_queue) {
    taskQueue.task_queue.forEach((t, index) => {
      if (t.feature_id && !definedFeatures.has(t.feature_id)) {
        crossFileResult.errors.push({
          path: `task-queue.yaml#task_queue[${index}].feature_id`,
          message: `"${t.feature_id}"가 functional-spec.yaml에 정의되지 않았습니다`,
          severity: 'error',
        });
      }
    });
  }

  if (crossFileResult.errors.length > 0) {
    crossFileResult.valid = false;
  }

  // 결과 출력
  const icon = crossFileResult.errors.length > 0 ? chalk.red('✗') : chalk.green('✓');
  console.log(`   ${icon} 크로스 파일 참조`);

  results.push(crossFileResult);
  return results;
}

// ============================================================
// 헬퍼 함수들
// ============================================================

function isGivenWhenThen(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    (lower.includes('given') && lower.includes('when') && lower.includes('then')) ||
    (lower.includes('주어') && lower.includes('때') && lower.includes('면'))
  );
}

function detectCycles(tasks: TaskQueue['task_queue']): string[][] {
  const cycles: string[][] = [];
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(taskId: string, path: string[]): void {
    if (recursionStack.has(taskId)) {
      const cycleStart = path.indexOf(taskId);
      cycles.push([...path.slice(cycleStart), taskId]);
      return;
    }

    if (visited.has(taskId)) return;

    visited.add(taskId);
    recursionStack.add(taskId);

    const task = taskMap.get(taskId);
    if (task?.dependencies) {
      for (const dep of task.dependencies) {
        dfs(dep, [...path, taskId]);
      }
    }

    recursionStack.delete(taskId);
  }

  for (const task of tasks) {
    if (task.id && !visited.has(task.id)) {
      dfs(task.id, []);
    }
  }

  return cycles;
}

// ============================================================
// 결과 출력
// ============================================================

function printResults(results: ValidationResult[], projectRoot: string): void {
  console.log(chalk.blue('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.blue('📊 검증 결과 요약'));
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  const validFiles = results.filter(r => r.valid).length;

  // 전체 상태
  if (totalErrors === 0) {
    console.log(chalk.green(`✅ 전체 결과: 통과`));
  } else {
    console.log(chalk.red(`❌ 전체 결과: 실패`));
  }

  console.log(chalk.gray(`   파일: ${validFiles}/${results.length} 유효`));
  console.log(chalk.gray(`   에러: ${totalErrors}개`));
  console.log(chalk.gray(`   경고: ${totalWarnings}개\n`));

  // 에러 상세
  if (totalErrors > 0) {
    console.log(chalk.red('🔴 에러 목록:\n'));
    results.forEach(r => {
      r.errors.forEach(e => {
        console.log(chalk.red(`   ${r.file}#${e.path}`));
        console.log(chalk.gray(`      ${e.message}`));
        if (e.suggestion) {
          console.log(chalk.blue(`      💡 ${e.suggestion}`));
        }
        console.log();
      });
    });
  }

  // 경고 상세
  if (totalWarnings > 0) {
    console.log(chalk.yellow('🟡 경고 목록:\n'));
    results.forEach(r => {
      r.warnings.forEach(w => {
        console.log(chalk.yellow(`   ${r.file}#${w.path}`));
        console.log(chalk.gray(`      ${w.message}`));
        if (w.suggestion) {
          console.log(chalk.blue(`      💡 ${w.suggestion}`));
        }
        console.log();
      });
    });
  }
}

// ============================================================
// 실행
// ============================================================

main().catch(console.error);