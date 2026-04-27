import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@r2d.app";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const NOTIFY_BEFORE_MINUTES = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================
// Crypto Helpers (Web Crypto API — zero deps)
// ============================================

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const binary = atob(str + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Import a raw VAPID private key (base64url-encoded 32 bytes) as an ECDSA P-256 key
 */
async function importVapidPrivateKey(b64: string): Promise<CryptoKey> {
  const raw = base64UrlDecode(b64);
  // Construct PKCS8 from raw 32-byte private key
  // For P-256, the JWK format is simpler
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    // We need to derive x,y from the public key or use a separate approach.
    // However, for signing only, we can import as JWK with x,y from the public key.
  };

  // Instead, import the public key to get x,y, then combine.
  // Actually, the simplest approach: import as raw ECDSA key via JWK
  // We need x and y coordinates from the public key.
  const pubRaw = base64UrlDecode(vapidPublicKey);
  // pubRaw is 65 bytes: 0x04 || x (32 bytes) || y (32 bytes)
  const x = base64UrlEncode(pubRaw.slice(1, 33));
  const y = base64UrlEncode(pubRaw.slice(33, 65));

  const fullJwk = {
    kty: "EC",
    crv: "P-256",
    x,
    y,
    d: base64UrlEncode(raw),
  };

  return crypto.subtle.importKey(
    "jwk",
    fullJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

/**
 * Create a VAPID Authorization header (JWT signed with ES256)
 */
async function createVapidAuthHeader(audience: string): Promise<{ authorization: string; cryptoKey: string }> {
  const header = { alg: "ES256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: vapidSubject,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  const key = await importVapidPrivateKey(vapidPrivateKey);
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    key,
    encoder.encode(unsigned)
  );

  // ECDSA signature from Web Crypto is in DER format,
  // but VAPID/JWT needs raw r||s (64 bytes)
  const signature = derToRaw(new Uint8Array(signatureBuffer));
  const signatureB64 = base64UrlEncode(signature);

  const jwt = `${unsigned}.${signatureB64}`;

  return {
    authorization: `WebPush ${jwt}`,
    cryptoKey: `p256ecdsa=${vapidPublicKey}`,
  };
}

/**
 * Convert DER-encoded ECDSA signature to raw r||s format
 */
function derToRaw(der: Uint8Array): Uint8Array {
  // DER format: 0x30 [total-len] 0x02 [r-len] [r] 0x02 [s-len] [s]
  const raw = new Uint8Array(64);
  let offset = 2; // skip 0x30 and total length

  // Read r
  offset++; // skip 0x02
  let rLen = der[offset++];
  const rStart = offset;
  offset += rLen;

  // Read s
  offset++; // skip 0x02
  let sLen = der[offset++];
  const sStart = offset;

  // Copy r (right-aligned in 32 bytes)
  const rBytes = der.slice(rStart, rStart + rLen);
  const rPadded = rLen > 32 ? rBytes.slice(rLen - 32) : rBytes;
  raw.set(rPadded, 32 - rPadded.length);

  // Copy s (right-aligned in 32 bytes)
  const sBytes = der.slice(sStart, sStart + sLen);
  const sPadded = sLen > 32 ? sBytes.slice(sLen - 32) : sBytes;
  raw.set(sPadded, 64 - sPadded.length);

  return raw;
}

// ============================================
// Web Push Payload Encryption (RFC 8291)
// ============================================

async function encryptPayload(
  payload: string,
  subscriptionPubKey: string, // base64url of p256dh
  subscriptionAuth: string    // base64url of auth
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; serverPubKey: Uint8Array }> {
  const encoder = new TextEncoder();

  // 1. Decode subscription keys
  const clientPubKeyRaw = base64UrlDecode(subscriptionPubKey);
  const authSecret = base64UrlDecode(subscriptionAuth);

  // 2. Generate ephemeral ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // 3. Export server public key as raw (65 bytes, uncompressed)
  const serverPubKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey)
  );

  // 4. Import client public key
  const clientPubKey = await crypto.subtle.importKey(
    "raw",
    clientPubKeyRaw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // 5. ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPubKey },
    serverKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // 6. Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 7. Derive IKM using HKDF with auth secret
  const ikmInfo = concatArrays(
    encoder.encode("WebPush: info\0"),
    clientPubKeyRaw,
    serverPubKeyRaw
  );
  const ikm = await hkdf(
    authSecret,
    sharedSecret,
    ikmInfo,
    32
  );

  // 8. Derive CEK (Content Encryption Key) and nonce
  const cekInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");

  const cek = await hkdf(salt, ikm, cekInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // 9. Encrypt with AES-128-GCM
  const paddedPayload = concatArrays(
    encoder.encode(payload),
    new Uint8Array([2]) // delimiter + no padding
  );

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      cryptoKey,
      paddedPayload
    )
  );

  // 10. Build aes128gcm body: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const idLen = new Uint8Array([serverPubKeyRaw.length]);

  const encrypted = concatArrays(
    salt,
    rs,
    idLen,
    serverPubKeyRaw,
    ciphertext
  );

  return { encrypted, salt, serverPubKey: serverPubKeyRaw };
}

