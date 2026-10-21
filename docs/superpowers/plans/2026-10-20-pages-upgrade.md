# V10 GitHub Pages Implementation Plan

**Goal:** 升级现有题库为可持续维护的静态网站。
**Architecture:** 原数据零转换迁移；复用 V10 UI；独立正式内容和本地草稿；Actions 校验后发布。
**Tech Stack:** HTML/CSS/ES modules, Node 内置测试, Playwright 浏览器验收。
**Spec:** ../specs/2026-10-20-pages-design.md

## Global Constraints
- 原题内容与编号完整保留；questions.json 为唯一正式数据源。
- 不覆盖旧项目。公开发布必须确认。页面中不得包含凭据。
- 本地草稿不自动覆盖线上正式内容。

## Review Focus
- 正式内容变化而浏览器仍有旧草稿：提示冲突，默认正式版。
- malformed JSON / 存储不可用：显示可恢复错误，不清空已有数据。
- 新增题目 / taxonomy.ids 陈旧：目录按 navGroup 自动生成。
- Pages 子路径和手机：相对资源正确、无水平溢出。
- 导入与其他标签页修改：不静默丢失已有草稿。

## Tasks
- [x] 1. 独立审核原数据，创建不可变 ID 基线与迁移报告；逐字段比对。
- [x] 2. tests/core.test.mjs 先写失败用例；assets/core.mjs 实现校验、导航、草稿冲突模型；运行 node --test。
- [x] 3. 从 V10 拆出 index.html/style.css/app.js；接入动态数据、草稿对比、练习收藏、导入导出；浏览器验收。
- [x] 4. scripts/validate.mjs 与 Pages workflow；README 提供使用 GitHub SHA 更新、校验和恢复说明。
- [ ] 5. 独立代码审查并修复；运行完整数据/单元/浏览器测试；准备具体发布结果供隐私确认；获准且具备连接后部署并验证固定 URL。

用户已明确要求无关键阻碍时直接实施，因此不增加设计/计划的逐步审批门槛。外部发布仍遵守单独隐私确认。

## 2026-10-21 私有访问实施状态

- [x] 用户已选择仅本人访问；停止公开发布流程。
- [x] GitHub Actions改为只校验，移除Pages发布权限及动作。
- [ ] 等待用户确认候选私有托管账号和唯一允许登录的邮箱。
- [ ] 在确认的平台先建立无私密数据的占位服务，配置全站身份验证及精确邮箱策略，验证匿名请求不可读，再部署真实数据。
- [ ] 连接Private GitHub仓库，恢复经过校验的自动部署，核验本人/匿名/非本人及JSON直链权限。

## 2026-10-21 最新执行状态

- [x] 用户重新明确授权公开Github和Pages发布，取代之前私有方向。
- [x] Pages校验、打包、自动部署工作流已恢复；全部23项测试、117题逐字节迁移检查通过。
- [ ] GitHub连接没有创建仓库/Pages设置接口；Chrome网页控制连接不可用，内置浏览器未登录。需用户在GitHub创建新公开仓库并选择Pages的GitHub Actions来源。
- [ ] 随后由代理上传当前项目到main，等待工作流成功，验证固定URL、线上JSON及手机显示。
