import { useState } from 'react';

interface Props {
  onSubmit: (problem: string, context: string, constraints: string) => void;
  error: string;
}

const DEMOS = [
  {
    label: '品牌定位 · 新消费饮品',
    problem: '一个新兴健康饮品品牌想进入中国市场，目标人群为 25-35 岁注重健康的都市白领。品牌主打「天然、低糖、功能+」概念。如何制定品牌定位和市场进入策略？',
    context: '竞争环境：元气森林、奈雪的茶等已占据一定市场。产品：含益生菌的功能性茶饮。预算：A轮融资 5000 万人民币。',
    constraints: '品牌定位需避开"伪健康"陷阱，产品需有科学背书，价格适中（15-25元/瓶）。',
  },
  {
    label: '品牌升级 · 传统制造转型',
    problem: '一家 30 年历史的五金工具制造商想从 B2B 代工转型为自有品牌，进军消费级 DIY 工具市场。如何重塑品牌形象并建立消费者认知？',
    context: '年营收 2 亿人民币，80% 来自海外代工。创始人希望用 3 年时间在国内建立品牌认知。产品品质对标博世/牧田。',
    constraints: '不能放弃现有 B2B 业务，品牌定位需有差异化（不是简单跟随），预算有限需要分阶段推进。',
  },
  {
    label: '品牌危机 · 食品安全事件',
    problem: '一家知名宠物食品品牌因工厂卫生问题被媒体曝光，社交媒体出现大量负面声量。如何制定品牌危机应对策略，既要解决当下危机，又要重建长期品牌信任？',
    context: '品牌有 8 年历史，年销售额 10 亿，用户基数 200 万。事件发生在代工厂而非自有工厂，但消费者不区分。',
    constraints: '必须在一周内做出实质性回应，不能仅靠公关声明。预算有限但愿意投入重建信任。需考虑 KOL 关系和电商平台关系。',
  },
];

export function DecisionInput({ onSubmit, error }: Props) {
  const [problem, setProblem] = useState('');
  const [context, setContext] = useState('');
  const [constraints, setConstraints] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    if (problem.trim().length < 10) return;
    setLoading(true);
    onSubmit(problem, context, constraints);
    // loading will be reset when phase changes in parent
    setTimeout(() => setLoading(false), 3000);
  };

  const loadDemo = (demo: typeof DEMOS[number]) => {
    setProblem(demo.problem);
    setContext(demo.context);
    setConstraints(demo.constraints);
  };

  return (
    <div className="decision-input">
      <div className="input-hero">
        <h2>Brand Decision Intelligence</h2>
        <p>
          描述你的品牌决策问题，4 位 AI 专家将从品牌策略、市场分析、消费者洞察、风险评估
          四个维度并行推理，交叉验证后给出综合决策方案。
        </p>
      </div>

      {/* Demo scenarios */}
      <div className="demo-scenarios">
        <span className="demo-label">示例场景：</span>
        {DEMOS.map((demo, i) => (
          <button key={i} className="demo-chip" onClick={() => loadDemo(demo)}>
            {demo.label}
          </button>
        ))}
      </div>

      <div className="input-form">
        <div className="field">
          <label>决策问题 *</label>
          <textarea
            value={problem}
            onChange={e => setProblem(e.target.value)}
            placeholder="详细描述你需要做的品牌决策...&#10;&#10;例如：一款面向 Z 世代的功能饮料如何定位品牌、选择目标市场和制定传播策略？"
            rows={4}
          />
        </div>

        <div className="field">
          <label>补充背景</label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="竞争环境、资源情况、已有的市场数据...（可选）"
            rows={3}
          />
        </div>

        <div className="field">
          <label>约束条件</label>
          <textarea
            value={constraints}
            onChange={e => setConstraints(e.target.value)}
            placeholder="预算上限、时间限制、不可触碰的红线...（可选）"
            rows={2}
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          className="btn-submit"
          onClick={handleSubmit}
          disabled={problem.trim().length < 10 || loading}
        >
          {loading ? '启动分析...' : '启动多 Agent 分析'}
        </button>
      </div>
    </div>
  );
}
