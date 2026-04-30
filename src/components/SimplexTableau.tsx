import React from 'react';
import { SimplexStep } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  step: SimplexStep;
  title: string;
}

export const SimplexTableau: React.FC<Props> = ({ step, title }) => {
  return (
    <div className="w-full flex flex-col h-full bg-white overflow-hidden">
      {title && <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 p-4 border-b border-slate-100">{title}</h3>}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[10px] font-mono border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr className="border-b border-slate-200">
              <th className="p-3 border-r border-slate-200 font-bold text-slate-500 text-left w-16">基变量</th>
              {step.headers.map((h, i) => (
                <th 
                  key={i} 
                  className={cn(
                      "p-3 text-center transition-colors",
                      step.pivotCol === i ? "bg-indigo-600 text-white font-black" : "text-slate-600 font-bold"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {step.tableau.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-50 transition-colors group">
                <td className="p-3 border-r border-slate-200 font-bold text-slate-400 group-hover:text-slate-600 bg-slate-50/50">
                  {rowIndex === 0 ? '检验数' : step.basis[rowIndex - 1]}
                </td>
                {row.map((val, colIndex) => (
                  <td 
                    key={colIndex} 
                    className={cn(
                      "p-3 text-center min-w-[70px] transition-all",
                      step.pivotCol === colIndex && "bg-indigo-50/30",
                      step.pivotRow === rowIndex && "bg-slate-50",
                      step.pivotRow === rowIndex && step.pivotCol === colIndex && "bg-indigo-50 font-black text-indigo-700 ring-2 ring-indigo-500/20 ring-inset"
                    )}
                  >
                    {val.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <div className="w-2.5 h-2.5 bg-indigo-600 rounded-sm"></div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">入基变量</span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <div className="w-2.5 h-2.5 bg-slate-200 rounded-sm"></div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">出基变量</span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <div className="w-2.5 h-2.5 bg-indigo-50 border border-indigo-500/30 rounded-sm"></div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">主元素 (Pivot)</span>
        </div>
      </div>
    </div>
  );
};
