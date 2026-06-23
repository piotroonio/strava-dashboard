const fs = require("fs");

const tokens = JSON.parse(process.env.TOKENS_JSON);

// ✅ Wrocław (zmień jeśli testujesz inne miasto)
const CITY = { lat: 51.107883, lng: 17.038538 };

// ✅ promień
const RADIUS_KM = 70;

const ALLOWED_CYCLING_TYPES = [
  "Ride",
  "MountainBikeRide",
  "GravelRide",
  "EBikeRide",
  "EMountainBikeRide"
];

// ✅ cache do geocodingu
const geoCache = {};

// ✅ odległość (Haversine)
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

// ✅ geocoding OSM (miasto)
async function getLocationName(lat, lon) {

  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;

  if (geoCache[key]) return geoCache[key];

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
      {
        headers: {
          "User-Agent": "wyzwanierowerowe-app"
        }
      }
    );

    const data = await res.json();
    const a = data.address || {};

    const location =
      a.city ||
      a.town ||
      a.village ||
      a.county ||
      "Unknown";

    geoCache[key] = location;

    // ✅ limiter (ważne)
    await new Promise(r => setTimeout(r, 1000));

    return location;

  } catch (err) {
    console.error("❌ GEO ERROR:", err);
    return "Unknown";
  }
}

// ✅ delay dla API Strava
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
      return [];
    }

    const accessToken = tokenData.access_token;

    // ✅ dane usera
    const athleteRes = await fetch(
      "https://www.strava.com/api/v3/athlete",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const athleteData = await athleteRes.json();

    const displayName =
      [athleteData.firstname, athleteData.lastname]
        .filter(Boolean)
        .join(" ") || user.name;

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
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) break;

      allActivities = allActivities.concat(data);
      page++;
    }

    console.log(`📊 ${displayName}: ${allActivities.length} activities`);

    const outsideActivities = [];

    // ✅ KLUCZOWA PĘTLA (async!)
    for (const a of allActivities) {

      if (!a.distance || a.distance < 1000) continue;
      if (!a.start_latlng || !a.end_latlng) continue;

      const [lat, lng] = a.start_latlng;
      const [endLat, endLng] = a.end_latlng;

      const dist = getDistance(lat, lng, CITY.lat, CITY.lng);

      if (dist < RADIUS_KM) continue;

      if (a.trainer === true) continue;
      if (!ALLOWED_CYCLING_TYPES.includes(a.sport_type)) continue;

      // ✅ geocoding
      const locationName = await getLocationName(lat, lng);

      // ✅ routing (OSM) - poniżej w routingu brakuje "C2"
      const mapLink =
        `https://www.openstreetmap.org/directions?engine=fossgis_osrm_bicycle` +
        `&route=${lat}%2C${lng}%3B${endLat}%2C${endLng}`;

      outsideActivities.push({
        name: displayName,

        date: a.start_date_local
          ? new Date(a.start_date_local).toISOString().split("T")[0]
          : null,

        location: locationName,

        distance: +(a.distance / 1000).toFixed(1),

        mapLink: mapLink,

        link: `https://www.strava.com/activities/${a.id}`
      });
    }

    console.log(`✅ ${displayName}: ${outsideActivities.length} outside`);

    return outsideActivities;

  } catch (err) {
    console.error("❌ USER ERROR:", user.name, err);
    return [];
  }
}

// ✅ MAIN
async function main() {
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;

  try {
  //const results = await Promise.all(
  //tokens.map(user => processUser(user, CLIENT_ID, CLIENT_SECRET))
  //);

const BATCH_SIZE = 80; // bezpieczne
const results = [];

for (let i = 0; i < tokens.length; i += BATCH_SIZE) {

  const batch = tokens.slice(i, i + BATCH_SIZE);

  console.log(`🚀 Processing batch ${i / BATCH_SIZE + 1}`);

  for (const user of batch) {
    const res = await processUser(user, CLIENT_ID, CLIENT_SECRET);
    results.push(res);
  }

  // ❗ NIE czekaj po ostatnim batchu
  if (i + BATCH_SIZE < tokens.length) {
    console.log("⏳ Waiting 15 minutes to respect rate limits...");
    await sleep(15 * 60 * 1000); // 15 min
  }
}


    const flat = results.flat();

    fs.writeFileSync("outside.json", JSON.stringify(flat, null, 2));

    console.log("✅ outside.json zapisany");

  } catch (err) {
    console.error("❌ GLOBAL ERROR:", err);
  }
}

main();
