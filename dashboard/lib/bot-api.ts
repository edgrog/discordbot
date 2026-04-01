interface BotApiResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

export async function callBotApi(
  path: string,
  options?: RequestInit
): Promise<BotApiResponse> {
  const url = `${process.env.BOT_API_URL}${path}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BOT_API_SECRET}`,
        ...options?.headers,
      },
      signal: AbortSignal.timeout(5000),
    });

    return await res.json();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Bot API unreachable";
    return { ok: false, error: message };
  }
}
