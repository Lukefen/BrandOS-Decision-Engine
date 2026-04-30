import { useState } from 'react';
import type { IntentResult, OptimizedPrompt, Phase } from '../types';

interface Props {
  phase: Phase;
  intentResult: IntentResult | null;
  optimizedPrompt: OptimizedPrompt | null;
  documentParsed: boolean;
}

export function ThinkingProcess({ phase, intentResult, optimizedPrompt, documentParsed }: Props) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const steps = [
    {
      id: 'intent',
      label: '意图理解',
      icon: '🧠',
      status: getStepStatus('intent', phase, intentResult),
      result: intentResult,
    },
    ...(documentParsed ? [{
      id: 'document',
      label: '文档解析',
      icon: '📄',
      status: getStepStatus('document', phase, intentResult),
      result: null,
    }] : []),
    {
      id: 'optimize',
      label: '方案优化',
      icon: '⚡',
      status: getStepStatus('optimize', phase, intentResult),
      result: optimizedPrompt,
    },
    {
      id: 'agents',
      label: '多专家分析',
      icon: '🤖',
      status: getStepStatus('agents', phase, intentResult),
      result: null,
    },
  ];

  return (
    <div className="thinking-process">
      <div className="thinking-header">
        <span className="thinking-icon">🔄</span>
        <span>AI 思考过程</span>
      </div>

      <div className="thinking-steps">
        {steps.map((step, i) => (
          <div key={step.id} className="thinking-step">
            {/* Connector */}
            {i > 0 && (
              <div className={`step-connector ${step.status === 'done' || step.status === 'running' ? 'active' : ''}`} />
            )}

            {/* Step node */}
            <div
              className={`step-node ${step.status}`}
              onClick={() => step.result && setExpandedStep(expandedStep === step.id ? null : step.id)}
            >
              <div className="step-dot-wrap">
                <div className={`step-dot ${step.status}`} />
              </div>

              <div className="step-info">
                <div className="step-label">
                  <span className="step-icon">{step.icon}</span>
                  <span>{step.label}</span>
                </div>

                {step.status === 'running' && (
                  <span className="step-status-text running">处理中...</span>
                )}

                {step.status === 'done' && step.id === 'intent' && intentResult && (
                  <span className="step-status-text done">
                    {getIntentTypeLabel(intentResult.intent_type)}
                  </span>
                )}

                {step.status === 'done' && step.id === 'optimize' && optimizedPrompt && (
                  <span className="step-status-text done">已优化</span>
                )}

                {step.status === 'done' && step.id === 'agents' && (
                  <span className="step-status-text done">进行中</span>
                )}
              </div>
            </div>

            {/* Expanded detail */}
            {expandedStep === step.id && step.result && (
              <div className="step-detail">
                {step.id === 'intent' && intentResult && (
                  <div className="detail-content">
                    <p><strong>摘要：</strong>{intentResult.summary}</p>
                    {intentResult.extracted_problem && (
                      <p><strong>提取的问题：</strong>{intentResult.extracted_problem}</p>
                    )}
                    {intentResult.extracted_context && (
                      <p><strong>提取的背景：</strong>{intentResult.extracted_context.slice(0, 200)}</p>
                    )}
                  </div>
                )}
                {step.id === 'optimize' && optimizedPrompt && (
                  <div className="detail-content">
                    {optimizedPrompt.optimization_notes && (
                      <p><strong>优化说明：</strong>{optimizedPrompt.optimization_notes}</p>
                    )}
                    <p><strong>优化后问题：</strong>{optimizedPrompt.refined_problem.slice(0, 200)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function getStepStatus(
  stepId: string,
  phase: Phase,
  intentResult: IntentResult | null,
): 'pending' | 'running' | 'done' {
  if (phase === 'input') return 'pending';

  if (stepId === 'intent') {
    if (phase === 'intent') return 'running';
    if (intentResult) return 'done';
    return 'pending';
  }

  if (stepId === 'document') {
    if (phase === 'intent' && intentResult?.intent_type === 'document_brief') return 'running';
    if (phase !== 'intent' && intentResult?.intent_type === 'document_brief') return 'done';
    return 'pending';
  }

  if (stepId === 'optimize') {
    if (phase === 'refining') return 'running';
    if (['reasoning', 'validation', 'synthesis', 'done'].includes(phase)) return 'done';
    return 'pending';
  }

  if (stepId === 'agents') {
    if (['reasoning', 'validation', 'synthesis', 'done'].includes(phase)) return phase === 'reasoning' ? 'running' : 'done';
    return 'pending';
  }

  return 'pending';
}

function getIntentTypeLabel(intentType: string): string {
  const labels: Record<string, string> = {
    vague_idea: '模糊想法',
    structured_problem: '结构化问题',
    document_brief: '文档方案',
  };
  return labels[intentType] || intentType;
}
