# Slow Social Backend (FastAPI)

这是基于你给出的架构路线图实现的后端首版，包含：

- 教育邮箱验证码注册（Redis + SMTP）
- JWT 鉴权与匿名系统 ID（system_id）
- 问卷 JSONB 建模（PostgreSQL）
- 周度离线匹配（硬过滤 + 加权打分）
- LLM 生成“合拍理由”
- 周二晚九点结果发布与邮件通知（Celery Beat）

## 1. 启动基础依赖

```bash
docker compose up -d
```

## 2. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

## 3. 配置环境变量

```bash
copy .env.example .env
```

按需填写 SMTP 与 LLM 配置。

## 4. 建表（开发快速方式）

```bash
python -m app.init_db
```

## 5. 启动 API

```bash
uvicorn app.main:app --reload --port 8000
```

访问文档：

- Swagger: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>

## 6. 启动 Celery Worker

```bash
celery -A app.celery_app.celery_app worker -l info
```

## 7. 启动 Celery Beat

```bash
celery -A app.celery_app.celery_app beat -l info
```

## 8. 核心接口

- `POST /api/auth/send-code` 发送 edu.cn 验证码
- `POST /api/auth/verify-code` 校验验证码
- `POST /api/auth/register` 注册并返回 token
- `POST /api/auth/login` 登录
- `PUT /api/questionnaire` 提交/更新问卷
- `GET /api/questionnaire` 获取我的问卷
- `GET /api/matches/current` 获取本周可见匹配
- `POST /api/contact/message` 联系 TA（邮件转发）

## 9. 说明

- 匹配流程默认按“每人每周最多一对”进行贪心分配。
- `build_weekly_matches` 任务会生成 `hidden` 状态结果。
- `publish_weekly_matches` 任务会把结果切换为 `visible`，前端才可读。
- 若未配置 LLM，将使用模板化“合拍理由”作为降级。
