const fs = require("fs");

async function fetchData() {
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

  // 🔄 odśwież token
  const tokenRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token"
    })
  });

  const tokenData = await tokenRes.json();
  console.log("DEBUG token:", tokenData);
  
  const accessToken = tokenData.access_token;

  // 📅 zakres dat (1 maja – 30 września)
  const after = new Date("2026-05-01").getTime() / 1000;
  const before = new Date("2026-09-30").getTime() / 1000;

  // 🚴 pobierz aktywności
  const activitiesRes = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=200`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const activities = await activitiesRes.json();
  
  console.log("DEBUG activities:", activities);

  // 📊 agregacja
  let totalDistance = 0;
  let totalElevation = 0;
  let totalTime = 0;

  let count = 0;

  activities.forEach(a => {
    if (a.type !== "Ride") return;

    totalDistance += a.distance; // metry
    totalElevation += a.total_elevation_gain;
    totalTime += a.moving_time; // sekundy
    count++;
  });

  const data = [
    {
      name: "Piotr S.",
      totalDistance: +(totalDistance / 1000).toFixed(1),
      avgSpeed:
        count > 0
          ? +((totalDistance / totalTime) * 3.6).toFixed(1)
          : 0,
      avgElevation:
        count > 0
          ? +(totalElevation / count).toFixed(0)
          : 0,
      count,
      updatedAt: new Date().toISOString()
    }
  ];

  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));

  console.log("✅ data.json updated from Strava");
}

fetchData();
