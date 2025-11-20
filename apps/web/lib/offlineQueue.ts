type Req = { url: string; method: "POST"|"PUT"|"DELETE"; body: any };
const KEY = "pf_offline_queue";

function getQ(): Req[] { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
function setQ(q: Req[]) { localStorage.setItem(KEY, JSON.stringify(q)); }

export function enqueue(req: Req) {
  const q = getQ(); q.push(req); setQ(q);
}

export async function flush(fetcher: (r: Req)=>Promise<void>) {
  const q = getQ(); const next: Req[] = [];
  for (const r of q) {
    try { await fetcher(r); } catch { next.push(r); }
  }
  setQ(next);
}



