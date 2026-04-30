
export type ConstraintOperator = '<=' | '>=' | '=';

export interface Constraint {
  id: string;
  a1: number;
  a2: number;
  operator: ConstraintOperator;
  b: number;
}

export interface LPProblem {
  objective: 'max' | 'min';
  c1: number;
  c2: number;
  constraints: Constraint[];
}

export interface SimplexStep {
  tableau: number[][];
  basis: string[];
  headers: string[];
  pivotRow: number | null;
  pivotCol: number | null;
  currentX: number;
  currentY: number;
  objectiveValue: number;
}

export interface Point {
  x: number;
  y: number;
}
