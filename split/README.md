# Split · 共享账本

独立入口：https://oscar-ge.github.io/split/ 。主站首页没有修改。

- [项目设计、需求和验收标准](docs/PROJECT.md)
- [可分享的项目介绍](https://oscar-ge.github.io/split/docs/)
- [OpenAPI 3.1 契约](docs/openapi.json)
- [TypeScript 后端源码](project/backend/)
- [账务与调度回归测试](tests/core.test.mjs)

## 本地检查

要求 Node.js 22 或更新版本。

```sh
node --test split/tests/core.test.mjs
node --check split/app.mjs
```

启动独立的后端开发环境后，运行本地 API 检查（仅允许本地地址，会建立隔离的测试账本）：

```sh
SPLIT_TEST_ORIGIN=http://127.0.0.1:4173 node split/tests/api-smoke.mjs
```

`config.mjs` 指定共享 API 地址。生产账目在后端 D1 数据库，代码里的 initial-book.json 仅用于首次初始化；发布新版不会覆盖已记入的新账目。

公开可读写，任何访问者都能编辑。JSON 可完整备份、恢复；CSV 适合表格查看。历史 zhao 的显示名称已修正为 wenchao zhang，ID 不变；原账务归属保持一致。
