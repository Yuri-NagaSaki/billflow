import { apiClient } from '@/utils/api-client';

export interface SchedulerSettings {
  notification_check_time: string;
  timezone: string;
  is_enabled: boolean;
}

export interface SchedulerStatus {
  running: boolean;
  nextRun: boolean;
  settings: SchedulerSettings;
  currentSchedule: {
    time: string;
    timezone: string;
    enabled: boolean;
  } | null;
}

export const schedulerApi = {
  // 获取调度器设置
  getSettings: (): Promise<SchedulerSettings> =>
    apiClient.get<SchedulerSettings>('/scheduler/settings'),

  // 更新调度器设置
  updateSettings: (settings: Partial<SchedulerSettings>): Promise<{ message: string; settings: SchedulerSettings }> =>
    apiClient.put<{ message: string; settings: SchedulerSettings }>('/protected/scheduler/settings', settings),

  // 获取调度器状态
  getStatus: (): Promise<SchedulerStatus> =>
    apiClient.get<SchedulerStatus>('/scheduler/status'),

  // 手动触发通知检查
  triggerCheck: (): Promise<{ message: string }> =>
    apiClient.post<{ message: string }>('/protected/scheduler/trigger', {})
};
