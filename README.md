# Palisade Owners AI

Отдельный публичный MVP для владельцев Hyundai Palisade.

## Что это

- база знаний по типичным вопросам владельцев Palisade
- поиск по Supabase-таблице с сообщениями/чанками
- AI-ответ по найденному контексту
- бесплатный демо-режим без Telegram, без VPN и без личной сервисной книжки

## Что входит в MVP

- быстрый поиск по Supabase RAG-таблице `knowledge_chunks`
- карточки по темам: масло, тормоза, AWD/HTRAC, дизель, электроника, шины
- AI-ответ поверх найденных источников
- лимит демо-AI в браузере: 5 запросов в день

## Как запустить

```powershell
npm install
npm run dev
```

## Переменные окружения

AI-ответы работают, только если задать один из ключей:

```bash
OPENROUTER_API_KEY=...
OPENAI_API_KEY=...
AI_PROVIDER=openrouter
AI_MODEL=openai/gpt-4o-mini
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Если Supabase env ещё не задан, сайт работает в fallback-режиме по локальным демо-карточкам.

## Supabase

1. Создай Supabase project.
2. Открой SQL Editor.
3. Выполни `supabase/schema.sql`.
4. Добавь `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` в `.env.local` и в Vercel env.

## Импорт Telegram-экспорта

```powershell
npm run import:telegram -- "C:\path\to\result.json" palisade-chat
```

Скрипт читает стандартный Telegram JSON export, фильтрует короткий мусор и складывает сообщения в `knowledge_chunks`.

## Архитектура

- `app/page.tsx` - публичный интерфейс
- `app/api/search` - поиск по базе знаний
- `app/api/answer` - AI-ответ поверх найденных материалов
- `supabase/schema.sql` - таблица и RPC для поиска
- `scripts/import-telegram.ts` - импорт Telegram JSON
- `lib/search.ts` - Supabase-поиск + локальный fallback
- `lib/ai.ts` - OpenAI-compatible слой для OpenRouter или OpenAI

## Дальше можно расширить

- pgvector embeddings
- авторизация для редакторов
- отдельные темы по мотору, АКПП и комплектациям
