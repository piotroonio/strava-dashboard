const tokens = JSON.parse(process.env.TOKENS_JSON);

const fs = require("fs");

async function fetchData() {
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  
for (const user of tokens) {
  const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

  console.log("ENV:", {
    CLIENT_ID: CLIENT_ID,
    CLIENT_SECRET: CLIENT_SECRET ? "OK" : "MISSING",
    REFRESH_TOKEN: REFRESH_TOKEN ? "OK" : "MISSING"
  });

  try {
    // 🔄 1. Odśwież token
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: "refresh_token"
      })
    });

    const tokenData = await tokenRes.json();
    console.log("TOKEN:", tokenData);

    if (!tokenData.access_token) {
      console.error("❌ TOKEN ERROR:", tokenData);
      return;
    }

    const accessToken = tokenData.access_token;

    // ✅ 2. Pobierz dane użytkownika
    const athleteRes = await fetch(
      "https://www.strava.com/api/v3/athlete",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const athleteData = await athleteRes.json();
    console.log("ATHLETE:", athleteData);

    // ✅ pełna nazwa
    const fullName = [athleteData.firstname, athleteData.lastname]
      .filter(Boolean)
      .join(" ");

    const displayName = fullName || "Unknown";

    // 📅 3. Zakres dat (dynamiczny rok)
    const year = new Date().getFullYear();
    const after = Math.floor(new Date(`${year}-05-01`).getTime() / 1000);
    const before = Math.floor(new Date(`${year}-09-30`).getTime() / 1000);

    // 🚴 4. Pagination – pobieranie aktywności
    let page = 1;
    let allActivities = [];

    while (true) {
      const res = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=200&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      const data = await res.json();

      if (!Array.isArray(data)) {
        console.error("❌ API ERROR:", data);
        return;
      }

      if (data.length === 0) break;

      console.log(`📄 Page ${page}: ${data.length} activities`);

      allActivities = allActivities.concat(data);
      page++;
    }

    console.log(`✅ Total activities fetched: ${allActivities.length}`);

    // 📊 5. Agregacja
    let totalDistance = 0;
    let totalElevation = 0;
    let totalTime = 0;
    let totalActivities = 0;


  // ✅ DOZWOLONE typy rowerowe
  const ALLOWED_CYCLING_TYPES = [
  "Ride",
  "MountainBikeRide",
  "GravelRide",
  "Velomobile",
  "Handcycle",
  "EBikeRide",
  "EMountainBikeRide"
  ];

let activityTypesSet = new Set();

    

allActivities.forEach(a => {

  // ❌ pomijamy trenażer (Zwift / indoor)
  if (a.trainer === true) return;

  // ✅ tylko aktywności rowerowe
  if (!ALLOWED_CYCLING_TYPES.includes(a.sport_type)) return;

  // ✅ zapis typów (do tabeli)
  activityTypesSet.add(a.sport_type);

  totalDistance += a.distance;
  totalElevation += a.total_elevation_gain;
  totalTime += a.moving_time;
  totalActivities++;
});
  }

    // 📈 6. Wynik
   // const result = [
   results.push({
     // {
        name: displayName,
        athleteId: athleteData.id, // ✅ potrzebne do linku Strava
        avatar: athleteData.profile,
        activityTypes: Array.from(activityTypesSet),

        totalDistance: +(totalDistance / 1000).toFixed(1),

        avgSpeed:
          totalTime > 0
            ? +((totalDistance / totalTime) * 3.6).toFixed(1)
            : 0,

        avgElevation:
          totalActivities > 0
            ? +(totalElevation / totalActivities).toFixed(0)
            : 0,

        totalElevation: Math.round(totalElevation),

        count: totalActivities,

        avgDistancePerRide:
          totalActivities > 0
            ? +((totalDistance / 1000) / totalActivities).toFixed(1)
            : 0,

        updatedAt: new Date().toISOString()
     // }
    //];
   });

    // 💾 7. Zapis
    //fs.writeFileSync("data.json", JSON.stringify(result, null, 2));
    fs.writeFileSync("data.json", JSON.stringify(results, null, 2));

    console.log("✅ data.json updated successfully");
  } catch (err) {
    console.error("❌ ERROR:", err);
  }
}

fetchData();
