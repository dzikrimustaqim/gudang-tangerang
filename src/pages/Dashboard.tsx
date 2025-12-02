import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  Package, 
  Building2, 
  TrendingUp, 
  ArrowRightLeft,
  Download,
  Trash2
} from 'lucide-react';
import { APP_CONFIG } from '@/constants';
import StockTab from '@/components/dashboard/StockTab';
import DistributionTab from '@/components/dashboard/DistributionTab';
import MasterDataTab from '@/components/dashboard/MasterDataTab';
import ResetTab from '@/components/dashboard/ResetTab';
import DashboardOverviewFresh from '@/components/dashboard/DashboardOverviewFresh';
import ExportDialog from '@/components/dashboard/ExportDialog';
import { ModeToggle } from '@/components/mode-toggle';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => await api.getCategories()
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Package className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold">{APP_CONFIG.name}</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsExportDialogOpen(true)}
            >
              <Download className="mr-2 h-4 w-4" />
              Ekspor
            </Button>
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-3xl h-auto">
            <TabsTrigger value="overview" className="flex items-center gap-2 px-3 py-2 h-auto min-h-[40px] text-sm whitespace-nowrap">
              <TrendingUp className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Ringkasan</span>
            </TabsTrigger>
            <TabsTrigger value="stock" className="flex items-center gap-2 px-3 py-2 h-auto min-h-[40px] text-sm whitespace-nowrap">
              <Package className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Stok</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2 px-3 py-2 h-auto min-h-[40px] text-sm whitespace-nowrap">
              <ArrowRightLeft className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Distribusi</span>
            </TabsTrigger>
            <TabsTrigger value="master" className="flex items-center gap-2 px-3 py-2 h-auto min-h-[40px] text-sm whitespace-nowrap">
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Data Master</span>
            </TabsTrigger>
            <TabsTrigger value="reset" className="flex items-center gap-2 px-3 py-2 h-auto min-h-[40px] text-sm whitespace-nowrap">
              <Trash2 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Reset</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <DashboardOverviewFresh />
          </TabsContent>

          <TabsContent value="stock" className="space-y-6">
            <StockTab />
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6">
            <DistributionTab />
          </TabsContent>

          <TabsContent value="master" className="space-y-6">
            <MasterDataTab />
          </TabsContent>

          <TabsContent value="reset" className="space-y-6">
            <ResetTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Export Dialog */}
      <ExportDialog 
        isOpen={isExportDialogOpen} 
        onClose={() => setIsExportDialogOpen(false)}
        categories={categoriesData || []}
      />
    </div>
  );
}