import * as math from 'mathjs';
import { LPProblem, SimplexStep, Point, Constraint } from '../types';

/**
 * 计算线性规划问题的单纯形法步骤
 * 限制为二维决策变量 x1, x2
 */
export function solveSimplex(problem: LPProblem): SimplexStep[] {
  const steps: SimplexStep[] = [];
  const { objective, c1, c2, constraints } = problem;

  // 1. 标准化 RHS：保证所有 b_i >= 0。如果 b_i < 0，整行乘以 -1，方向反转
  const normalizedConstraints = constraints.map(c => {
    let a1 = c.a1;
    let a2 = c.a2;
    let operator = c.operator;
    let b = c.b;
    if (b < 0) {
      a1 = -a1;
      a2 = -a2;
      b = -b;
      if (operator === '<=') operator = '>=';
      else if (operator === '>=') operator = '<=';
    }
    return { id: c.id, a1, a2, operator, b };
  });

  // 2. 确定变量和排列表头
  // 表头格式：['obj', 'x1', 'x2', Slack/Surplus s_j..., Artificial a_j..., 'RHS']
  const headers: string[] = ['obj', 'x1', 'x2'];
  const basis: string[] = [];

  const slackIndices: number[] = [];
  const artificialIndices: number[] = [];

  normalizedConstraints.forEach((c, idx) => {
    if (c.operator === '<=') {
      const name = `s${idx + 1}`;
      headers.push(name);
      basis.push(name);
      slackIndices.push(idx);
    } else if (c.operator === '>=') {
      const sName = `s${idx + 1}`;
      headers.push(sName);
      slackIndices.push(idx); // surplus 变量
      
      const aName = `a${idx + 1}`;
      headers.push(aName);
      basis.push(aName);
      artificialIndices.push(idx);
    } else if (c.operator === '=') {
      const aName = `a${idx + 1}`;
      headers.push(aName);
      basis.push(aName);
      artificialIndices.push(idx);
    }
  });

  headers.push('RHS');
  const numCols = headers.length;

  // 辅助函数：根据当前基和系数表计算当前的 x1, x2 和原始主目标函数值
  const getSolution = (tab: number[][], currentHeaders: string[], currentBasis: string[]) => {
    let x1 = 0;
    let x2 = 0;
    
    const x1RowIdx = currentBasis.findIndex(b => b === 'x1');
    const x1Col = currentHeaders.indexOf('x1');
    if (x1RowIdx !== -1 && x1Col !== -1) {
      x1 = tab[x1RowIdx + 1][tab[x1RowIdx + 1].length - 1] / tab[x1RowIdx + 1][x1Col];
    }
    
    const x2RowIdx = currentBasis.findIndex(b => b === 'x2');
    const x2Col = currentHeaders.indexOf('x2');
    if (x2RowIdx !== -1 && x2Col !== -1) {
      x2 = tab[x2RowIdx + 1][tab[x2RowIdx + 1].length - 1] / tab[x2RowIdx + 1][x2Col];
    }
    
    if (isNaN(x1) || !isFinite(x1)) x1 = 0;
    if (isNaN(x2) || !isFinite(x2)) x2 = 0;

    const z = c1 * x1 + c2 * x2;
    return { x: x1, y: x2, z };
  };

  const captureStep = (tab: number[][], pRow: number | null, pCol: number | null, activeHeaders: string[], activeBasis: string[], message?: string) => {
    const sol = getSolution(tab, activeHeaders, activeBasis);
    steps.push({
      tableau: tab.map(r => [...r]),
      basis: [...activeBasis],
      headers: [...activeHeaders],
      pivotRow: pRow,
      pivotCol: pCol,
      currentX: sol.x,
      currentY: sol.y,
      objectiveValue: sol.z,
      message
    });
  };

  const hasArtificials = artificialIndices.length > 0;
  let tableau: number[][] = [];

  if (hasArtificials) {
    // ---------------------- 第一阶段 (Phase 1) ----------------------
    // 目标是最小化目标人工变量之和 w = sum(a_k)，等价于最大化 -w = -sum(a_k) => obj行代表 G + sum(a_k) = 0
    const phase1ObjRow = new Array(numCols).fill(0);
    phase1ObjRow[0] = 1; // obj
    
    // 设置人工变量在行0处系数为 1
    normalizedConstraints.forEach((c, idx) => {
      if (c.operator === '>=' || c.operator === '=') {
        const aName = `a${idx + 1}`;
        const colIdx = headers.indexOf(aName);
        if (colIdx !== -1) {
          phase1ObjRow[colIdx] = 1;
        }
      }
    });

    const constraintRows: number[][] = [];
    normalizedConstraints.forEach((c, idx) => {
      const row = new Array(numCols).fill(0);
      row[0] = 0;
      row[1] = c.a1;
      row[2] = c.a2;
      
      if (c.operator === '<=') {
        const name = `s${idx + 1}`;
        const colIdx = headers.indexOf(name);
        if (colIdx !== -1) row[colIdx] = 1;
      } else if (c.operator === '>=') {
        const name = `s${idx + 1}`;
        const colIdx = headers.indexOf(name);
        if (colIdx !== -1) row[colIdx] = -1; // surplus
      }
      
      if (c.operator === '>=' || c.operator === '=') {
        const name = `a${idx + 1}`;
        const colIdx = headers.indexOf(name);
        if (colIdx !== -1) row[colIdx] = 1;
      }
      
      row[numCols - 1] = c.b;
      constraintRows.push(row);
    });

    tableau = [phase1ObjRow, ...constraintRows];

    // 从 Row 0 中减去含有人工变量的约束行，满足基变量在 Row 0 中系数为 0 的 canonical 形式
    artificialIndices.forEach((cIdx) => {
      const rowIdx = cIdx + 1;
      const targetRow = tableau[rowIdx];
      tableau[0] = tableau[0].map((v, colIdx) => v - targetRow[colIdx]);
    });

    captureStep(
      tableau, 
      null, 
      null, 
      headers, 
      basis, 
      "<strong>第一阶段初始化：</strong>零点 (0,0) 不在可行域内。我们引入人工变量并加入单纯形表，将当前目标设定为<strong>最小化人工变量之和 w</strong>，以寻找原问题的一个初始基可行解。"
    );

    let iter = 0;
    while (iter < 20) {
      let pivotCol = -1;
      let minVal = -1e-9;
      for (let j = 1; j < numCols - 1; j++) {
        if (tableau[0][j] < minVal) {
          minVal = tableau[0][j];
          pivotCol = j;
        }
      }

      if (pivotCol === -1) {
        break; // 第一阶段达到最优解
      }

      let pivotRow = -1;
      let minRatio = Infinity;
      for (let i = 1; i <= normalizedConstraints.length; i++) {
        const val = tableau[i][pivotCol];
        if (val > 1e-9) {
          const ratio = tableau[i][numCols - 1] / val;
          if (ratio < minRatio) {
            minRatio = ratio;
            pivotRow = i;
          }
        }
      }

      if (pivotRow === -1) {
        break; // 第一阶段无界（实际不可能发生，作为安全出口）
      }

      captureStep(
        tableau, 
        pivotRow, 
        pivotCol, 
        headers, 
        basis, 
        `<strong>第一阶段迭代：</strong>选取检验数最负的变量 <strong>${headers[pivotCol]}</strong> 为入基变量，选取比值最小的 <strong>${basis[pivotRow - 1]}</strong> 为出基变量进行旋转。`
      );

      const pivotVal = tableau[pivotRow][pivotCol];
      tableau[pivotRow] = tableau[pivotRow].map(v => v / pivotVal);
      for (let i = 0; i < tableau.length; i++) {
        if (i !== pivotRow) {
          const coeff = tableau[i][pivotCol];
          tableau[i] = tableau[i].map((v, idx) => v - coeff * tableau[pivotRow][idx]);
        }
      }

      basis[pivotRow - 1] = headers[pivotCol];
      iter++;
    }

    const phase1OptVal = tableau[0][numCols - 1];
    // w = -phase1OptVal。若 w > 1e-6 则是无解
    if (phase1OptVal < -1e-6) {
      captureStep(
        tableau,
        null,
        null,
        headers,
        basis,
        "<strong>第一阶段结束：</strong>人工变量之和 w 无法降低至 0（w = " + (-phase1OptVal).toFixed(2) + "）。这意味着<strong>原规划问题不存在任何基可行解（可行域为空）</strong>。"
      );
      return steps;
    }

    // 剔除所有人工变量列，过渡至第二阶段
    const phase2ColIndices = headers.map((h, j) => h.startsWith('a') ? -1 : j).filter(j => j !== -1);
    const phase2Headers = phase2ColIndices.map(j => headers[j]);

    const phase2Tableau: number[][] = [];
    const p2ObjRow = new Array(phase2Headers.length).fill(0);
    p2ObjRow[0] = 1; // obj
    const x1ColP2 = phase2Headers.indexOf('x1');
    const x2ColP2 = phase2Headers.indexOf('x2');
    if (x1ColP2 !== -1) p2ObjRow[x1ColP2] = (objective === 'max' ? -c1 : c1);
    if (x2ColP2 !== -1) p2ObjRow[x2ColP2] = (objective === 'max' ? -c2 : c2);
    phase2Tableau.push(p2ObjRow);

    for (let i = 1; i < tableau.length; i++) {
      const p2Row = phase2ColIndices.map(j => tableau[i][j]);
      phase2Tableau.push(p2Row);
    }

    // 第二阶段：消去当前已经处于基中的决策变量在 Row 0 中的原始系数
    for (let r = 1; r < phase2Tableau.length; r++) {
      const basicVarName = basis[r - 1];
      const basicCol = phase2Headers.indexOf(basicVarName);
      if (basicCol !== -1) {
        const coeff = phase2Tableau[0][basicCol];
        if (Math.abs(coeff) > 1e-9) {
          phase2Tableau[0] = phase2Tableau[0].map((v, colIdx) => v - coeff * phase2Tableau[r][colIdx]);
        }
      }
    }

    tableau = phase2Tableau;
    headers.length = 0;
    headers.push(...phase2Headers);

    captureStep(
      tableau, 
      null, 
      null, 
      headers, 
      basis, 
      "<strong>第二阶段开始：</strong>已成功驱逐人工变量，寻找到一个极点初始基可行解！现在<strong>移除所有人工变量，恢复原规划的目标函数形式</strong>。开始对其寻找最优解。"
    );

  } else {
    // ---------------------- 传统直接求解 (No Artificials) ----------------------
    const phase2ObjRow = new Array(numCols).fill(0);
    phase2ObjRow[0] = 1; // obj
    phase2ObjRow[1] = (objective === 'max' ? -c1 : c1);
    phase2ObjRow[2] = (objective === 'max' ? -c2 : c2);
    
    const constraintRows: number[][] = [];
    normalizedConstraints.forEach((c, idx) => {
      const row = new Array(numCols).fill(0);
      row[0] = 0;
      row[1] = c.a1;
      row[2] = c.a2;
      
      const sName = `s${idx + 1}`;
      const colIdx = headers.indexOf(sName);
      if (colIdx !== -1) row[colIdx] = 1;
      row[numCols - 1] = c.b;
      constraintRows.push(row);
    });

    tableau = [phase2ObjRow, ...constraintRows];

    captureStep(
      tableau,
      null,
      null,
      headers,
      basis,
      "<strong>初始单纯形表：</strong>由于原点 (0,0) 在可行域内，直接使用决策变量为 0，松弛变量作为基变量构建初始基可行解。"
    );
  }

  // ---------------------- 第二阶段迭代 (Phase 2 Loop) ----------------------
  const p2Cols = headers.length;
  let iter2 = 0;
  while (iter2 < 20) {
    let pivotCol = -1;
    let minVal = -1e-9;
    for (let j = 1; j < p2Cols - 1; j++) {
      if (tableau[0][j] < minVal) {
        minVal = tableau[0][j];
        pivotCol = j;
      }
    }

    if (pivotCol === -1) {
      break; // 找到最优解
    }

    let pivotRow = -1;
    let minRatio = Infinity;
    for (let i = 1; i < tableau.length; i++) {
      const val = tableau[i][pivotCol];
      if (val > 1e-9) {
        const ratio = tableau[i][p2Cols - 1] / val;
        if (ratio < minRatio) {
          minRatio = ratio;
          pivotRow = i;
        }
      }
    }

    if (pivotRow === -1) {
      captureStep(
        tableau,
        null,
        pivotCol,
        headers,
        basis,
        `<strong>迭代过程中断：</strong>目标优化的入基变量 <strong>${headers[pivotCol]}</strong> 在各约束中系数均非正，表明当前问题沿着该基方向是<strong>无界的（Objective value can increase infinitely）</strong>。`
      );
      return steps;
    }

    captureStep(
      tableau,
      pivotRow,
      pivotCol,
      headers,
      basis,
      `<strong>第二阶段优化：</strong>选取更优方向，检验数最负的变量 <strong>${headers[pivotCol]}</strong> 进入基，约束限制最强的 <strong>${basis[pivotRow - 1]}</strong> 离开基进行旋转变换。`
    );

    const pivotVal = tableau[pivotRow][pivotCol];
    tableau[pivotRow] = tableau[pivotRow].map(v => v / pivotVal);
    for (let i = 0; i < tableau.length; i++) {
      if (i !== pivotRow) {
        const coeff = tableau[i][pivotCol];
        tableau[i] = tableau[i].map((v, idx) => v - coeff * tableau[pivotRow][idx]);
      }
    }

    basis[pivotRow - 1] = headers[pivotCol];
    iter2++;
  }

  // 求解结束
  const finalSol = getSolution(tableau, headers, basis);
  captureStep(
    tableau,
    null,
    null,
    headers,
    basis,
    `<strong>求解最优完成：</strong>所有检验数均非负，寻找到唯一最优解！最优坐标极点为 <strong>(${finalSol.x.toFixed(2)}, ${finalSol.y.toFixed(2)})</strong>，最优目标值 Z = <strong>${finalSol.z.toFixed(2)}</strong>。`
  );

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
