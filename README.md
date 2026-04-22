## 国际学校点歌平台（Web）

当前已实现：
- 首页 `学生｜老师` 两入口（功能相同）
- 右上角 `Admin` 管理员入口（页面骨架）
- `/zh`、`/en` 两种语言路径骨架
- 网易云搜歌 API 代理：`GET /api/search?keyword=...`（需配置中间层）
- 点歌 + 冷却：`POST /api/request`（需要数据库；冷却可用 Redis 或内存兜底）
- 管理员登录与队列管理：`/api/admin/login`、`/api/requests?scope=all`、`/api/requests/:id/(play|remove)`

## Getting Started

### 1) 配置环境变量

复制示例文件：

```bash
cp .env.example .env.local
```

然后启动你的网易云中间层（推荐自部署开源 `NeteaseCloudMusicApi`），并把它的地址配置到：
- `NETEASE_API_BASE_URL`：例如 `http://localhost:3001`

### 2) 启动依赖（推荐：Docker Compose）

```bash
docker compose up -d
```

然后初始化数据库表结构（首次执行）：

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 3) 启动开发服务器

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

入口：
- 学生：`/zh` -> Student
- 老师：`/zh` -> Teacher
- 管理员：`/zh/admin`

管理员密码：
- 在 `.env.local` 里设置 `ADMIN_PASSWORD`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
