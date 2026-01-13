/**
 * SDD System 스펙 파일 타입 정의
 */

// ============================================================
// Discovery 단계 타입
// ============================================================

export interface IdeaCrystal {
  idea_crystal: {
    core_value: string;
    target_user: string;
    existing_alternatives: Array<{
      name: string;
      limitation: string;
    }>;
    differentiation_hypothesis: string;
  };
  metadata: Metadata;
}

export interface ProblemDefinition {
  problem_definition: {
    as_is_workflow: Array<{
      step: string;
      pain_point: string | null;
      time_spent: string;
    }>;
    to_be_workflow: Array<{
      step: string;
      improvement: string;
    }>;
    success_metrics: Array<{
      metric: string;
      current: string | number;
      target: string | number;
      measurement_method: string;
    }>;
  };
  metadata: Metadata;
}

export interface Requirements {
  requirements: {
    user_stories: UserStory[];
    non_functional: {
      performance: Array<{ requirement: string; threshold: string }>;
      security: Array<{ requirement: string }>;
      accessibility: Array<{ requirement: string }>;
    };
    constraints: {
      technical: string[];
      business: string[];
      legal: string[];
    };
  };
  metadata: Metadata;
}

export interface UserStory {
  id: string;
  as_a: string;
  i_want: string;
  so_that: string;
  priority: 'must' | 'should' | 'could' | 'wont';
  acceptance_criteria: string[];
}

// ============================================================
// Specification 단계 타입
// ============================================================

export interface FunctionalSpec {
  functional_spec: {
    features: Feature[];
  };
  metadata: Metadata;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  parent_story: string;
  dependencies: string[];
  states: State[];
  inputs: Array<{
    name: string;
    type: string;
    validation: string;
    required?: boolean;
  }>;
  outputs: Array<{
    name: string;
    type: string;
    format?: string;
  }>;
  error_cases: ErrorCase[];
  edge_cases: Array<{
    scenario: string;
    expected_behavior: string;
  }>;
  performance?: Array<{
    metric: string;
    threshold: string;
  }>;
}

export interface State {
  name: string;
  description?: string;
  transitions: Array<{
    trigger: string;
    target: string;
    condition: string | null;
  }>;
}

export interface ErrorCase {
  condition: string;
  error_code: string;
  user_message: string;
  recovery_action: string;
}

export interface TechnicalSpec {
  technical_spec: {
    architecture: {
      type: string;
      diagram: string;
      components: Array<{
        name: string;
        responsibility: string;
        technology: string;
        interfaces: {
          provides: string[];
          consumes: string[];
        };
      }>;
    };
    data_model: {
      entities: Entity[];
    };
    api_spec: {
      base_url: string;
      endpoints: Endpoint[];
    };
    adrs: Array<{
      id: string;
      title: string;
      status: string;
      reference: string;
    }>;
  };
  metadata: Metadata;
}

export interface Entity {
  name: string;
  description?: string;
  attributes: Array<{
    name: string;
    type: string;
    constraints: string;
  }>;
  relationships: Array<{
    type: '1:1' | '1:N' | 'M:N';
    target: string;
    description?: string;
  }>;
}

export interface Endpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  auth_required?: boolean;
  request: {
    headers?: Record<string, string>;
    params?: Record<string, string>;
    query?: Record<string, string>;
    body?: Record<string, unknown>;
  };
  response: {
    success: {
      status: number;
      body: Record<string, unknown>;
    };
    errors: Array<{
      status: number;
      code: string;
      body: Record<string, unknown>;
    }>;
  };
}

export interface UiSpec {
  ui_spec: {
    design_tokens?: {
      colors: Record<string, string>;
      spacing: { unit: string };
      breakpoints: Record<string, string>;
    };
    screens: Screen[];
  };
  metadata: Metadata;
}

export interface Screen {
  id: string;
  name: string;
  route: string;
  description: string;
  implements_features: string[];
  components: Component[];
  interactions: Array<{
    trigger: string;
    action: string;
    feedback: string;
  }>;
  responsive: {
    mobile: string;
    tablet: string;
    desktop: string;
  };
  accessibility: {
    focus_order: string[];
    aria_labels: Record<string, string>;
    keyboard_shortcuts?: Record<string, string>;
  };
}

