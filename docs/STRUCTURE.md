# 项目结构

```
.
├── src/                      # 前端（React + Vite）
│   ├── components/
│   ├── pages/
│   ├── store/
│   ├── services/
│   └── i18n/
├── worker/                   # Cloudflare Workers 后端
│   └── src/
│       ├── index.ts
│       ├── routes/
│       ├── services/
│       ├── middleware/
│       ├── utils/
│       └── types.ts
├── migrations/               # D1 初始化 SQL
├── tests/                    # Vitest + Miniflare 测试
├── wrangler.toml             # Workers 配置
└── dist/                     # 前端构建产物（Workers 静态资源）
```

前端构建后的 `dist/` 由 Worker 通过 `[assets]` 绑定提供服务。
