const fs = require("fs");

const tokens = JSON.parse(process.env.TOKENS_JSON);

// ✅ współrzędne Wrocławia
// const CITY = { lat: 51.107883, lng: 17.038538 }; //Wrocław
const CITY = { lat: 52.406374, lng: 16.925168 }; // ✅ Poznań

// ✅ promień (km)
const RADIUS_KM = 20;

// ✅ dozwolone typy rowerowe
const ALLOWED_CYCLING_TYPES = [
  "Ride",
  "MountainBikeRide",
  "GravelRide",
  "EBikeRide",
  "EMountainBikeRide"
];

// ✅ funkcja liczenia odległości
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

// ✅ opóźnienie (limit API)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ✅ przetwarzanie jednego usera
async function processUser(user, CLIENT_ID, CLIENT_SECRET) {
  await sleep(200);

  try {
    console.log("👤 USER:", user.name);

    // 🔄 refresh token
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
      console.error("❌ TOKEN ERROR:", user.name);
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

    // ✅ pobieranie aktywności
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

    // ✅ filtr poza Wrocławiem
    const outsideActivities = [];

    allActivities.forEach(a => {

      if (!a.start_latlng) return;

      const [lat, lng] = a.start_latlng;

      const dist = getDistance(
        lat,
        lng,
        CITY.lat,
        CITY.lng
      );

      // ✅ poza Wrocławiem
      if (dist < RADIUS_KM) return;

      // ✅ tylko rowerowe
      if (a.trainer === true) return;
      if (!ALLOWED_CYCLING_TYPES.includes(a.sport_type)) return;

      outsideActivities.push({
        name: displayName,
        distance: +(a.distance / 1000).toFixed(1),
        link: `https://www.strava.com/activities/${a.id}`
      });

    });

    console.log(`✅ ${displayName}: ${outsideActivities.length} outside`);

    return outsideActivities;

  } catch (err) {
    console.error("❌ ERROR USER:", user.name, err);
    return [];
  }
}

// ✅ MAIN
async function main() {
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;

  try {
    const results = await Promise.all(
      tokens.map(user => processUser(user, CLIENT_ID, CLIENT_SECRET))
    );

    // ✅ spłaszcz tablicę
    const flat = results.flat();

    // ✅ zapis
    fs.writeFileSync("outside.json", JSON.stringify(flat, null, 2));

    console.log("✅ outside.json zapisany");

  } catch (err) {
    console.error("❌ GLOBAL ERROR:", err);
  }
}

main();
