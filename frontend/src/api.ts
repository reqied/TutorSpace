export async function api(path: string, options: RequestInit = {}) {
  const r = await fetch("/api" + path, {
    ...options,
    headers:
      options.body instanceof FormData
        ? options.headers
        : { "Content-Type": "application/json", ...options.headers },
  });
  if (!r.ok) {
    let message =
      r.status === 401
        ? "Нужен вход"
        : r.status === 403
          ? "Нет доступа"
          : r.status === 409
            ? "Данные изменились или уже существуют"
            : "Ошибка запроса";
    try {
      message = (await r.json()).message || message;
    } catch {}
    throw new Error(message);
  }
  return r.status === 204 ? null : r.json();
}
export function send(path: string, body: unknown, method = "POST") {
  return api(path, { method, body: JSON.stringify(body) });
}
