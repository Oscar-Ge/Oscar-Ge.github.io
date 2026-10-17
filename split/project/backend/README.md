# Split API backend

这是生产后端的源码镜像。前端仍由 GitHub Pages 托管。本后端由 Sites 的 Vinext / Worker 运行时托管，使用 D1 共享数据库。

## 代码入口

- `app/api/books/`：共享账本 REST API、输入校验、版本冲突响应。
- `lib/ledger.ts`：参数化 SQL、版本比较、事务和审计快照。
- `lib/rent.ts`：房租幂等写入与有限次数并发重试。
- `app/mcp/route.ts`：云端任务可调用的只读摘要与房租工具。
- `public/split/core.mjs`：与浏览器共用的账务规则。
- `db/schema.ts` / `drizzle/`：Drizzle 模式与 SQL 迁移。
- `data/initial-book.json`：一次性初始化数据，后续发布不覆盖数据库。
- `scripts/import-kitty.py`：保留精度并校验原始余额的 Excel 导入器。

## 开发

使用 Node.js 22.13+ 和 pnpm 11.25。锁文件锁定依赖。此目录保留 Sites 的构建适配器与环境配置，普通静态服务器无法运行 API。

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm exec tsc --noEmit
```

本地 D1 首次建表：

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lying_rictor.sql
```

随后启动 `pnpm dev`。在受管 Sites 环境中由 `sites-preview start` 启动预览，不要另外启动进程。生产部署使用 Sites 保存版本和部署流程；schema migration 随部署应用。项目 ID 是公开配置，不包含数据库或仓库凭据。

## 月度任务

每次运行先 `get_ledger_summary`，再调用 `apply_due_rent`，最后读回摘要。所有金额、成员和月份来自已保存的规则；调用者不能传入未来日期。默认付款人 ge，起始月 2026-11。重复执行不创建重复条目；暂停时不写入。更新持久化数据无需重新发布网站。

任务 ID、启用状态与正式验证结果见仓库 `split/docs/RELEASE.md`。
