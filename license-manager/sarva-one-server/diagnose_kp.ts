import "dotenv/config";
import { db, pool } from "./src/db/connection.js";
import { sql } from "drizzle-orm";

// Read-only diagnostic for the "Krishnapriya Textiles" sync outage.
// Prints NO secrets — only the masked DB host and diagnostic data.

const LID = "a12b18b6-0c76-4537-89b8-221f973090ac"; // active Krishnapriya license

function maskHost(url: string | undefined) {
  if (!url) return "(no DATABASE_URL)";
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}:${u.port ?? ""}/${u.pathname.slice(1)}`;
  } catch {
    return "(unparseable URL)";
  }
}

async function run() {
  console.log("DB host (masked):", maskHost(process.env.DATABASE_URL));
  console.log("Server time:", new Date().toISOString());
  console.log("Now (local):", new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));
  console.log("----------------------------------------");

  // 1. The ACTIVE license record
  const licenseResult = (await db.execute(sql`
    select id, key, shop_name, owner_name, phone, email, plan, status,
           machine_id, activated_at, expires_at, grace_period_days, max_seats,
           created_at, updated_at, deleted_at
    from licenses
    where id = ${LID}
  `)) as any;
  console.log("License record:");
  console.table(licenseResult.rows ?? []);

  // 2. Latest heartbeats (incl. machine_id to spot machine changes)
  const hbs = (await db.execute(sql`
    select created_at, app_version, machine_id, ip_address,
           bills_today, total_bills, total_customers, total_products
    from heartbeats
    where license_id = ${LID}
    order by created_at desc
    limit 25
  `)) as any;
  console.log(`Latest ${hbs.rows.length} heartbeats:`);
  console.table(hbs.rows);
  console.log("Distinct machines:", JSON.stringify([...new Set(hbs.rows.map((r: any) => r.machine_id))]));
  console.log("Distinct versions:", JSON.stringify([...new Set(hbs.rows.map((r: any) => r.app_version))]));
  console.log("Heartbeat count total:", ((await db.execute(sql`select count(*) from heartbeats where license_id = ${LID}`)) as any).rows[0]?.count);

  // 2b. Full timeline (ascending) with gaps between beats
  const tl = (await db.execute(sql`
    select created_at, app_version, bills_today, total_bills
    from heartbeats
    where license_id = ${LID}
    order by created_at asc
  `)) as any;
  const tlRows = tl.rows ?? [];
  console.log(`Full timeline (${tlRows.length} beats):`);
  for (let i = 0; i < tlRows.length; i++) {
    const prev = i === 0 ? null : new Date(tlRows[i - 1].created_at);
    const gap = prev ? Math.round((new Date(tlRows[i].created_at) - prev.getTime()) / 60000) : 0;
    console.log(
      tlRows[i].created_at,
      "| v" + tlRows[i].app_version,
      "| billsToday=" + tlRows[i].bills_today,
      "| totalBills=" + tlRows[i].total_bills,
      "| gap(min)=" + gap
    );
  }

  console.log("----------------------------------------");

  // 2c. Hash check: does runtime hashMachineId(machine_id) match the stored activation hash?
  const { hashMachineId } = await import("./src/services/licenseService.js");
  const machineId = "ff51b09c-4f58-4ad2-b59a-d961d5094b6f";
  const runtimeHash = hashMachineId(machineId);
  const storedHash = "02fea1a391aa519a996cd99fc76ed5894a7f27ed78b6966de40c823c357aa477";
  console.log("Runtime machine hash == stored activation hash?", runtimeHash === storedHash);
  console.log("(If false, touchActivation() matches 0 rows on every heartbeat → last_seen_at never updates. Latent bug, does not block sync.)");

  // 3. Events for this license
  const events = (await db.execute(sql`
    select created_at, actor_type, actor_id, event_type, ip_address
    from license_events
    where license_id = ${LID}
    order by created_at desc
    limit 40
  `)) as any;
  console.log(`Latest ${events.rows.length} events:`);
  console.table(events.rows);

  // 4. Activations for this license
  const acts = (await db.execute(sql`
    select machine_id_hash, hostname, app_version, activated_at, last_seen_at, deactivated_at, blocked_at
    from license_activations
    where license_id = ${LID}
    order by activated_at desc
  `)) as any;
  console.log(`Activations (${acts.rows.length}):`);
  console.table(acts.rows);

  console.log("----------------------------------------");

  // 5. Global comparison: latest heartbeat per license + any rejection signals
  const global = (await db.execute(sql`
    select l.shop_name, l.status, l.deleted_at,
           (select max(created_at) from heartbeats h where h.license_id = l.id) as last_hb,
           (select max(created_at) from license_events e where e.license_id = l.id and e.event_type in ('license.validation_failed','license.machine_mismatch','license.suspended','license.machine_blocked')) as last_bad_event
    from licenses l
    order by last_hb desc nulls last
  `)) as any;
  console.log("All licenses — last heartbeat + last rejection event:");
  console.table(global.rows);

  // 6. Recent activity across ALL clients (last 36h events + last 12h heartbeats)
  const recentEvents = (await db.execute(sql`
    select created_at, actor_type, actor_id, event_type
    from license_events
    where created_at > now() - interval '36 hours'
    order by created_at desc
  `)) as any;
  console.log(`Events in last 36h (${recentEvents.rows.length}):`);
  console.table(recentEvents.rows);

  const recentHbs = (await db.execute(sql`
    select h.created_at, l.shop_name, h.app_version, h.machine_id
    from heartbeats h
    join licenses l on l.id = h.license_id
    where h.created_at > now() - interval '12 hours'
    order by h.created_at desc
  `)) as any;
  console.log(`Heartbeats in last 12h (${recentHbs.rows.length}):`);
  console.table(recentHbs.rows);
}

const WATCH = process.argv.includes("watch");
if (WATCH) {
  // -------------------------------------------------------------------------
  // Watch mode: `npx tsx diagnose_kp.ts watch`
  // Polls every 20s for a NEW Krishnapriya heartbeat and exits when one lands.
  // -------------------------------------------------------------------------
  const LAST_KNOWN = "2026-07-31 14:41:35.428747+00";
  const TIMEOUT_MS = 6 * 60 * 60 * 1000;
  const startedAt = Date.now();
  console.log("Watching for a new KP heartbeat (newer than", LAST_KNOWN, ")...");

  async function watch() {
    try {
      const res = (await db.execute(sql`
        select created_at, app_version, machine_id, total_bills, bills_today
        from heartbeats
        where license_id = ${LID} and created_at > ${LAST_KNOWN}::timestamptz
        order by created_at desc
        limit 5
      `)) as any;
      if ((res.rows ?? []).length > 0) {
        console.log("HEARTBEAT_RECEIVED");
        console.table(res.rows);
        await pool.end();
        process.exit(0);
      }
    } catch (err) {
      console.error("Watch poll error (ignored):", err?.message ?? err);
    }

    if (Date.now() - startedAt > TIMEOUT_MS) {
      console.log("WATCH_TIMEOUT: no new heartbeat within 6 hours.");
      await pool.end();
      process.exit(1);
    }

    setTimeout(watch, 20000);
  }

  watch();
} else {
  run()
    .catch((err) => {
      console.error("Diagnostic failed:", err?.message ?? err);
    })
    .finally(async () => {
      await pool.end();
    });
}
