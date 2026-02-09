# 国际化 (i18n) 指南

本文档详细说明了如何在订阅管理系统中添加和维护多语言支持。

## 目录

- [项目结构](#项目结构)
- [添加新语言](#添加新语言)
- [使用翻译](#使用翻译)
- [维护指南](#维护指南)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)

## 项目结构

当前的国际化文件结构如下：

```
src/i18n/
├── config.ts                 # i18n 配置文件
├── types.ts                  # 类型定义
└── locales/
    ├── en/                   # 英文翻译
    │   ├── common.json
    │   ├── navigation.json
    │   ├── subscription.json
    │   ├── dashboard.json
    │   ├── settings.json
    │   ├── validation.json
    │   ├── reports.json
    │   └── notification.json
    └── zh-CN/                # 中文翻译
        ├── common.json
        ├── navigation.json
        ├── subscription.json
        ├── dashboard.json
        ├── settings.json
        ├── validation.json
        ├── reports.json
        └── notification.json
```

### 翻译文件说明

- **common.json**: 通用翻译，如按钮、状态、通用术语
- **navigation.json**: 导航相关翻译
- **subscription.json**: 订阅管理相关翻译
- **dashboard.json**: 仪表板相关翻译
- **settings.json**: 设置页面相关翻译
- **validation.json**: 表单验证消息
- **reports.json**: 报表相关翻译
- **notification.json**: 通知相关翻译

## 添加新语言

### 步骤 1: 创建翻译文件

在 `src/i18n/locales/` 下创建新语言目录。以添加日语为例：

```bash
mkdir src/i18n/locales/ja
```

创建所有必需的翻译文件：

```bash
touch src/i18n/locales/ja/common.json
touch src/i18n/locales/ja/navigation.json
touch src/i18n/locales/ja/subscription.json
touch src/i18n/locales/ja/dashboard.json
touch src/i18n/locales/ja/settings.json
touch src/i18n/locales/ja/validation.json
touch src/i18n/locales/ja/reports.json
```

### 步骤 2: 复制并翻译内容

将英文翻译文件复制到新语言目录，然后翻译所有内容：

```json
// src/i18n/locales/ja/common.json 示例
{
  "loading": "読み込み中...",
  "save": "保存",
  "cancel": "キャンセル",
  "delete": "削除",
  "edit": "編集",
  "confirm": "確認",
  "search": "検索",
  "filter": "フィルター",
  "close": "閉じる",
  "back": "戻る",
  "next": "次へ",
  "previous": "前へ",
  "yes": "はい",
  "no": "いいえ"
}
```

### 步骤 3: 更新 i18n 配置

修改 `src/i18n/config.ts`，添加新语言的导入和配置：

```typescript
// 添加导入
import jaCommon from './locales/ja/common.json';
import jaNavigation from './locales/ja/navigation.json';
import jaSubscription from './locales/ja/subscription.json';
import jaDashboard from './locales/ja/dashboard.json';
import jaSettings from './locales/ja/settings.json';
import jaValidation from './locales/ja/validation.json';
import jaReports from './locales/ja/reports.json';

// 在 resources 对象中添加新语言
const resources = {
  en: { /* 英文翻译 */ },
  'zh-CN': { /* 中文翻译 */ },
  ja: {
    common: jaCommon,
    navigation: jaNavigation,
    subscription: jaSubscription,
    dashboard: jaDashboard,
    settings: jaSettings,
    validation: jaValidation,
    reports: jaReports,
  },
};
```

### 步骤 4: 更新语言切换器

修改 `src/components/ui/LanguageSwitcher.tsx`：

```typescript
const languages = [
  { code: 'en', name: 'English' },
  { code: 'zh-CN', name: '简体中文' },
  { code: 'ja', name: '日本語' },
  // 添加更多语言...
];
```

## 使用翻译

### 在组件中使用翻译

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  // 使用单个命名空间
  const { t } = useTranslation('common');
  
  // 使用多个命名空间
  const { t } = useTranslation(['common', 'subscription']);
  
  return (
    <div>
      <h1>{t('common:title')}</h1>
      <button>{t('save')}</button>
      <p>{t('subscription:description')}</p>
    </div>
  );
}
```

### 翻译键命名规范

- 使用 camelCase 命名
- 使用有意义的键名
- 按功能分组

```json
{
  "buttons": {
    "save": "保存",
    "cancel": "取消",
    "delete": "删除"
  },
  "messages": {
    "success": "操作成功",
    "error": "操作失败"
  },
  "forms": {
    "nameRequired": "名称为必填项",
    "invalidUrl": "链接格式无效"
  }
}
```

### 插值和复数

```typescript
// 插值
t('welcome', { name: 'John' }); // "欢迎, John"

// 复数
t('itemCount', { count: 5 }); // "5 个项目"
```

对应的翻译文件：

```json
{
  "welcome": "欢迎, {{name}}",
  "itemCount_one": "{{count}} 个项目",
  "itemCount_other": "{{count}} 个项目"
}
```

## 维护指南

### 添加新翻译键

1. 在英文翻译文件中添加新键
2. 在所有其他语言文件中添加对应翻译
3. 在组件中使用新的翻译键

### 翻译文件同步

当添加新功能时，确保：
- [ ] 所有新的文本都使用翻译函数
- [ ] 所有语言文件都包含新的翻译键
- [ ] 翻译内容准确且符合上下文

## 最佳实践

### 1. 避免硬编码文本

❌ 错误做法：
```typescript
<button>Save</button>
<input placeholder="Enter your name" />
```

✅ 正确做法：
```typescript
<button>{t('common:save')}</button>
<input placeholder={t('common:enterName')} />
```

### 2. 合理组织翻译键

按功能模块组织，避免键名冲突：

```json
{
  "subscription": {
    "add": "添加订阅",
    "edit": "编辑订阅",
    "delete": "删除订阅"
  },
  "payment": {
    "add": "添加支付",
    "edit": "编辑支付",
    "delete": "删除支付"
  }
}
```

### 3. 处理长文本

对于长文本，考虑 UI 布局的适配：

```css
/* 为不同语言预留足够空间 */
.button-text {
  min-width: 120px;
  text-align: center;
}
```

### 4. 日期和数字格式化

使用 i18n 库的格式化功能：

```typescript
import { format } from 'date-fns';
import { zhCN, enUS, ja } from 'date-fns/locale';

const formatDate = (date: Date, language: string) => {
  const locales = { 'zh-CN': zhCN, 'en': enUS, 'ja': ja };
  return format(date, 'PPP', { locale: locales[language] });
};
```

## 常见问题

### Q: 某些翻译显示为翻译键而不是翻译内容？

A: 检查以下几点：
1. 翻译文件中是否存在该键
2. 命名空间是否正确
3. i18n 配置是否正确导入了翻译文件

### Q: 如何处理文本长度差异？

A: 不同语言的文本长度可能差异很大：
1. 使用弹性布局 (Flexbox/Grid)
2. 设置合适的最小宽度
3. 考虑使用省略号处理过长文本

### Q: 如何处理 RTL (从右到左) 语言？

A: 对于阿拉伯语、希伯来语等：
1. 添加 CSS 支持：`direction: rtl`
2. 调整图标和布局方向
3. 使用 CSS 逻辑属性 (`margin-inline-start` 等)

### Q: 如何实现动态语言切换？

A: 当前实现已支持动态切换：
1. 语言选择保存在 localStorage
2. 页面刷新后保持选择的语言
3. 实时切换无需刷新页面

## 工具推荐

### 翻译工具
- **LLM**: 大模型翻译
- **Google Translate API**: 自动翻译
- **DeepL API**: 高质量机器翻译

### 开发工具
- **i18n Ally (VS Code 扩展)**: 翻译文件管理
- **React i18next 调试工具**: 浏览器调试

---

## 贡献

如果你发现翻译错误或想要添加新语言，请：

1. Fork 项目
2. 创建新的语言分支
3. 添加或修改翻译文件
4. 提交 Pull Request

感谢你对项目国际化的贡献！
