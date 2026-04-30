import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, IntentResult } from '../types';

interface Props {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  awaitingClarification: boolean;
  clarificationQuestions: string[];
  onClarificationResponse: (answers: string[]) => void;
  isProcessing: boolean;
}

const DEMOS = [
  {
    label: '品牌定位 · 新消费饮品',
    text: '一个新兴健康饮品品牌想进入中国市场，目标人群为 25-35 岁注重健康的都市白领。品牌主打「天然、低糖、功能+」概念。如何制定品牌定位和市场进入策略？竞争环境：元气森林、奈雪的茶等已占据一定市场。产品：含益生菌的功能性茶饮。预算：A轮融资 5000 万人民币。',
  },
  {
    label: '品牌升级 · 传统制造转型',
    text: '一家 30 年历史的五金工具制造商想从 B2B 代工转型为自有品牌，进军消费级 DIY 工具市场。年营收 2 亿人民币，80% 来自海外代工。创始人希望用 3 年时间在国内建立品牌认知。产品品质对标博世/牧田。如何重塑品牌形象？',
  },
  {
    label: '品牌危机 · 食品安全事件',
    text: '一家知名宠物食品品牌因工厂卫生问题被媒体曝光，社交媒体出现大量负面声量。品牌有 8 年历史，年销售额 10 亿，用户基数 200 万。事件发生在代工厂而非自有工厂。如何制定品牌危机应对策略？',
  },
];

export function ChatInterface({
  messages,
  onSendMessage,
  awaitingClarification,
  clarificationQuestions,
  onClarificationResponse,
  isProcessing,
}: Props) {
  const [inputText, setInputText] = useState('');
  const [clarificationAnswers, setClarificationAnswers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // Initialize clarification answers when questions arrive
  useEffect(() => {
    if (clarificationQuestions.length > 0) {
      setClarificationAnswers(clarificationQuestions.map(() => ''));
    }
  }, [clarificationQuestions]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [inputText]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || isProcessing) return;
    onSendMessage(text);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClarificationSubmit = () => {
    const validAnswers = clarificationAnswers.filter(a => a.trim());
    if (validAnswers.length === 0) return;
    onClarificationResponse(validAnswers);
    setClarificationAnswers([]);
  };

  const handleDemoClick = (text: string) => {
    setInputText(text);
    textareaRef.current?.focus();
  };

  const getIntentBadge = (intent: IntentResult) => {
    const badges: Record<string, { label: string; className: string }> = {
      vague_idea: { label: '模糊想法', className: 'vague' },
      structured_problem: { label: '结构化问题', className: 'structured' },
      document_brief: { label: '文档方案', className: 'document' },
    };
    return badges[intent.intent_type] || badges.structured_problem;
  };

  return (
    <div className="chat-container">
      {/* Messages area */}
      <div className="chat-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`chat-bubble ${msg.role}`}>
            <div className="bubble-content">
              {msg.role === 'assistant' && msg.metadata?.intent && (
                <div className="intent-result">
                  {(() => {
                    const badge = getIntentBadge(msg.metadata.intent);
                    return <span className={`intent-badge ${badge.className}`}>{badge.label}</span>;
                  })()}
                  <p className="intent-summary">{msg.metadata.intent.summary}</p>
                </div>
              )}
              <p>{msg.content}</p>
              {msg.metadata?.isQuestion && msg.metadata.questions && (
                <div className="clarification-inline">
                  {msg.metadata.questions.map((q, i) => (
                    <div key={i} className="clarification-question">{q}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isProcessing && !awaitingClarification && (
          <div className="chat-bubble assistant">
            <div className="bubble-content thinking">
              <span className="thinking-dots">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Clarification input */}
      {awaitingClarification && clarificationQuestions.length > 0 && (
        <div className="clarification-panel">
          <div className="clarification-header">请补充以下信息，帮助我更好地理解你的需求：</div>
          {clarificationQuestions.map((q, i) => (
            <div key={i} className="clarification-field">
              <label>{q}</label>
              <textarea
                value={clarificationAnswers[i] || ''}
                onChange={e => {
                  const updated = [...clarificationAnswers];
                  updated[i] = e.target.value;
                  setClarificationAnswers(updated);
                }}
                placeholder="请输入你的回答..."
                rows={2}
              />
            </div>
          ))}
          <button
            className="btn-primary btn-clarification-submit"
            onClick={handleClarificationSubmit}
            disabled={clarificationAnswers.every(a => !a.trim())}
          >
            提交补充信息
          </button>
        </div>
      )}

      {/* Input area */}
      {!awaitingClarification && (
        <div className="chat-input-area">
          {/* Demo chips */}
          {messages.length <= 1 && (
            <div className="demo-chips-row">
              {DEMOS.map((demo, i) => (
                <button key={i} className="demo-chip" onClick={() => handleDemoClick(demo.text)}>
                  {demo.label}
                </button>
              ))}
            </div>
          )}

          <div className="input-row">
            <textarea
              ref={textareaRef}
              className="chat-input"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="描述你的品牌决策问题...（支持粘贴文档）"
              rows={1}
              disabled={isProcessing}
            />
            <button
              className="btn-send"
              onClick={handleSend}
              disabled={!inputText.trim() || isProcessing}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </button>
          </div>

          <div className="input-hint">
            按 Enter 发送 · Shift+Enter 换行 · 可直接粘贴品牌Brief文档
          </div>
        </div>
      )}
    </div>
  );
}
