import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const { HubConnectionBuilder } = require("@microsoft/signalr");
const base = process.env.TEST_URL || "http://localhost:8080";
const email = process.env.TUTOR_EMAIL,
  password = process.env.TUTOR_PASSWORD;
if (!email || !password)
  throw Error(
    "Set TUTOR_EMAIL and TUTOR_PASSWORD for the isolated test instance",
  );
function client() {
  let cookie = "";
  const fn = async (
    path,
    body,
    method = body === undefined ? "GET" : "POST",
  ) => {
    const r = await fetch(base + "/api" + path, {
      method,
      headers: {
        Origin: new URL(base).origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
    if (r.headers.has("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    let value;
    try {
      value = await r.json();
    } catch {}
    return { status: r.status, value };
  };
  fn.cookie = () => cookie;
  return fn;
}
const t = client(),
  a = client(),
  b = client(),
  anon = client();
assert.equal((await anon("/students")).status, 401);
assert.equal((await t("/auth/login", { email, password })).status, 200);
const suffix = Date.now(),
  studentPassword = "Student_Test_2026!";
const sa = (
  await t("/students", {
    name: "Test A",
    email: `test-a-${suffix}@example.test`,
    grade: "10",
    password: studentPassword,
    telegramChatId: null,
    vkPeerId: null,
  })
).value;
const sb = (
  await t("/students", {
    name: "Test B",
    email: `test-b-${suffix}@example.test`,
    grade: "11",
    password: studentPassword,
    telegramChatId: null,
    vkPeerId: null,
  })
).value;
assert.ok(sa.id && sb.id);
assert.equal(
  (await a("/auth/login", { email: sa.email, password: studentPassword }))
    .status,
  200,
);
assert.equal(
  (await b("/auth/login", { email: sb.email, password: studentPassword }))
    .status,
  200,
);
assert.equal((await a("/students")).value.length, 1);
assert.equal((await a("/students", { name: "Forbidden" })).status, 403);
const m = (
  await t("/materials", {
    title: "Integration test",
    section: "Алгебра",
    kind: "Домашка",
    content: "$2+2$?",
    answer: "4",
  })
).value;
assert.ok(m.id);
assert.equal(
  (await a("/materials")).value.some((x) => x.id === m.id),
  false,
);
const assign = (
  await t("/assignments", {
    studentId: sa.id,
    materialId: m.id,
    deadline: "2027-01-01T12:00:00+05:00",
  })
).value;
assert.ok(assign.id);
const visible = (await a("/materials")).value.find((x) => x.id === m.id);
assert.equal(visible.answer, null);
assert.equal(visible.autoCheck, true);
assert.equal((await b("/assignments")).value.length, 0);
assert.equal(
  (await b(`/assignments/${assign.id}/submit`, { response: "4" })).status,
  403,
);
assert.equal(
  (await a(`/assignments/${assign.id}/submit`, { response: "5" })).value.status,
  "Попробуй ещё",
);
assert.equal(
  (await a(`/assignments/${assign.id}/submit`, { response: " 4 " })).value
    .status,
  "Верно",
);
assert.equal((await a("/materials", { title: "Forbidden" })).status, 403);
const l = (
  await t("/lessons", {
    studentId: sa.id,
    title: "Test lesson",
    startsAt: "2027-01-01T10:00:00+05:00",
    minutes: 60,
    price: 1500,
    done: false,
    paid: false,
  })
).value;
assert.ok(l.id);
assert.equal((await b(`/boards/${l.id}`)).status, 403);
const ca = new HubConnectionBuilder()
  .withUrl(base + "/hubs/board", {
    headers: { Cookie: a.cookie(), Origin: new URL(base).origin },
  })
  .build();
const cb = new HubConnectionBuilder()
  .withUrl(base + "/hubs/board", {
    headers: { Cookie: b.cookie(), Origin: new URL(base).origin },
  })
  .build();
await ca.start();
await cb.start();
await ca.invoke("Join", l.id);
await assert.rejects(() => cb.invoke("Join", l.id));
const event = new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(Error("SignalR update not received")),
    5000,
  );
  ca.on("BoardUpdated", (value) => {
    clearTimeout(timer);
    resolve(value);
  });
});
const board = (await a(`/boards/${l.id}`)).value;
assert.equal(board.version, 0);
assert.equal(
  (
    await a(
      `/boards/${l.id}`,
      {
        data: '[{"color":"#000","width":3,"points":[[1,2],[3,4]]}]',
        version: 0,
      },
      "PUT",
    )
  ).value.version,
  1,
);
assert.equal((await event).version, 1);
await ca.stop();
await cb.stop();
assert.equal(
  (await t(`/boards/${l.id}`, { data: "[]", version: 0 }, "PUT")).status,
  409,
);
assert.equal(
  (await t(`/lessons/${l.id}`, { ...l, studentId: sb.id }, "PATCH")).status,
  400,
);
assert.equal(
  (await a(`/lessons/${l.id}`, { ...l, paid: true }, "PATCH")).status,
  403,
);
assert.equal(
  (await t(`/lessons/${l.id}`, { ...l, paid: true, done: true }, "PATCH")).value
    .paid,
  true,
);
const form = new FormData();
form.append(
  "file",
  new Blob(["A test file"], { type: "text/plain" }),
  "test.txt",
);
const file = (await t("/files/" + m.id, form)).value;
assert.ok(file.id);
assert.equal((await a("/files?materialId=" + m.id)).value.length, 1);
assert.equal((await b("/files?materialId=" + m.id)).status, 403);
assert.equal((await b("/files/" + file.id)).status, 403);
assert.equal((await a("/files/" + file.id)).status, 200);
const review = (
  await t(`/assignments/${assign.id}/review`, {
    status: "Принято",
    feedback: "Отлично",
  })
).value;
assert.equal(review.feedback, "Отлично");
assert.equal((await a("/notifications")).status, 403);
const csrf = await fetch(base + "/api/auth/logout", {
  method: "POST",
  headers: { Origin: "https://untrusted.example" },
});
assert.equal(csrf.status, 403);
console.log(
  "PASS: auth, roles, student isolation, answer secrecy, auto-check, manual review, lesson statuses, files, board persistence, conflict protection, SignalR updates and group isolation, CSRF origin",
);
