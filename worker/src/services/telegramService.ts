import type { Env } from '../types';
import { getSecret } from './secretService';

const PLACEHOLDER_TOKEN = 'your_telegram_bot_token_here';

export class TelegramService {
  constructor(private env: Env) {}

  private async resolveToken() {
    const stored = await getSecret(this.env, 'telegram_bot_token');
    const token = stored || this.env.TELEGRAM_BOT_TOKEN || '';
    const source = stored ? 'database' : this.env.TELEGRAM_BOT_TOKEN ? 'env' : 'none';
    return { token, source };
  }

  async isConfigured() {
    const { token } = await this.resolveToken();
    return !!token && token !== PLACEHOLDER_TOKEN;
  }

  async getConfigStatus() {
    const { token, source } = await this.resolveToken();
    const isPlaceholder = token === PLACEHOLDER_TOKEN || !token;
    return {
      configured: !!token && !isPlaceholder,
      hasToken: !!token,
      isPlaceholder,
      source
    };
  }

  private async request(path: string, payload?: unknown) {
    const { token } = await this.resolveToken();
    if (!token || token === PLACEHOLDER_TOKEN) {
      throw new Error('Telegram Bot Token not configured');
    }

    const url = `https://api.telegram.org/bot${token}/${path}`;
    const options: RequestInit = payload
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      : { method: 'GET' };

    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.description || `Telegram API error (${response.status})`);
    }
    return data.result;
  }

  async sendMessage(chatId: string, text: string, options: Record<string, unknown> = {}) {
    try {
      if (!chatId) throw new Error('Chat ID is required');
      const result = await this.request('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      });

      return { success: true, messageId: result.message_id, timestamp: new Date().toISOString() };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async validateChatId(chatId: string) {
    try {
      const result = await this.request('getChat', { chat_id: chatId });
      return { success: true, chatInfo: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async getBotInfo() {
    try {
      const result = await this.request('getMe');
      return { success: true, botInfo: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async sendTestMessage(chatId: string) {
    const testMessage = `🔔 <b>订阅管理系统测试消息</b>

这是一条来自订阅管理系统的测试消息。

如果您收到此消息，说明您的Telegram通知配置正确！

⏰ 发送时间: ${new Date().toLocaleString('zh-CN')}

如有问题，请联系管理员。`;

    return this.sendMessage(chatId, testMessage);
  }
}
