import type { Env } from '../types';

export class TelegramService {
  private botToken: string | undefined;
  private apiBaseUrl: string | null = null;

  constructor(private env: Env) {
    this.botToken = env.TELEGRAM_BOT_TOKEN;
    if (this.botToken) {
      this.apiBaseUrl = `https://api.telegram.org/bot${this.botToken}`;
    }
  }

  isConfigured() {
    return !!this.botToken && this.botToken !== 'your_telegram_bot_token_here';
  }

  getConfigStatus() {
    return {
      configured: this.isConfigured(),
      hasToken: !!this.botToken,
      isPlaceholder: this.botToken === 'your_telegram_bot_token_here' || !this.botToken
    };
  }

  private async request(path: string, payload?: unknown) {
    if (!this.apiBaseUrl) {
      throw new Error('Telegram Bot Token not configured');
    }

    const url = `${this.apiBaseUrl}/${path}`;
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
