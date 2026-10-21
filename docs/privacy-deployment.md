# HISTORICAL：已取代的仅本人访问方案

本文件仅记录历史，不是当前部署要求。

2026-10-21，用户先提出仅本人访问，因此曾评估“私有 GitHub + Cloudflare Workers/Access”，并暂时把 CI 改为纯校验。随后用户明确改为“算了，还是公开发布到github”，已授权将现有 117 题发布到公开 GitHub 仓库和 GitHub Pages。最新授权取代此前的私有托管方向，不再以私有账号、Access 或额外公开确认作为当前发布前提。

当前目标及实际状态以 [README](../README.md) 和 `.github/workflows/deploy.yml` 为准。工作流已恢复为校验、全部测试及 main 分支的 Pages 部署；仓库创建和线上成功仍须以实际结果验证。历史设计、迁移报告、验收记录及本地发布包继续保留，不删除原始题库或本地历史。

私有方案未部署到 Cloudflare，也未把题库、个人数据或备份上传到 Sites；Sites 仅创建过空的探测资源。该空资源不构成题库托管或内容发布。

历史技术背景：个人账号的常规 GitHub Pages 不提供私有站点身份访问控制；GitHub 的私有 Pages 功能适用于 GitHub Enterprise Cloud 组织拥有的 private/internal 项目仓库，参见 [GitHub 官方说明](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site)。Cloudflare Workers 可另配 Access，参见 [Cloudflare 官方说明](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)。这些是当时评估过的替代方案，不是当前公开 Pages 部署的操作步骤。
