// get_strava_tokens.js
import readline from "readline";
import fetch from "node-fetch";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_URI = "https://thoulden.github.io/strava-callback"; // must match your Strava app settings

console.log(`
Open this URL in your browser and authorize:
https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&approval_prompt=force&scope=read,activity:read_all
`);

rl.question("Paste the 'code' you see in the redirect URL: ", async (code) => {
  const response = await fetch("https://www.strava.com/api/v3/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();
  console.log("Access token:", data.access_token);
  console.log("Refresh token:", data.refresh_token);
  console.log("Expires at:", new Date(data.expires_at * 1000).toISOString());

  // Optionally write to a .env file
  // require('fs').appendFileSync('.env', `STRAVA_REFRESH_TOKEN=${data.refresh_token}\n`);

  rl.close();
});
