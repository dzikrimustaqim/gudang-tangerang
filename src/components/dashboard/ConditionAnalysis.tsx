import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, TrendingUp } from 'lucide-react';
import { DashboardSummary } from '@/types';

interface ConditionAnalysisProps {
  summary: DashboardSummary;
}

const CONDITION_COLORS = {
  'Layak Pakai': { bg: 'bg-green-500', text: 'text-green-700', percentage: 76 },
  'Rusak Ringan': { bg: 'bg-yellow-500', text: 'text-yellow-700', percentage: 16 },
  'Rusak/Hilang': { bg: 'bg-red-500', text: 'text-red-700', percentage: 8 }
} as const;

export function ConditionAnalysis({ summary }: ConditionAnalysisProps) {
  const total = Object.values(summary.items_by_condition).reduce((sum, count) => sum + count, 0);
  
  return (
    <Card className="shadow-lg h-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Analisis Kondisi Item
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pie Chart Visual */}
        <div className="flex items-center justify-center">
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 42 42" className="w-full h-full">
              <circle
                cx="21"
                cy="21"
                r="15.915"
                fill="transparent"
                stroke="#e5e7eb"
                strokeWidth="3"
              />
              {Object.entries(summary.items_by_condition).map(([condition, count], index) => {
                const config = CONDITION_COLORS[condition as keyof typeof CONDITION_COLORS];
                const percentage = (count / total) * 100;
                const strokeDasharray = `${percentage} ${100 - percentage}`;
                const strokeDashoffset = index === 0 ? 25 : 
                  index === 1 ? 25 - (Object.values(summary.items_by_condition)[0] / total * 100) :
                  25 - ((Object.values(summary.items_by_condition)[0] + Object.values(summary.items_by_condition)[1]) / total * 100);
                
                return (
                  <circle
                    key={condition}
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="transparent"
                    stroke={config.bg.replace('bg-', '#').replace('green-500', '10b981').replace('yellow-500', 'f59e0b').replace('red-500', 'ef4444')}
                    strokeWidth="3"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform="rotate(-90 21 21)"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-white">{total}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Item</div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend with improved styling */}
        <div className="space-y-3">
          {Object.entries(summary.items_by_condition).map(([condition, count]) => {
            const config = CONDITION_COLORS[condition as keyof typeof CONDITION_COLORS];
            const percentage = Math.round((count / total) * 100);
            return (
              <div key={condition} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 ${config.bg} rounded-full shadow-sm`}></div>
                  <span className="text-sm font-medium">{condition}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{count}</span>
                  <span className={`text-xs ${config.text} bg-white dark:bg-gray-700 px-2 py-1 rounded-full`}>
                    {percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>


      </CardContent>
    </Card>
  );
}