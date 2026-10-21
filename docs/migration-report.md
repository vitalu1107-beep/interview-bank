# V10 初次迁移记录

核验日期：2026-10-20。保留用户提供的 `interview_bank_v10.html` 和 `interview_bank_v10.json`；项目不覆盖或删除原文件。正式数据由原 JSON 原样复制为根目录 `questions.json`，未进行字段映射、格式重排或内容补写。

## 原文件指纹

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `interview_bank_v10.json` | 171198 | `aef4c1b2ef6cea314363fe6f420ffccd2d094d891d9451ed7a27331fbebb4304` |
| `questions.json`（迁移时） | 171198 | `aef4c1b2ef6cea314363fe6f420ffccd2d094d891d9451ed7a27331fbebb4304` |
| `interview_bank_v10.html` | 167389 | `f2055b9b09a16863692ae285a31d442f100bdd01deff927caa0b51631f2cb5aa` |

本地读取原始 JSON 与迁移后的 JSON，已确认字节完全一致，解析后的全部字段与值完全一致。HTML 指纹用于标识 UI 来源；不表示拆分后的网页与原 HTML 字节相同。

## 内容保留

| 目录 | 标题 | 初始题数 |
| --- | --- | ---: |
| A | 个人经历 | 14 |
| B | 行业与岗位认知 | 16 |
| C | 个人动机与行为模式 | 10 |
| D | 简历深挖 | 77 |
| 合计 | | 117 |

保留全部 117 个题号、四类目录及二级小类；主问题 40 题、深挖 77 题。目录归属根据原 `taxonomy[].groups` 与各题 `navGroup` 对应关系统计。

逐字段比较覆盖整个 JSON：`version`、`meta`、`deepGroups`、`items`、`sourceNote`、`skillCategories`、`taxonomy`，以及每条题目的全部原有字段。原稿的 `parts[].tag/text`、`logic`、`note`、`data`、`state`、关联题号、能力标签和所有数组顺序均保留。没有生成通用 `answer`、历史 `updatedAt` 或“已定稿”状态，也没有清理待核实文字。

## 清单与后续校验的边界

`original-manifest.json` 的格式为：

- `sources`：两个原文件的文件名、字节数与整个文件的 SHA-256。
- `initialCounts`：初次迁移时的总数和 A/B/C/D 数量，是历史记录，不是增长上限。
- `requiredIds`：必须持续保留的原始 117 个题号。
- `originalItems`：每题的 `id`、原始目录 `category`、原始小类 `navGroup`、完整题目对象的 `sha256`。
- 逐题 SHA-256 的输入：递归按对象键排序、保持数组顺序、使用 `JSON.stringify` 的原始值编码、无额外空白的 UTF-8 JSON。清单中的 `canonicalization` 同步记录此规则。

普通 `node scripts/validate.mjs` 调用核心结构校验，并保护原始 ID 和 A/B/C/D 目录归属；允许修订原题内容、同一目录内调整小类和增加题目。普通 CI 不比较逐题内容哈希，也不要求题目总数永远为 117。源文件指纹和逐题指纹保留初始迁移证据，不作为未来内容编辑的禁令。

本地初次迁移可显式运行：

```sh
node scripts/validate.mjs questions.json --migration ../interview_bank_v10.json
```

将原始文件参数替换为实际保留位置；脚本会检查原文件 SHA-256、逐题 SHA-256、全部解析字段及原始字节。此参数不用于 GitHub Actions；正式内容后续修订时只运行普通校验。

## 发布状态

仓库与 URL：**尚未创建/尚未部署，待公开授权与仓库连接**。当前没有远端 Actions 成功记录或线上验收结果。本记录只证明初次 JSON 迁移的完整性；单元测试、浏览器交互和部署结果须分别以实际执行记录验收。
