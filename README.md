# 豆苗的成长手帖

V10 题库的静态网页版本，使用公开 GitHub 仓库和 GitHub Pages 托管。`questions.json` 是唯一正式内容来源；网页、浏览器草稿和练习记录各自独立。无需数据库或浏览器端第三方运行时依赖，网页内不保存 GitHub 凭据。

公开仓库：[vitalu1107-beep/interview-bank](https://github.com/vitalu1107-beep/interview-bank)，默认分支 `main`。固定访问地址：[在线面试题库](https://vitalu1107-beep.github.io/interview-bank/)。验收证据见 [测试记录](docs/verification.md)；后续发布结果以 [Actions](https://github.com/vitalu1107-beep/interview-bank/actions) 中最新 `main` 提交对应的运行及线上数据为准。

2026-10-21 已上线：首次提交 `de6d323a75226c2107b68e996d449bd0f5032f80` 的 [校验、测试与 Pages 部署均成功](https://github.com/vitalu1107-beep/interview-bank/actions/runs/39535857172)。实际请求线上 JSON 返回 HTTP 200，117 题与 V10 原稿逐字节一致；线上桌面、390px 手机布局和核心交互已实测通过。

2026-10-21，用户最新指示已授权将现有 117 题公开发布到 GitHub 和 Pages，取代此前“仅本人访问”的方案。此前的私有托管说明保留为 [历史记录](docs/privacy-deployment.md)，不再是当前部署要求。题目及正式 JSON 将可被任何人读取；本地草稿和练习备份不随站点发布。

## 前端视觉改版（待 PR 审核）

品牌名称、副标题和当前栏目集中配置在 `assets/notebook.mjs` 的 `SITE_CONFIG`；改名只需改这里，页面标题、品牌与导出文稿同步使用。现有题库作为“面试练习”，未添加不可用的未来栏目入口。

奶油色纸面与蓝黄文具细节、真实学习概览、继续练习、手机折叠目录及长答案阅读样式详见 [改版截图与验收记录](docs/ui-redesign/README.md)。`questions.json`、`assets/core.mjs`、本地存储 key 和备份结构保持不变。手机/平板目录在 860px 及以下默认收起，搜索始终可见；有旧版草稿、冲突或存储错误时，状态详情会自动展开。

该改版在独立分支提交 PR，审核合并前原 Pages 保持现状。原有工作流只增加新增本地模块的打包条目，发布路径与方式不变。

## 本地使用

主要文件：`index.html` 为页面，`assets/` 为交互与样式，`questions.json` 为正式题库，`scripts/validate.mjs` 与 `tests/core.test.mjs` 为校验及测试，`.github/workflows/deploy.yml` 为自动发布流程。

使用 Node.js 22 或更高版本；不需要 `npm install`。在项目目录执行：

```sh
npm run check
python3 -m http.server 8000 --bind 127.0.0.1
```

浏览器打开 [本地题库](http://localhost:8000/)。也可分别执行 `npm run validate`、`npm test`。直接双击 HTML 使用 `file://` 时，浏览器通常会阻止相对 JSON 请求，存储行为也不稳定；请使用本地 HTTP 服务。

每次加载均重新请求相对路径下的 `questions.json`，刷新可获取已部署的正式内容。默认展示正式版；保存的本地草稿需主动选择查看。草稿基于编辑时的正式内容指纹：正式题目变化后提示冲突，并提供对比、保留草稿与备份，不自动覆盖新正式版。

收藏、练习与草稿保存在当前浏览器、当前源的本地存储中，不会提交到 GitHub。协议、域名或端口不同即为不同源；换设备、换浏览器或由本地切换到 Pages，记录不会自动同步。清理浏览器数据前先导出备份。

导出的备份包含草稿和练习记录。导入题库 JSON 或备份先显示预览和冲突，确认后只写入本地状态；导入不会修改正式 `questions.json`。旧 V10 的本地存储不会自动套用；需要迁移时先导出，再通过本页导入核对。

## 正式数据

初始共 117 题：个人经历 A 14 题、行业与岗位认知 B 16 题、个人动机与行为模式 C 10 题、简历深挖 D 77 题。后续可增加题目，不把总数固定为 117。

题目保留原结构：

| 字段 | 含义 |
| --- | --- |
| `id`、`title` | 稳定题号与题目 |
| `parts` | 回答分段；每段保留 `tag` 和 `text` |
| `logic` | 回答逻辑 |
| `note` | 注意事项、待核实内容 |
| `data` | 数据及口径说明 |
| `state` | 原稿状态，包含待补、待核实等状态；不自动改成已定稿 |
| `kind`、`group`、`navGroup` | 主问题/深挖类型与目录归属；`group` 按原题保留 |
| `mother`、`story`、`related`、`deepRefs` | 母题、项目与关联问题 |
| `skills`、`primarySkill` | 能力标签与主要能力 |

同时保留 `meta`、`deepGroups`、`sourceNote`、`skillCategories`、`taxonomy` 等顶层字段。不把原稿转换成通用 `answer` 字段。`updatedAt` 是可选字段；只有实际编辑需要时才记录真实时间，不给历史原题补造日期。

目录与数量根据 `items[].navGroup` 以及 `taxonomy[].groups` 动态生成，`taxonomy.groups[].ids` 不作为题目数量来源。新增题目需要唯一题号、有效分组和完整字段；新增分组时补充 taxonomy。原始 117 个 ID 不得遗漏，其 A/B/C/D 目录归属必须保留；可以修订答案、在同一目录内调整小类，并增加新题。

`docs/original-manifest.json` 记录原始 ID、目录归属和逐题 SHA-256，作为初次迁移证据；普通 CI 只用它保护原始 ID 与目录归属，不锁死答案哈希。迁移详情见 `docs/migration-report.md`。

```sh
# 校验指定 JSON；省略路径时校验项目中的 questions.json
node scripts/validate.mjs questions.json

# 仅初次迁移核验：将路径替换为保留的 V10 原始 JSON
node scripts/validate.mjs questions.json --migration ../interview_bank_v10.json
```

`--migration` 额外比较源文件哈希、逐题哈希、全部字段及文件字节。正式内容开始修订后，它与原稿不同是预期结果，日常修改应运行普通校验。

## ChatGPT题库更新说明

网页本身不直接写 GitHub。仓库为 `vitalu1107-beep/interview-bank`，默认分支为 `main`，正式数据路径始终为根目录 [`questions.json`](questions.json)。先读取最新数据，再处理明确指定的题号。后续 ChatGPT 会话必须具备可写的 GitHub 工具并获得此仓库 `Contents:write` 授权；只读连接不能提交。首次上传或修改工作流还需要 `Workflows:write`，日常改题目不需要修改工作流。

1. 用 `fetch_file` 读取 `questions.json` 的完整最新内容，参数包含 `repository_full_name`、`path: "questions.json"`、`ref: "main"`。保存返回的当前**文件 blob SHA**。
2. 在最新 JSON 中只修改指定 `id` 的记录，保留其他记录、未知字段、原始 ID 和分类。比较前后对象，确认只有这一条记录变化；展示具体差异，程序化检查 JSON、唯一 ID、完整回答、原始 ID 清单和分类。具备执行环境时运行校验与测试；仅有 GitHub 连接时由仓库 Actions 运行，必须等待通过后再报告成功，无需 Codex 介入。
3. 用 `update_file` 提交完整 UTF-8 JSON 文本：`repository_full_name`、`path: "questions.json"`、`branch: "main"`、明确的 `message`、`content`，以及第一步取得的精确当前 `sha`。此 SHA 用于防止覆盖他人的并发编辑，不是文件的 SHA-256 或提交 SHA。
4. 若返回 SHA 冲突、409 或 422，立即停止提交并提示用户。可以只读获取最新文件并展示冲突差异；未经用户确认不再次写入，不盲目重试旧内容，不并行写同一路径。后续正常顺序更新使用工具返回的 `content_sha`，并再次确认文件仍为当前版本。
5. 检查 Actions 中与本次提交 SHA 对应的运行，确认**最新 `main` 提交**的校验、全部测试与部署均成功。再请求实际 Pages 地址的 `questions.json`（附随机参数、禁用缓存），核对指定记录与页面正式版。较早的一次绿色运行或仅 HTTP 200 均不足以证明本次内容已上线；校验通过但尚未部署时应分别报告。

GitHub Contents API 的读取、更新与文件 SHA 机制见 [GitHub 官方文档](https://docs.github.com/en/rest/repos/contents)。不要把 token、私钥或连接凭据写入项目。

### 新增题目

先完整读取最新 `questions.json` 和 blob SHA，确认没有重复题号，再向 `items` 追加一条完整记录。主问使用对应 A/B/C 编号，简历深挖沿用 Dxx-xx 格式；现有题号不得重排。填写真实的 `title`、有序 `parts`、`logic`、`note`、`data`、`state`，以及有效的 `navGroup`、`kind`、`skills`、`primarySkill`、`deepRefs` 和既有结构需要的字段。未知事实写明待核实，不补造答案或状态。

已有小类只需引用其 `navGroup`；新增小类时在所属一级分类的 `taxonomy[].groups` 追加唯一分组 ID 和名称。导航将根据记录自动生成，`ids` 可为空；数量自动增长。按照同一套 SHA 校验、提交与部署确认流程执行。

可直接对 ChatGPT 说：“把 A10 更新成刚刚定稿的答案，并同步到 GitHub。先读最新 questions.json，使用返回的 blob SHA 提交；发生冲突就停止并告诉我。等待本次提交的 Actions 和 Pages 部署成功，再核验线上 JSON；未上线则明确告诉我实际状态。”

## Pages 发布与恢复

在目标仓库的 Settings → Pages 中选择 GitHub Actions。`.github/workflows/deploy.yml` 在 `main` push、PR 和手动运行时执行 `node scripts/validate.mjs` 与 `node --test`。PR 只执行校验和测试；只有 `main` 的非 PR 运行会打包并部署，部署中的运行不会被后续提交取消。

站点产物严格限定为 `index.html`、`questions.json`、`assets/app.js`、`assets/core.mjs`、`assets/style.css` 和生成的 `.nojekyll`。不会复制整个项目，`docs/`、`output/`、测试夹具、原始文件、个人备份及探测资源均不进入站点产物。公开仓库中提交的文件仍然公开，不能把未进入站点产物当作隐私保护。

实际站点地址以成功部署的输出为准，再按上述步骤核对最新提交及线上 JSON。工作流的构建、产物和部署机制见 [GitHub Pages 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

需要恢复历史时，先用 `fetch_file` 指定历史提交 SHA 读取旧版，再读取 `main` 当前文件取得当前 blob SHA。把确认过的旧内容通过 `update_file` 作为**新的提交**写回 `main`；恢复内容仍须通过原始 ID、目录与结构校验。保留历史，不 force push。最后确认最新提交的 Actions、部署结果及线上 JSON。浏览器草稿需要通过本地备份另行恢复，GitHub 历史不包含草稿。

本文件提供操作与验收方法，首次上线的实际结果记录在 [测试记录](docs/verification.md) 中。

多标签页草稿写入使用浏览器 Web Locks 串行化，并核对保存前的本地版本；若其他标签页已更新，本次保存会停止并提示备份后刷新。缺少 Web Locks 或存储不可用时，修改仅暂存在内存并明确提示导出。未保存的编辑会阻止切换，完整备份还会附带当前未保存表单及无法读取的原存储文本，便于恢复。
