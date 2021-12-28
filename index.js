"use strict";

import WebSocket from "ws";
// import { toEDNString } from "edn-data";
import { randomUUID } from "crypto";
import transit from "transit-js";

const log = (enthrallme) => console.log(enthrallme);

const tReader = transit.reader("json", {
  handlers: {
    ":": (v) => `${v}`,
  },
});
const tWriter = transit.writer();

// const encoded = toEDNString([
//   [{ key: "foo/bar" }, { map: [[{ key: "message" }, "Hello, World!"]] }],
// ]);

let mdata = transit.map();
mdata.set(transit.keyword("message"), "Hello World");
let message = [[transit.keyword("foo/bar"), mdata]];

const superSecureCrsfToken = "abcd1234";
const endpoint = `ws://localhost:8080/ws?client-id=${randomUUID()}&csrf-token=${superSecureCrsfToken}`;
const ws = new WebSocket(endpoint);

ws.onopen = (event) => {
  log(`Connection opened to '${endpoint}'!`);
  ws.send(tWriter.write(message));
};

ws.onmessage = ({ data }) => {
  let decoded = tReader.read(data.slice(1)); // sente puts a `-` or a `+` at the start of the payload...we don't want that, otherwise transit decoding will fail!
  if ("chsk/ws-ping" === decoded) {
    log("I received a chsk/ws-ping!");
  } else {
    let key = decoded[0];
    if (Array.isArray(key)) {
      // we are dealing with actual "business-logic" replies...
      let payloadType = key[0];
      let payload = transit.mapToObject(key[1]);
      switch (payloadType) {
        case "foo/bar":
          log(payload.message);
          break;
        default:
          log(`I received an unknown payloadType '${payloadType}'`);
          break;
      }
    } else {
      // we are dealing with typical other `sente` websocket replies...
      switch (key) {
        case "chsk/handshake":
          log(`I've received a chsk/handshake '${key}!'`);
          break;
        default:
          log(`I received an unknown key '${key}'!`);
          break;
      }
    }
  }
};

ws.onclose = (event) => {
  log(`Connection closed to '${endpoint}'!`);
};

ws.onerror = ({ message }) => {
  if (message.includes("403")) {
    log("Unauthorized!!");
  } else {
    log(message);
  }
};
