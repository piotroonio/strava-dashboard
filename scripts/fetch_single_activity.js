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
        refresh_token:
          process.env.STRAVA_PERSONAL_REFRESH_TOKEN,
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
  "data/activity-photos.json",
  JSON.stringify(photos, null, 2)
);

const streamRes = await fetch(
  `https://www.strava.com/api/v3/activities/${ACTIVITY_ID}/streams?keys=time,latlng,altitude&key_by_type=true`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }
);

const streams = await streamRes.json();

console.log(
  "Streams keys:",
  Object.keys(streams)
);

console.log(
  "latlng exists:",
  !!streams.latlng
);

let startLocation = null;
let finishLocation = null;

let startAltitude = null;
let finishAltitude = null;

if (
  streams.latlng &&
  streams.latlng.data &&
  streams.latlng.data.length > 0
) {

  const route =
    streams.latlng.data;

  const start =
    route[0];

  const weather =
  await fetchWeather(
    start[0],
    start[1],
    detail.start_date
  );

  const finish =
    route[
      route.length - 1
    ];

  if (
  streams.altitude &&
  streams.altitude.data &&
  streams.altitude.data.length > 0
  ) {

  startAltitude =
    Math.round(
      streams.altitude.data[0]
    );

  finishAltitude =
    Math.round(
      streams.altitude.data[
        streams.altitude.data.length - 1
      ]
    );
  }
  
  console.log(
    "Reverse geocoding start..."
  );

  startLocation =
    await reverseGeocode(
      start[0],
      start[1]
    );

  console.log(
    startLocation
  );

  console.log(
    "Reverse geocoding finish..."
  );

  finishLocation =
    await reverseGeocode(
      finish[0],
      finish[1]
    );

  console.log(
    finishLocation
  );
}

detail.start_location =
  startLocation;

detail.finish_location =
  finishLocation;

detail.start_altitude =
  startAltitude;

detail.finish_altitude =
  finishAltitude;

detail.weather =
  weather;

fs.writeFileSync(
  "data/activity-detail.json",
  JSON.stringify(
    detail,
    null,
    2
  )
);

fs.writeFileSync(
  "data/activity-photos.json",
  JSON.stringify(
    photos,
    null,
    2
  )
);

fs.writeFileSync(
  "data/activity-streams.json",
  JSON.stringify(
    streams,
    null,
    2
  )
);

console.log(
  "✅ zapisano data/activity-detail.json"
);

console.log(
  "✅ zapisano data/activity-photos.json"
);

console.log(
  "✅ zapisano data/activity-streams.json"
);
  
}

async function reverseGeocode(
  lat,
  lon
) {

  const response =
    await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
      {
        headers: {
          "User-Agent":
            "strava-dashboard"
        }
      }
    );

  const data =
    await response.json();

  return {
    display_name:
      data.display_name,

    city:
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.hamlet ||
      "",

    road:
      data.address?.road ||
      ""
  };
}

async function fetchWeather(
  lat,
  lon,
  startDate
) {

  const date =
    startDate.substring(0, 10);

  const hour =
    new Date(startDate)
      .getUTCHours();

  const response =
    await fetch(
      `https://archive-api.open-meteo.com/v1/archive` +
      `?latitude=${lat}` +
      `&longitude=${lon}` +
      `&start_date=${date}` +
      `&end_date=${date}` +
      `&hourly=temperature_2m,apparent_temperature,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m`
    );

  const data =
    await response.json();

  return {
    temperature:
      data.hourly.temperature_2m[hour],

    feels_like:
      data.hourly.apparent_temperature[hour],

    wind_speed:
      data.hourly.wind_speed_10m[hour],

    wind_direction:
      data.hourly.wind_direction_10m[hour],

    precipitation:
      data.hourly.precipitation[hour],

    cloud_cover:
      data.hourly.cloud_cover[hour]
  };
}

main().catch(console.error);
