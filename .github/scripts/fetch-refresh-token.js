// No imports needed on Node 20
// access via: https://www.strava.com/oauth/authorize?client_id=CLIENT_ID&response_type=code&redirect_uri=https%3A%2F%2Fruns.thomas-houlden.com%2Fstrava-callback.html&scope=read,activity:read_all&approval_prompt=force



(async () => {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_CODE } = process.env;

  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_CODE) {
    console.error("Missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_CODE");
    process.exit(1);
  }

  const res = await fetch("https://www.strava.com/api/v3/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code: STRAVA_CODE,
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
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
