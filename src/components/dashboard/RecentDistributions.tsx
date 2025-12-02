import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { distributionDirection } from '@/types';

interface distribution {
  id: number;
  item: string;
  direction: distributionDirection;
  opd: string;
  date: string;
}

interface RecentdistributionsProps {
  distributions: distribution[];
}

const DIRECTION_ICONS = {
  'Gudang → OPD': { icon: ArrowUpRight, color: 'text-red-500' },
  'OPD → Gudang': { icon: ArrowDownLeft, color: 'text-green-500' },
  'OPD → OPD': { icon: ArrowRightLeft, color: 'text-blue-500' }
} as const;

export function Recentdistributions({ distributions }: RecentdistributionsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerPage = 4;
  const safedistributions = distributions || [];
  const totalPages = Math.max(1, Math.ceil(safedistributions.length / itemsPerPage));

  const nextPage = () => {
    if (hasNext) {
      setCurrentIndex((prev) => prev + itemsPerPage);
    }
  };

  const prevPage = () => {
    if (hasPrev) {
      setCurrentIndex((prev) => prev - itemsPerPage);
    }
  };

  const currentItems = safedistributions.slice(currentIndex, currentIndex + itemsPerPage);
  const hasNext = currentIndex + itemsPerPage < safedistributions.length;
  const hasPrev = currentIndex > 0;

  return (
    <Card className="shadow-lg h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            Distribusi Terbaru
          </CardTitle>
          {safedistributions.length > itemsPerPage && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={prevPage}
                disabled={!hasPrev}
                className={`h-9 w-9 p-0 transition-all duration-200 ${!hasPrev ? 'opacity-50' : 'hover:bg-amber-50 hover:border-amber-300'}`}
                title="Halaman sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              {/* Page indicators */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, pageIndex) => {
                  const currentPage = Math.floor(currentIndex / itemsPerPage);
                  return (
                    <button
                      key={pageIndex}
                      onClick={() => setCurrentIndex(pageIndex * itemsPerPage)}
                      className={`h-2 w-2 rounded-full transition-all duration-200 ${
                        pageIndex === currentPage 
                          ? 'bg-amber-600 w-4' 
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                      title={`Halaman ${pageIndex + 1}`}
                    />
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={nextPage}
                disabled={!hasNext}
                className={`h-9 w-9 p-0 transition-all duration-200 ${!hasNext ? 'opacity-50' : 'hover:bg-amber-50 hover:border-amber-300'}`}
                title="Halaman berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="min-h-[240px]"> {/* Fixed height container for 4 items */}
          {safedistributions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Clock className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Tidak ada distribusi terbaru</p>
            </div>
          ) : (
            <>
              {currentItems.map((distribution) => {
                const { icon: Icon, color } = DIRECTION_ICONS[distribution.direction];
                return (
                  <div 
                    key={distribution.id} 
                    className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 transition-all duration-200 hover:from-amber-100 hover:to-amber-150 hover:shadow-md cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-3 h-3 bg-amber-600 rounded-full"></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate text-gray-700 group-hover:text-amber-700 transition-colors">
                          {distribution.item}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {distribution.opd}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center justify-center w-6 h-6 bg-white rounded-full shadow-sm">
                        <Icon className={`h-3 w-3 ${color}`} />
                      </div>
                      <Badge variant="secondary" className="text-xs font-semibold bg-amber-600 text-white px-2 py-1">
                        {distribution.date}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              
              {/* Fill empty slots to maintain consistent height */}
              {Array.from({ length: itemsPerPage - currentItems.length }).map((_, index) => (
                <div key={`empty-${index}`} className="h-[56px]" />
              ))}
            </>
          )}
        </div>
        
        {/* Show total count */}
        {safedistributions.length > 0 && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Total Distribusi:</span>
              <span className="font-medium">{safedistributions.length}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
