import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Send, Check, X, MessageCircle, Settings } from 'lucide-react';
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

interface BotInfo {
  id: number;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

interface ApiResponse {
  response?: { status?: number };
}

interface ConfigResponse {
  config?: TelegramConfigData;
}

interface ValidationResponse {
  success?: boolean;
  error?: string;
}

interface BotInfoResponse {
  success?: boolean;
  botInfo?: BotInfo;
}

export const TelegramConfig: React.FC<TelegramConfigProps> = ({ userId, onConfigChange }) => {
  const { t } = useTranslation('notification');
  const { toast } = useToast();

  // 使用本地存储
  const {
    channelConfigs,
    setTelegramConfig,
    setChannelValidated
  } = useNotificationStore();

  const [config, setConfig] = useState<TelegramConfigData>({
    chat_id: channelConfigs.telegram?.chat_id || ''
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [validating, setValidating] = useState(false);
  const [chatIdValid, setChatIdValid] = useState<boolean | null>(
    channelConfigs.telegram?.validated ?? null
  );
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [botTokenInput, setBotTokenInput] = useState('');

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await notificationApi.getChannelConfig('telegram');
      if (response) {
        // 后端返回的配置结构：{ id, channel_type, channel_config, config, is_active, ... }
        // config 字段是解析后的 JSON 对象，channel_config 是原始 JSON 字符串
        const configData = (response as unknown as ConfigResponse).config || {};
        const chatId = (configData as TelegramConfigData).chat_id || '';

        // 更新本地状态和本地存储
        setConfig({ chat_id: chatId });
        setTelegramConfig({ chat_id: chatId });
      }
    } catch (error) {
      console.error('Failed to load Telegram config:', error);
      // 如果配置不存在（404错误），使用本地存储的数据或重置为空配置
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
      const [configStatus, botInfoResponse] = await Promise.all([
        notificationApi.getTelegramConfigStatus(),
        notificationApi.getBotInfo()
      ]);

      // The API client already extracts the data field, so configStatus and botInfoResponse are the data directly
      setBotConfig(configStatus || { configured: false, hasToken: false, isPlaceholder: true });
      setBotInfo((botInfoResponse as BotInfoResponse)?.success ? (botInfoResponse as BotInfoResponse).botInfo || null : null);
    } catch (error) {
      console.error('Failed to load bot info:', error);
      // Set default values on error
      setBotConfig({ configured: false, hasToken: false, isPlaceholder: true });
      setBotInfo(null);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadBotInfo();
  }, [userId, loadConfig, loadBotInfo]);

  const validateChatId = async (chatId: string) => {
    if (!chatId.trim()) {
      setChatIdValid(null);
      setChannelValidated('telegram', false);
      return;
    }

    try {
      setValidating(true);
      const response = await notificationApi.validateChatId(chatId);
      // The API client already extracts the data field, so response is the data directly
      const isValid = (response as ValidationResponse)?.success || false;
      setChatIdValid(isValid);
      setChannelValidated('telegram', isValid);

      if (isValid) {
        toast({
          title: t('chatIdValid'),
          description: t('chatIdValid'),
        });
      } else {
        toast({
          title: t('chatIdInvalid'),
          description: (response as ValidationResponse)?.error || t('chatIdInvalid'),
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to validate Chat ID:', error);
      setChatIdValid(false);
      setChannelValidated('telegram', false);
      toast({
        title: t('chatIdInvalid'),
        description: t('chatIdHelp'),
        variant: 'destructive'
      });
    } finally {
      setValidating(false);
    }
  };

  const saveBotToken = async (token: string, silent = false) => {
    if (!token) {
      if (!silent) {
        toast({
          title: t('errors.telegramNotConfigured'),
          description: t('botTokenHelp'),
          variant: 'destructive'
        });
      }
      return false;
    }

    try {
      setSavingToken(true);
      await notificationApi.setTelegramBotToken(token);
      setBotTokenInput('');
      await loadBotInfo();
      if (!silent) {
        toast({
          title: t('tokenSaved'),
          description: t('tokenSaved')
        });
      }
      return true;
    } catch (error) {
      console.error('Failed to save Telegram bot token:', error);
      if (!silent) {
        toast({
          title: t('tokenSaveFailed'),
          description: t('tokenSaveFailed'),
          variant: 'destructive'
        });
      }
      return false;
    } finally {
      setSavingToken(false);
    }
  };

  const ensureTokenConfigured = async () => {
    const token = botTokenInput.trim();
    if (token) {
      const saved = await saveBotToken(token, true);
      if (!saved) return false;
    }

    try {
      const status = await notificationApi.getTelegramConfigStatus();
      if (!status?.configured) {
        toast({
          title: t('errors.telegramNotConfigured'),
          description: t('botTokenHelp'),
          variant: 'destructive'
        });
        return false;
      }
      return true;
    } catch (error) {
      console.error('Failed to verify Telegram bot token:', error);
      toast({
        title: t('tokenSaveFailed'),
        description: t('tokenSaveFailed'),
        variant: 'destructive'
      });
      return false;
    }
  };

  const handleSave = async () => {
    if (!config.chat_id.trim()) {
      toast({
        title: t('errors.invalidChatId'),
        description: t('chatIdHelp'),
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving(true);
      const token = botTokenInput.trim();
      if (token) {
        const saved = await saveBotToken(token, true);
        if (!saved) return;
      }

      // 先保存到本地存储
      setTelegramConfig({
        chat_id: config.chat_id,
        validated: chatIdValid ?? false
      });

      // 然后保存到服务器
      await notificationApi.configureChannel('telegram', { chat_id: config.chat_id });

      // 重新加载配置以确保显示最新保存的数据
      await loadConfig();

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

  const handleSaveToken = async () => {
    await saveBotToken(botTokenInput.trim(), false);
  };

  const handleTest = async () => {
    if (!config.chat_id.trim()) {
      toast({
        title: t('errors.invalidChatId'),
        description: t('chatIdHelp'),
        variant: 'destructive'
      });
      return;
    }

    try {
      const tokenReady = await ensureTokenConfigured();
      if (!tokenReady) return;
      setTesting(true);
      // Ensure latest chat_id is saved before test
      await notificationApi.configureChannel('telegram', { chat_id: config.chat_id });
      setTelegramConfig({ chat_id: config.chat_id, validated: chatIdValid ?? false });
      await notificationApi.testNotification('telegram');
      toast({
        title: t('testSuccess'),
        description: t('testSuccess'),
      });
    } catch (error) {
      console.error('Failed to send test notification:', error);
      toast({
        title: t('testFailed'),
        description: t('errors.sendFailed'),
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleChatIdChange = (value: string) => {
    setConfig(prev => ({ ...prev, chat_id: value }));
    setChatIdValid(null);
    // 实时更新本地存储
    setTelegramConfig({ chat_id: value, validated: false });
    setChannelValidated('telegram', false);
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
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bot Info */}
        {botInfo && (
          <Alert>
            <Settings className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div><strong>{t('botName')}:</strong> {botInfo.first_name}</div>
                <div><strong>{t('botUsername')}:</strong> @{botInfo.username}</div>
                <div><strong>{t('botStatus')}:</strong> {getStatusBadge()}</div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Configuration Warning */}
        {botConfig && !botConfig.configured && (
          <Alert variant="destructive">
            <X className="h-4 w-4" />
            <AlertDescription>
              {t('errors.telegramNotConfigured')}
            </AlertDescription>
          </Alert>
        )}

        {/* Bot Token Input */}
        <div className="space-y-2">
          <Label htmlFor="bot-token">{t('botToken')}</Label>
        <div className="flex gap-2">
          <Input
            id="bot-token"
            type="password"
            value={botTokenInput}
            onChange={(e) => setBotTokenInput(e.target.value)}
            placeholder="123456:ABCDEF..."
            disabled={savingToken || loading}
          />
          <Button
            type="button"
            onClick={handleSaveToken}
            disabled={savingToken || loading || !botTokenInput.trim()}
          >
              {savingToken ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t('saveToken')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('botTokenHelp')}</p>
        </div>

        {/* Chat ID Input */}
        <div className="space-y-2">
          <Label htmlFor="chat-id">{t('chatId')}</Label>
          <div className="flex gap-2">
            <Input
              id="chat-id"
              value={config.chat_id}
              onChange={(e) => handleChatIdChange(e.target.value)}
              placeholder="123456789"
              disabled={loading}
            />
            <Button
              variant="outline"
              type="button"
              onClick={() => validateChatId(config.chat_id)}
              disabled={validating || !config.chat_id.trim()}
            >
              {validating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('validateChatId')
              )}
            </Button>
          </div>
          
          {/* Chat ID Validation Status */}
          {chatIdValid !== null && (
            <div className="flex items-center gap-2 text-sm">
              {chatIdValid ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-green-600">{t('chatIdValid')}</span>
                </>
              ) : (
                <>
                  <X className="h-4 w-4 text-red-500" />
                  <span className="text-red-600">{t('chatIdInvalid')}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p className="text-xs whitespace-pre-line">
            {t('chatIdHelp')}
          </p>
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
            disabled={testing || loading || !config.chat_id.trim()}
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