export interface Component {
  id: string;
  type: string;
  description: string;
  props?: Record<string, string>;
  states: Array<{
    name: string;
    appearance: string;
    behavior: string;
  }>;
}

// ============================================================
// Implementation 단계 타입
// ============================================================

export interface TaskQueue {
  task_queue: Task[];
  metadata: Metadata;
}

export interface Task {
  id: string;
  feature_id: string;
  name: string;
  description?: string;
  type: 'frontend' | 'backend' | 'fullstack' | 'infra';
  priority: number;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  spec_refs: {
    functional?: string;
    technical?: string;
    ui?: string;
  };
  acceptance_criteria: string[];
  expected_outputs?: Array<{
    path: string;
    type: string;
  }>;
  estimated_complexity?: 'low' | 'medium' | 'high';
  completed_at?: string;
}

export interface ImplementationResult {
  implementation_result: {
    task_id: string;
    feature_id: string;
    completed_at: string;
    implemented_by: string;
    duration_minutes?: number;
    files_created: Array<{
      path: string;
      lines: number;
      purpose: string;
    }>;
    files_modified: Array<{
      path: string;
      changes: string;
    }>;
    test_results: {
      total: number;
      passed: number;
      failed: number;
      skipped?: number;
      coverage?: {
        statements: number;
        branches: number;
        functions: number;
        lines: number;
      };
    };
    spec_compliance: {
      states: Array<{ name: string; implemented: boolean }>;
      error_cases: Array<{ code: string; implemented: boolean }>;
      edge_cases: Array<{ scenario: string; implemented: boolean; notes?: string }>;
    };
    deviations: Deviation[];
    verification?: {
      verified_at: string;
      compliance_rate: number;
      passed: number;
      failed: number;
      warnings: number;
      issues: Array<{
        type: string;
        item: string;
        status: 'fixed' | 'pending' | 'wont_fix';
        expected?: unknown;
        actual?: unknown;
      }>;
    };
    next_tasks: {
      unblocked: string[];
      notes?: string;
    };
  };
}

export interface Deviation {
  spec_item: string;
  actual: string;
  reason: string;
  approved: boolean;
  approved_by?: string;
  approved_at?: string;
}

// ============================================================
// Traceability 타입
// ============================================================

export interface Traceability {
  traceability: {
    requirements_to_features: Record<string, string[]>;
    features_to_technical: Record<string, {
      api_endpoints: string[];
      data_models: string[];
      components: string[];
    }>;
    features_to_ui: Record<string, string[]>;
    features_to_code: Record<string, {
      files: string[];
      tests: string[];
    }>;
  };
  reverse_mappings?: {
    code_to_features: Record<string, string[]>;
    features_to_requirements: Record<string, string[]>;
  };
  metadata: Metadata;
}

// ============================================================
// Changelog 타입
// ============================================================

export interface Changelog {
  changelog: ChangelogEntry[];
  metadata: {
    current_version: string;
    created_at: string;
    last_updated: string;
  };
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: Array<{
    type: 'feature' | 'modification' | 'bugfix' | 'breaking' | 'initial';
    id?: string;
    description: string;
    affected_specs?: string[];
    affected_code?: string[];
    tasks?: string[];
    adr?: string;
    reason?: string;
    breaking?: boolean;
    migration_guide?: string;
    root_cause?: string;
    regression_test?: string;
  }>;
}

// ============================================================
// 공통 타입
// ============================================================

export interface Metadata {
  created_at: string;
  author?: string;
  status?: 'draft' | 'reviewed' | 'approved';
  last_updated?: string;
  depends_on?: string[];
}

// ============================================================
// 검증 결과 타입
// ============================================================

export interface ValidationResult {
  valid: boolean;
  file: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'critical' | 'error' | 'warning';
  suggestion?: string;
}

// ============================================================
// 영향 분석 타입
// ============================================================

export interface ImpactAnalysis {
  change: {
    file: string;
    path: string;
    from: unknown;
    to: unknown;
  };
  direct_impacts: Array<{
    file: string;
    items: string[];
    reason: string;
  }>;
  cascading_impacts: Array<{
    file: string;
    items?: string[];
    reason: string;
  }>;
  affected_tests: string[];
  risk_level: 'low' | 'medium' | 'high';
  recommendation: string;
}