/**
 * HKDF-SHA256 (RFC 5869)
 */
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Extract
  const prk = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, ikm)
  );

  // Expand
  const prkKey = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const infoWithCounter = concatArrays(info, new Uint8Array([1]));
  const output = new Uint8Array(
    await crypto.subtle.sign("HMAC", prkKey, infoWithCounter)
  );

  return output.slice(0, length);
}

function concatArrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ============================================
// Send Push Notification
// ============================================

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object
): Promise<{ ok: boolean; status: number; statusText: string }> {
  const payloadStr = JSON.stringify(payload);

  // 1. Encrypt payload
  const { encrypted } = await encryptPayload(
    payloadStr,
    subscription.p256dh,
    subscription.auth
  );

  // 2. Create VAPID auth headers
  const audience = new URL(subscription.endpoint).origin;
  const { authorization, cryptoKey } = await createVapidAuthHeader(audience);

  // 3. Send to push service
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Content-Length": String(encrypted.byteLength),
      Authorization: authorization,
      "Crypto-Key": cryptoKey,
      TTL: "86400",
      Urgency: "high",
    },
    body: encrypted,
  });

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  };
}

// ============================================
// Main Handler
// ============================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + NOTIFY_BEFORE_MINUTES * 60 * 1000);

    // 1. Find reminders that are upcoming and not yet notified
    const { data: reminders, error: remindersError } = await supabase
      .from("reminders")
      .select("id, title, datetime, notes, user_id")
      .eq("completed", false)
      .is("notified_at", null)
      .not("datetime", "is", null)
      .lte("datetime", windowEnd.toISOString())
      .gte("datetime", now.toISOString());

    if (remindersError) {
      console.error("Reminders query error:", remindersError);
      return new Response(JSON.stringify({ error: remindersError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ status: "no_pending", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${reminders.length} reminders to notify`);

    // 2. Group by user_id
    const byUser: Record<string, typeof reminders> = {};
    for (const r of reminders) {
      if (!byUser[r.user_id]) byUser[r.user_id] = [];
      byUser[r.user_id].push(r);
    }

    let sentCount = 0;
    let errorCount = 0;

    // 3. For each user, get their push subscriptions and send
    for (const [userId, userReminders] of Object.entries(byUser)) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId);

      if (!subs || subs.length === 0) {
        console.log(`No push subscriptions for user ${userId}, skipping`);
        continue;
      }

      for (const reminder of userReminders) {
        const dt = new Date(reminder.datetime);
        const timeStr = dt.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        const payload = {
          title: `⏰ ${timeStr} ${reminder.title}`,
          body: reminder.notes || "即将开始",
          tag: `reminder-${reminder.id}`,
          reminderId: reminder.id,
          url: "/",
        };

        // Send to all user's devices
        for (const sub of subs) {
          try {
            const result = await sendPushNotification(sub, payload);
            if (result.ok) {
              sentCount++;
              console.log(`Push sent for reminder ${reminder.id} to ${sub.endpoint.substring(0, 50)}...`);
            } else {
              errorCount++;
              console.error(`Push failed: ${result.status} ${result.statusText}`);
              // If subscription is expired (410 Gone), remove it
              if (result.status === 410 || result.status === 404) {
                await supabase
                  .from("push_subscriptions")
                  .delete()
                  .eq("endpoint", sub.endpoint);
                console.log("Removed expired subscription");
              }
            }
          } catch (err) {
            errorCount++;
            console.error(`Push error for reminder ${reminder.id}:`, err);
          }
        }

        // 4. Mark as notified
        await supabase
          .from("reminders")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", reminder.id);
      }
    }

    return new Response(
      JSON.stringify({ status: "done", sent: sentCount, errors: errorCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-push error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
