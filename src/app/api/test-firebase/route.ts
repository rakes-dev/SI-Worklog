import { NextResponse } from "next/server";

/**
 * Firestore connectivity / configuration probe.
 *
 * The app's client SDK always talks to the (default) database. This endpoint
 * probes Firestore over REST (no auth, no SDK) and interprets the result so
 * "firestore issues" become self-explanatory:
 *
 *  - HTTP 403 PERMISSION_DENIED → database reachable, security rules enforcing.
 *    This is HEALTHY: the app authenticates users before doing real reads.
 *  - HTTP 404 NOT_FOUND         → the (default) database does not exist for this
 *    project id — a database-name/config mismatch (the exact bug this checks).
 *  - network error              → Firestore is unreachable from this machine,
 *    which matches the browser "client is offline" symptoms.
 *
 * Both (default) and the legacy named database "si-worklog" are probed so a
 * mismatch is called out explicitly.
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";

interface ProbeResult {
  database: string;
  httpStatus: number | null;
  errorStatus: string | null;
  reachable: boolean;
  note: string;
}

async function probeDatabase(database: string): Promise<ProbeResult> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/databases/${database}/documents/sites?pageSize=1`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as {
      error?: { status?: string };
    };
    const errorStatus = body?.error?.status ?? null;
    return {
      database,
      httpStatus: res.status,
      errorStatus,
      reachable: true,
      note:
        res.status === 403 || errorStatus === "PERMISSION_DENIED"
          ? "Reachable — security rules enforcing (403 for anonymous reads is expected)."
          : res.status === 404 || errorStatus === "NOT_FOUND"
            ? "Database NOT FOUND for this project."
            : "Reached, but with an unexpected response.",
    };
  } catch (error) {
    return {
      database,
      httpStatus: null,
      errorStatus: null,
      reachable: false,
      note: `UNREACHABLE from this machine (network/proxy/firewall): ${String(error)}`,
    };
  }
}

export async function GET() {
  if (!PROJECT_ID) {
    return NextResponse.json(
      { ok: false, error: "NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set." },
      { status: 500 },
    );
  }

  const [defaultDb, legacyNamedDb] = await Promise.all([
    probeDatabase("(default)"),
    probeDatabase("si-worklog"),
  ]);

  let verdict: string;
  if (!defaultDb.reachable) {
    verdict =
      "Firestore is unreachable from the server — matches the browser 'client is offline' errors. Check network/proxy/antivirus.";
  } else if (
    defaultDb.httpStatus === 404 ||
    defaultDb.errorStatus === "NOT_FOUND"
  ) {
    verdict =
      "The (default) database does not exist for this project — the app cannot work against it. Check the Firebase console and firebase.json.";
  } else {
    verdict =
      "Healthy: (default) database is reachable and security rules are enforcing. The app authenticates users before real reads, so 403s here are expected.";
  }

  return NextResponse.json({
    ok: defaultDb.reachable && defaultDb.httpStatus !== 404,
    projectId: PROJECT_ID,
    verdict,
    defaultDatabase: defaultDb,
    legacyNamedDatabase: legacyNamedDb,
    checkedAt: new Date().toISOString(),
  });
}
