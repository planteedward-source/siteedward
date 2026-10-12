import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import vm from "node:vm";

test("actual Edge handler verifies authorization and file bytes before storing", async (t) => {
  const source = await readFile(
    new URL("../supabase/functions/upload-media/index.ts", import.meta.url),
    "utf8",
  );
  let handler;
  const state = {
    admin: true,
    authenticated: true,
    uploads: 0,
    inserts: 0,
    removed: 0,
    failInsert: false,
  };
  const env = {
    SUPABASE_URL: "https://fixture.supabase.co",
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
  };
  const createClient = (_, key) =>
    key === "anon"
      ? {
          auth: {
            getUser: async () => ({
              data: { user: state.authenticated ? { id: "admin-id" } : null },
              error: state.authenticated ? null : { message: "Invalid token" },
            }),
          },
          rpc: async () => ({ data: state.admin, error: null }),
        }
      : {
          storage: {
            from: () => ({
              upload: async () => {
                state.uploads++;
                return { error: null };
              },
              remove: async () => {
                state.removed++;
                return { error: null };
              },
            }),
          },
          from: () => ({
            insert: async () => {
              state.inserts++;
              return {
                error: state.failInsert
                  ? { message: "Database unavailable" }
                  : null,
              };
            },
          }),
        };
  const { code } = await transform(
    source.replace(/^import .*from "npm:[^\n]+\n/m, ""),
    { loader: "ts" },
  );
  vm.runInNewContext(code, {
    Deno: {
      env: { get: (name) => env[name] },
      serve: (fn) => {
        handler = fn;
      },
    },
    createClient,
    File,
    Request,
    Response,
    Uint8Array,
    crypto,
  });
  async function request({
    file,
    authorization = "Bearer fixture",
    origin = "https://edward-plante.vercel.app",
    title = "Photo de test",
    alt = "Description de test",
  } = {}) {
    const body = new FormData();
    if (file) body.set("file", file);
    body.set("title", title);
    body.set("alt", alt);
    const headers = { Origin: origin };
    if (authorization) headers.Authorization = authorization;
    return handler(
      new Request("https://fixture.supabase.co/functions/v1/upload-media", {
        method: "POST",
        headers,
        body,
      }),
    );
  }
  await t.test(
    "missing or invalid auth and non-admin roles never upload",
    async () => {
      assert.equal((await request({ authorization: "" })).status, 401);
      state.authenticated = false;
      assert.equal((await request()).status, 401);
      state.authenticated = true;
      state.admin = false;
      assert.equal((await request()).status, 403);
      state.admin = true;
      assert.equal(
        (await request({ origin: "https://untrusted.example" })).status,
        403,
      );
      assert.equal(state.uploads, 0);
    },
  );
  await t.test(
    "spoofed MIME, SVG, invalid descriptions and oversized files are refused",
    async () => {
      assert.equal(
        (
          await request({
            file: new File(["<html>fake</html>"], "fake.png", {
              type: "image/png",
            }),
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request({
            file: new File(["<svg/>"], "fake.svg", { type: "image/svg+xml" }),
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request({
            file: new File([new Uint8Array(9 * 1024 * 1024)], "large.png", {
              type: "image/png",
            }),
          })
        ).status,
        413,
      );
      assert.equal(
        (
          await request({
            file: new File(
              [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
              "test.png",
              { type: "image/png" },
            ),
            alt: "",
          })
        ).status,
        400,
      );
      assert.equal(state.uploads, 0);
    },
  );
  const image = await readFile(
    new URL("../public/images/accueil.png", import.meta.url),
  );
  await t.test(
    "successful publication follows storage and metadata responses",
    async () => {
      const response = await request({
        file: new File([image], "original.png", { type: "image/png" }),
      });
      assert.equal(response.status, 200);
      assert.match((await response.json()).id, /^[\da-f-]{36}$/);
      assert.equal(state.uploads, 1);
      assert.equal(state.inserts, 1);
    },
  );
  await t.test(
    "failed metadata publication cleans up uploaded object and returns an error",
    async () => {
      state.failInsert = true;
      const response = await request({
        file: new File([image], "original.png", { type: "image/png" }),
      });
      assert.equal(response.status, 500);
      assert.ok((await response.json()).error);
      assert.equal(state.removed, 1);
    },
  );
});
