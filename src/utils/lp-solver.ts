import * as math from 'mathjs';
import { LPProblem, SimplexStep, Point, Constraint } from '../types';

/**
 * 计算线性规划问题的单纯形法步骤
 * 限制为二维决策变量 x1, x2
 */
export function solveSimplex(problem: LPProblem): SimplexStep[] {
  const steps: SimplexStep[] = [];
  const { objective, c1, c2, constraints } = problem;

  // 1. 标准化
  // x1, x2 是决策变量。根据约束添加松弛变量、剩余变量或人工变量
  // 虽然这里主要是二维可视化，但算法要稳健
  // 为了简单起见，我们主要处理 <= 约束，或者将其转化为标准型
  
  let matrix: number[][] = [];
  let headers: string[] = ['obj', 'x1', 'x2'];
  let basis: string[] = [];
  
  // 目标函数行
  const objRow = [1, objective === 'max' ? -c1 : c1, objective === 'max' ? -c2 : c2];
  
  // 处理约束
  constraints.forEach((cons, i) => {
    const row = [0, cons.a1, cons.a2];
    matrix.push(row);
    const slackName = `s${i + 1}`;
    headers.push(slackName);
    basis.push(slackName);
  });
  
  // 补齐目标函数行的松弛变量列
  for (let i = 0; i < constraints.length; i++) {
    objRow.push(0);
  }
  objRow.push(0); // RHS
  
  // 补齐约束行的松弛变量列和 RHS
  matrix.forEach((row, i) => {
    for (let j = 0; j < constraints.length; j++) {
      row.push(i === j ? 1 : 0);
    }
    row.push(constraints[i].b);
  });
  
  let tableau = [objRow, ...matrix];
  headers.push('RHS');

  const getSolution = (tab: number[][]) => {
    const x1Col = 1;
    const x2Col = 2;
    const rhsCol = tab[0].length - 1;
    
    let x1 = 0;
    let x2 = 0;
    
    // 检查 x1 是否在基中
    const x1InBasis = basis.findIndex(b => b === 'x1');
    if (x1InBasis !== -1) {
       x1 = tab[x1InBasis + 1][rhsCol] / tab[x1InBasis + 1][x1Col];
    } else {
        // 另一种检查：列是否为单位向量
        let count = 0;
        let lastOneIdx = -1;
        for(let r=1; r<tab.length; r++) {
            if (Math.abs(tab[r][x1Col] - 1) < 1e-9) { count++; lastOneIdx = r; }
            else if (Math.abs(tab[r][x1Col]) > 1e-9) { count = 100; }
        }
        if (count === 1) x1 = tab[lastOneIdx][rhsCol];
    }

    const x2InBasis = basis.findIndex(b => b === 'x2');
    if (x2InBasis !== -1) {
       x2 = tab[x2InBasis + 1][rhsCol] / tab[x2InBasis + 1][x2Col];
    } else {
        let count = 0;
        let lastOneIdx = -1;
        for(let r=1; r<tab.length; r++) {
            if (Math.abs(tab[r][x2Col] - 1) < 1e-9) { count++; lastOneIdx = r; }
            else if (Math.abs(tab[r][x2Col]) > 1e-9) { count = 100; }
        }
        if (count === 1) x2 = tab[lastOneIdx][rhsCol];
    }

    return { x: x1, y: x2, z: tab[0][rhsCol] * (objective === 'max' ? 1 : -1) };
  };

  const captureStep = (tab: number[][], pRow: number | null, pCol: number | null) => {
    const sol = getSolution(tab);
    steps.push({
      tableau: tab.map(r => [...r]),
      basis: [...basis],
      headers: [...headers],
      pivotRow: pRow,
      pivotCol: pCol,
      currentX: sol.x,
      currentY: sol.y,
      objectiveValue: sol.z
    });
  };

  // 迭代
  let iter = 0;
  while (iter < 10) {
    // 寻找入基列 (最负的检验数)
    let pivotCol = -1;
    let minVal = 0;
    for (let j = 1; j < tableau[0].length - 1; j++) {
      if (tableau[0][j] < minVal) {
        minVal = tableau[0][j];
        pivotCol = j;
      }
    }

    if (pivotCol === -1) {
      captureStep(tableau, null, null);
      break; 
    }

    // 寻找出基行 (最小比值)
    let pivotRow = -1;
    let minRatio = Infinity;
    const rhsCol = tableau[0].length - 1;
    for (let i = 1; i < tableau.length; i++) {
      if (tableau[i][pivotCol] > 0) {
        const ratio = tableau[i][rhsCol] / tableau[i][pivotCol];
        if (ratio < minRatio) {
          minRatio = ratio;
          pivotRow = i;
        }
      }
    }

    if (pivotRow === -1) {
       captureStep(tableau, null, pivotCol);
       break; // 无界
    }

    captureStep(tableau, pivotRow, pivotCol);

    // 旋转变换
    const pivotVal = tableau[pivotRow][pivotCol];
    tableau[pivotRow] = tableau[pivotRow].map(v => v / pivotVal);
    for (let i = 0; i < tableau.length; i++) {
      if (i !== pivotRow) {
        const factor = tableau[i][pivotCol];
        tableau[i] = tableau[i].map((v, idx) => v - factor * tableau[pivotRow][idx]);
      }
    }
    
    // 更新基
    basis[pivotRow - 1] = headers[pivotCol];
    
    iter++;
  }

  return steps;
}

/**
 * 计算可行域顶点
 */
export function getFeasibleRegion(constraints: Constraint[], bounds: { x: number, y: number }): Point[] {
  const lines: { a: number, b: number, c: number }[] = constraints.map(c => ({ a: c.a1, b: c.a2, c: c.b }));
  
  // 添加坐标轴边界
  lines.push({ a: 1, b: 0, c: 0 }); // x = 0
  lines.push({ a: 0, b: 1, c: 0 }); // y = 0
  lines.push({ a: 1, b: 0, c: bounds.x }); // x = max
  lines.push({ a: 0, b: 1, c: bounds.y }); // y = max

  const points: Point[] = [];

  // 获取所有直线的两两交点
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const l1 = lines[i];
      const l2 = lines[j];
      const det = l1.a * l2.b - l2.a * l1.b;
      if (Math.abs(det) < 1e-9) continue;
      
      const x = (l1.c * l2.b - l2.c * l1.b) / det;
      const y = (l1.a * l2.c - l2.a * l1.c) / det;
      
      // 检查交点是否在所有约束内
      let isFeasible = true;
      if (x < -1e-7 || y < -1e-7 || x > bounds.x + 1e-7 || y > bounds.y + 1e-7) {
          isFeasible = false;
      } else {
          for (const cons of constraints) {
            const val = cons.a1 * x + cons.a2 * y;
            if (cons.operator === '<=' && val > cons.b + 1e-7) isFeasible = false;
            if (cons.operator === '>=' && val < cons.b - 1e-7) isFeasible = false;
            if (cons.operator === '=' && Math.abs(val - cons.b) > 1e-7) isFeasible = false;
            if (!isFeasible) break;
          }
      }
      
      if (isFeasible) {
        points.push({ x, y });
      }
    }
  }

  // 顶点排序（极角排序）
  if (points.length === 0) return [];
  
  const center = {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
  
  return points.sort((a, b) => {
    return Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x);
  });
}
