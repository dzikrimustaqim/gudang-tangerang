import type {
  Item,
  Distribution,
  OPD,
  OPDLocation,
  Category,
  Brand,
  Type,
  CreateItemRequest,
  CreateDistributionRequest,
  CreateOPDRequest,
  CreateOPDLocationRequest,
  CreateCategoryRequest,
  CreateBrandRequest,
  CreateTypeRequest,
  DashboardSummary,
  PaginatedResponse
} from '@/types/api';

// Use relative URL so it works through nginx proxy
const API_BASE_URL = '/api/v1';

class ApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      // Try to get error message from response body
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If parsing fails, use default message
      }
      
      const error = new Error(errorMessage);
      (error as any).response = { 
        status: response.status,
        data: { error: errorMessage }
      };
      throw error;
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // Dashboard
  async getDashboardSummary(): Promise<DashboardSummary> {
    return this.request<DashboardSummary>('/dashboard/summary');
  }

  async getRecentDistributions(): Promise<Distribution[]> {
    return this.request<Distribution[]>('/dashboard/recent-distributions');
  }

  // Items
  async getItems(params?: Record<string, string | number>): Promise<PaginatedResponse<Item>> {
    const queryString = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return this.request<PaginatedResponse<Item>>(`/items${queryString ? `?${queryString}` : ''}`);
  }

  async getItem(id: string): Promise<Item> {
    return this.request<Item>(`/items/${id}`);
  }

  async createItem(data: CreateItemRequest): Promise<Item> {
    return this.request<Item>('/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateItem(id: string, data: Partial<CreateItemRequest>): Promise<Item> {
    return this.request<Item>(`/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteItem(id: string): Promise<void> {
    return this.request<void>(`/items/${id}`, {
      method: 'DELETE',
    });
  }

  async searchItems(query: string): Promise<Item[]> {
    return this.request<Item[]>(`/items/search?q=${encodeURIComponent(query)}`);
  }

  // distributions
  async getDistributions(params?: Record<string, string | number>): Promise<PaginatedResponse<Distribution>> {
    const queryString = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return this.request<PaginatedResponse<Distribution>>(`/distributions${queryString ? `?${queryString}` : ''}`);
  }

  async createDistribution(data: CreateDistributionRequest): Promise<Distribution> {
    return this.request<Distribution>('/distributions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDistribution(distribution_code: string, data: Partial<CreateDistributionRequest>): Promise<Distribution> {
    return this.request<Distribution>(`/distributions/${distribution_code}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDistribution(distribution_code: string): Promise<void> {
    return this.request<void>(`/distributions/${distribution_code}`, {
      method: 'DELETE',
    });
  }

  // OPDs
  async getOPDs(): Promise<OPD[]> {
    return this.request<OPD[]>('/opds');
  }

  async createOPD(data: CreateOPDRequest): Promise<OPD> {
    return this.request<OPD>('/opds', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOPD(id: string, data: Partial<CreateOPDRequest>): Promise<OPD> {
    return this.request<OPD>(`/opds/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteOPD(id: string): Promise<void> {
    return this.request<void>(`/opds/${id}`, {
      method: 'DELETE',
    });
  }

  // OPD Locations
  async getOPDLocations(opdId: string): Promise<OPDLocation[]> {
    return this.request<OPDLocation[]>(`/opds/${opdId}/locations`);
  }

  async createOPDLocation(opdId: string, data: CreateOPDLocationRequest): Promise<OPDLocation> {
    return this.request<OPDLocation>(`/opds/${opdId}/locations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOPDLocation(opdId: string, locationId: string, data: Partial<CreateOPDLocationRequest>): Promise<OPDLocation> {
    return this.request<OPDLocation>(`/opds/${opdId}/locations/${locationId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteOPDLocation(opdId: string, locationId: string): Promise<void> {
    return this.request<void>(`/opds/${opdId}/locations/${locationId}`, {
      method: 'DELETE',
    });
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/categories');
  }

  async createCategory(data: CreateCategoryRequest): Promise<Category> {
    return this.request<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: Partial<CreateCategoryRequest>): Promise<Category> {
    return this.request<Category>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string): Promise<void> {
    return this.request<void>(`/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // Brands
  async getBrands(categoryId?: string): Promise<Brand[]> {
    const query = categoryId ? `?category_id=${categoryId}` : '';
    return this.request<Brand[]>(`/brands${query}`);
  }

  async createBrand(data: CreateBrandRequest): Promise<Brand> {
    return this.request<Brand>('/brands', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBrand(id: string, data: Partial<CreateBrandRequest>): Promise<Brand> {
    return this.request<Brand>(`/brands/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBrand(id: string): Promise<void> {
    return this.request<void>(`/brands/${id}`, {
      method: 'DELETE',
    });
  }

  // Types
  async getTypes(brandId?: string): Promise<Type[]> {
    const query = brandId ? `?brand_id=${brandId}` : '';
    return this.request<Type[]>(`/types${query}`);
  }

  async createType(data: CreateTypeRequest): Promise<Type> {
    return this.request<Type>('/types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateType(id: string, data: Partial<CreateTypeRequest>): Promise<Type> {
    return this.request<Type>(`/types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteType(id: string): Promise<void> {
    return this.request<void>(`/types/${id}`, {
      method: 'DELETE',
    });
  }

  // Reset all data
  async resetAllData(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/reset', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
