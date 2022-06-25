# Bi-Directional RPC

I found myself needing to wrap different types of websockets. I found some wrappers for websocket RPC, but they were unidirectional. This library aims to make it very easy to define and implement websocket RPC.

The main reason I wanted this was for WebRTC, but I've found other uses for it.

**Server ping method**

```ts
const server = new WebSocket('ws://some-url/');
// Define handlers for incoming messages
const serverRpc = makeSocketRpc(ws, {
  ping: () => 'pong',
});

const client = new WebSocket('ws://some-url/');
// Define types of messages that the server can handle
const clientRpc = makeSocketRpc<{
  ping: () => string;
}>(ws);

// Make the call
const result = await clientRpc.ping();
console.log(result); // 'pong'

// ------------------------------------------------------------

// You can define both sides of the RPC at the same time
const rpc = makeSocketRpc<{
  // Type definitions for the server
  bin(): string;
}>(ws, {
  // Handlers for the client
  foo: () => 'bar',
});

rpc.bin();
// ...and server can call foo()
```
