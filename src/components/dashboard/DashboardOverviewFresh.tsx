import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Package, 
  Warehouse, 
  Building2, 
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Activity,
  BarChart3,
  Layers,
  Clock,
  AlertTriangle,
  Zap,
  PieChart,
  Users,
  Calendar,
  MapPin
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import type { Item, Distribution } from '@/types';

interface DashboardStats {
  totalItems: number;
  itemsInWarehouse: number;
  itemsInOPD: number;
  totalDistributions: number;
  layakPakai: number;
  rusakRingan: number;
  rusakHilang: number;
  categoryBreakdown: { name: string; count: number; percentage: number }[];
  opdBreakdown: { name: string; count: number; percentage: number }[];
  brandBreakdown: { name: string; count: number }[];
  typeBreakdown: { name: string; count: number }[];
  recentDistributions: Distribution[];
  distributionsToday: number;
  distributionsThisWeek: number;
  distributionsThisMonth: number;
  toOpdCount: number;
  toWarehouseCount: number;
  betweenOpdCount: number;
  healthScore: number;
}

export default function DashboardOverviewFresh() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeFilter, setTimeFilter] = useState<'3months' | '6months' | '1year' | 'all'>('3months');

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['items'],
    queryFn: async () => await api.getItems() // Fetch all items - no limit
  });
  
  const { data: distributionsData, isLoading: distributionsLoading } = useQuery({
    queryKey: ['distributions'],
    queryFn: async () => await api.getDistributions() // Fetch all distributions - no limit
  });

  const { data: opdsData, isLoading: opdsLoading } = useQuery({
    queryKey: ['opds'],
    queryFn: async () => await api.getOPDs() // Fetch all OPDs
  });

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => await api.getCategories() // Fetch all categories
  });

  const { data: brandsData, isLoading: brandsLoading } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => await api.getBrands() // Fetch all brands
  });

  useEffect(() => {
    if (itemsData && distributionsData && opdsData && categoriesData && brandsData) {
      calculateStats();
    }
  }, [itemsData, distributionsData, opdsData, categoriesData, brandsData, timeFilter]);

  const getFilteredDistributions = (distributions: Distribution[]) => {
    if (timeFilter === 'all') return distributions;
    
    const now = new Date();
    const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let startDate: Date;
    
    switch (timeFilter) {
      case '3months':
        // 3 bulan ke belakang dari hari ini
        startDate = new Date(currentDate);
        startDate.setMonth(startDate.getMonth() - 3);
        startDate.setHours(0, 0, 0, 0);
        break;
      case '6months':
        // 6 bulan ke belakang dari hari ini
        startDate = new Date(currentDate);
        startDate.setMonth(startDate.getMonth() - 6);
        startDate.setHours(0, 0, 0, 0);
        break;
      case '1year':
        // 1 tahun ke belakang dari hari ini
        startDate = new Date(currentDate);
        startDate.setFullYear(startDate.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        return distributions;
    }
    
    return distributions.filter((t: Distribution) => {
      const distributionDate = new Date(t.distribution_date);
      return distributionDate >= startDate && distributionDate <= currentDate;
    });
  };

  const calculateStats = () => {
    if (!itemsData || !distributionsData || !opdsData || !categoriesData || !brandsData) return;

    const items = itemsData.data || [];
    const allDistributions = distributionsData.data || [];
    const allOpds = opdsData || [];
    const allCategories = categoriesData || [];
    const allBrands = brandsData || [];
    const distributions = getFilteredDistributions(allDistributions);

    const totalItems = items.length;
    
    // Count items based on actual current_location field
    const itemsInWarehouse = items.filter((item: Item) => item.current_location === 'Gudang').length;
    const itemsInOPD = items.filter((item: Item) => item.current_location && item.current_location !== 'Gudang').length;

    // Use latest_condition from distribution history
    const layakPakai = items.filter((item: Item) => (item.latest_condition || item.condition) === 'Layak Pakai').length;
    const rusakRingan = items.filter((item: Item) => (item.latest_condition || item.condition) === 'Rusak Ringan').length;
    const rusakHilang = items.filter((item: Item) => (item.latest_condition || item.condition) === 'Rusak/Hilang').length;

    const healthScore = totalItems > 0 ? Math.round((layakPakai / totalItems) * 100) : 0;

    // Category breakdown - Show ALL categories from master data
    const categoryMap = new Map<string, number>();
    
    // Initialize all categories with 0 count
    allCategories.forEach((cat: any) => {
      categoryMap.set(cat.name, 0);
    });
    
    // Count items per category
    items.forEach((item: Item) => {
      const catName = typeof item.category === 'string' ? item.category : (item.category?.name || 'Lainnya');
      if (categoryMap.has(catName)) {
        categoryMap.set(catName, (categoryMap.get(catName) || 0) + 1);
      }
    });
    
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalItems > 0 ? Math.round((count / totalItems) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    // Brand breakdown - Show ALL brands from master data
    const brandMap = new Map<string, number>();
    
    // Initialize all brands with 0 count
    allBrands.forEach((brand: any) => {
      brandMap.set(brand.name, 0);
    });
    
    // Count items per brand
    items.forEach((item: Item) => {
      const brandName = item.brand;
      if (brandName && brandMap.has(brandName)) {
        brandMap.set(brandName, (brandMap.get(brandName) || 0) + 1);
      }
    });
    
    const brandBreakdown = Array.from(brandMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Type breakdown
    const typeMap = new Map<string, number>();
    items.forEach((item: Item) => {
      const typeName = item.type || 'Unknown';
      typeMap.set(typeName, (typeMap.get(typeName) || 0) + 1);
    });
    const typeBreakdown = Array.from(typeMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // OPD breakdown - Show ALL OPDs from master data
    // Count based on current_opd field in items
    const opdMap = new Map<string, number>();
    
    // Initialize all OPDs with 0 count
    allOpds.forEach((opd: any) => {
      opdMap.set(opd.name, 0);
    });
    
    // Count items at each OPD based on current_opd field
    items.forEach((item: Item) => {
      // Check if item is in OPD and has current_opd data
      if (item.current_location === 'OPD' && item.current_opd?.name) {
        const opdName = item.current_opd.name;
        if (opdMap.has(opdName)) {
          opdMap.set(opdName, (opdMap.get(opdName) || 0) + 1);
        }
      }
    });
    
    // Calculate percentages based on total items in OPD (not total items)
    const opdBreakdown = Array.from(opdMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: itemsInOPD > 0 ? Math.round((count / itemsInOPD) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    // Recent distributions
    const recentDistributions = distributions
      .sort((a: Distribution, b: Distribution) => 
        new Date(b.distribution_date).getTime() - new Date(a.distribution_date).getTime()
      )
      .slice(0, 10); // Show last 10 recent transactions

    // Time-based distribution counts
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const distributionsToday = distributions.filter((t: Distribution) => 
      new Date(t.distribution_date) >= todayStart
    ).length;
    const distributionsThisWeek = distributions.filter((t: Distribution) => 
      new Date(t.distribution_date) >= weekStart
    ).length;
    const distributionsThisMonth = distributions.filter((t: Distribution) => 
      new Date(t.distribution_date) >= monthStart
    ).length;

    // Distribution direction breakdown (from filtered distributions)
    const toOpdCount = distributions.filter((t: Distribution) => t.direction === 'Gudang → OPD').length;
    const toWarehouseCount = distributions.filter((t: Distribution) => t.direction === 'OPD → Gudang').length;
    const betweenOpdCount = distributions.filter((t: Distribution) => t.direction === 'OPD → OPD').length;

    setStats({
      totalItems,
      itemsInWarehouse,
      itemsInOPD,
      totalDistributions: distributions.length,
      layakPakai,
      rusakRingan,
      rusakHilang,
      categoryBreakdown,
      opdBreakdown,
      brandBreakdown,
      typeBreakdown,
      recentDistributions,
      distributionsToday,
      distributionsThisWeek,
      distributionsThisMonth,
      toOpdCount,
      toWarehouseCount,
      betweenOpdCount,
      healthScore
    });
  };

  if (itemsLoading || distributionsLoading || opdsLoading || !stats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const warehousePercentage = stats.totalItems > 0 ? Math.round((stats.itemsInWarehouse / stats.totalItems) * 100) : 0;
  const opdPercentage = stats.totalItems > 0 ? Math.round((stats.itemsInOPD / stats.totalItems) * 100) : 0;

  const getTimeFilterLabel = () => {
    switch (timeFilter) {
      case '3months': return '3 Bulan Terakhir';
      case '6months': return '6 Bulan Terakhir';
      case '1year': return '1 Tahun Terakhir';
      case 'all': return 'Semua Waktu';
    }
  };

  return (
    <div className="space-y-4">
      {/* Hero Header with Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6 shadow-2xl">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white">Dashboard Inventori</h1>
              </div>
              <p className="text-white/80 text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Real-time monitoring • {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="text-right space-y-2">
              <div className="flex items-center gap-2 justify-end">
                <Clock className="h-5 w-5 text-white/80" />
                <span className="text-2xl font-bold text-white">{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex items-center gap-3">
                <Select value={timeFilter} onValueChange={(value: any) => setTimeFilter(value)}>
                  <SelectTrigger className="w-[180px] bg-white/20 text-white border-white/30 backdrop-blur-sm hover:bg-white/30 transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3months">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        3 Bulan Terakhir
                      </div>
                    </SelectItem>
                    <SelectItem value="6months">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        6 Bulan Terakhir
                      </div>
                    </SelectItem>
                    <SelectItem value="1year">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        1 Tahun Terakhir
                      </div>
                    </SelectItem>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3 w-3" />
                        Semua Waktu
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Statistics Cards - Distribution Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total distributions Card */}
            <div className="relative overflow-hidden bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 hover:bg-white/20 transition-all group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <ArrowUpDown className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs text-white/80 font-medium uppercase tracking-wide">Total Distribusi</span>
                </div>
                <div className="text-4xl font-bold text-white mb-1">{stats.totalDistributions.toLocaleString('id-ID')}</div>
                <div className="flex items-center gap-1">
                  <Activity className="h-3 w-3 text-white/60" />
                  <span className="text-xs text-white/70">{getTimeFilterLabel()}</span>
                </div>
              </div>
            </div>

            {/* Gudang → OPD Card */}
            <div className="relative overflow-hidden bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 hover:bg-white/20 transition-all group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/20 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-red-500/30 rounded-lg">
                    <ArrowUpRight className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs text-white/80 font-medium uppercase tracking-wide">Gudang → OPD</span>
                </div>
                <div className="text-4xl font-bold text-white mb-1">{stats.toOpdCount.toLocaleString('id-ID')}</div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-white/60" />
                  <span className="text-xs text-white/70">Distribusi keluar</span>
                </div>
              </div>
            </div>

            {/* OPD → Gudang Card */}
            <div className="relative overflow-hidden bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 hover:bg-white/20 transition-all group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/20 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-green-500/30 rounded-lg">
                    <ArrowDownLeft className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs text-white/80 font-medium uppercase tracking-wide">OPD → Gudang</span>
                </div>
                <div className="text-4xl font-bold text-white mb-1">{stats.toWarehouseCount.toLocaleString('id-ID')}</div>
                <div className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-white/60" />
                  <span className="text-xs text-white/70">Kembali ke gudang</span>
                </div>
              </div>
            </div>

            {/* OPD → OPD Card */}
            <div className="relative overflow-hidden bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 hover:bg-white/20 transition-all group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/20 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-blue-500/30 rounded-lg">
                    <ArrowRightLeft className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs text-white/80 font-medium uppercase tracking-wide">OPD → OPD</span>
                </div>
                <div className="text-4xl font-bold text-white mb-1">{stats.betweenOpdCount.toLocaleString('id-ID')}</div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-white/60" />
                  <span className="text-xs text-white/70">Transfer antar OPD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Overview - 3 Cards (Not affected by time filter) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Items Card */}
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-500/20 to-gray-500/20 rounded-full -mr-16 -mt-16" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <Package className="h-8 w-8 text-slate-600 dark:text-slate-400" />
              </div>
              <Badge variant="outline" className="text-xs">Total</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Item</p>
              <p className="text-3xl font-bold">{stats.totalItems.toLocaleString('id-ID')}</p>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Warehouse className="h-3.5 w-3.5" />
                  <span className="font-medium">{stats.itemsInWarehouse.toLocaleString('id-ID')} Gudang</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="font-medium">{stats.itemsInOPD.toLocaleString('id-ID')} OPD</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warehouse Stock Card */}
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full -mr-16 -mt-16" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl">
                <Warehouse className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <Badge variant="outline" className="text-xs">{warehousePercentage}%</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Di Gudang</p>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{stats.itemsInWarehouse.toLocaleString('id-ID')}</p>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{warehousePercentage}% dari total</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  <span>Siap distribusi</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Distributed (OPD) Stock Card */}
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full -mr-16 -mt-16" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-xl">
                <Building2 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <Badge variant="outline" className="text-xs">{opdPercentage}%</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Di OPD</p>
              <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{stats.itemsInOPD.toLocaleString('id-ID')}</p>
            </div>
            <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-300">{opdPercentage}% dari total</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{stats.opdBreakdown.length} OPD aktif</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Condition Status */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3 border-b bg-gradient-to-r from-green-50 to-red-50 dark:from-green-950 dark:to-red-950">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChart className="h-5 w-5 text-green-600" />
              Status Kondisi Asset
              <span className="ml-auto text-xs font-normal">
                <Badge className={`${
                  stats.healthScore >= 80 ? 'bg-green-600' :
                  stats.healthScore >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                }`}>
                  {stats.healthScore >= 80 ? 'Excellent' :
                   stats.healthScore >= 60 ? 'Good' : 'Need Attention'}
                </Badge>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-xl border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">{stats.layakPakai}</div>
                <p className="text-xs text-muted-foreground mt-1">Layak Pakai</p>
                <p className="text-xs font-semibold mt-1">{stats.totalItems > 0 ? Math.round((stats.layakPakai / stats.totalItems) * 100) : 0}%</p>
              </div>

              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-xl border border-yellow-200 dark:border-yellow-800">
                <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-yellow-600">{stats.rusakRingan}</div>
                <p className="text-xs text-muted-foreground mt-1">Rusak Ringan</p>
                <p className="text-xs font-semibold mt-1">{stats.totalItems > 0 ? Math.round((stats.rusakRingan / stats.totalItems) * 100) : 0}%</p>
              </div>

              <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-xl border border-red-200 dark:border-red-800">
                <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-red-600">{stats.rusakHilang}</div>
                <p className="text-xs text-muted-foreground mt-1">Rusak/Hilang</p>
                <p className="text-xs font-semibold mt-1">{stats.totalItems > 0 ? Math.round((stats.rusakHilang / stats.totalItems) * 100) : 0}%</p>
              </div>
            </div>

            {/* Distribution bars */}
            <div className="space-y-3 py-3">
              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-7 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden flex shadow-inner">
                  <div 
                    className="bg-green-500 h-full transition-all flex items-center justify-center" 
                    style={{ width: `${stats.totalItems > 0 ? (stats.layakPakai / stats.totalItems) * 100 : 0}%` }}
                  >
                    {stats.layakPakai > 0 && stats.totalItems > 0 && (stats.layakPakai / stats.totalItems) * 100 > 12 && (
                      <span className="text-sm font-bold text-white">
                        {Math.round((stats.layakPakai / stats.totalItems) * 100)}%
                      </span>
                    )}
                  </div>
                  <div 
                    className="bg-yellow-500 h-full transition-all flex items-center justify-center" 
                    style={{ width: `${stats.totalItems > 0 ? (stats.rusakRingan / stats.totalItems) * 100 : 0}%` }}
                  >
                    {stats.rusakRingan > 0 && stats.totalItems > 0 && (stats.rusakRingan / stats.totalItems) * 100 > 6 && (
                      <span className="text-sm font-bold text-white">
                        {Math.round((stats.rusakRingan / stats.totalItems) * 100)}%
                      </span>
                    )}
                  </div>
                  <div 
                    className="bg-red-500 h-full transition-all flex items-center justify-center" 
                    style={{ width: `${stats.totalItems > 0 ? (stats.rusakHilang / stats.totalItems) * 100 : 0}%` }}
                  >
                    {stats.rusakHilang > 0 && stats.totalItems > 0 && (stats.rusakHilang / stats.totalItems) * 100 > 6 && (
                      <span className="text-sm font-bold text-white">
                        {Math.round((stats.rusakHilang / stats.totalItems) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Label bawah bar */}
              <div className="flex justify-center">
                <span className="text-base text-muted-foreground font-semibold">Total: {stats.totalItems} Asset</span>
              </div>
            </div>

            {/* Health Summary Info */}
            <div className="pt-3 mt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">Siap Pakai:</span>
                  <span className="font-semibold text-sm text-green-700 dark:text-green-400">
                    {stats.totalItems > 0 ? Math.round((stats.layakPakai / stats.totalItems) * 100) : 0}%
                  </span>
                </div>
                {stats.rusakRingan + stats.rusakHilang > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      {stats.rusakRingan + stats.rusakHilang} perlu tindakan
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Recent Activity */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-blue-600" />
              Aktivitas Terbaru
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {stats.recentDistributions.length} distribusi terakhir
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2">
              {stats.recentDistributions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Belum ada distribusi</p>
              ) : (
                stats.recentDistributions.map((distribution: Distribution) => {
                  const direction = distribution.direction || '';
                  const isToWarehouse = direction.includes('→ Gudang');
                  const isFromWarehouse = direction.startsWith('Gudang →');
                  
                  // Build source location string
                  let sourceLocationText = '';
                  if (isFromWarehouse) {
                    sourceLocationText = 'Gudang';
                  } else {
                    // Get source OPD name
                    const sourceOpdName = distribution.source_opd?.name || '';
                    // Get source location name
                    const sourceLocName = distribution.source_location || '';
                    sourceLocationText = sourceOpdName && sourceLocName 
                      ? `${sourceOpdName} - ${sourceLocName}` 
                      : (sourceOpdName || sourceLocName || 'N/A');
                  }
                  
                  // Build target location string
                  let targetLocationText = '';
                  if (isToWarehouse) {
                    targetLocationText = 'Gudang';
                  } else {
                    // Get target OPD name
                    const targetOpdName = distribution.target_opd?.name || '';
                    // Get target location name
                    const targetLocName = distribution.specific_location || '';
                    targetLocationText = targetOpdName && targetLocName 
                      ? `${targetOpdName} - ${targetLocName}` 
                      : (targetOpdName || targetLocName || 'N/A');
                  }

                  return (
                    <div 
                      key={distribution.distribution_code} 
                      className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-800 dark:hover:to-gray-700 transition-all border"
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${
                        isToWarehouse ? 'bg-green-100 dark:bg-green-900' :
                        isFromWarehouse ? 'bg-red-100 dark:bg-red-900' :
                        'bg-blue-100 dark:bg-blue-900'
                      }`}>
                        {isToWarehouse ? (
                          <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : isFromWarehouse ? (
                          <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                        ) : (
                          <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {distribution.distribution_code}
                          {' - '}
                          {distribution.item?.serial_number || 'N/A'}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="truncate">{sourceLocationText}</span>
                          <span>→</span>
                          <span className="truncate">{targetLocationText}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold">
                          {new Date(distribution.distribution_date).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section - 3 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Categories */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all">
          <CardHeader className="pb-3 border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 bg-violet-100 dark:bg-violet-900 rounded-lg">
                <Layers className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1">
                <div className="font-bold">Top Kategori</div>
                <div className="text-xs text-muted-foreground font-normal">
                  {stats.categoryBreakdown.length} kategori
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {stats.totalItems} total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
              {stats.categoryBreakdown.map((cat, idx) => (
                <div key={cat.name} className="group hover:bg-violet-50 dark:hover:bg-violet-950 p-2 rounded-lg transition-colors">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 shadow-sm transition-transform group-hover:scale-110 ${
                        idx === 0 ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white' :
                        idx === 1 ? 'bg-gradient-to-br from-violet-400 to-purple-500 text-white' :
                        idx === 2 ? 'bg-gradient-to-br from-violet-300 to-purple-400 text-white' :
                        'bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 text-white'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-semibold">{cat.name}</div>
                        <div className="text-xs text-muted-foreground">{cat.percentage}% dari total</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="font-bold text-lg">{cat.count}</div>
                      <div className="text-xs text-muted-foreground">unit</div>
                    </div>
                  </div>
                  <div className="relative">
                    <Progress value={cat.percentage} className="h-2" />
                    <div className="absolute -top-1 right-0 text-[10px] font-bold text-violet-600 dark:text-violet-400">
                      {cat.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Brands */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all">
          <CardHeader className="pb-3 border-b bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950 dark:to-blue-950">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 bg-cyan-100 dark:bg-cyan-900 rounded-lg">
                <Package className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="flex-1">
                <div className="font-bold">Top Merek</div>
                <div className="text-xs text-muted-foreground font-normal">
                  {stats.brandBreakdown.length} merek
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {stats.totalItems} total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
              {stats.brandBreakdown.map((brand, idx) => {
                const percentage = stats.totalItems > 0 ? Math.round((brand.count / stats.totalItems) * 100) : 0;
                return (
                  <div key={brand.name} className="group hover:bg-cyan-50 dark:hover:bg-cyan-950 p-2 rounded-lg transition-colors">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 shadow-sm transition-transform group-hover:scale-110 ${
                          idx === 0 ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white' :
                          idx === 1 ? 'bg-gradient-to-br from-cyan-400 to-blue-500 text-white' :
                          idx === 2 ? 'bg-gradient-to-br from-cyan-300 to-blue-400 text-white' :
                          'bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 text-white'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-semibold">{brand.name}</div>
                          <div className="text-xs text-muted-foreground">{percentage}% dari total</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="font-bold text-lg text-cyan-700 dark:text-cyan-300">{brand.count}</div>
                        <div className="text-xs text-muted-foreground">unit</div>
                      </div>
                    </div>
                    <div className="relative">
                      <Progress value={percentage} className="h-2" />
                      <div className="absolute -top-1 right-0 text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                        {percentage}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* OPD */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all">
          <CardHeader className="pb-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="font-bold">Top OPD</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Berdasarkan jumlah asset saat ini
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {stats.itemsInOPD} total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
              {stats.opdBreakdown.map((opd, idx) => (
                <div key={opd.name} className="group hover:bg-blue-50 dark:hover:bg-blue-950 p-2 rounded-lg transition-colors">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 shadow-sm transition-transform group-hover:scale-110 ${
                        idx === 0 ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' :
                        idx === 1 ? 'bg-gradient-to-br from-blue-400 to-indigo-500 text-white' :
                        idx === 2 ? 'bg-gradient-to-br from-blue-300 to-indigo-400 text-white' :
                        'bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 text-white'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-semibold">{opd.name}</div>
                        <div className="text-xs text-muted-foreground">{opd.percentage}% dari total OPD</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="font-bold text-lg text-blue-700 dark:text-blue-300">{opd.count}</div>
                      <div className="text-xs text-muted-foreground">item</div>
                    </div>
                  </div>
                  <div className="relative">
                    <Progress value={opd.percentage} className="h-2" />
                    <div className="absolute -top-1 right-0 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      {opd.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
