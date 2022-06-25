function uuidV4() {
  const uuid = new Array(36);
  for (let i = 0; i < 36; i++) {
    uuid[i] = Math.floor(Math.random() * 16);
  }
  uuid[14] = 4;
  uuid[19] = uuid[19] &= ~(1 << 2);
  uuid[19] = uuid[19] |= 1 << 3;
  uuid[8] = uuid[13] = uuid[18] = uuid[23] = "-";
  return uuid.map((x) => x.toString(16)).join("");
}
const jsonrpc = "2.0";
const isFunctionCallMessage = (message) => {
  return message.jsonrpc === jsonrpc && typeof message.method === "string" && Array.isArray(message.params);
};
const methodNotFoundError = (id) => ({
  jsonrpc,
  id,
  error: {
    code: -32601,
    message: "Method not found"
  }
});
const internalError = (id, error) => ({
  jsonrpc,
  id,
  error: {
    code: -32603,
    message: "Unexpected error",
    data: error
  }
});
const makeSocketRpc = (socket, localHandlers) => {
  const calls = /* @__PURE__ */ new Map();
  const connected = new Promise((resolve, reject) => {
    if (socket.readyState === 0) {
      socket.addEventListener("open", () => {
        resolve();
      }, { once: true });
    } else if (socket.readyState === 1) {
      resolve();
    } else {
      reject(new Error("Socket is closed"));
    }
  });
  const sendCall = (method, params) => {
    const id = uuidV4();
    const payload = JSON.stringify({ jsonrpc, id, method, params });
    return new Promise((resolve, reject) => {
      calls.set(id, { resolve, reject });
      socket.send(payload);
    });
  };
  const result = new Proxy({}, {
    get(target, propKey) {
      return async (...args) => {
        await connected;
        return sendCall(String(propKey), args);
      };
    }
  });
  socket.addEventListener("message", async (event) => {
    try {
      const data = JSON.parse(event.data);
      const send = (message) => socket.send(JSON.stringify({ jsonrpc, ...message }));
      if (data.jsonrpc !== jsonrpc) {
        return;
      }
      if (isFunctionCallMessage(data)) {
        const method = localHandlers && localHandlers[data.method];
        if (!method || typeof method !== "function") {
          return send(methodNotFoundError(data.id));
        }
        try {
          const result2 = await method.call(localHandlers, ...data.params);
          return send({ id: data.id, result: result2 });
        } catch (e) {
          return send(internalError(data.id, e));
        }
      } else if ("result" in data) {
        const call = calls.get(data.id);
        if (call) {
          call.resolve(data.result);
          calls.delete(data.id);
        }
      } else if ("error" in data) {
        const call = calls.get(data.id);
        if (call) {
          call.reject(data.error);
          calls.delete(data.id);
        }
      }
    } catch (error) {
      console.error(error);
      socket.send(JSON.stringify({
        jsonrpc,
        error: { code: -32601, message: "Invalid JSON" }
      }));
    }
  });
  return result;
};
export { makeSocketRpc };
