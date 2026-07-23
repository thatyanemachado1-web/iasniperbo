import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(projectRoot, "src/lib/telegramRooms.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: "telegramRooms.ts",
}).outputText;

const module = { exports: {} };
const context = vm.createContext({
  AbortController,
  Response,
  clearTimeout: (handle) => clearImmediate(handle),
  exports: module.exports,
  fetch: undefined,
  module,
  require(specifier) {
    if (specifier === "@/lib/adminApi") return { readAdminSession: () => null };
    if (specifier === "@/lib/userSession") {
      return { readUserSession: () => ({ clientToken: "", email: "" }) };
    }
    throw new Error(`Unexpected import in timeout test: ${specifier}`);
  },
  setTimeout: (callback) => setImmediate(callback),
});

vm.runInContext(compiled, context, { filename: "telegramRooms.js" });
const telegramRooms = module.exports;

const timeoutCases = [
  {
    name: "validation",
    expected: /validacao da sala demorou mais de 15 segundos/i,
    run: () =>
      telegramRooms.createTelegramRoom({ name: "Sala teste", chatId: "chat", botToken: "token" }),
  },
  {
    name: "list",
    expected: /carregamento das salas demorou mais de 15 segundos/i,
    run: () => telegramRooms.listTelegramRooms(),
  },
  {
    name: "update",
    expected: /atualizacao da sala demorou mais de 15 segundos/i,
    run: () => telegramRooms.updateTelegramRoom("room", { name: "Sala atualizada" }),
  },
  {
    name: "toggle",
    expected: /alteracao do modulo demorou mais de 15 segundos/i,
    run: () => telegramRooms.toggleTelegramRoomModule("room", "paying_numbers", true),
  },
  {
    name: "test",
    expected: /teste da sala demorou mais de 15 segundos/i,
    run: () => telegramRooms.testTelegramRoom("room"),
  },
  {
    name: "delete",
    expected: /exclusao da sala demorou mais de 15 segundos/i,
    run: () => telegramRooms.deleteTelegramRoom("room"),
  },
  {
    name: "preview",
    expected: /envio da previa demorou mais de 15 segundos/i,
    run: () => telegramRooms.previewTelegramRoom("room", "Teste", []),
  },
  {
    name: "strategy list",
    expected: /carregamento das estrategias demorou mais de 15 segundos/i,
    run: () => telegramRooms.listTelegramStrategyPatterns(),
  },
  {
    name: "strategy save",
    expected: /salvamento da estrategia demorou mais de 15 segundos/i,
    run: () =>
      telegramRooms.saveTelegramStrategyDelivery({ id: "pattern", name: "Padrao" }),
  },
];

for (const testCase of timeoutCases) {
  let fetchCalls = 0;
  context.fetch = (_input, init = {}) => {
    fetchCalls += 1;
    return abortablePendingRequest(init.signal);
  };

  await assert.rejects(testCase.run(), testCase.expected, testCase.name);
  assert.equal(fetchCalls, 1, `${testCase.name} must not retry`);
}

let createFetchCalls = 0;
context.fetch = (_input, init = {}) => {
  createFetchCalls += 1;
  if (createFetchCalls === 1) {
    return Promise.resolve(
      new Response(JSON.stringify({ validationCode: "validation-code" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
  return abortablePendingRequest(init.signal);
};

await assert.rejects(
  telegramRooms.createTelegramRoom({ name: "Sala teste", chatId: "chat", botToken: "token" }),
  /cadastro da sala demorou mais de 15 segundos/i,
  "create",
);
assert.equal(createFetchCalls, 2, "create must validate once and create once without retry");

console.log("telegram-rooms timeout tests: ok");

function abortablePendingRequest(signal) {
  return new Promise((_resolve, reject) => {
    signal?.addEventListener(
      "abort",
      () => {
        const error = new Error("Request aborted");
        error.name = "AbortError";
        reject(error);
      },
      { once: true },
    );
  });
}
