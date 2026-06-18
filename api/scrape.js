import axios from "axios";

// Satu fungsi multi-mode:
//   otakudesu("death note")                  ← search
//   otakudesu({ url: "...otakudesu.blog/anime/<slug>/" })    ← detail anime
//   otakudesu({ url: "...otakudesu.blog/episode/<slug>/" })  ← episode (stream + DL)
//   otakudesu({ mode: "home" })              ← update terbaru di home
//   otakudesu({ mode: "ongoing", page: 1 })  ← anime ongoing
//   otakudesu({ mode: "completed", page: 1 })
//   otakudesu({ mode: "schedule" })          ← jadwal rilis per hari
//   otakudesu({ mode: "genres" })            ← list semua genre
//   otakudesu({ mode: "genre", slug: "action", page: 1 })
//   otakudesu({ mode: "list" })              ← A-Z anime list (heavy)

const API = "https://api.rifkyshre.biz.id";
const ROUTE = "/scrape/otakudesu";

export async function otakudesu(input) {
  let payload;

  if (typeof input === "string") {
    payload = /^https?:\/\/otakudesu\./i.test(input)
      ? { url: input }
      : { query: input };
  } else {
    payload = input;
  }

  try {
    const res = await axios.post(
      `${API}${ROUTE}`,
      payload,
      {
        timeout: 45000,
        validateStatus: () => true,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const body = res.data;

    if (!body?.status) {
      return {
        Status: false,
        Code: body?.code ?? res.status,
        Input: input,
        Result: null,
        Error: body?.error ?? "Unknown error",
      };
    }

    return {
      Status: true,
      Code: body.code,
      Input: input,
      Result: body.data,
    };
  } catch (e) {
    return {
      Status: false,
      Code: e.response?.status ?? 500,
      Input: input,
      Result: null,
      Error: e.message ?? String(e),
    };
  }
}
