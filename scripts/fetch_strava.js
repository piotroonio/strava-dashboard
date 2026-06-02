const fs = require("fs");

// ✅ wczytanie tokenów
const tokens = JSON.parse(process.env.TOKENS_JSON);

async function fetchData() {
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;

  let results = []; // ✅ DODANE

  try {

    // 🔁 PĘTLA USERS
    for (const user of tokens) {

      const REFRESH_TOKEN = user.refresh_token; // ✅ FIX

      console.log("👤 USER:", user.name);

      // 🔄 1. Odśwież token
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

      if (!tokenData.access_token) {
        console.error("❌ TOKEN ERROR:", tokenData);
        continue; // ✅ ważne przy multi-user
      }

      const accessToken = tokenData.access_token;

      // ✅ ATHLETE
      const athleteRes = await fetch(
        "https://www.strava.com/api/v3/athlete",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      const athleteData = await athleteRes.json();

      const displayName = [athleteData.firstname, athleteData.lastname]
        .filter(Boolean)
        .join(" ");

      // 📅 zakres dat
      const year = new Date().getFullYear();
      const after = Math.floor(new Date(`${year}-05-01`).getTime() / 1000);
      const before = Math.floor(new Date(`${year}-09-30`).getTime() / 1000);

      // 🚴 aktywności
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
          break;
        }

        if (data.length === 0) break;

        allActivities = allActivities.concat(data);
        page++;
      }

      // 📊 agregacja
      let totalDistance = 0;
      let totalElevation = 0;
      let totalTime = 0;
      let totalActivities = 0;

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

        if (a.trainer === true) return;
        if (!ALLOWED_CYCLING_TYPES.includes(a.sport_type)) return;

        activityTypesSet.add(a.sport_type);

        totalDistance += a.distance;
        totalElevation += a.total_elevation_gain;
        totalTime += a.moving_time;
        totalActivities++;
      });

      // ✅ wynik
      results.push({
        name: displayName || "Unknown",
        athleteId: athleteData.id,
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
      });

    } // ✅ KONIEC pętli

    // 💾 zapis
    fs.writeFileSync("data.json", JSON.stringify(results, null, 2));

    console.log("✅ data.json updated");

  } catch (err) {
    console.error("❌ GLOBAL ERROR:", err);
  }
}

fetchData();
