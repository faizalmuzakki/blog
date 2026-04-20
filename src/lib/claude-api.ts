// Client for the home-server claude-api service (Express wrapper around
// the Claude Code CLI). See /home/solork/Projects/home-server/claude-api.
//
// Server returns { id, result, duration_ms } where `result` is the parsed
// JSON produced by `claude -p ... --output-format json` — which itself has
// a `.result` string containing the assistant's final text response.

export interface ClaudeApiConfig {
  url: string;
  secret: string;
}

export interface ComposeGeneration {
  language: string;
  title: string;
  description: string;
  slug: string;
  content: string;
}

const COMPOSE_SYSTEM_PROMPT = `You are a bilingual blog editor. The user will give you:
- rough notes or stream-of-consciousness text in any language
- a target language (ISO code) for the output

Your job: turn the notes into a polished, publishable blog post IN THE TARGET LANGUAGE.

Return ONLY a single JSON object with this exact shape, and nothing else:

{
  "title": "string — concise, evocative, <= 100 chars",
  "description": "string — one-sentence summary used as meta description, <= 200 chars",
  "slug": "string — url-safe-kebab-case, ascii only, <= 60 chars",
  "content": "string — full post body in Markdown. Use headings (##), lists, blockquotes, and paragraph breaks naturally. Do NOT include an H1 title heading — the title is rendered separately. Improve the writing: fix grammar, tighten phrasing, keep the author's voice."
}

Do not wrap in code fences. Do not add commentary before or after.`;

function buildPrompt(originalText: string, targetLang: string, sourceLang: string): string {
  return [
    `Target language: ${targetLang}`,
    `Source language (of the notes): ${sourceLang}`,
    '',
    'Notes:',
    '```',
    originalText,
    '```',
  ].join('\n');
}

interface ClaudeApiResponse {
  id: string;
  result?: {
    result?: string;
    is_error?: boolean;
    subtype?: string;
  } | string;
  error?: string;
  duration_ms?: number;
}

function extractText(payload: ClaudeApiResponse): string {
  if (typeof payload.result === 'string') return payload.result;
  if (payload.result && typeof payload.result.result === 'string') return payload.result.result;
  throw new Error('claude-api returned no text result');
}

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

export async function composeOne(
  config: ClaudeApiConfig,
  originalText: string,
  targetLang: string,
  sourceLang: string,
): Promise<ComposeGeneration> {
  const res = await fetch(`${config.url.replace(/\/$/, '')}/api/prompt`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.secret}`,
    },
    body: JSON.stringify({
      prompt: buildPrompt(originalText, targetLang, sourceLang),
      systemPrompt: COMPOSE_SYSTEM_PROMPT,
      maxTurns: 1,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`claude-api ${res.status}: ${body.slice(0, 300)}`);
  }

  const payload = (await res.json()) as ClaudeApiResponse;
  if (payload.error) throw new Error(payload.error);

  const text = stripCodeFences(extractText(payload));

  let parsed: Partial<ComposeGeneration>;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`claude-api returned non-JSON for ${targetLang}: ${text.slice(0, 200)}`);
  }

  if (
    typeof parsed.title !== 'string' ||
    typeof parsed.description !== 'string' ||
    typeof parsed.slug !== 'string' ||
    typeof parsed.content !== 'string'
  ) {
    throw new Error(`claude-api returned malformed shape for ${targetLang}`);
  }

  return {
    language: targetLang,
    title: parsed.title.trim(),
    description: parsed.description.trim(),
    slug: parsed.slug.trim(),
    content: parsed.content.trim(),
  };
}

export async function composeMany(
  config: ClaudeApiConfig,
  originalText: string,
  targetLanguages: string[],
  sourceLang: string,
): Promise<ComposeGeneration[]> {
  const results = await Promise.allSettled(
    targetLanguages.map((lang) => composeOne(config, originalText, lang, sourceLang)),
  );
  const out: ComposeGeneration[] = [];
  const errors: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') out.push(r.value);
    else errors.push(`${targetLanguages[i]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
  }
  if (errors.length && !out.length) {
    throw new Error(`All generations failed: ${errors.join('; ')}`);
  }
  return out;
}
