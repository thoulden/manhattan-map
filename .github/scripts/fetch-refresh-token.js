import fetch from "node-fetch";

// Node 20 has global fetch — no dependency needed
const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const CODE = process.env.STRAVA_CODE;

if (!CLIENT_ID || !CLIENT_SECRET || !CODE) {
  console.error("Missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_CODE");
  process.exit(1);
}

const res = await fetch("https://www.strava.com/api/v3/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: CODE,
    grant_type: "authorization_code",
  }),
});
const data = await res.json();

if (!res.ok) {
  console.error("Token exchange failed:", data);
  process.exit(1);
}

console.log("Access token:", data.access_token);
console.log("Refresh token:", data.refresh_token);
console.log("Expires at:", new Date(data.expires_at * 1000).toISOString());

