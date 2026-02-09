import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Send, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { notificationApi } from '@/services/notificationApi';
import { useToast } from '@/hooks/use-toast';
import { useNotificationStore } from '@/store/notificationStore';

interface TelegramConfigProps {
  userId: number;
  onConfigChange?: () => void;
}

interface TelegramConfigData {
  chat_id: string;
}

interface BotConfig {
  configured: boolean;
  hasToken: boolean;
  isPlaceholder: boolean;
}

interface ApiResponse {
  response?: { status?: number };
}

interface ConfigResponse {
  config?: TelegramConfigData;
}

export const TelegramConfig: React.FC<TelegramConfigProps> = ({ userId, onConfigChange }) => {
  const { t } = useTranslation('notification');
  const { toast } = useToast();

  const {
    channelConfigs,
    setTelegramConfig,
  } = useNotificationStore();

  const [config, setConfig] = useState<TelegramConfigData>({
    chat_id: channelConfigs.telegram?.chat_id || ''
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [botTokenInput, setBotTokenInput] = useState('');

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await notificationApi.getChannelConfig('telegram');
      if (response) {
        const configData = (response as unknown as ConfigResponse).config || {};
        const chatId = (configData as TelegramConfigData).chat_id || '';

        setConfig({ chat_id: chatId });
        setTelegramConfig({ chat_id: chatId });
      }
    } catch (error) {
      console.error('Failed to load Telegram config:', error);
      if ((error as ApiResponse).response?.status === 404) {
        const localChatId = channelConfigs.telegram?.chat_id || '';
        setConfig({ chat_id: localChatId });
      }
    } finally {
      setLoading(false);
    }
  }, [setTelegramConfig, channelConfigs.telegram?.chat_id]);

  const loadBotInfo = useCallback(async () => {
    try {
      const configStatus = await notificationApi.getTelegramConfigStatus();
      setBotConfig(configStatus || { configured: false, hasToken: false, isPlaceholder: true });
    } catch (error) {
      console.error('Failed to load bot info:', error);
      setBotConfig({ configured: false, hasToken: false, isPlaceholder: true });
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadBotInfo();
  }, [userId, loadConfig, loadBotInfo]);

  const handleSave = async () => {
    const chatId = config.chat_id.trim();
    if (!chatId) {
      toast({
        title: t('errors.invalidChatId'),
        description: t('chatIdHelp'),
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving(true);

      // Save bot token if provided
      const token = botTokenInput.trim();
      if (token) {
        try {
          await notificationApi.setTelegramBotToken(token);
          setBotTokenInput('');
        } catch (error) {
          console.error('Failed to save Telegram bot token:', error);
          toast({
            title: t('tokenSaveFailed'),
            description: t('tokenSaveFailed'),
            variant: 'destructive'
          });
          return;
        }
      }

      // Save chat_id
      await notificationApi.configureChannel('telegram', { chat_id: chatId });

      // Update local store
      setTelegramConfig({ chat_id: chatId });

      // Reload bot info and config
      await Promise.all([loadBotInfo(), loadConfig()]);

      toast({
        title: t('telegramConfigSaved'),
        description: t('channelConfigured'),
      });
      onConfigChange?.();
    } catch (error) {
      console.error('Failed to save Telegram config:', error);
      toast({
        title: t('telegramConfigError'),
        description: t('errors.configSaveFailed'),
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    // Check if bot is configured and has a saved chat_id
    if (!botConfig?.configured || !channelConfigs.telegram?.chat_id) {
      toast({
        title: t('saveFirst'),
        description: t('saveFirst'),
        variant: 'destructive'
      });
      return;
    }

    try {
      setTesting(true);
      await notificationApi.testNotification('telegram');
      toast({
        title: t('testSuccess'),
        description: t('testSuccess'),
      });
    } catch (error) {
      console.error('Failed to send test notification:', error);
      const message = error instanceof Error ? error.message : t('errors.sendFailed');
      toast({
        title: t('testFailed'),
        description: message,
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = () => {
    if (!botConfig) {
      return <Badge variant="secondary">{t('notConfigured')}</Badge>;
    }

    if (botConfig.configured) {
      return <Badge variant="default" className="bg-green-500">{t('configured')}</Badge>;
    } else {
      return <Badge variant="destructive">{t('notConfigured')}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          {t('telegram')}
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bot Token Input */}
        <div className="space-y-2">
          <Label htmlFor="bot-token">{t('botToken')}</Label>
          <Input
            id="bot-token"
            type="password"
            value={botTokenInput}
            onChange={(e) => setBotTokenInput(e.target.value)}
            placeholder="123456:ABCDEF..."
            disabled={saving || loading}
          />
          <p className="text-xs text-muted-foreground">{t('botTokenHelp')}</p>
        </div>

        {/* Chat ID Input */}
        <div className="space-y-2">
          <Label htmlFor="chat-id">{t('chatId')}</Label>
          <Input
            id="chat-id"
            value={config.chat_id}
            onChange={(e) => setConfig(prev => ({ ...prev, chat_id: e.target.value }))}
            placeholder="123456789"
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground whitespace-pre-line">{t('chatIdHelp')}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !config.chat_id.trim()}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t('save')}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={handleTest}
            disabled={testing || loading}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t('test')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
