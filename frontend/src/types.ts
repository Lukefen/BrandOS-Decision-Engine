// ---- Intent Detection ----
export type IntentType = 'vague_idea' | 'structured_problem' | 'document_brief';

export interface IntentResult {
  intent_type: IntentType;
  summary: string;
  extracted_problem: string;
  extracted_context: string;
  extracted_constraints: string;
  needs_clarification: boolean;
  clarification_questions: string[];
}

// ---- Prompt Optimization ----
export interface OptimizedPrompt {
  refined_problem: string;
  refined_context: string;
  refined_constraints: string;
  optimization_notes: string;
}

// ---- Chat Message ----
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    intent?: IntentResult;
    optimized?: OptimizedPrompt;
    isQuestion?: boolean;
    questions?: string[];
  };
}

// ---- Decision Events ----
export interface DecisionEvent {
  type:
    | 'intent_detecting'
    | 'intent_detected'
    | 'clarification_needed'
    | 'document_parsed'
    | 'prompt_refining'
    | 'prompt_refined'
    | 'phase'
    | 'agent_start'
    | 'agent_done'
    | 'cross_validation'
    | 'synthesis'
    | 'done'
    | 'error';
  agent?: string;
  role_label?: string;
  icon?: string;
  content?: string;
  key_insights?: string[];
  confidence?: number;
  cross_validation?: CrossValidation;
  synthesis?: SynthesisResult;
  message?: string;
  intent_result?: IntentResult;
  optimized_prompt?: OptimizedPrompt;
  clarification_questions?: string[];
}

export interface CrossValidation {
  agreements: string[];
  conflicts: { point: string; agent_a?: string; agent_b?: string }[];
  risk_flags: string[];
}

export interface SynthesisResult {
  recommendation: string;
  options: { option: string; pros: string[]; cons: string[]; score: number }[];
  next_steps: string[];
  confidence: number;
}

export interface AgentResult {
  agent: string;
  role_label: string;
  icon: string;
  reasoning: string;
  key_insights: string[];
  confidence: number;
  done: boolean;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  problem: string;
  context: string;
  agents: AgentResult[];
  cross_validation: CrossValidation;
  synthesis: SynthesisResult;
}

export type Phase =
  | 'input'
  | 'intent'
  | 'clarifying'
  | 'refining'
  | 'reasoning'
  | 'validation'
  | 'synthesis'
  | 'done';
