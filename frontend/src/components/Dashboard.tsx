import type { AgentResult, CrossValidation, SynthesisResult, Phase } from '../types';

interface Props {
  phase: Phase;
  problem: string;
  originalProblem?: string;
  agents: AgentResult[];
  crossValidation: CrossValidation | null;
  synthesis: SynthesisResult | null;
  onNewDecision: () => void;
}

export function Dashboard({ phase, problem, originalProblem, agents, crossValidation, synthesis, onNewDecision }: Props) {
  const doneCount = agents.filter(a => a.done).length;

  return (
    <div className="dashboard">
      {/* Problem summary */}
      <div className="problem-summary">
        <h2>决策分析</h2>
        <p className="problem-text">{problem}</p>
        {originalProblem && originalProblem !== problem && (
          <details className="original-input">
            <summary>原始输入</summary>
            <p>{originalProblem}</p>
          </details>
        )}
        <div className="status-row">
          <div className="phase-badge" data-phase={phase}>
            {phase === 'intent' && '理解意图中...'}
            {phase === 'refining' && '优化分析方案...'}
            {phase === 'reasoning' && `Agent 推理中... (${doneCount}/${agents.length})`}
            {phase === 'validation' && '交叉验证中...'}
            {phase === 'synthesis' && '综合决策中...'}
            {phase === 'done' && '分析完成'}
          </div>
          {phase === 'done' && (
            <button className="btn-primary" onClick={onNewDecision}>
              新建决策
            </button>
          )}
        </div>
      </div>

      {/* Agent cards */}
      <div className="agent-grid">
        {agents.map(agent => (
          <AgentMiniCard key={agent.agent} agent={agent} />
        ))}
      </div>

      {/* Cross Validation */}
      {crossValidation && (
        <div className="cv-panel">
          <h3>🔍 交叉验证结果</h3>
          <div className="cv-grid">
            <div className="cv-section agreements">
              <h4>✅ 共识点</h4>
              <ul>
                {crossValidation.agreements.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
            <div className="cv-section conflicts">
              <h4>⚡ 分歧点</h4>
              <ul>
                {crossValidation.conflicts.map((c, i) => (
                  <li key={i}>
                    {c.agent_a && c.agent_b
                      ? `[${c.agent_a} vs ${c.agent_b}] `
                      : ''}
                    {c.point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="cv-section risks">
              <h4>⚠️ 风险标记</h4>
              <ul>
                {crossValidation.risk_flags.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Synthesis */}
      {synthesis && (
        <div className="synthesis-panel">
          <h3>⚖ 综合决策</h3>
          <div className="synthesis-content markdown-body"
               dangerouslySetInnerHTML={{ __html: renderMarkdown(synthesis.recommendation) }} />

          {synthesis.options.length > 0 && (
            <div className="options-grid">
              {synthesis.options.map((opt, i) => (
                <div key={i} className="option-card">
                  <div className="option-header">
                    <span className="option-name">{opt.option}</span>
                    <span className="option-score">{opt.score}/100</span>
                  </div>
                  <div className="option-score-bar">
                    <div className="option-score-fill" style={{ width: `${opt.score}%` }} />
                  </div>
                  {opt.pros.length > 0 && (
                    <div className="option-pros">
                      <span className="label-good">优势</span>
                      <ul>{opt.pros.map((p, j) => <li key={j}>{p}</li>)}</ul>
                    </div>
                  )}
                  {opt.cons.length > 0 && (
                    <div className="option-cons">
                      <span className="label-bad">劣势</span>
                      <ul>{opt.cons.map((c, j) => <li key={j}>{c}</li>)}</ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {synthesis.next_steps.length > 0 && (
            <div className="next-steps">
              <h4>📋 下一步行动</h4>
              <ol>
                {synthesis.next_steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="confidence-bar">
            <span>综合置信度</span>
            <div className="confidence-track">
              <div
                className="confidence-fill"
                style={{ width: `${(synthesis.confidence * 100).toFixed(0)}%` }}
              />
            </div>
            <span className="confidence-value">{(synthesis.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentMiniCard({ agent }: { agent: AgentResult }) {
  return (
    <div className={`agent-mini-card ${agent.done ? 'done' : 'running'}`}>
      <div className="agent-mini-header">
        <span className="agent-icon">{agent.icon}</span>
        <span className="agent-role">{agent.role_label}</span>
        {agent.done && (
          <span className="agent-confidence">
            {(agent.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>
      {agent.done ? (
        <ul className="agent-insights">
          {agent.key_insights.map((ins, i) => (
            <li key={i}>{ins}</li>
          ))}
        </ul>
      ) : (
        <div className="agent-loading">
          <span className="pulse" />
          推理中...
        </div>
      )}
    </div>
  );
}

// Simple markdown → HTML renderer
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}
