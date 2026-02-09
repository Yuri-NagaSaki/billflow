import { create } from 'zustand'
import { apiClient } from '@/utils/api-client'
import { Subscription } from './subscriptionStore'
import { transformToApi } from './subscriptionStore'

interface OptimisticUpdate {
  id: string
  type: 'create' | 'update' | 'delete'
  data: Partial<Subscription>
  timestamp: number
}

interface OptimisticState {
  pendingUpdates: OptimisticUpdate[]
  addOptimisticUpdate: (update: OptimisticUpdate) => void
  removeOptimisticUpdate: (id: string) => void
  clearOptimisticUpdates: () => void
}

export const useOptimisticStore = create<OptimisticState>((set) => ({
  pendingUpdates: [],
  
  addOptimisticUpdate: (update) => set((state) => ({
    pendingUpdates: [...state.pendingUpdates, update]
  })),
  
  removeOptimisticUpdate: (id) => set((state) => ({
    pendingUpdates: state.pendingUpdates.filter(u => u.id !== id)
  })),
  
  clearOptimisticUpdates: () => set({ pendingUpdates: [] })
}))

// Optimistic update functions
export const optimisticUpdateSubscription = async (
  id: number,
  data: Partial<Subscription>,
  onSuccess: () => void,
  onError: (error: Error) => void
) => {
  const updateId = `update-${id}-${Date.now()}`
  
  // Add optimistic update
  useOptimisticStore.getState().addOptimisticUpdate({
    id: updateId,
    type: 'update',
    data: { ...data, id },
    timestamp: Date.now()
  })
  
  try {
    // Make API call (convert to API schema)
    const apiData = transformToApi(data)
    await apiClient.put(`/protected/subscriptions/${id}`, apiData)
    
    // Remove optimistic update and trigger success
    useOptimisticStore.getState().removeOptimisticUpdate(updateId)
    onSuccess()
  } catch (error) {
    // Remove optimistic update and trigger error
    useOptimisticStore.getState().removeOptimisticUpdate(updateId)
    onError(error as Error)
  }
}

export const optimisticCreateSubscription = async (
  data: Omit<Subscription, 'id'>,
  onSuccess: (id: number) => void,
  onError: (error: Error) => void
) => {
  const updateId = `create-${Date.now()}`
  const tempId = -Date.now() // Negative ID for temporary subscription
  
  // Add optimistic update
  useOptimisticStore.getState().addOptimisticUpdate({
    id: updateId,
    type: 'create',
    data: { ...data, id: tempId },
    timestamp: Date.now()
  })
  
  try {
    // Make API call
    const result = await apiClient.post<{ id: number }>('/protected/subscriptions', data)
    
    // Remove optimistic update and trigger success
    useOptimisticStore.getState().removeOptimisticUpdate(updateId)
    onSuccess(result.id)
  } catch (error) {
    // Remove optimistic update and trigger error
    useOptimisticStore.getState().removeOptimisticUpdate(updateId)
    onError(error as Error)
  }
}

export const optimisticDeleteSubscription = async (
  id: number,
  onSuccess: () => void,
  onError: (error: Error) => void
) => {
  const updateId = `delete-${id}-${Date.now()}`
  
  // Add optimistic update
  useOptimisticStore.getState().addOptimisticUpdate({
    id: updateId,
    type: 'delete',
    data: { id },
    timestamp: Date.now()
  })
  
  try {
    // Make API call
    await apiClient.delete(`/protected/subscriptions/${id}`)
    
    // Remove optimistic update and trigger success
    useOptimisticStore.getState().removeOptimisticUpdate(updateId)
    onSuccess()
  } catch (error) {
    // Remove optimistic update and trigger error
    useOptimisticStore.getState().removeOptimisticUpdate(updateId)
    onError(error as Error)
  }
}

// Hook to merge optimistic updates with actual data
export const useOptimisticSubscriptions = (subscriptions: Subscription[]) => {
  const pendingUpdates = useOptimisticStore(state => state.pendingUpdates)
  
  // Apply optimistic updates to subscriptions
  let optimisticSubscriptions = [...subscriptions]
  
  pendingUpdates.forEach(update => {
    switch (update.type) {
      case 'create':
        optimisticSubscriptions.push(update.data as Subscription)
        break
        
      case 'update':
        optimisticSubscriptions = optimisticSubscriptions.map(sub =>
          sub.id === update.data.id ? { ...sub, ...update.data } : sub
        )
        break
        
      case 'delete':
        optimisticSubscriptions = optimisticSubscriptions.filter(
          sub => sub.id !== update.data.id
        )
        break
    }
  })
  
  return optimisticSubscriptions
}