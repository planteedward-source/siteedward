import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("PostgreSQL migration enforces visitor, account and administrator permissions", async (t) => {
  const pg = new PGlite();
  const admin = "00000000-0000-4000-8000-000000000077";
  const ordinary = "00000000-0000-4000-8000-000000000040";
  try {
    // Supabase's external schemas are emulated; production migration is used unchanged.
    await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon,authenticated;
      grant select,insert,update,delete on storage.objects to anon,authenticated;`);
    await pg.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610120001_player_site.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await pg.exec(await readFile(new URL("../supabase/migrations/202610120002_reference_videos.sql", import.meta.url), "utf8"));
    await pg.query("insert into auth.users values ($1),($2)", [
      admin,
      ordinary,
    ]);
    await pg.query("insert into private.site_admins values ($1)", [admin]);
    async function as(role, user, sql, values = []) {
      await pg.exec("begin");
      try {
        await pg.exec(`set local role ${role}`);
        await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [
          user || "",
        ]);
        return await pg.query(sql, values);
      } finally {
        await pg.exec("rollback");
      }
    }
    await t.test(
      "public can read genuine initial zero values but cannot mutate or grant itself rights",
      async () => {
        const rows = await as("anon", null, "select * from public.totals");
        assert.equal(rows.rows.length, 2);
        assert.ok(
          rows.rows.every(
            (r) => r.matches === 0 && r.goals === 0 && r.assists === 0,
          ),
        );
        assert.equal(
          (await as("anon", null, "select public.is_admin() as allowed"))
            .rows[0].allowed,
          false,
        );
        await assert.rejects(
          as(
            "anon",
            null,
            "select public.save_totals('2026-2027','trident',1,2,3,0)",
          ),
          /permission denied/,
        );
        await assert.rejects(
          as("anon", null, "update public.totals set goals=5"),
          /permission denied/,
        );
        await assert.rejects(
          as("anon", null, "select * from private.site_admins"),
          /permission denied/,
        );
      },
    );
    await t.test(
      "authenticated ordinary account is denied all sensitive RPCs",
      async () => {
        for (const sql of [
          "select public.save_totals('2026-2027','trident',1,2,3,0)",
          "select public.create_season('2027-2028')",
          "select public.activate_season('2026-2027')",
          "select public.delete_season('2026-2027')",
          "select public.choose_hero('local-1')",
          "select public.remove_media('local-1')",
          "select public.restore_local_media()",
        ])
          await assert.rejects(
            as("authenticated", ordinary, sql),
            /Administrator required/,
          );
        await assert.rejects(
          as(
            "authenticated",
            ordinary,
            "insert into public.media(path,kind,title,alt) values('fake','image','Fake','Fake')",
          ),
          /permission denied/,
        );
        await assert.rejects(
          as(
            "authenticated",
            ordinary,
            "insert into storage.objects(bucket_id,name) values('player-media','fake.png')",
          ),
          /row-level security/,
        );
      },
    );
    await t.test(
      "admin edits totals with validation and conflict detection, but cannot bypass RPCs",
      async () => {
        assert.equal(
          (
            await as(
              "authenticated",
              admin,
              "select public.is_admin() as allowed",
            )
          ).rows[0].allowed,
          true,
        );
        await pg.exec("begin");
        try {
          await pg.exec("set local role authenticated");
          await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [
            admin,
          ]);
          await pg.exec(
            "select public.save_totals('2026-2027','trident',4,2,1,0)",
          );
          const r = (
            await pg.query("select * from public.totals where team='trident'")
          ).rows[0];
          assert.deepEqual(
            [r.matches, r.goals, r.assists, r.revision],
            [4, 2, 1, 1],
          );
          await assert.rejects(
            pg.exec("select public.save_totals('2026-2027','trident',4,9,1,0)"),
            /conflict/,
          );
        } finally {
          await pg.exec("rollback");
        }
        await assert.rejects(
          as(
            "authenticated",
            admin,
            "select public.save_totals('2026-2027','trident',0,-1,0,0)",
          ),
          /check constraint/,
        );
        await assert.rejects(
          as("authenticated", admin, "update public.totals set goals=9"),
          /permission denied/,
        );
        await assert.rejects(
          as(
            "authenticated",
            admin,
            "insert into storage.objects(bucket_id,name) values('player-media','unvalidated.png')",
          ),
          /row-level security/,
        );
      },
    );
    await t.test(
      "seasons use real totals, have one active season, and protect the active season",
      async () => {
        await assert.rejects(
          as(
            "authenticated",
            admin,
            "select public.create_season('2027-2029')",
          ),
          /check constraint/,
        );
        await assert.rejects(
          as(
            "authenticated",
            admin,
            "select public.delete_season('2026-2027')",
          ),
          /saison active/,
        );
        await pg.exec("begin");
        try {
          await pg.exec("set local role authenticated");
          await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [
            admin,
          ]);
          await pg.exec(
            "select public.create_season('2027-2028'); select public.activate_season('2027-2028');",
          );
          assert.equal(
            (
              await pg.query(
                "select count(*)::int as n from public.seasons where active",
              )
            ).rows[0].n,
            1,
          );
          assert.equal(
            (
              await pg.query(
                "select count(*)::int as n from public.totals where season_id='2027-2028' and goals=0 and assists=0 and matches=0",
              )
            ).rows[0].n,
            2,
          );
          await pg.exec("select public.delete_season('2026-2027')");
          assert.equal(
            (
              await pg.query(
                "select count(*)::int as n from public.totals where season_id='2026-2027'",
              )
            ).rows[0].n,
            0,
          );
        } finally {
          await pg.exec("rollback");
        }
      },
    );
    await t.test(
      "hero selection rejects non-existent media and protects current photo",
      async () => {
        await assert.rejects(
          as("authenticated", admin, "select public.choose_hero('invented')"),
          /photo existante/,
        );
        await assert.rejects(
          as(
            "authenticated",
            admin,
            "select public.remove_media('local-hero')",
          ),
          /autre photo/,
        );
        await pg.exec("begin");
        try {
          await pg.exec("set local role authenticated");
          await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [
            admin,
          ]);
          await pg.exec(
            "select public.choose_hero('local-1'); select public.remove_media('local-hero');",
          );
          const r = (await pg.query("select * from public.site_settings"))
            .rows[0];
          assert.equal(r.hero_media_id, "local-1");
          assert.deepEqual(r.hidden_local_media, ["local-hero"]);
          await pg.exec("select public.restore_local_media()");
          assert.deepEqual(
            (
              await pg.query(
                "select hidden_local_media from public.site_settings",
              )
            ).rows[0].hidden_local_media,
            [],
          );
        } finally {
          await pg.exec("rollback");
        }
      },
    );
  } finally {
    await pg.close();
  }
});
