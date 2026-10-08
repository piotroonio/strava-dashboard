const fs = require("fs");

const ACTIVITY_ID = process.env.ACTIVITY_ID;

async function main() {

  const REFRESH_TOKEN =
    process.env.STRAVA_PERSONAL_REFRESH_TOKEN;

  const ATHLETE_ID =
    Number(
      process.env.STRAVA_PERSONAL_ATHLETE_ID
    );

  const tokenRes = await fetch(
    "https://www.strava.com/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token: user.refresh_token,
        grant_type: "refresh_token"
      })
    }
  );

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    console.error(tokenData);
    process.exit(1);
  }

  const accessToken =
    tokenData.access_token;

  const detailRes = await fetch(
    `https://www.strava.com/api/v3/activities/${ACTIVITY_ID}`,
    {
      headers: {
        Authorization:
          `Bearer ${accessToken}`
      }
    }
  );

  const detail = await detailRes.json();

  console.log("=== NAME ===");
  console.log(detail.name);

  console.log("=== MAP ===");
  console.log(
    JSON.stringify(
      detail.map,
      null,
      2
    )
  );

  console.log("=== PHOTOS ===");
  console.log(
    JSON.stringify(
      detail.photos,
      null,
      2
    )
  );

  console.log("=== FULL ACTIVITY ===");

const photoRes = await fetch(
  `https://www.strava.com/api/v3/activities/${ACTIVITY_ID}/photos?size=2048`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }
);

const photos = await photoRes.json();

console.log("=== ALL PHOTOS ===");
console.log(
  JSON.stringify(photos, null, 2)
);

// utworzenie katalogu data jeśli nie istnieje
fs.mkdirSync("data", {
  recursive: true
});

fs.writeFileSync(
  "data/activity-detail.json",
  JSON.stringify(detail, null, 2)
);

fs.writeFileSync(
  "data/activity-photos.json",
  JSON.stringify(photos, null, 2)
);

console.log("✅ zapisano data/activity-detail.json");
console.log("✅ zapisano data/activity-photos.json");
  
}

main().catch(console.error);
