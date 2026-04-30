import { useState } from 'react';
import type { AgentResult, Phase } from '../types';

interface Props {
  agents: AgentResult[];
  phase: Phase;
}

const PREPROCESS_NODES = [
  { id: 'intent', icon: '🧠', label: '意图理解' },
  { id: 'optimize', icon: '⚡', label: '方案优化' },
];

export function ReasonChain({ agents, phase }: Props) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  if (agents.length === 0) return null;

  // Determine pre-processing node status
  const preNodes = PREPROCESS_NODES.map(node => {
    let done = false;
    if (node.id === 'intent') {
      done = ['refining', 'reasoning', 'validation', 'synthesis', 'done'].includes(phase);
    } else if (node.id === 'optimize') {
      done = ['reasoning', 'validation', 'synthesis', 'done'].includes(phase);
    }
    return { ...node, done };
  });

  return (
    <div className="reason-chain">
      <h3>推理链路</h3>

      <div className="chain-flow">
        {/* Pre-processing nodes */}
        {preNodes.map((node, i) => (
          <div key={node.id} className="chain-node-wrap">
            {i > 0 && (
              <div className={`chain-connector ${node.done ? 'active' : ''}`}>
                <div className="connector-line" />
              </div>
            )}
            <div className={`chain-node ${node.done ? 'done' : 'running'}`}>
              <div className="node-header">
                <span className="node-icon">{node.icon}</span>
                <span className="node-role">{node.label}</span>
                {node.done ? (
                  <span className="node-check">✓</span>
                ) : (
                  <span className="node-spinner" />
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Agent nodes */}
        {agents.map((agent, i) => (
          <div key={agent.agent} className="chain-node-wrap">
            {/* Connector line */}
            <div className={`chain-connector ${agent.done ? 'active' : ''}`}>
              <div className="connector-line" />
            </div>

            <div
              className={`chain-node ${agent.done ? 'done' : 'running'}`}
              onClick={() => setExpandedAgent(expandedAgent === agent.agent ? null : agent.agent)}
            >
              <div className="node-header">
                <span className="node-icon">{agent.icon}</span>
                <span className="node-role">{agent.role_label}</span>
                {agent.done ? (
                  <span className="node-check">✓</span>
                ) : (
                  <span className="node-spinner" />
                )}
              </div>

              {agent.done && (
                <div className="node-meta">
                  <span className="node-confidence">
                    置信度 {(agent.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>

            {/* Expanded reasoning */}
            {expandedAgent === agent.agent && agent.done && (
              <div className="node-detail">
                <div className="detail-content markdown-body"
                     dangerouslySetInnerHTML={{ __html: renderReasoning(agent.reasoning) }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Phase indicator */}
      {phase !== 'done' && (
        <div className="chain-phase-indicator">
          <span className="phase-dot active" />
          {phase === 'intent' && '理解意图中'}
          {phase === 'refining' && '优化方案中'}
          {phase === 'reasoning' && 'Agent 并行推理'}
          {phase === 'validation' && '交叉验证'}
          {phase === 'synthesis' && '综合决策'}
        </div>
      )}
    </div>
  );
}

function renderReasoning(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}
