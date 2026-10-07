const fs = require("fs");

const tokens = JSON.parse(process.env.TOKENS_JSON);

const ACTIVITY_ID = process.env.ACTIVITY_ID;

// nazwa dokładnie taka jak w TOKENS_JSON
const MY_NAME = "Piotr Sieradzki";

async function main() {

  const user = tokens.find(
    t => t.name === MY_NAME
  );

  if (!user) {
    throw new Error(
      `Nie znaleziono użytkownika ${MY_NAME}`
    );
  }

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
  `https://www.strava.com/api/v3/activities/${ACTIVITY_ID}/photos?size=600`,
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
