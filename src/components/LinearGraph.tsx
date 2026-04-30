import React, { useMemo, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Point, Constraint, LPProblem } from '../types';
import { getFeasibleRegion } from '../utils/lp-solver';

interface Props {
  problem: LPProblem;
  currentX: number;
  currentY: number;
  history: Point[];
  showFeasible?: boolean;
}

export const LinearGraph: React.FC<Props> = ({ problem, currentX, currentY, history, showFeasible = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 500 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const margin = 50;
  const { width, height } = dimensions;

  // 自动计算比例尺
  const maxAxis = useMemo(() => {
    let m = 10;
    problem.constraints.forEach(c => {
      if (c.a1 !== 0) m = Math.max(m, Math.abs(c.b / c.a1));
      if (c.a2 !== 0) m = Math.max(m, Math.abs(c.b / c.a2));
    });
    return m * 1.2 || 10;
  }, [problem.constraints]);

  const scaleX = (x: number) => margin + (x / maxAxis) * (width - 2 * margin);
  const scaleY = (y: number) => height - margin - (y / maxAxis) * (height - 2 * margin);

  const region = useMemo(() => getFeasibleRegion(problem.constraints, { x: maxAxis, y: maxAxis }), [problem, maxAxis]);
  const pointsPath = region.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ') + ' Z';

  const z = problem.c1 * currentX + problem.c2 * currentY;
  const objLinePoints = useMemo(() => {
    if (Math.abs(problem.c2) < 1e-9) {
        if (Math.abs(problem.c1) < 1e-9) return { x1: 0, y1: 0, x2: 0, y2: 0 };
        const lx = z / problem.c1;
        return { x1: scaleX(lx), y1: scaleY(0), x2: scaleX(lx), y2: scaleY(maxAxis) };
    }
    const xstart = 0;
    const ystart = (z - problem.c1 * xstart) / problem.c2;
    const xend = maxAxis;
    const yend = (z - problem.c1 * xend) / problem.c2;
    return { x1: scaleX(xstart), y1: scaleY(ystart), x2: scaleX(xend), y2: scaleY(yend) };
  }, [z, problem, maxAxis, width, height]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-white overflow-hidden" id="viz-container">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orientation="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#ef4444" />
          </marker>
        </defs>

        {/* 网格线和刻度 */}
        {[...Array(11)].map((_, i) => {
          const val = i * (maxAxis / 10);
          const x = scaleX(val);
          const y = scaleY(val);
          return (
            <React.Fragment key={i}>
              {/* 水平线 */}
              <line 
                  x1={scaleX(0)} y1={y} 
                  x2={scaleX(maxAxis)} y2={y} 
                  stroke="#f1f5f9" strokeWidth="1" 
              />
              {/* Y轴数值 */}
              {i > 0 && i < 11 && (
                <text x={scaleX(0) - 25} y={y + 4} className="text-[9px] fill-slate-400 font-mono text-right">
                  {val.toFixed(i % 2 === 0 ? 0 : 1)}
                </text>
              )}
              
              {/* 垂直线 */}
              <line 
                  x1={x} y1={scaleY(0)} 
                  x2={x} y2={scaleY(maxAxis)} 
                  stroke="#f1f5f9" strokeWidth="1" 
              />
              {/* X轴数值 */}
              {i > 0 && i < 11 && (
                <text x={x} y={scaleY(0) + 15} className="text-[9px] fill-slate-400 font-mono text-center" textAnchor="middle">
                  {val.toFixed(i % 2 === 0 ? 0 : 1)}
                </text>
              )}
            </React.Fragment>
          );
        })}

        {/* 坐标轴 */}
        <line x1={scaleX(0)} y1={scaleY(0)} x2={scaleX(maxAxis)} y2={scaleY(0)} stroke="#1e293b" strokeWidth="2" />
        <line x1={scaleX(0)} y1={scaleY(0)} x2={scaleX(0)} y2={scaleY(maxAxis)} stroke="#1e293b" strokeWidth="2" />
        
        {/* 轴标签 */}
        <text x={scaleX(maxAxis)} y={scaleY(0) + 25} className="text-[10px] fill-slate-900 font-bold uppercase font-mono">x₁ (决策变量1)</text>
        <text x={scaleX(0) - 10} y={scaleY(maxAxis) - 10} className="text-[10px] fill-slate-900 font-bold uppercase font-mono" transform={`rotate(-90, ${scaleX(0) - 10}, ${scaleY(maxAxis) - 10})`}>x₂ (决策变量2)</text>
        <text x={scaleX(0) - 20} y={scaleY(0) + 20} className="text-[10px] fill-slate-900 font-bold font-mono">0</text>

        {/* 可行域 */}
        <AnimatePresence>
          {showFeasible && region.length > 0 && (
            <motion.path
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                d={pointsPath}
                fill="rgba(79, 70, 229, 0.08)"
                stroke="rgba(79, 70, 229, 0.3)"
                strokeWidth="1.5"
            />
          )}
        </AnimatePresence>

        {/* 约束线 */}
        {problem.constraints.map((c, i) => {
          let x1, y1, x2, y2;
          if (Math.abs(c.a2) < 1e-9) {
            x1 = c.b / c.a1; x2 = x1; y1 = 0; y2 = maxAxis;
          } else {
            x1 = 0; y1 = c.b / c.a2;
            x2 = maxAxis; y2 = (c.b - c.a1 * maxAxis) / c.a2;
          }
          return (
            <line 
              key={c.id} 
              x1={scaleX(x1)} y1={scaleY(y1)} 
              x2={scaleX(x2)} y2={scaleY(y2)} 
              stroke="#94a3b8" 
              strokeWidth="0.8" 
              strokeDasharray="2 2"
            />
          );
        })}

        {/* 搜索轨迹 */}
        {history.length > 1 && (
          <polyline
            points={history.map(p => `${scaleX(p.x)},${scaleY(p.y)}`).join(' ')}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd="url(#arrowhead)"
          />
        )}

        {/* 目标函数移动线 */}
        <motion.line
          animate={{ x1: objLinePoints.x1, y1: objLinePoints.y1, x2: objLinePoints.x2, y2: objLinePoints.y2 }}
          transition={{ type: 'spring', damping: 25, stiffness: 80 }}
          stroke="#f59e0b"
          strokeWidth="2"
          strokeDasharray="4 2"
        />

        {/* 搜索路径上的点 */}
        {history.map((p, i) => (
           <circle 
            key={i}
            cx={scaleX(p.x)} 
            cy={scaleY(p.y)} 
            r={i === history.length - 1 ? 4 : 2} 
            fill={i === history.length - 1 ? "#10b981" : "#ef4444"} 
           />
        ))}
      </svg>
      
      {/* Legend Overlay */}
      <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-slate-100 text-[10px] shadow-sm space-y-1.5 font-medium">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-amber-500"></div> 
          <span className="text-slate-600">目标函数所在位置</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-red-500"></div> 
          <span className="text-slate-600">顶点搜索路径轨迹</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-indigo-50 border border-indigo-200"></div> 
          <span className="text-slate-600">可行域集合领域</span>
        </div>
        <div className="pt-2 mt-2 border-t border-slate-100 font-mono text-indigo-600">
           Z = {z.toFixed(2)}
           <br/>
           ({currentX.toFixed(2)}, {currentY.toFixed(2)})
        </div>
      </div>
    </div>
  );
};
