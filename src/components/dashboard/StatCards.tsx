import { Package, Warehouse, Building2, TrendingUp } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { CARD_COLORS } from '@/constants';
import { DashboardSummary } from '@/types';

interface StatCardsProps {
  summary: DashboardSummary;
}

export function StatCards({ summary }: StatCardsProps) {
  const warehousePercentage = Math.round((summary.items_in_warehouse / summary.total_items) * 100);
  const opdPercentage = Math.round((summary.items_in_opd / summary.total_items) * 100);

  const stats = [
    {
      title: 'Total Item',
      value: summary.total_items,
      subtitle: '+12% dari bulan lalu',
      icon: Package,
      colorScheme: CARD_COLORS.blue
    },
    {
      title: 'Di Gudang',
      value: summary.items_in_warehouse,
      subtitle: `${warehousePercentage}% dari total inventori`,
      icon: Warehouse,
      colorScheme: CARD_COLORS.emerald
    },
    {
      title: 'Di Unit OPD',
      value: summary.items_in_opd,
      subtitle: `${opdPercentage}% disebar ke unit`,
      icon: Building2,
      colorScheme: CARD_COLORS.purple
    },
    {
      title: 'Distribusi',
      value: summary.total_transactions,
      subtitle: '+8% bulan ini',
      icon: TrendingUp,
      colorScheme: CARD_COLORS.amber
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          title={stat.title}
          value={stat.value}
          subtitle={stat.subtitle}
          icon={stat.icon}
          colorScheme={stat.colorScheme}
        />
      ))}
    </div>
  );
}