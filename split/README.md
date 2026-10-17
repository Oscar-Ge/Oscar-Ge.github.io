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
node --test split/tests/*.test.mjs
node --check split/app.mjs
```

启动独立的后端开发环境后，运行本地 API 检查（仅允许本地地址，会建立隔离的测试账本）：

```sh
SPLIT_TEST_ORIGIN=http://127.0.0.1:4173 node split/tests/api-smoke.mjs
```

`config.mjs` 指定共享 API 地址。生产账目在后端 D1 数据库，代码里的 initial-book.json 仅用于首次初始化；发布新版不会覆盖已记入的新账目。

公开可读写，任何访问者都能编辑。JSON 可备份、恢复账目与附件引用（不含附件文件）；CSV 适合表格查看。历史 zhao 的显示名称已修正为 wenchao zhang，ID 不变；原账务归属保持一致。

## 新增能力

- 17 种货币：保存原币与锁定汇率，统一折算 USD 分摊。
- 照片和 PDF 附件：每笔 5 个，每个 10 MiB，R2 持久保存。
- Finances 来源：在 ChatGPT 获取导入文件，打开“账本 → Finances 来源”，预览匹配或选择交易记账。网页没有银行直连或实时同步；未匹配的历史记录保持手动来源。
- `tests/premium-api.mjs` 导出隔离账本集成测试函数，覆盖文件、换算、来源与旧客户端保护；本地浏览器运行时不会改动 d6。
