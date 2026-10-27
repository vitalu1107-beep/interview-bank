# Practice navigation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 选分类立即练习，关联追问可以恢复原题与阅读位置。

**Architecture:** 在现有app.js保留页面内练习状态和来源栈。HTML增加欢迎区标识、现有品牌/栏目入口语义及返回提示位置，CSS复用既有按钮样式。

**Tech Stack:** 原生HTML/CSS/ES modules，Node内置测试，无新增依赖。

**Spec:** ../specs/2026-10-27-practice-navigation-design.md

## Global constraints

- questions.json、core.mjs、localStorage键与数据结构不变。
- 新独立分支/PR，不自动合并main；Pages路径与工作流不变。
- 未保存编辑时，任何新增的导航动作仍保留输入并提示先保存。

## Review focus

- 点击当前展开的一级分类也必须选择该类并展示题目。
- 从搜索/收藏/草稿视图进入关联题后，返回恢复来源条件。
- 多层关联跳转按顺序返回，直接导航清空旧链。
- 移动端分类选择收起目录，欢迎内容不再次占据顶部。
- 返回后的焦点及阅读位置可靠，未保存编辑不能被丢弃。

### Task 1: 进入练习

Files: assets/app.js, index.html, tests/practice-navigation.test.mjs.

- [x] 测试一级分类选择得到该类真实题目、收起欢迎区且滚动到练习开头；先观察失败。
- [x] 实现练习模式入口/首页返回；修正分类selection与滚动目标，保持编辑保护。
- [x] 测试通过，浏览器检查目录、搜索和首页返回。

### Task 2: 关联题返回

Files: assets/app.js, assets/style.css, tests/practice-navigation.test.mjs.

- [x] 测试来源条件与展开集合恢复、多层返回、直接导航清链；先观察失败。
- [x] 实现来源栈和目标题卡上方返回按钮，恢复源链接的屏幕位置和焦点。
- [x] 验证未保存编辑保护、桌面和手机布局，运行npm run check。
- [x] 独立审查最终diff，准备截图与验收说明；PR与CI状态由GitHub实时记录。

## 验证记录

基线35文件与main逐文件blob SHA一致；原生Git工作区工具不可用，因此使用独立目录快照与GitHub原生分支提交，原工作目录保留。8项导航回归先RED后GREEN，npm run check最终38/38通过。独立只读审查无阻断问题；浏览器桌面/平板/390/375px已通过，详情见docs/practice-navigation/README.md。
