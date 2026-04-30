import { useState, useCallback, useRef } from 'react';
import type {
  DecisionEvent, AgentResult, CrossValidation, SynthesisResult,
  Phase, ChatMessage, IntentResult, OptimizedPrompt,
} from './types';
import { connectDecisionSocket, sendClarificationResponse, fetchHistory, deleteHistoryEntry } from './api';
import { Dashboard } from './components/Dashboard';
import { DecisionInput } from './components/DecisionInput';
import { ChatInterface } from './components/ChatInterface';
import { ThinkingProcess } from './components/ThinkingProcess';
import { ReasonChain } from './components/ReasonChain';
import { HistoryPanel } from './components/HistoryPanel';
import { ApiSettings } from './components/ApiSettings';

let msgCounter = 0;
function nextId() { return `msg_${++msgCounter}_${Date.now()}`; }

export default function App() {
  // Core state
  const [phase, setPhase] = useState<Phase>('input');
  const [problem, setProblem] = useState('');
  const [agents, setAgents] = useState<AgentResult[]>([]);
  const [crossValidation, setCrossValidation] = useState<CrossValidation | null>(null);
  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(null);
  const [error, setError] = useState('');

  // Conversational state
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: nextId(),
    role: 'assistant',
    content: '你好！我是 BrandOS 决策助手。描述你的品牌决策问题，我会理解你的意图并启动多专家分析。你也可以直接粘贴品牌Brief文档。',
    timestamp: Date.now(),
  }]);
  const [intentResult, setIntentResult] = useState<IntentResult | null>(null);
  const [optimizedPrompt, setOptimizedPrompt] = useState<OptimizedPrompt | null>(null);
  const [awaitingClarification, setAwaitingClarification] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const [documentParsed, setDocumentParsed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // UI state
  const [showHistory, setShowHistory] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [inputMode, setInputMode] = useState<'chat' | 'form'>('chat');
  const [llmAvailable, setLlmAvailable] = useState(false);
  const [llmModel, setLlmModel] = useState('');

  // WebSocket ref for clarification responses
  const wsRef = useRef<WebSocket | null>(null);

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, { ...msg, id: nextId(), timestamp: Date.now() }]);
  }, []);

  // ---- New conversational flow ----
  const handleSendMessage = useCallback((userInput: string) => {
    // Add user message
    addMessage({ role: 'user', content: userInput });

    // Reset state for new analysis
    setPhase('intent');
    setProblem(userInput);
    setAgents([]);
    setCrossValidation(null);
    setSynthesis(null);
    setIntentResult(null);
    setOptimizedPrompt(null);
    setDocumentParsed(false);
    setAwaitingClarification(false);
    setClarificationQuestions([]);
    setError('');
    setIsProcessing(true);

    const startedAgents = new Set<string>();

    const ws = connectDecisionSocket(
      userInput,
      (event: DecisionEvent) => {
        switch (event.type) {
          case 'intent_detecting':
            // Thinking indicator is shown via isProcessing state
            break;

          case 'intent_detected':
            if (event.intent_result) {
              setIntentResult(event.intent_result);
              const intent = event.intent_result;
              const typeLabels: Record<string, string> = {
                vague_idea: '模糊想法',
                structured_problem: '结构化问题',
                document_brief: '文档方案',
              };
              addMessage({
                role: 'assistant',
                content: `我理解到这是一个「${typeLabels[intent.intent_type] || intent.intent_type}」类型的问题。${intent.summary}`,
                metadata: { intent },
              });
            }
            break;

          case 'clarification_needed':
            if (event.clarification_questions) {
              setPhase('clarifying');
              setAwaitingClarification(true);
              setClarificationQuestions(event.clarification_questions);
              setIsProcessing(false);
              addMessage({
                role: 'assistant',
                content: '为了更好地分析你的问题，请补充以下信息：',
                metadata: { isQuestion: true, questions: event.clarification_questions },
              });
            }
            break;

          case 'document_parsed':
            setDocumentParsed(true);
            if (event.content) {
              addMessage({ role: 'assistant', content: event.content });
            }
            break;

          case 'prompt_refining':
            setPhase('refining');
            break;

          case 'prompt_refined':
            if (event.optimized_prompt) {
              setOptimizedPrompt(event.optimized_prompt);
              addMessage({
                role: 'assistant',
                content: '已完成问题优化，正在启动多专家并行分析...',
                metadata: { optimized: event.optimized_prompt },
              });
            }
            break;

          case 'agent_start':
            if (event.agent && !startedAgents.has(event.agent)) {
              startedAgents.add(event.agent);
              setPhase('reasoning');
              setAgents(prev => [...prev, {
                agent: event.agent!,
                role_label: event.role_label || '',
                icon: event.icon || '',
                reasoning: '',
                key_insights: [],
                confidence: 0,
                done: false,
              }]);
            }
            break;

          case 'agent_done':
            setAgents(prev => prev.map(a =>
              a.agent === event.agent ? {
                ...a,
                reasoning: event.content || '',
                key_insights: event.key_insights || [],
                confidence: event.confidence || 0,
                done: true,
              } : a
            ));
            break;

          case 'phase':
            if (event.message === 'phase_2_start') {
              setPhase('validation');
            }
            break;

          case 'cross_validation':
            if (event.cross_validation) {
              setCrossValidation(event.cross_validation);
            }
            setPhase('synthesis');
            break;

          case 'synthesis':
            if (event.synthesis) {
              setSynthesis(event.synthesis);
            }
            break;

          case 'done':
            setPhase('done');
            setIsProcessing(false);
            break;

          case 'error':
            setError(event.message || '未知错误');
            setPhase('input');
            setIsProcessing(false);
            addMessage({ role: 'assistant', content: `发生错误：${event.message || '未知错误'}` });
            break;
        }
      },
      (msg) => {
        setError(msg);
        setIsProcessing(false);
        addMessage({ role: 'assistant', content: msg });
      },
      () => {},
    );

    wsRef.current = ws;
  }, [addMessage]);

  // ---- Clarification response ----
  const handleClarificationResponse = useCallback((answers: string[]) => {
    const answerText = answers.join('\n');
    addMessage({ role: 'user', content: answerText });

    setAwaitingClarification(false);
    setClarificationQuestions([]);
    setIsProcessing(true);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      sendClarificationResponse(wsRef.current, answers);
    }
  }, [addMessage]);

  // ---- Legacy form flow ----
  const handleDecide = useCallback((problem: string, context: string, constraints: string) => {
    setProblem(problem);
    setPhase('reasoning');
    setAgents([]);
    setCrossValidation(null);
    setSynthesis(null);
    setError('');

    const startedAgents = new Set<string>();

    connectDecisionSocket(
      { problem, context, constraints },
      (event: DecisionEvent) => {
        switch (event.type) {
          case 'agent_start':
            if (event.agent && !startedAgents.has(event.agent)) {
              startedAgents.add(event.agent);
              setAgents(prev => [...prev, {
                agent: event.agent!,
                role_label: event.role_label || '',
                icon: event.icon || '',
                reasoning: '',
                key_insights: [],
                confidence: 0,
                done: false,
              }]);
            }
            break;

          case 'agent_done':
            setAgents(prev => prev.map(a =>
              a.agent === event.agent ? {
                ...a,
                reasoning: event.content || '',
                key_insights: event.key_insights || [],
                confidence: event.confidence || 0,
                done: true,
              } : a
            ));
            break;

          case 'phase':
            if (event.message === 'phase_2_start') {
              setPhase('validation');
            }
            break;

          case 'cross_validation':
            if (event.cross_validation) {
              setCrossValidation(event.cross_validation);
            }
            setPhase('synthesis');
            break;

          case 'synthesis':
            if (event.synthesis) {
              setSynthesis(event.synthesis);
            }
            break;

          case 'done':
            setPhase('done');
            break;

          case 'error':
            setError(event.message || '未知错误');
            setPhase('input');
            break;
        }
      },
      (msg) => setError(msg),
      () => {},
    );
  }, []);

  const handleNewDecision = () => {
    setPhase('input');
    setProblem('');
    setAgents([]);
    setCrossValidation(null);
    setSynthesis(null);
    setIntentResult(null);
    setOptimizedPrompt(null);
    setDocumentParsed(false);
    setAwaitingClarification(false);
    setClarificationQuestions([]);
    setIsProcessing(false);
    setMessages([{
      id: nextId(),
      role: 'assistant',
      content: '你好！我是 BrandOS 决策助手。描述你的品牌决策问题，我会理解你的意图并启动多专家分析。你也可以直接粘贴品牌Brief文档。',
      timestamp: Date.now(),
    }]);
  };

  const isAnalysisPhase = ['intent', 'clarifying', 'refining', 'reasoning', 'validation', 'synthesis', 'done'].includes(phase);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <span className="logo">🧠</span>
          <div>
            <h1>BrandOS</h1>
            <span className="subtitle">Decision Intelligence Engine</span>
          </div>
        </div>
        <div className="header-right">
          <button
            className="btn-ghost btn-mode-toggle"
            onClick={() => setInputMode(inputMode === 'chat' ? 'form' : 'chat')}
            title={inputMode === 'chat' ? '切换到表单模式' : '切换到对话模式'}
          >
            {inputMode === 'chat' ? '📋 表单' : '💬 对话'}
          </button>
          <button
            className="btn-ghost"
            onClick={() => setShowApiSettings(true)}
            title="API 设置"
          >
            ⚙ API
          </button>
          <button
            className="btn-ghost"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? '返回决策' : '历史记录'}
          </button>
        </div>
      </header>

      <main className="app-main">
        {showHistory ? (
          <HistoryPanel
            onLoad={(entry) => {
              setProblem(entry.problem);
              setAgents(entry.agents);
              setCrossValidation(entry.cross_validation);
              setSynthesis(entry.synthesis);
              setPhase('done');
              setShowHistory(false);
            }}
            fetchHistory={fetchHistory}
            deleteEntry={deleteHistoryEntry}
          />
        ) : (
          <>
            {/* Chat mode input */}
            {phase === 'input' && inputMode === 'chat' && (
              <ChatInterface
                messages={messages}
                onSendMessage={handleSendMessage}
                awaitingClarification={false}
                clarificationQuestions={[]}
                onClarificationResponse={handleClarificationResponse}
                isProcessing={false}
              />
            )}

            {/* Form mode input (legacy) */}
            {phase === 'input' && inputMode === 'form' && (
              <DecisionInput onSubmit={handleDecide} error={error} />
            )}

            {/* Clarification phase — chat stays visible */}
            {phase === 'clarifying' && (
              <ChatInterface
                messages={messages}
                onSendMessage={handleSendMessage}
                awaitingClarification={awaitingClarification}
                clarificationQuestions={clarificationQuestions}
                onClarificationResponse={handleClarificationResponse}
                isProcessing={isProcessing}
              />
            )}

            {/* Analysis phases */}
            {isAnalysisPhase && phase !== 'input' && phase !== 'clarifying' && (
              <>
                <ThinkingProcess
                  phase={phase}
                  intentResult={intentResult}
                  optimizedPrompt={optimizedPrompt}
                  documentParsed={documentParsed}
                />

                <Dashboard
                  phase={phase}
                  problem={optimizedPrompt?.refined_problem || problem}
                  originalProblem={intentResult?.summary || ''}
                  agents={agents}
                  crossValidation={crossValidation}
                  synthesis={synthesis}
                  onNewDecision={handleNewDecision}
                />

                {phase !== 'done' && agents.length > 0 && (
                  <ReasonChain agents={agents} phase={phase} />
                )}
              </>
            )}
          </>
        )}
      </main>

      {showApiSettings && (
        <ApiSettings
          onClose={() => setShowApiSettings(false)}
          onSaved={(available, model) => {
            setLlmAvailable(available);
            setLlmModel(model);
          }}
        />
      )}
    </div>
  );
}
