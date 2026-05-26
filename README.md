# Palisade Community Search

Публичный поиск по обсуждениям Telegram-сообщества владельцев Hyundai Palisade.

## Что это

- одно поле → реальные треды обсуждений владельцев (дата, активность, реакции)
- гибридный поиск: семантика (Mistral embeddings) + русский full-text, слияние RRF
- по желанию — AI-сводка найденных тредов (кнопка, лимит в браузере)
- без Telegram, без VPN, без личной сервисной книжки

## Архитектура

- читает готовую базу тредов из Supabase-проекта `palisade-sergey` (≈65K тредов)
- ходит только под **anon-ключом** и вызывает единственную RPC `search_threads`
- прямого доступа к таблице у публичного сервиса нет (RLS + SECURITY DEFINER)

## Файлы

- `app/page.tsx` — публичный UI поиска
- `app/api/search` — поиск тредов (бесплатно)
- `app/api/answer` — AI-сводка по найденным тредам
- `lib/supabase.ts` — embed запроса + вызов RPC `search_threads`
- `lib/mistral.ts`, `lib/http.ts` — embeddings и HTTP-обёртка
- `supabase/migrations/0002_public_search_access.sql` — read-only доступ к базе

## Запуск

```powershell
npm install
# скопируй .env.example в .env.local и заполни ключи
npm run dev
```

## Supabase

Один раз выполни `supabase/migrations/0002_public_search_access.sql` в SQL Editor
проекта `palisade-sergey`. Это включает RLS на `threads`, делает `search_threads`
SECURITY DEFINER и выдаёт `anon` право вызывать только поиск.

## Переменные окружения

См. `.env.example`. Минимум для поиска: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`MISTRAL_API_KEY`. Для AI-сводки добавь `OPENROUTER_API_KEY`.
