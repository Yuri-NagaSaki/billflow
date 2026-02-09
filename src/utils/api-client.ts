import { API_BASE_URL, getHeaders, ApiError } from '@/config/api';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  skipCache?: boolean;
};

interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

const defaultCacheTtl = 30_000; // 30 seconds

class ApiClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pendingRequests = new Map<string, Promise<any>>();
  private responseCache = new Map<string, CacheEntry>();

  private getCacheKey(url: string, options?: RequestOptions): string {
    return `${options?.method || 'GET'}-${url}`;
  }

  async request<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const method = options?.method || 'GET';

    // Check response cache for GET requests
    if (method === 'GET' && !options?.skipCache) {
      const cacheKey = this.getCacheKey(endpoint, options);
      const cached = this.responseCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return cached.data as T;
      }
    }

    // Deduplicate GET requests
    if (method === 'GET') {
      const cacheKey = this.getCacheKey(endpoint, options);
      const pending = this.pendingRequests.get(cacheKey);
      if (pending) {
        return pending;
      }
    }

    const requestPromise = this.performRequest<T>(url, method, options);

    if (method === 'GET') {
      const cacheKey = this.getCacheKey(endpoint, options);
      this.pendingRequests.set(cacheKey, requestPromise);

      requestPromise
        .then((data) => {
          // Store successful response in cache
          this.responseCache.set(cacheKey, {
            data,
            timestamp: Date.now(),
            ttl: defaultCacheTtl,
          });
        })
        .catch(() => {
          // Don't cache errors
        })
        .finally(() => {
          this.pendingRequests.delete(cacheKey);
        });
    }

    // Invalidate all cached responses on write operations
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      requestPromise.then(() => {
        this.responseCache.clear();
      }).catch(() => {
        // Still invalidate cache on failed writes to be safe
        this.responseCache.clear();
      });
    }

    return requestPromise;
  }

  private async performRequest<T>(
    url: string,
    method: string,
    options?: RequestOptions
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...getHeaders(method),
          ...options?.headers,
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: options?.signal,
        credentials: 'include',
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new ApiError(
          responseData.error || responseData.message || 'Request failed',
          response.status,
          responseData
        );
      }

      // Handle new unified response format
      if (responseData.success !== undefined) {
        if (responseData.success && responseData.data !== undefined) {
          return responseData.data as T;
        } else if (!responseData.success) {
          throw new ApiError(
            responseData.error || responseData.message || 'Request failed',
            response.status,
            responseData
          );
        }
      }

      // Fallback for old format
      return responseData as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new ApiError('Network error. Please check your connection.');
      }

      throw new ApiError(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    }
  }

  /** Invalidate cached responses. If pattern is provided, only matching keys are removed. */
  invalidateCache(pattern?: string) {
    if (!pattern) {
      this.responseCache.clear();
      return;
    }
    for (const key of this.responseCache.keys()) {
      if (key.includes(pattern)) {
        this.responseCache.delete(key);
      }
    }
  }

  // Convenience methods
  async get<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export type for dependency injection if needed
export type { ApiClient };
