# Compatible translation API

This document specifies the custom translation API. Its backend is not included. Configure a compatible HTTPS endpoint and key in the sidepanel. Existing Tokyo-region API Gateway endpoints continue to work; other HTTPS hosts are granted via optional permission when saved. The extension ships no credentials or project-owned backend URL.

Requests use `POST`, `content-type: application/json`, and `x-api-key: <user-configured-key>`.

## POST /<stage>/translate

```json
{
  "text": "Hello world",
  "tokens": ["Hello", "world"],
  "context": []
}
```

A successful response must match:

```json
{
  "words": [
    {"i": 0, "ja": "こんにちは", "base": "hello"},
    {"i": 1, "ja": "世界", "base": "world"}
  ],
  "phrases": [],
  "sentence": {"ja": "こんにちは、世界"}
}
```

`words[].i` indexes the request tokens. A phrase is `{ "start": 0, "end": 1, "ja": "訳", "idiom": true }`, with inclusive token indexes. Return entries in token order; do not return missing or out-of-range token indexes. Words and phrases should describe the provided subtitle in context.

## POST /<stage>/translate-span

The URL is resolved as `new URL('translate-span', apiUrl)`. In addition to the same `text`, `tokens`, and `context`, send inclusive indexes:

```json
{"text":"Take a break","tokens":["Take","a","break"],"context":[],"start":0,"end":2}
```

Response:

```json
{"ja":"休憩する"}
```

## Limits and errors

Text: at most 500 characters; tokens: 1–80 entries, each at most 100 characters; context: at most two cues, each at most 500 characters. Span indexes must satisfy `0 <= start <= end < tokens.length`.

Timeout: 15 seconds. HTTP 429 is retried once after one second. HTTP 403 means authentication failure; 400 means invalid request; 504 means timeout; other non-2xx or invalid response schemas mean server error.

Validate requests, enforce authentication and usage limits on the backend, and configure any required CORS policy for extension requests. Rate limiting and credentials must be enforced server-side; the client cannot hide an API key from its own user.

## Direct providers (v0.5+)

The OpenAI-compatible and Ollama engines need no custom `/translate` server. They send a non-streaming POST to the configured `/chat/completions` endpoint with `model`, `messages`, and `response_format: {"type":"json_object"}`. The prompt requests the same word/phrase/sentence shape above; spans request only `{ "ja": "..." }`. Returned token indexes must cover every input token once, in order; malformed or incomplete responses are rejected.

Cloud endpoints use `Authorization: Bearer ...`. Ollama mode is loopback-only and sends no API key. Remote HTTP, URL credentials/query strings/fragments, and HTTP redirects are rejected. HTTPS endpoints may be customized, but individual providers may implement only part of the Chat Completions API.

Timeouts are 30 seconds for remote compatible APIs and 60 seconds for Ollama. HTTP 429 is retried once after one second. HTTP 401/403 is authentication failure. The UI's connection test deliberately bypasses translation caches.

References: [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility).
