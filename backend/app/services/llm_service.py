import json

import httpx

from app.core.config import settings


async def generate_reason(profile_a: dict, profile_b: dict, score: float) -> str:
    base_url = settings.DEEPSEEK_BASE_URL if settings.DEEPSEEK_API_KEY else settings.LLM_BASE_URL
    api_key = settings.DEEPSEEK_API_KEY or settings.LLM_API_KEY
    model = settings.DEEPSEEK_MODEL if settings.DEEPSEEK_API_KEY else settings.LLM_MODEL

    if not api_key:
        return (
            "你们在作息、生活节奏和价值观上有较高一致性，"
            "同时在性格侧重点上形成互补。"
            f"综合评分为 {score:.1f}，建议从共同兴趣话题开始交流。"
        )

    prompt = {
        "role": "user",
        "content": (
            "请根据以下两位同学的脱敏画像，生成一段 100-200 字中文匹配理由，"
            "语气温暖真诚，有趣不夸张，不泄露隐私。\n"
            f"A: {json.dumps(profile_a, ensure_ascii=False)}\n"
            f"B: {json.dumps(profile_b, ensure_ascii=False)}\n"
            f"score: {score:.2f}"
        ),
    }

    headers = {"Authorization": f"Bearer {api_key}"}

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(
                f"{base_url.rstrip('/')}/chat/completions",
                headers=headers,
                json={"model": model, "messages": [prompt], "temperature": 0.7, "max_tokens": 300},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            print(f"LLM error: {exc}")
            return (
                "你们在作息、生活节奏和价值观上有较高一致性，"
                "同时在性格侧重点上形成互补。"
                f"综合评分为 {score:.1f}，建议从共同兴趣话题开始交流。"
            )
