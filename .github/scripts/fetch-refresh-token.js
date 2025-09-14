import fetch from "node-fetch";

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const CODE = process.env.STRAVA_CODE; // <- read from env var
const REDIRECT_URI = "https://runs.thomas-houlden.com/strava-callback.html";

if (!CODE) {
  console.error("Missing STRAVA_CODE env variable");
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
console.log("Access token:", data.access_token);
console.log("Refresh token:", data.refresh_token);
console.log("Expires at:", new Date(data.expires_at * 1000).toISOString());
