import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, Settings, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { schedulerApi, SchedulerSettings as SchedulerSettingsType, SchedulerStatus } from '@/services/schedulerApi';

export function SchedulerSettings() {
  const { t } = useTranslation('notification');
  const [settings, setSettings] = useState<SchedulerSettingsType>({
    notification_check_time: '09:00',
    timezone: 'Asia/Shanghai',
    is_enabled: true
  });
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const timezones = [
    { value: 'Asia/Shanghai', label: t('scheduler.timezones.Asia/Shanghai') },
    { value: 'Asia/Tokyo', label: t('scheduler.timezones.Asia/Tokyo') },
    { value: 'Asia/Seoul', label: t('scheduler.timezones.Asia/Seoul') },
    { value: 'Asia/Hong_Kong', label: t('scheduler.timezones.Asia/Hong_Kong') },
    { value: 'America/New_York', label: t('scheduler.timezones.America/New_York') },
    { value: 'America/Los_Angeles', label: t('scheduler.timezones.America/Los_Angeles') },
    { value: 'Europe/London', label: t('scheduler.timezones.Europe/London') },
    { value: 'Europe/Paris', label: t('scheduler.timezones.Europe/Paris') },
    { value: 'UTC', label: t('scheduler.timezones.UTC') }
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsData, statusData] = await Promise.all([
        schedulerApi.getSettings(),
        schedulerApi.getStatus()
      ]);
      setSettings(settingsData);
      setStatus(statusData);
    } catch (error) {
      console.error('Failed to load scheduler data:', error);
      toast.error(t('scheduler.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await schedulerApi.updateSettings(settings);
      toast.success(t('scheduler.messages.updateSuccess'));
      // 重新加载状态
      await loadData();
    } catch (error) {
      console.error('Failed to update scheduler settings:', error);
      toast.error(t('scheduler.messages.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerCheck = async () => {
    try {
      await schedulerApi.triggerCheck();
      toast.success(t('scheduler.messages.triggerSuccess'));
    } catch (error) {
      console.error('Failed to trigger notification check:', error);
      toast.error(t('scheduler.messages.triggerFailed'));
    }
  };

  const getStatusBadge = () => {
    if (!status) return null;

    if (!settings.is_enabled) {
      return <Badge variant="secondary">{t('scheduler.status.disabled')}</Badge>;
    }

    if (status.running) {
      return <Badge variant="default">{t('scheduler.status.running')}</Badge>;
    }

    return <Badge variant="destructive">{t('scheduler.status.stopped')}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">{t('scheduler.loading')}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          {t('scheduler.settings')}
        </CardTitle>
        <CardDescription>
          {t('scheduler.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 状态显示 */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('scheduler.currentStatus')}</span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {status?.currentSchedule && (
              <span className="text-sm text-muted-foreground">
                {status.currentSchedule.time} ({status.currentSchedule.timezone})
              </span>
            )}
          </div>
        </div>

        {/* 启用/禁用开关 */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>{t('scheduler.enableScheduler')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('scheduler.enableDescription')}
            </p>
          </div>
          <Switch
            checked={settings.is_enabled}
            onCheckedChange={(checked) => setSettings({ ...settings, is_enabled: checked })}
            disabled={saving}
          />
        </div>

        {/* 时间设置 */}
        <div className="space-y-2">
          <Label htmlFor="check-time">{t('scheduler.checkTime')}</Label>
          <Input
            id="check-time"
            type="time"
            value={settings.notification_check_time}
            onChange={(e) => setSettings({ ...settings, notification_check_time: e.target.value })}
            disabled={saving || !settings.is_enabled}
            className="w-32"
          />
          <p className="text-sm text-muted-foreground">
            {t('scheduler.checkTimeDescription')}
          </p>
        </div>

        {/* 时区设置 */}
        <div className="space-y-2">
          <Label>{t('scheduler.timezone')}</Label>
          <Select
            value={settings.timezone}
            onValueChange={(value) => setSettings({ ...settings, timezone: value })}
            disabled={saving || !settings.is_enabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timezones.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('scheduler.saving') : t('scheduler.saveSettings')}
          </Button>

          <Button
            variant="outline"
            onClick={handleTriggerCheck}
            disabled={!settings.is_enabled}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {t('scheduler.manualTrigger')}
          </Button>
        </div>

        {/* 提示信息 */}
        {!settings.is_enabled && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">{t('scheduler.disabledWarning')}</p>
              <p>{t('scheduler.disabledWarningDescription')}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
