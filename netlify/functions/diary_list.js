const { createClient } = require("@supabase/supabase-js");

function getToken(headers) {
  const v = headers.authorization || headers.Authorization || "";
  return v.startsWith("Bearer ") ? v.slice(7) : "";
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "missing_env", detail: "SUPABASE_URL / SUPABASE_ANON_KEY" }),
      };
    }

    const token = getToken(event.headers);
    if (!token) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "unauthorized", detail: "missing bearer token" }),
      };
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userRes, error: userErr } = await supabaseClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "unauthorized", detail: userErr ? userErr.message : "no user" }),
      };
    }

    const { data, error } = await supabaseClient
      .from("diaries")
      .select("id, created_at, words, content")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "supabase_error", detail: error.message }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true, diaries: data }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "server_error", detail: String(e) }),
    };
  }
};
