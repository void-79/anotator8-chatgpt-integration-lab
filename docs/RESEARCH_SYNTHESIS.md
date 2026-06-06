# Итоговый отчёт: Anotator8 MCP Integration Lab

**Проект:** `anotator8-chatgpt-integration-lab`
**Дата:** 2026-06-06
**Автор:** Mavis (оркестратор) + исследовательская команда из 4 агентов
**Версия SDK:** `@modelcontextprotocol/sdk` 1.29.0

---

## 1. Краткое резюме

Anotator8 ChatGPT Integration Lab — MCP-сервер для read-only анализа проектов Anotator8. Сервер реализован на TypeScript с использованием официального MCP SDK, Streamable HTTP транспорта (совместим с ChatGPT Developer Mode) и ext-apps для UI-виджетов.

**Исследование подтвердило:** MCP — правильный выбор; OpenAI формально принял MCP в марте 2025; ChatGPT Developer Mode запущен 11 сентября 2025. Протокол выиграл гонку стандартов tool-integration.

**Найдено и исправлено 4 критических проблемы.** Осталось 19 significant issues (3 CRITICAL, 16 MAJOR, 7 MINOR по оценке impl-reviewer v2).

---

## 2. Критические исправления — уже выполнены

| ID | Что | Файл | Статус |
|----|-----|------|--------|
| P01 | `@modelcontextprotocol/sdk` перенесён из `devDependencies` → `dependencies` | `package.json` | ✅ Исправлено |
| P02 | `express` добавлен в `dependencies` | `package.json` | ✅ Исправлено |
| P07 | README.md: исправлены все 7 названий инструментов; обновлены env vars (MCP_HOST/MCP_PORT) | `README.md` | ✅ Исправлено |
| P05 | `collectUnknownFields` теперь принимает `raw` объект, а не пустой | `anotator8-adapter.ts:68` | ✅ Исправлено |
| — | Обновлены версии зависимостей в ARCHITECTURE.md (1.29.0 / 1.7.4) | `docs/ARCHITECTURE.md` | ✅ Исправлено |

**Проверка:** `npm test` → 41/41 ✅ | `npm run smoke` → 6/6 ✅ | `tsc --noEmit` → 0 errors ✅

---

## 3. Оставшиеся критические проблемы

### P03 (CRITICAL) — `simulateInspect` не возвращает `rawSummary`

**Файл:** `src/server/index.ts` / `tests/integration/tools.test.ts`

`inspectProjectOutputSchema` содержит `rawSummary: { nodeCount, trackCount, version }`, но функция `extractInspectResult` не возвращает это поле. Тесты симулируют то же поведение — расхождение незаметно.

**Исправление:** добавить `rawSummary` в `extractInspectResult`:
```typescript
function extractInspectResult(normalized: NormalizedProject) {
  return {
    projectId: normalized.source.kind, // или передавать projectId
    version: normalized.version,
    source: { /* ... */ },
    stats: normalized.stats,
    rawSummary: {
      nodeCount: normalized.annotations.length,
      trackCount: normalized.subtitleTracks.length,
      version: normalized.version,
    },
    warnings: normalized.warnings,
  };
}
```

### P10 (MAJOR) — Нет валидации размера входных данных

**Файл:** `src/server/anotator8-adapter.ts`

Документация обещает лимит 10MB, но `MAX_PROJECT_SIZE = 10485760` нигде не применяется. `projectData` приходит как `z.unknown()`.

**Исправление:** добавить в начало `normalize()`:
```typescript
normalize(raw: unknown): NormalizedProject {
  if (typeof raw === 'string' && raw.length > MAX_PROJECT_SIZE) {
    throw new Error(`Project data exceeds maximum size of ${MAX_PROJECT_SIZE} bytes`);
  }
  // ...
}
```

---

## 4. Production Readiness Roadmap

Исследование 25+ production MCP-серверов выявило следующие критически важные компоненты:

### 4.1 Аутентификация (OAuth 2.1 — обязательно для remote)

MCP Spec 2025-03 требует OAuth 2.1 для remote-серверов. Минимальный viable вариант для dev-режима:

```typescript
// src/middleware/auth.ts
export function bearerAuthMiddleware(validTokens: Set<string>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="mcp"');
      return res.status(401).json({ error: 'Missing Bearer token' });
    }
    if (!validTokens.has(header.slice(7))) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    next();
  };
}
```

Для production: `@modelcontextprotocol/sdk` содержит `mcp/client/auth.ts` для полного OAuth 2.1.

### 4.2 Dockerfile (multi-stage Alpine)

```dockerfile
# Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
ENV MCP_HOST=0.0.0.0 MCP_PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD wget -qO- http://localhost:8787/health || exit 1
CMD ["node", "dist/server/index.js"]
```

### 4.3 Health endpoints + Graceful shutdown

Добавить в `src/server/index.ts`:

```typescript
// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));
app.get('/ready', (_req, res) => {
  // можно проверять транспорты, adapter
  res.json({ status: 'ready', transports: Object.keys(transports).length });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, draining...');
  // закрыть активные сессии
  for (const [sid, transport] of Object.entries(transports)) {
    transport.close();
  }
  server.close(() => process.exit(0));
});
```

### 4.4 Rate limiting

```typescript
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/mcp', limiter);
```

---

