import { ApiError } from '@/config/api';

// Validation error helper
export const getValidationErrors = (error: ApiError): Record<string, string> => {
  if (error.data?.errors && typeof error.data.errors === 'object') {
    return error.data.errors;
  }
  return {};
};

// Network error check
export const isNetworkError = (error: Error): boolean => {
  return error instanceof TypeError && error.message === 'Failed to fetch';
};

// Retry logic
export const retryWithBackoff = async <T,>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0 || !isNetworkError(error as Error)) {
      throw error;
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
};
