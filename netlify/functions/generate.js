export default async (req) => {
  /* ---------- CORS ---------- */
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers });
  }

  try {
    /* ---------- 入力 ---------- */
    const { words } = await req.json();

    if (!Array.isArray(words)) {
      return Response.json(
        { error: "words must be an array" },
        { status: 400, headers }
      );
    }

    if (![3, 5, 7].includes(words.length)) {
      return Response.json(
        { error: "words length must be 3, 5, or 7" },
        { status: 400, headers }
      );
    }

    /* ---------- API Key ---------- */
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY is missing" },
        { status: 500, headers }
      );
    }

    /* ---------- Prompt ---------- */
    const prompt = `
あなたは日本語の日記生成AIです。

【条件】
・以下の単語をすべて使用する
・日本語で書く
・自然な一人称の日記文
・文字数は200〜350字
・箇条書きや見出しは使わない

【使用する単語】
${words.join("、")}

【出力】
条件を満たした日記文のみを出力してください。
`;

    /* ---------- OpenAI ---------- */
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return Response.json(
        { error: "OpenAI error", detail: t },
        { status: 500, headers }
      );
    }

    const data = await r.json();

    const text =
      data.output_text ??
      data.output?.[0]?.content?.[0]?.text ??
      "";

    return Response.json({ text }, { headers });

  } catch (e) {
    return Response.json(
      { error: "server error", detail: String(e) },
      { status: 500, headers }
    );
  }
};