## 5. MCP Spec Compliance Gaps

### 5.1 Prompts endpoints — полностью отсутствуют

MCP Spec определяет `/prompts/list` и `/prompts/get`. В проекте `src/server/prompts/` — пустая директория.

**Рекомендация:** добавить минимум 1 prompt template для review workflow:
```typescript
server.prompt(
  'project_review',
  'Структурированный review аннотаций проекта',
  { projectData: z.object({ projectId: z.string() }) },
  ({ projectData }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Review project ${projectData.projectId}: analyze annotations...`
      }
    }]
  })
);
```

### 5.2 Missing capabilities declarations

Не явно объявлено, какие capabilities есть у сервера:

```typescript
new McpServer(
  { name: SERVER_NAME, version: SERVER_VERSION },
  {
    instructions: INSTRUCTIONS,
    capabilities: {
      tools: { listChanged: true },
      // resources: { listChanged: true },  // TODO
      // prompts: { listChanged: true },     // TODO
      // logging: { },                       // TODO
    }
  }
);
```

### 5.3 Resource templates — не реализованы

Для будущей поддержки multi-project: `project:///{projectId}` resource template.

---

## 6. Security Hardening

### 6.1 Текущая угроза: 83% MCP deployments уязвимы

Исследование Invariant Labs + Equixly (2025):
- 43% MCP-серверов подвержены command injection
- CVE-2025-6514: OAuth-агент позволял произвольное выполнение shell-команд (~500K окружений)
- Docker публично назвал экосистему MCP "security nightmare" (август 2025)

### 6.2 Top 5 рисков

| # | Риск |mitigation |
|---|------|-----------|
| 1 | Command injection | Не передавать raw user input в shell; валидировать все входы |
| 2 | Tool poisoning | Аудит всех tool descriptions на скрытые инструкции |
| 3 | Tool shadowing | Проверять domain trust перед подключением MCP-сервера |
| 4 | Supply chain | Заморозить версии MCP SDK; отключить auto-update |
| 5 | Context pollution | Ограничить размер tool output |

### 6.3 Widget security — XSS риски

**Файл:** `src/server/index.ts:451-509`

Inline widget HTML имеет:
- `'unsafe-inline'` для скриптов
- `JSON.stringify(v)` в stats render (XSS если v содержит пользовательские данные)
- Hardcoded malicious domain в production

**Рекомендация:** вынести widget в отдельный файл, использовать CSP header, экранировать user data.

---

## 7. Documentation Fixes Needed

| Файл | Что исправить |
|------|--------------|
| `docs/SECURITY.md` | Security checklist: "Max project size enforced" — не реализовано |
| `src/server/index.ts` | Host параметр в `createMcpExpressApp` — проверить документацию |
| `src/shared/types.ts` | `AnnotationShapeType` неполный (отсутствует `'point'`); `VisualData.fill` не соответствует fixture (цвет с alpha) |
| `tests/integration/tools.test.ts` | `simulateInspect` расходится с реальной реализацией (P03) |

---

## 8. Next Steps — Priority Order

### Фаза 1 — Critical (ломают production)
1. Исправить `rawSummary` в `extractInspectResult` (P03)
2. Добавить валидацию размера проекта (P13)
3. Добавить Bearer auth middleware (MCP 2025-03 spec)

### Фаза 2 — Major (важно для production)
4. Добавить Dockerfile (multi-stage Alpine)
5. Добавить health/ready endpoints
6. Добавить graceful SIGTERM shutdown
7. Исправить widget XSS risks
8. Объявить capabilities явно

### Фаза 3 — Minor (улучшения)
9. Добавить prompts endpoint (1 template)
10. Расширить smoke test (проверять tools registration)
11. Исправить fixture path в интеграционных тестах
12. Добавить resource templates для multi-project
13. Добавить rate limiting

---

## 9. Verified Context

| Параметр | Значение |
|-----------|---------|
| MCP выбран правильно | ✅ Anthropic → OpenAI → Google все приняли |
| StreamableHTTP | ✅ Standard transport с 2025-03 |
| ext-apps / structuredContent | ✅ Для ChatGPT Apps виджетов |
| readOnlyHint: true | ✅ Установлен на всех 7 tools |
| OAuth 2.1 mandatory | ✅ Для remote servers с 2025-03 |
| MCP SDK accepts raw Zod shapes | ✅ `normalizeObjectSchema()` в zod-compat.js |
| structuredContent at root | ✅ Correct для ext-apps клиентов |
| A2A complementary not competing | ✅ Google A2A для agent↔agent |
| LangChain MCP adapters | ✅ `langchain-mcp-adapters` (Feb 2025) |
| SDK v2 timeline Q3 2026 | ✅ RC model, 28 июля 2026 ожидаемо |

---

## 10. Sources

- `@modelcontextprotocol/sdk` zod-compat.js — подтверждено из исходников
- MCP Spec 2025-03-26, 2025-06-18, 2025-11-25
- OpenAI Developer Mode — сентябрь 2025
- modelcontextprotocol/servers, github-mcp-server (~25k stars)
- MCP Security: Invariant Labs, Equixly (2025), CVE-2025-6514, CVE-2025-66414
- LangChain MCP adapters: langchain-mcp-adapters (Feb 2025)
- A2A Protocol: Google Cloud Next, April 2025
