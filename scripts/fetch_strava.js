const fs = require("fs");

// ✅ tokens z GitHub Secrets
const tokens = JSON.parse(process.env.TOKENS_JSON);

// ✅ limiter (ms)
const DELAY_MS = 200;

// ✅ helper sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ✅ przetwarzanie jednego użytkownika
async function processUser(user, CLIENT_ID, CLIENT_SECRET) {

  await sleep(DELAY_MS); // ✅ limiter

  try {
    console.log("👤 USER:", user.name);

    const REFRESH_TOKEN = user.refresh_token;

    // 🔄 TOKEN REFRESH
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
      console.error("❌ TOKEN ERROR:", user.name, tokenData);
      return null;
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

    // 🚴 pobieranie aktywności (pagination)
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
        console.error("❌ API ERROR:", user.name, data);
        break;
      }

      if (data.length === 0) break;

      console.log(`📄 ${user.name} page ${page}: ${data.length}`);

      allActivities = allActivities.concat(data);
      page++;
    }

    // 📊 agregacja
    const ALLOWED_CYCLING_TYPES = [
      "Ride",
      "MountainBikeRide",
      "GravelRide",
      "Velomobile",
      "Handcycle",
      "EBikeRide",
      "EMountainBikeRide"
    ];

    let totalDistance = 0;
    let totalElevation = 0;
    let totalTime = 0;
    let totalActivities = 0;
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

    console.log(`✅ ${user.name}: ${totalActivities} activities`);

    // ✅ wynik pojedynczego usera
    return {
      name: displayName || user.name,
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
          ? Math.round(totalElevation / totalActivities)
          : 0,

      totalElevation: Math.round(totalElevation),

      count: totalActivities,

      avgDistancePerRide:
        totalActivities > 0
          ? +((totalDistance / 1000) / totalActivities).toFixed(1)
          : 0,

      updatedAt: new Date().toISOString()
    };

  } catch (err) {
    console.error("❌ USER ERROR:", user.name, err);
    return null;
  }
}


// ✅ MAIN
async function fetchData() {
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;

  try {

    // 🔥 równoległe wykonanie
    const results = await Promise.all(
      tokens.map(user => processUser(user, CLIENT_ID, CLIENT_SECRET))
    );

    // ✅ usunięcie null (userów z błędem)
    const cleanResults = results.filter(Boolean);

    // 💾 zapis
    fs.writeFileSync("data.json", JSON.stringify(cleanResults, null, 2));

    console.log("✅ data.json updated (multi-user)");

  } catch (err) {
    console.error("❌ GLOBAL ERROR:", err);
  }
}

fetchData();
