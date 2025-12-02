import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, Plus, Edit, Trash2, Package, ChevronDown, ChevronRight, Tag, Layers } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Category, Brand, Type } from '@/types/api';

export default function CategoryManagement() {
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Record<string, Brand[]>>({});
  const [types, setTypes] = useState<Record<string, Type[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

  // Dialog states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isBrandDialogOpen, setIsBrandDialogOpen] = useState(false);
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);
  const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] = useState(false);
  const [isDeleteBrandDialogOpen, setIsDeleteBrandDialogOpen] = useState(false);
  const [isDeleteTypeDialogOpen, setIsDeleteTypeDialogOpen] = useState(false);

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [editingType, setEditingType] = useState<Type | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null);
  const [deletingType, setDeletingType] = useState<Type | null>(null);

  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [brandForm, setBrandForm] = useState({ category_id: '', name: '' });
  const [typeForm, setTypeForm] = useState({ brand_id: '', name: '' });

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const categoriesRes = await api.getCategories();
      setCategories(categoriesRes);

      // Fetch brands for all categories
      const brandsMap: Record<string, Brand[]> = {};
      const typesMap: Record<string, Type[]> = {};
      
      await Promise.all(
        categoriesRes.map(async (category) => {
          try {
            const categoryBrands = await api.getBrands(category.id);
            brandsMap[category.id] = categoryBrands;

            // Fetch types for each brand
            await Promise.all(
              categoryBrands.map(async (brand) => {
                try {
                  const brandTypes = await api.getTypes(brand.id);
                  typesMap[brand.id] = brandTypes;
                } catch (error) {
                  console.error(`Error fetching types for brand ${brand.id}:`, error);
                  typesMap[brand.id] = [];
                }
              })
            );
          } catch (error) {
            console.error(`Error fetching brands for category ${category.id}:`, error);
            brandsMap[category.id] = [];
          }
        })
      );

      setBrands(brandsMap);
      setTypes(typesMap);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-expand when searching matches brands or types
  useEffect(() => {
    if (!search || search.trim() === '') {
      // Clear expansions when search is empty
      setExpandedCategories(new Set());
      setExpandedBrands(new Set());
      return;
    }

    const searchLower = search.toLowerCase();
    const newExpandedCategories = new Set<string>();
    const newExpandedBrands = new Set<string>();

    // Check each category for brand/type matches
    categories.forEach(category => {
      const categoryBrands = brands[category.id] || [];
      
      // Check if any brand or type matches
      categoryBrands.forEach(brand => {
        const brandTypes = types[brand.id] || [];
        
        // Check if brand name matches
        const brandNameMatch = brand.name.toLowerCase().includes(searchLower);
        
        // Check if any type matches
        const typeMatch = brandTypes.some(type => 
          type.name.toLowerCase().includes(searchLower)
        );
        
        // If brand or type matches but category doesn't, auto-expand category
        const categoryNameMatch = category.name.toLowerCase().includes(searchLower);
        
        if ((brandNameMatch || typeMatch) && !categoryNameMatch) {
          newExpandedCategories.add(category.id);
        }
        
        // If type matches but brand doesn't, auto-expand brand
        if (typeMatch && !brandNameMatch) {
          newExpandedBrands.add(brand.id);
        }
        
        // If brand matches, expand category
        if (brandNameMatch && !categoryNameMatch) {
          newExpandedCategories.add(category.id);
        }
      });
    });

    setExpandedCategories(newExpandedCategories);
    setExpandedBrands(newExpandedBrands);
  }, [search, categories, brands, types]);

  // Toggle expand
  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleBrand = (brandId: string) => {
    const newExpanded = new Set(expandedBrands);
    if (newExpanded.has(brandId)) {
      newExpanded.delete(brandId);
    } else {
      newExpanded.add(brandId);
    }
    setExpandedBrands(newExpanded);
  };

  // Expand/Collapse All
  const handleExpandAll = () => {
    const allCategoryIds = new Set(categories.map(c => c.id));
    const allBrandIds = new Set(
      Object.values(brands).flat().map(b => b.id)
    );
    setExpandedCategories(allCategoryIds);
    setExpandedBrands(allBrandIds);
  };

  const handleCollapseAll = () => {
    setExpandedCategories(new Set());
    setExpandedBrands(new Set());
  };

  // Category CRUD
  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '' });
    setIsCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name });
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, categoryForm);
        toast.success('Kategori berhasil diperbarui');
      } else {
        await api.createCategory(categoryForm);
        toast.success('Kategori berhasil ditambahkan');
      }
      setIsCategoryDialogOpen(false);
      fetchData();
      // Trigger refresh di tab lain
      window.dispatchEvent(new Event('masterDataChanged'));
    } catch (error) {
      toast.error('Gagal menyimpan kategori');
    }
  };

  const handleDeleteCategory = (category: Category) => {
    setDeletingCategory(category);
    setIsDeleteCategoryDialogOpen(true);
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    
    try {
      await api.deleteCategory(deletingCategory.id);
      toast.success('Kategori berhasil dihapus');
      setIsDeleteCategoryDialogOpen(false);
      setDeletingCategory(null);
      fetchData();
      // Trigger refresh di tab lain
      window.dispatchEvent(new Event('masterDataChanged'));
    } catch (error) {
      toast.error('Gagal menghapus kategori');
    }
  };

  // Brand CRUD
  const handleAddBrand = (categoryId: string) => {
    setEditingBrand(null);
    setBrandForm({ category_id: categoryId, name: '' });
    setIsBrandDialogOpen(true);
  };

  const handleEditBrand = (brand: Brand) => {
    setEditingBrand(brand);
    setBrandForm({ category_id: brand.category_id, name: brand.name });
    setIsBrandDialogOpen(true);
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBrand) {
        await api.updateBrand(editingBrand.id, { name: brandForm.name });
        toast.success('Merek berhasil diperbarui');
      } else {
        await api.createBrand(brandForm);
        toast.success('Merek berhasil ditambahkan');
      }
      setIsBrandDialogOpen(false);
      await fetchData();
      
      // Trigger refresh di semua tab dengan delay untuk memastikan backend sudah selesai
      setTimeout(() => {
        window.dispatchEvent(new Event('masterDataChanged'));
        window.dispatchEvent(new Event('storage')); // Trigger storage event untuk extra compatibility
      }, 100);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Gagal menyimpan merek';
      toast.error(errorMsg);
    }
  };

  const handleDeleteBrand = (brand: Brand) => {
    setDeletingBrand(brand);
    setIsDeleteBrandDialogOpen(true);
  };

  const confirmDeleteBrand = async () => {
    if (!deletingBrand) return;
    
    try {
      await api.deleteBrand(deletingBrand.id);
      toast.success('Merek berhasil dihapus');
      setIsDeleteBrandDialogOpen(false);
      setDeletingBrand(null);
      fetchData();
      // Trigger refresh di tab lain
      window.dispatchEvent(new Event('masterDataChanged'));
    } catch (error) {
      toast.error('Gagal menghapus merek');
    }
  };

  // Type CRUD
  const handleAddType = (brandId: string) => {
    setEditingType(null);
    setTypeForm({ brand_id: brandId, name: '' });
    setIsTypeDialogOpen(true);
  };

  const handleEditType = (type: Type) => {
    setEditingType(type);
    setTypeForm({ brand_id: type.brand_id, name: type.name });
    setIsTypeDialogOpen(true);
  };

  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingType) {
        await api.updateType(editingType.id, { name: typeForm.name });
        toast.success('Tipe berhasil diperbarui');
      } else {
        await api.createType(typeForm);
        toast.success('Tipe berhasil ditambahkan');
      }
      setIsTypeDialogOpen(false);
      await fetchData();
      
      // Trigger refresh di semua tab
      setTimeout(() => {
        window.dispatchEvent(new Event('masterDataChanged'));
        window.dispatchEvent(new Event('storage'));
      }, 100);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Gagal menyimpan tipe';
      toast.error(errorMsg);
    }
  };

  const handleDeleteType = (type: Type) => {
    setDeletingType(type);
    setIsDeleteTypeDialogOpen(true);
  };

  const confirmDeleteType = async () => {
    if (!deletingType) return;
    
    try {
      await api.deleteType(deletingType.id);
      toast.success('Tipe berhasil dihapus');
      setIsDeleteTypeDialogOpen(false);
      setDeletingType(null);
      fetchData();
      // Trigger refresh di tab lain
      window.dispatchEvent(new Event('masterDataChanged'));
    } catch (error) {
      toast.error('Gagal menghapus tipe');
    }
  };

  // Filter - search across categories, brands, and types
  const filteredCategories = categories.filter(category => {
    const searchLower = search.toLowerCase().trim();
    
    if (!searchLower) {
      return true;
    }
    
    // Check category name
    const categoryMatch = category.name.toLowerCase().includes(searchLower);
    
    // Check brand names
    const categoryBrands = brands[category.id] || [];
    const brandMatch = categoryBrands.some(brand => 
      brand.name.toLowerCase().includes(searchLower)
    );
    
    // Check type names
    const typeMatch = categoryBrands.some(brand => {
      const brandTypes = types[brand.id] || [];
      return brandTypes.some(type => 
        type.name.toLowerCase().includes(searchLower)
      );
    });
    
    return categoryMatch || brandMatch || typeMatch;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64">Memuat data...</div>;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Kategori Item
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Kelola hierarki kategori, merek, dan tipe produk
            </p>
          </div>
          <Button onClick={handleAddCategory}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Kategori
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Expand/Collapse */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari kategori, merek, atau tipe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={handleExpandAll}
            className="gap-2 whitespace-nowrap"
          >
            <ChevronDown className="h-4 w-4" />
            Expand All
          </Button>
          <Button 
            variant="outline" 
            onClick={handleCollapseAll}
            className="gap-2 whitespace-nowrap"
          >
            <ChevronRight className="h-4 w-4" />
            Collapse All
          </Button>
        </div>

        {/* Categories List */}
        <div className="rounded-lg border shadow-sm bg-card">
        <div className="divide-y">
          {filteredCategories.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {search ? 'Tidak ada kategori, merek, atau tipe yang cocok dengan pencarian' : 'Belum ada kategori'}
            </div>
          ) : (
            filteredCategories.map((category) => {
              const categoryBrands = brands[category.id] || [];
              const isExpanded = expandedCategories.has(category.id);

              return (
                <div key={category.id}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(category.id)}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Package className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-lg">{category.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {categoryBrands.length} merek
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddBrand(category.id);
                          }}
                          className="gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Tambah Merek
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCategory(category);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(category);
                          }}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t bg-accent/20 p-4 space-y-2">
                      {categoryBrands.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Belum ada merek. Klik "Tambah Merek" untuk menambahkan.
                        </p>
                      ) : (
                        categoryBrands
                          .filter(brand => {
                            if (!search || search.trim() === '') return true;
                            const searchLower = search.toLowerCase();
                            
                            // Check brand name
                            const brandMatch = brand.name.toLowerCase().includes(searchLower);
                            
                            // Check type names
                            const brandTypes = types[brand.id] || [];
                            const typeMatch = brandTypes.some(type => 
                              type.name.toLowerCase().includes(searchLower)
                            );
                            
                            return brandMatch || typeMatch;
                          })
                          .map((brand) => {
                          const brandTypes = types[brand.id] || [];
                          const isBrandExpanded = expandedBrands.has(brand.id);

                          return (
                            <div key={brand.id} className="ml-8 border rounded-md bg-muted/50 shadow-sm">
                              <Collapsible open={isBrandExpanded} onOpenChange={() => toggleBrand(brand.id)}>
                                <CollapsibleTrigger className="w-full">
                                  <div className="flex items-center justify-between p-3 hover:bg-accent transition-colors border-b">
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-2">
                                        {isBrandExpanded ? (
                                          <ChevronDown className="h-4 w-4 text-foreground" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-foreground" />
                                        )}
                                        <div className="h-8 w-8 rounded-md bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                                          <Tag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        </div>
                                      </div>
                                      <div className="text-left">
                                        <h4 className="font-semibold text-sm">{brand.name}</h4>
                                        <p className="text-xs text-muted-foreground font-medium">
                                          {brandTypes.length} tipe
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAddType(brand.id);
                                        }}
                                        className="gap-1 text-xs h-7"
                                      >
                                        <Plus className="h-3 w-3" />
                                        Tambah Tipe
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditBrand(brand);
                                        }}
                                        className="h-7 w-7 p-0"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteBrand(brand);
                                        }}
                                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                  <div className="bg-card/50 p-4">
                                    {brandTypes.length === 0 ? (
                                      <p className="text-sm text-muted-foreground text-center py-4 font-medium">
                                        Belum ada tipe. Klik "Tambah Tipe" untuk menambahkan.
                                      </p>
                                    ) : (
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-6">
                                        {brandTypes
                                          .filter(type => {
                                            if (!search || search.trim() === '') return true;
                                            return type.name.toLowerCase().includes(search.toLowerCase());
                                          })
                                          .map((type) => (
                                          <div
                                            key={type.id}
                                            className="group flex items-center justify-between p-3 rounded-md bg-card border-2 border-border hover:border-primary/60 hover:shadow-md transition-all"
                                          >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <div className="h-6 w-6 rounded bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
                                                <Layers className="h-3.5 w-3.5 text-primary" />
                                              </div>
                                              <span className="text-sm font-semibold truncate">{type.name}</span>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEditType(type)}
                                                className="h-6 w-6 p-0"
                                              >
                                                <Edit className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteType(type)}
                                                className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-4 pb-4">
              <div className="space-y-2">
                <Label htmlFor="categoryName">Nama Kategori *</Label>
                <Input
                  id="categoryName"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ name: e.target.value })}
                  placeholder="Contoh: Router, Laptop, Printer"
                  required
                />
              </div>
            </div>
          </div>
          <div className="border-t pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              Batal
            </Button>
            <Button type="button" onClick={handleSaveCategory}>
              {editingCategory ? 'Perbarui' : 'Tambah'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Brand Dialog */}
      <Dialog open={isBrandDialogOpen} onOpenChange={setIsBrandDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              {editingBrand ? 'Edit Merek' : 'Tambah Merek Baru'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-4 pb-4">
              <div className="space-y-2">
                <Label htmlFor="brandName">Nama Merek *</Label>
                <Input
                  id="brandName"
                  value={brandForm.name}
                  onChange={(e) => setBrandForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Contoh: MikroTik, Cisco, TP-Link"
                  required
                />
              </div>
            </div>
          </div>
          <div className="border-t pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsBrandDialogOpen(false)}>
              Batal
            </Button>
            <Button type="button" onClick={handleSaveBrand}>
              {editingBrand ? 'Perbarui' : 'Tambah'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Type Dialog */}
      <Dialog open={isTypeDialogOpen} onOpenChange={setIsTypeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              {editingType ? 'Edit Tipe' : 'Tambah Tipe Baru'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-4 pb-4">
              <div className="space-y-2">
                <Label htmlFor="typeName">Nama Tipe *</Label>
                <Input
                  id="typeName"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Contoh: RB951Ui-2HnD, RB4011iGS+"
                  required
                />
              </div>
            </div>
          </div>
          <div className="border-t pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsTypeDialogOpen(false)}>
              Batal
            </Button>
            <Button type="button" onClick={handleSaveType}>
              {editingType ? 'Perbarui' : 'Tambah'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Category AlertDialog */}
      <AlertDialog open={isDeleteCategoryDialogOpen} onOpenChange={setIsDeleteCategoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Penghapusan Kategori</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus kategori "{deletingCategory?.name}"? 
              <span className="font-semibold text-destructive"> Semua merek dan tipe di dalamnya juga akan terhapus.</span> Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteCategory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Brand AlertDialog */}
      <AlertDialog open={isDeleteBrandDialogOpen} onOpenChange={setIsDeleteBrandDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Penghapusan Merek</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus merek "{deletingBrand?.name}"? 
              <span className="font-semibold text-destructive"> Semua tipe di dalamnya juga akan terhapus.</span> Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteBrand}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Type AlertDialog */}
      <AlertDialog open={isDeleteTypeDialogOpen} onOpenChange={setIsDeleteTypeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Penghapusan Tipe</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus tipe "{deletingType?.name}"? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteType}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </CardContent>
    </Card>
  );
}
