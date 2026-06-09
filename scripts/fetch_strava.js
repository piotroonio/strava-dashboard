const fs = require("fs");

const tokens = JSON.parse(process.env.TOKENS_JSON);

// ✅ corrections
let corrections = {};
try {
  corrections = JSON.parse(fs.readFileSync("corrections.json"));
  console.log("✅ corrections.json loaded");
} catch {
  console.log("⚠️ No corrections.json found");
  corrections = {};
}

// ✅ typy rowerowe
const ALLOWED_CYCLING_TYPES = [
  "Ride",
  "MountainBikeRide",
  "GravelRide",
  "EBikeRide",
  "EMountainBikeRide"
];

// ✅ odległość
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ✅ duplikat (TEN SAM USER)
function isDuplicate(a, b) {
  if (!a.start_latlng || !b.start_latlng) return false;

  const timeDiff = Math.abs(
    new Date(a.start_date).getTime() -
    new Date(b.start_date).getTime()
  );

  const distDiff = Math.abs(a.distance - b.distance);

  const geoDiff = getDistance(
    a.start_latlng[0],
    a.start_latlng[1],
    b.start_latlng[0],
    b.start_latlng[1]
  );

  return (
    timeDiff < 10 * 60 * 1000 &&
    distDiff < 500 &&
    geoDiff < 0.5
  );
}

// ✅ znajdź duplikaty
function findDuplicates(activities) {
  const duplicateIds = new Set();
  const duplicatePairs = [];

  for (let i = 0; i < activities.length; i++) {
    for (let j = i + 1; j < activities.length; j++) {

      if (isDuplicate(activities[i], activities[j])) {

        duplicateIds.add(activities[j].id);

        duplicatePairs.push({
          activity1: activities[i].id,
          activity2: activities[j].id
        });
      }
    }
  }

  return { duplicateIds, duplicatePairs };
}

// ✅ delay
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ✅ przetwarzanie usera
async function processUser(user, CLIENT_ID, CLIENT_SECRET) {

  await sleep(200);

  try {
    console.log("👤 USER:", user.name);

    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: user.refresh_token,
        grant_type: "refresh_token"
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("❌ TOKEN ERROR:", user.name, tokenData);
      return { data: null, duplicates: [] };
    }

    const accessToken = tokenData.access_token;

    // ✅ dane użytkownika
    const athleteRes = await fetch(
      "https://www.strava.com/api/v3/athlete",
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const athlete = await athleteRes.json();
    const avatar = athlete.profile;

    const displayName =
      [athlete.firstname, athlete.lastname]
        .filter(Boolean)
        .join(" ") || user.name;

    // ✅ exclude user
    if (corrections.excludeUsers?.includes(displayName)) {
      console.log(`🚫 Skipping user: ${displayName}`);
      return { data: null, duplicates: [] };
    }

    // 📅 zakres dat
    const year = new Date().getFullYear();
    const after = Math.floor(new Date(`${year}-05-01`).getTime() / 1000);
    const before = Math.floor(new Date(`${year}-09-30`).getTime() / 1000);

    let page = 1;
    let allActivities = [];

    while (true) {
      const res = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=200&page=${page}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) break;

      allActivities = allActivities.concat(data);
      page++;
    }

    console.log(`📊 ${displayName}: ${allActivities.length}`);

    // ✅ duplikaty
    const { duplicateIds, duplicatePairs } = findDuplicates(allActivities);

    console.log(`⚠️ ${displayName}: ${duplicateIds.size} duplicates`);

    // ✅ merge duplicate + manual ignore
    const ignoredActivities = new Set([
      ...(corrections.ignoreActivities || []),
      ...duplicateIds
    ]);

    // ✅ agregacja
    let totalDistance = 0;
    let totalElevation = 0;
    let totalMovingTime = 0;
    let totalActivities = 0;
    let activityTypes = new Set();

    allActivities.forEach(a => {

      // ❌ ignore (manual + dup)
      if (ignoredActivities.has(a.id)) return;

      if (!a.distance || a.distance < 1000) return;
      if (!a.start_latlng) return;
      if (a.trainer === true) return;
      if (!ALLOWED_CYCLING_TYPES.includes(a.sport_type)) return;

      // ✅ override dystansu
      let distance = a.distance;

      if (corrections.overrideDistances?.[a.id]) {
        distance = corrections.overrideDistances[a.id] * 1000;
        console.log(`✏️ Override ${a.id}`);
      }

      totalDistance += distance;
      totalElevation += a.total_elevation_gain || 0;
      totalMovingTime += a.moving_time || 0;
      totalActivities++;

      activityTypes.add(a.sport_type);
    });

    return {
      data: {
        name: displayName,
        avatar: avatar,
        
        totalDistance: +(totalDistance / 1000).toFixed(1),
        totalElevation: Math.round(totalElevation),

       // avgElevation: totalActivities
       // ? Math.round(totalElevation / totalActivities)
       // : 0
        
        totalTime: Math.round(totalMovingTime / 3600),
        totalActivities,
        avgSpeed: totalDistance
          ? +((totalDistance / 1000) / (totalMovingTime / 3600)).toFixed(2)
          : 0,
        activityTypes: Array.from(activityTypes)
      },
      duplicates: duplicatePairs.map(p => ({
        user: displayName,
        ...p
      }))
    };

  } catch (err) {
    console.error("❌ USER ERROR:", user.name, err);
    return { data: null, duplicates: [] };
  }
}

// ✅ MAIN
async function main() {

  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;

  try {
    const results = await Promise.all(
      tokens.map(u => processUser(u, CLIENT_ID, CLIENT_SECRET))
    );

    // ✅ clean data
    const data = results
      .map(r => r.data)
      .filter(Boolean);

    fs.writeFileSync("data.json", JSON.stringify(data, null, 2));

    // ✅ duplicates
    const duplicates = results.flatMap(r => r.duplicates);

    fs.writeFileSync("duplicates.json", JSON.stringify(duplicates, null, 2));

    console.log("✅ data.json + duplicates.json updated");

  } catch (err) {
    console.error("❌ GLOBAL ERROR:", err);
  }
}

main();
