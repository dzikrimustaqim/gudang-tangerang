import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  colorScheme: {
    gradient: string;
    text: string;
    icon: string;
    value: string;
    subtitle: string;
  };
  className?: string;
}

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  colorScheme,
  className 
}: StatCardProps) {
  return (
    <Card className={cn(
      "border-0 shadow-lg bg-gradient-to-br", 
      colorScheme.gradient,
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={cn("text-sm font-medium", colorScheme.text)}>
          {title}
        </CardTitle>
        <Icon className={cn("h-4 w-4", colorScheme.icon)} />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", colorScheme.value)}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <p className={cn("text-xs", colorScheme.subtitle)}>
          {subtitle}
        </p>
      </CardContent>
    </Card>
  );
}