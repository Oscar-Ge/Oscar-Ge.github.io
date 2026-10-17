# 月度房租自动入账

## 执行路径

1. GitHub 仓库 `Oscar-Ge/Oscar-Ge.github.io` 的 **Split monthly rent** 工作流在每月 1 日 13:15 UTC 启动，亦支持手工 Run workflow。
2. `split/scripts/sync-rent.mjs` 读取房租规则，调用公开的 `POST /api/rent`。该 API 只使用服务器的纽约日期生成到期月份，不接受自定义未来日期。
3. 服务在 D1 中使用 revision 乐观锁和事务写入，只创建不存在的月份。可安全重试；不覆盖手工记入、已删除或已修改的月度记录。暂停规则时不记入。
4. 脚本重新读取服务器数据，验证没有待补月份，将结果提交到 `split/data/rent-status.json`。回执仅含月份、状态、版本与执行时间，不包含完整账本。
5. 关联云端任务核对本月工作流和回执；若当月运行失败，重试该运行的失败 job 一次。仍失败或任务未触发时提示用户查看仓库 Actions。正常时只给简短确认。

API 处理数据不需要重新部署后端。运行回执的提交也保留了仓库活动记录。GitHub 的 cron 不是精确计时服务，可能延迟；公开仓库的无活动规则或手动禁用仍会影响调度，云端核对用于发现这些情况。

## 规则

默认从 2026-11 开始，每月 1 日；付款人 ge，总额 212500 cents。wenchao zhang $840，yuan $73.75，xu 和 ge 各 $605.625。保持原 zhao 的成员 ID，显示名称修正为 wenchao zhang。

记录 ID `rent-YYYY-MM`。同月已有同额房租时跳过；已删除的自动记录不重建。跨月漏跑按月补记。规则更改影响之后生成的账目，旧账目保持原样。

## 云端核对的独立执行说明

- 从 GitHub 读取 `split/data/rent-status.json` 和 `.github/workflows/split-rent.yml`。
- 按 America/New_York 确定本月。回执 month 等于本月且 status 为 verified 即完成；paused / deleted_by_user 应尊重用户操作，不补记。
- 若回执旧或缺失，查看名为 Split monthly rent 的本月 workflow runs。进行中则等待并复查；失败则使用 GitHub 的 rerun failed workflow jobs 操作重试一次，之后读取状态和回执。
- 没有本月运行、工作流被禁用、权限失败或重试仍失败时，报告准确问题并提供 Actions 链接，不把失败说成已记账。
- 不更改账目金额、参与人、起始月或规则；不重复创建调度任务。整个流程只需要已连接的 GitHub 和 Sites，不依赖本地浏览器。

## 验证

初次发布触发同一条 GitHub 工作流。2026-10 尚未到首个应记月份，因此写入器应返回 addedMonths=[]，revision 不变；这既验证了无人值守路径，也避免制造未来账目。11 月的入账与重复运行由领域测试覆盖；每次正式运行再检查持久化结果。
