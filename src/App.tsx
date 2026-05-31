import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Minus, Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Calculator, Info } from 'lucide-react';
import { LPProblem, Constraint, SimplexStep, Point } from './types';
import { solveSimplex } from './utils/lp-solver';
import { LinearGraph } from './components/LinearGraph';
import { SimplexTableau } from './components/SimplexTableau';
import { motion, AnimatePresence } from 'framer-motion';
import { PasswordGate } from './components/PasswordGate';

export default function App() {
  const [problem, setProblem] = useState<LPProblem>({
    objective: 'max',
    c1: 3,
    c2: 2,
    constraints: [
      { id: '1', a1: 1, a2: 2, operator: '<=', b: 8 },
      { id: '2', a1: 1, a2: 1, operator: '<=', b: 5 },
      { id: '3', a1: 2, a2: 1, operator: '<=', b: 8 },
    ]
  });

  const [steps, setSteps] = useState<SimplexStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playTimerRef = useRef<number | null>(null);

  // 初始化求解
  useEffect(() => {
    const result = solveSimplex(problem);
    setSteps(result);
    setCurrentStepIdx(0);
    setIsPlaying(false);
  }, [problem]);

  // 播放逻辑
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = window.setInterval(() => {
        setCurrentStepIdx(prev => {
          if (prev < steps.length - 1) return prev + 1;
          setIsPlaying(false);
          return prev;
        });
      }, 1000 / playbackSpeed);
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    }
    return () => { if (playTimerRef.current) clearInterval(playTimerRef.current); };
  }, [isPlaying, steps.length, playbackSpeed]);

  const currentStep = steps[currentStepIdx] || null;
  const history = useMemo(() => {
    return steps.slice(0, currentStepIdx + 1).map(s => ({ x: s.currentX, y: s.currentY }));
  }, [steps, currentStepIdx]);

  const addConstraint = () => {
    const newId = (problem.constraints.length + 1).toString();
    setProblem(prev => ({
      ...prev,
      constraints: [...prev.constraints, { id: newId, a1: 1, a2: 1, operator: '<=', b: 10 }]
    }));
  };

  const removeConstraint = (id: string) => {
    setProblem(prev => ({
      ...prev,
      constraints: prev.constraints.filter(c => c.id !== id)
    }));
  };

  const updateConstraint = (id: string, updates: Partial<Constraint>) => {
    setProblem(prev => ({
      ...prev,
      constraints: prev.constraints.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  return (
    <PasswordGate>
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* Top Navigation Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold">Σ</div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">单纯形法可视化分析平台</h1>
        </div>
        <div className="flex gap-4 text-sm font-medium text-slate-500">
          <span className="px-3 py-1 bg-slate-100 rounded-full text-indigo-600">二维线性规划</span>
          <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-full">
            迭代步数: {currentStepIdx}/{steps.length > 0 ? steps.length - 1 : 0}
          </span>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full font-mono">
            Z: {currentStep?.objectiveValue.toFixed(2)}
          </span>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left Sidebar: Parameters */}
        <section className="w-72 flex flex-col gap-6 shrink-0 h-full">
          {/* Objective Function */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">目标函数</h2>
            <div className="flex items-center gap-2 mb-3">
              <select 
                value={problem.objective}
                onChange={(e) => setProblem(p => ({ ...p, objective: e.target.value as 'max' | 'min' }))}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold uppercase"
              >
                <option value="max">MAX</option>
                <option value="min">MIN</option>
              </select>
              <span className="text-sm italic font-serif text-slate-500">Z =</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input 
                  type="number" 
                  value={problem.c1} 
                  onChange={e => setProblem(p => ({...p, c1: Number(e.target.value)}))}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm pr-6 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-mono">x₁</span>
              </div>
              <span className="text-slate-300 font-bold">+</span>
              <div className="relative flex-1">
                <input 
                  type="number" 
                  value={problem.c2} 
                  onChange={e => setProblem(p => ({...p, c2: Number(e.target.value)}))}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm pr-6 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-mono">x₂</span>
              </div>
            </div>
          </div>

          {/* Constraints Container */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">约束条件</h2>
              <button 
                onClick={addConstraint}
                className="p-1 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                title="添加约束"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <AnimatePresence initial={false}>
                {problem.constraints.map((c) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={c.id} 
                    className="p-3 bg-slate-50 rounded border border-slate-100 group relative"
                  >
                    <div className="flex gap-2 items-center mb-2">
                       <input 
                        type="number" 
                        value={c.a1} 
                        onChange={e => updateConstraint(c.id, { a1: Number(e.target.value) })}
                        className="w-12 bg-white border border-slate-200 rounded text-xs p-1.5 text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <span className="text-[10px] text-slate-400 uppercase font-bold">x₁ +</span>
                      <input 
                        type="number" 
                        value={c.a2} 
                        onChange={e => updateConstraint(c.id, { a2: Number(e.target.value) })}
                        className="w-12 bg-white border border-slate-200 rounded text-xs p-1.5 text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <span className="text-[10px] text-slate-400 uppercase font-bold">x₂</span>
                    </div>
                      <div className="flex gap-2 items-center">
                        <select
                          value={c.operator}
                          onChange={e => updateConstraint(c.id, { operator: e.target.value as any })}
                          className="bg-white border border-slate-200 rounded text-xs px-2 py-1 font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="<=">&le;</option>
                          <option value=">=">&ge;</option>
                          <option value="=">=</option>
                        </select>
                        <input 
                          type="number" 
                          value={c.b} 
                          onChange={e => updateConstraint(c.id, { b: Number(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded text-xs p-1.5 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    <button 
                      onClick={() => removeConstraint(c.id)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            <div className="p-2 text-[10px] text-slate-400 text-center border-t border-slate-100 mt-4 font-mono">
              x₁, x₂ ≥ 0 (决策变量默认非负)
            </div>
          </div>
        </section>

        {/* Center: Visualization Graph & Controls */}
        <section className="flex-1 flex flex-col gap-6 overflow-hidden min-w-[500px]">
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0">
               <LinearGraph 
                  problem={problem} 
                  currentX={currentStep?.currentX ?? 0}
                  currentY={currentStep?.currentY ?? 0}
                  history={history}
                />
            </div>
          </div>
          
          {/* Control Bar */}
          <div className="h-16 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center px-6 justify-between shrink-0">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 transform active:scale-95"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
              </button>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">动画速度</span>
                <input 
                  type="range"
                  min="0.5"
                  max="4"
                  step="0.1"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="w-32 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setCurrentStepIdx(Math.max(0, currentStepIdx - 1))}
                disabled={currentStepIdx === 0}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                上一步
              </button>
              <button 
                onClick={() => setCurrentStepIdx(Math.min(steps.length - 1, currentStepIdx + 1))}
                disabled={currentStepIdx === steps.length - 1}
                className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                下一步
              </button>
              <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
              <button 
                onClick={() => {
                  setCurrentStepIdx(0);
                  setIsPlaying(false);
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                重置
              </button>
            </div>
          </div>
        </section>

        {/* Right Sidebar: Simplex Tableau */}
        <section className="w-96 flex flex-col gap-4 shrink-0 overflow-hidden h-full">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                单纯形表 (迭代 {currentStepIdx.toString().padStart(2, '0')})
              </h2>
              {currentStepIdx === steps.length - 1 && steps.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                  <div className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse"></div>
                  已完成
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-auto">
              {currentStep && (
                <SimplexTableau 
                    step={currentStep} 
                    title="" 
                />
              )}
            </div>

            <div className="p-4 bg-indigo-50/50 border-t border-indigo-100/50 shrink-0">
               <div className="text-[11px] text-indigo-900 leading-relaxed">
                  <strong className="block mb-1 text-indigo-700 uppercase font-bold tracking-wider">当前步骤说明:</strong>
                  {currentStep?.message ? (
                    <div dangerouslySetInnerHTML={{ __html: currentStep.message }} />
                  ) : currentStepIdx === 0 ? (
                    "初始化初始单纯形表。所有松弛变量作为基变量，构成坐标原点 (0,0) 处的初始可行解。"
                  ) : currentStepIdx === steps.length - 1 ? (
                    "所有检验数均非负，说明已找到最优解。当前基变量取值即为最优解，Z 值为最大/最小值。"
                  ) : currentStep ? (
                    `选取检验数最小的变量 ${currentStep.headers[currentStep.pivotCol!]} 为入基变量，选取比值最小的 ${currentStep.basis[currentStep.pivotRow! - 1]} 为出基变量进行旋转变换。`
                  ) : null}
               </div>
            </div>
          </div>
          
          {/* Solution Status Card */}
          <div className="bg-indigo-600 rounded-xl p-5 text-white shadow-lg shadow-indigo-100 shrink-0">
            <div className="text-[10px] uppercase font-bold opacity-70 mb-1 tracking-widest">当前分析状态</div>
            <div className="flex items-end justify-between">
              <div className="text-xl font-bold font-mono">
                {currentStepIdx === steps.length - 1 ? "找到最优解" : "正在搜索中..."}
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center">
                {currentStepIdx === steps.length - 1 ? (
                   <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                   <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Status Footer */}
      <footer className="h-8 bg-slate-100 border-t border-slate-200 flex items-center justify-between px-8 shrink-0">
        <div className="text-[10px] text-slate-400 font-mono">
          状态: <span className="text-emerald-600 font-bold uppercase">Ready</span> • 模型: Simplex-2D-Viz • 精度: 10e-6
        </div>
        <div className="text-[10px] text-slate-400 font-medium">
          © 2026 运筹学可视化教学辅助系统 • 2D Simplex Viewer
        </div>
      </footer>
    </div>
    </PasswordGate>
  );
}
