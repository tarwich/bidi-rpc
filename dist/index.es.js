function y() {
  const e = new Array(36);
  for (let n = 0; n < 36; n++)
    e[n] = Math.floor(Math.random() * 16);
  return e[14] = 4, e[19] = e[19] &= ~(1 << 2), e[19] = e[19] |= 1 << 3, e[8] = e[13] = e[18] = e[23] = "-", e.map((n) => n.toString(16)).join("");
}
const i = "2.0", p = (e) => e.jsonrpc === i && typeof e.method == "string" && Array.isArray(e.params), g = (e) => ({
  jsonrpc: i,
  id: e,
  error: {
    code: -32601,
    message: "Method not found"
  }
}), m = (e, n) => ({
  jsonrpc: i,
  id: e,
  error: {
    code: -32603,
    message: "Unexpected error",
    data: n
  }
}), S = (e, n) => {
  const a = /* @__PURE__ */ new Map(), c = new Promise((s, r) => {
    e.readyState === 0 ? e.addEventListener(
      "open",
      () => {
        s();
      },
      { once: !0 }
    ) : e.readyState === 1 ? s() : r(new Error("Socket is closed"));
  }), u = (s, r) => {
    const o = y(), t = JSON.stringify({ jsonrpc: i, id: o, method: s, params: r });
    return new Promise((d, f) => {
      a.set(o, { resolve: d, reject: f }), e.send(t);
    });
  }, l = new Proxy(
    {},
    {
      get(s, r) {
        return async (...o) => (await c, u(String(r), o));
      }
    }
  );
  return e.addEventListener("message", async (s) => {
    try {
      const r = JSON.parse(s.data), o = (t) => e.send(JSON.stringify({ jsonrpc: i, ...t }));
      if (r.jsonrpc !== i)
        return;
      if (p(r)) {
        const t = n && n[r.method];
        if (!t || typeof t != "function")
          return o(g(r.id));
        try {
          const d = await t.call(n, ...r.params);
          return o({ id: r.id, result: d });
        } catch (d) {
          return o(m(r.id, d));
        }
      } else if ("result" in r) {
        const t = a.get(r.id);
        t && (t.resolve(r.result), a.delete(r.id));
      } else if ("error" in r) {
        const t = a.get(r.id);
        t && (t.reject(r.error), a.delete(r.id));
      }
    } catch (r) {
      console.error(r), e.send(
        JSON.stringify({
          jsonrpc: i,
          error: { code: -32601, message: "Invalid JSON" }
        })
      );
    }
  }), l;
};
export {
  S as makeSocketRpc
};
