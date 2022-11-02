var y = Object.defineProperty;
var v = (e, r, o) => r in e ? y(e, r, { enumerable: !0, configurable: !0, writable: !0, value: o }) : e[r] = o;
var d = (e, r, o) => (v(e, typeof r != "symbol" ? r + "" : r, o), o);
const u = "2.0", g = (e) => e.jsonrpc === u && typeof e.method == "string" && Array.isArray(e.params), S = (e) => ({
  jsonrpc: u,
  id: e,
  error: {
    code: -32601,
    message: "Method not found"
  }
}), w = (e, r) => (console.error(r), {
  jsonrpc: u,
  id: e,
  error: {
    code: -32603,
    message: "Unexpected error",
    data: r
  }
}), m = (e) => e && e.jsonrpc === u && typeof e.id == "string", b = (e) => e && e.jsonrpc === u && typeof e.id == "string" && e.error && typeof e.error.message == "string", j = (e) => e && e.jsonrpc === u && typeof e.id == "string" && ("value" in e || "done" in e), E = (e) => e && typeof e[Symbol.asyncIterator] == "function";
class O {
  constructor() {
    d(this, "_done");
    d(this, "iterator");
    d(this, "queue", []);
    d(this, "resolvers", []);
    this.iterator = {
      next: (r) => this.done ? Promise.resolve({ value: r, done: !0 }) : this.queue.length > 0 ? Promise.resolve(this.queue.shift()) : new Promise((o) => {
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
  push(r) {
    if (this._done)
      throw new Error("Cannot push after end");
    this.resolvers.length > 0 ? this.resolvers.shift()({ value: r, done: !1 }) : this.queue.push({ value: r, done: !1 });
  }
  end() {
    if (this._done)
      throw new Error("Cannot end after end");
    this._done = !0, this.resolvers.length > 0 ? this.resolvers.shift()({ value: void 0, done: !0 }) : this.queue.push({ value: void 0, done: !0 });
  }
}
const N = (e) => e.map((r) => {
  switch (typeof r) {
    case "function":
      return {
        type: "function",
        value: String(r)
      };
    default:
      return {
        type: typeof r,
        value: JSON.stringify(r)
      };
  }
}), P = (e) => e.map((r) => {
  switch (r.type) {
    case "function":
      const o = { require, process };
      return new Function(...Object.keys(o), `return ${r.value}`)(
        ...Object.values(o)
      );
    case "string":
    case "number":
    case "boolean":
    case "object":
    default:
      return JSON.parse(r.value);
  }
});
function q() {
  const e = new Array(36);
  for (let r = 0; r < 36; r++)
    e[r] = Math.floor(Math.random() * 16);
  return e[14] = 4, e[19] = e[19] &= ~(1 << 2), e[19] = e[19] |= 1 << 3, e[8] = e[13] = e[18] = e[23] = "-", e.map((r) => r.toString(16)).join("");
}
const x = (e, r) => {
  const o = /* @__PURE__ */ new Map(), l = new Promise((c, t) => {
    e.readyState === 0 ? e.addEventListener(
      "open",
      () => {
        c();
      },
      { once: !0 }
    ) : e.readyState === 1 ? c() : t(new Error("Socket is closed"));
  }), f = (c, t) => {
    const i = q(), n = JSON.stringify({
      jsonrpc: u,
      id: i,
      method: c,
      params: N(t)
    });
    return new Promise((s, a) => {
      o.set(i, { resolve: s, reject: a }), e.send(n);
    });
  }, h = new Proxy(
    {},
    {
      get(c, t) {
        return async (...i) => (await l, f(String(t), i));
      }
    }
  );
  return e.addEventListener("message", async (c) => {
    try {
      const t = JSON.parse(c.data), i = (n) => e.send(JSON.stringify({ jsonrpc: u, ...n }));
      if (t.jsonrpc !== u)
        return;
      if (g(t)) {
        const n = r && r[t.method];
        if (!n || typeof n != "function")
          return i(S(t.id));
        try {
          const s = P(t.params), a = await n.call(r, ...s);
          if (E(a)) {
            for await (const p of a)
              i({ id: t.id, value: p });
            return i({ id: t.id, done: !0 });
          } else
            i({ id: t.id, result: a });
          return;
        } catch (s) {
          return i(w(t.id, s));
        }
      } else if (j(t)) {
        const n = o.get(t.id);
        if (n) {
          const s = n.iterableSink || new O();
          n.iterableSink = s, t.done ? (s.end(), o.delete(t.id), n.resolve(s)) : (s.push(t.value), n.resolve(s));
        }
      } else if (b(t)) {
        const n = o.get(t.id);
        n && (n.reject(t.error), o.delete(t.id));
      } else if (m(t)) {
        const n = o.get(t.id);
        n && (n.resolve(t.result), o.delete(t.id));
      }
    } catch (t) {
      console.error("Error handling message", t, c.data), e.send(
        JSON.stringify({
          jsonrpc: u,
          error: { code: -32601, message: "Invalid JSON" }
        })
      );
    }
  }), h;
};
export {
  O as AsyncIterableSink,
  x as makeSocketRpc
};
