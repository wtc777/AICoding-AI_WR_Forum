from __future__ import annotations

import mimetypes
import os
from pathlib import Path
from typing import Iterable, List, Tuple

import google.generativeai as genai
from dotenv import load_dotenv

GEMINI_MODEL = "gemini-3.0-pro-preview"


def _read_file_bytes(path: Path) -> Tuple[str, bytes]:
  mime, _ = mimetypes.guess_type(path.name)
  mime = mime or "image/jpeg"
  return mime, path.read_bytes()


def _ensure_api_key() -> str:
  load_dotenv()
  api_key = os.getenv("GEMINI_API_KEY") or os.getenv("AI_API_KEY")
  if not api_key:
    raise RuntimeError("GEMINI_API_KEY environment variable not set")
  return api_key


def analyze_image_with_gemini(image_path: str, prompt: str, model_name: str = GEMINI_MODEL, api_endpoint: str | None = None) -> str:
  api_key = _ensure_api_key()
  if api_endpoint:
    genai.configure(api_key=api_key, client_options={"api_endpoint": api_endpoint})
  else:
    genai.configure(api_key=api_key)

  path = Path(image_path)
  if not path.exists():
    raise FileNotFoundError(f"Image not found: {image_path}")

  mime, image_bytes = _read_file_bytes(path)
  model = genai.GenerativeModel(model_name)
  response = model.generate_content(
    [
      {"text": prompt},
      {
        "inline_data": {
          "mime_type": mime,
          "data": image_bytes,
        }
      },
    ]
  )
  return response.text


def analyze_image_bytes(images: Iterable[Tuple[str, bytes]], prompt: str, model_name: str = GEMINI_MODEL, api_endpoint: str | None = None) -> dict:
  api_key = _ensure_api_key()
  if api_endpoint:
    genai.configure(api_key=api_key, client_options={"api_endpoint": api_endpoint})
  else:
    genai.configure(api_key=api_key)

  parts: List[dict] = [{"text": prompt}]
  for filename, data in images:
    mime, _ = mimetypes.guess_type(filename)
    mime = mime or "image/png"
    parts.append({"inline_data": {"mime_type": mime, "data": data}})

  model = genai.GenerativeModel(model_name)
  response = model.generate_content(parts)
  text = response.text or ""
  return {"text": text, "raw": response.to_dict()}


def analyze_card_image(image_path: str) -> str:
  prompt = (
    "你是一名专业的性格色彩分析师。"
    "请阅读图片中的卡牌文字，并输出 JSON："
    '{"cards": [{"index": 序号, "color": 颜色, "keyword_cn": 中文关键词, "keyword_en": 英文关键词, "score": 分值}]} '
    "无法识别的字段使用 null。"
  )
  return analyze_image_with_gemini(image_path, prompt)


if __name__ == "__main__":
  sample = Path("./sample/card.jpg")
  demo_prompt = "请帮我解析这张卡牌的内容并用简体中文输出。"
  try:
    print(analyze_image_with_gemini(str(sample), demo_prompt))
  except Exception as exc:  # noqa: BLE001
    print("Run failed:", exc)
