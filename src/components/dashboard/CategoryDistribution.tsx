import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, ChevronLeft, ChevronRight } from 'lucide-react';

interface CategoryDistributionProps {
  categories: Array<{ category_name: string; count: number }>;
}

export function CategoryDistribution({ categories }: CategoryDistributionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerPage = 3;
  const safeCategories = categories || [];
  const totalPages = Math.max(1, Math.ceil(safeCategories.length / itemsPerPage));

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

  const currentItems = safeCategories.slice(currentIndex, currentIndex + itemsPerPage);
  const hasNext = currentIndex + itemsPerPage < safeCategories.length;
  const hasPrev = currentIndex > 0;

  return (
    <Card className="shadow-lg h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Item per Kategori
          </CardTitle>
          {safeCategories.length > itemsPerPage && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={prevPage}
                disabled={!hasPrev}
                className={`h-9 w-9 p-0 transition-all duration-200 ${!hasPrev ? 'opacity-50' : 'hover:bg-blue-50 hover:border-blue-300'}`}
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
                          ? 'bg-blue-600 w-4' 
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
                className={`h-9 w-9 p-0 transition-all duration-200 ${!hasNext ? 'opacity-50' : 'hover:bg-blue-50 hover:border-blue-300'}`}
                title="Halaman berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="min-h-[180px]"> {/* Fixed height container */}
          {safeCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Package className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Belum ada data kategori</p>
            </div>
          ) : (
            <>
              {currentItems.map((category, index) => (
                <div 
                  key={`${category.category_name}-${currentIndex + index}`} 
                  className="flex justify-between items-center p-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 transition-all duration-200 hover:from-blue-100 hover:to-blue-150 hover:shadow-md cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                    <span className="font-medium text-gray-700 group-hover:text-blue-700 transition-colors">{category.category_name}</span>
                  </div>
                  <Badge variant="secondary" className="font-semibold bg-blue-600 text-white px-3 py-1">
                    {category.count}
                  </Badge>
                </div>
              ))}
              
              {/* Fill empty slots to maintain consistent height */}
              {Array.from({ length: itemsPerPage - currentItems.length }).map((_, index) => (
                <div key={`empty-${index}`} className="h-[60px]" />
              ))}
            </>
          )}
        </div>
        
        {/* Show total count */}
        {safeCategories.length > 0 && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Total Kategori:</span>
              <span className="font-medium">{safeCategories.length}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}