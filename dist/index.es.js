var p = Object.defineProperty;
var y = (e, t, o) => t in e ? p(e, t, { enumerable: !0, configurable: !0, writable: !0, value: o }) : e[t] = o;
var a = (e, t, o) => (y(e, typeof t != "symbol" ? t + "" : t, o), o);
const d = "2.0", v = (e) => e.jsonrpc === d && typeof e.method == "string" && Array.isArray(e.params), S = (e) => ({
  jsonrpc: d,
  id: e,
  error: {
    code: -32601,
    message: "Method not found"
  }
}), g = (e, t) => ({
  jsonrpc: d,
  id: e,
  error: {
    code: -32603,
    message: "Unexpected error",
    data: t
  }
}), w = (e) => e && e.jsonrpc === d && typeof e.id == "string" && e.result !== void 0, m = (e) => e && e.jsonrpc === d && typeof e.id == "string" && e.error && typeof e.error.message == "string", j = (e) => e && e.jsonrpc === d && typeof e.id == "string" && ("value" in e || "done" in e), E = (e) => e && typeof e[Symbol.asyncIterator] == "function";
class b {
  constructor() {
    a(this, "_done");
    a(this, "iterator");
    a(this, "queue", []);
    a(this, "resolvers", []);
    this.iterator = {
      next: (t) => this.done ? Promise.resolve({ value: t, done: !0 }) : this.queue.length > 0 ? Promise.resolve(this.queue.shift()) : new Promise((o) => {
        this.resolvers.push(o);
      })
    };
  }
  get done() {
    return this._done && this.queue.length === 0;
  }
  [Symbol.asyncIterator]() {
    return this.iterator;
  }
  next() {
    return this.iterator.next();
  }
  push(t) {
    if (this._done)
      throw new Error("Cannot push after end");
    this.resolvers.length > 0 ? this.resolvers.shift()({ value: t, done: !1 }) : this.queue.push({ value: t, done: !1 });
  }
  end() {
    if (this._done)
      throw new Error("Cannot end after end");
    this._done = !0, this.resolvers.length > 0 ? this.resolvers.shift()({ value: void 0, done: !0 }) : this.queue.push({ value: void 0, done: !0 });
  }
}
function q() {
  const e = new Array(36);
  for (let t = 0; t < 36; t++)
    e[t] = Math.floor(Math.random() * 16);
  return e[14] = 4, e[19] = e[19] &= ~(1 << 2), e[19] = e[19] |= 1 << 3, e[8] = e[13] = e[18] = e[23] = "-", e.map((t) => t.toString(16)).join("");
}
const C = (e, t) => {
  const o = /* @__PURE__ */ new Map(), c = new Promise((u, r) => {
    e.readyState === 0 ? e.addEventListener(
      "open",
      () => {
        u();
      },
      { once: !0 }
    ) : e.readyState === 1 ? u() : r(new Error("Socket is closed"));
  }), f = (u, r) => {
    const i = q(), n = JSON.stringify({ jsonrpc: d, id: i, method: u, params: r });
    return new Promise((s, l) => {
      o.set(i, { resolve: s, reject: l }), e.send(n);
    });
  }, h = new Proxy(
    {},
    {
      get(u, r) {
        return async (...i) => (await c, f(String(r), i));
      }
    }
  );
  return e.addEventListener("message", async (u) => {
    try {
      const r = JSON.parse(u.data), i = (n) => e.send(JSON.stringify({ jsonrpc: d, ...n }));
      if (r.jsonrpc !== d)
        return;
      if (console.log("Received message", r), v(r)) {
        const n = t && t[r.method];
        if (!n || typeof n != "function")
          return i(S(r.id));
        try {
          const s = await n.call(t, ...r.params);
          if (E(s)) {
            for await (const l of s)
              i({ id: r.id, value: l });
            return i({ id: r.id, done: !0 });
          } else
            i({ id: r.id, result: s });
          return;
        } catch (s) {
          return i(g(r.id, s));
        }
      } else if (w(r)) {
        const n = o.get(r.id);
        n && (n.resolve(r.result), o.delete(r.id));
      } else if (j(r)) {
        const n = o.get(r.id);
        if (n) {
          const s = n.iterableSink || new b();
          n.iterableSink = s, r.done ? (s.end(), o.delete(r.id)) : (s.push(r.value), n.resolve(s));
        }
      } else if (m(r)) {
        const n = o.get(r.id);
        n && (n.reject(r.error), o.delete(r.id));
      }
    } catch {
      e.send(
        JSON.stringify({
          jsonrpc: d,
          error: { code: -32601, message: "Invalid JSON" }
        })
      );
    }
  }), h;
};
export {
  b as AsyncIterableSink,
  C as makeSocketRpc
};
