const fs = require("fs");

async function fetchData() {
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

  // Debug ENV (bezpieczny)
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

    // 📅 2. Zakres dat (dynamiczny rok)
    const year = new Date().getFullYear();
    const after = Math.floor(new Date(`${year}-05-01`).getTime() / 1000);
    const before = Math.floor(new Date(`${year}-09-30`).getTime() / 1000);

    // 🚴 3. Pagination – pobieranie wszystkich aktywności
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

      if (data.length === 0) {
        break;
      }

      console.log(`📄 Page ${page}: ${data.length} activities`);

      allActivities = allActivities.concat(data);
      page++;
    }

    console.log(`✅ Total activities fetched: ${allActivities.length}`);

    // 📊 4. Agregacja danych
    let totalDistance = 0;
    let totalElevation = 0;
    let totalTime = 0;
    let totalActivities = 0;

    allActivities.forEach(a => {
      if (a.type !== "Ride") return;

      totalDistance += a.distance;               // metry
      totalElevation += a.total_elevation_gain; // metry
      totalTime += a.moving_time;               // sekundy
      totalActivities++;
    });

    // 📈 5. Obliczenia końcowe
// ✅ wyciągnij dane użytkownika z pierwszej aktywności
const athlete = allActivities[0]?.athlete;

const firstName = athlete?.firstname || "";
const lastName = athlete?.lastname || "";
const athleteId = athlete?.id;

// inicjał nazwiska
const lastInitial = lastName ? `${lastName.charAt(0)}.` : "";

// fallback gdyby coś było nie tak
const displayName = `${firstName} ${lastInitial}`.trim() || "Unknown";

const result = [
  {
    name: displayName,
    athleteId: athleteId, // 🔥 do linków!

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
  }
];

    // 💾 6. Zapis pliku
    fs.writeFileSync("data.json", JSON.stringify(result, null, 2));

    console.log("✅ data.json updated successfully");
  } catch (err) {
    console.error("❌ ERROR:", err);
  }
}

fetchData();
