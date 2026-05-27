import fs from "fs";

// generujemy dane + znacznik czasu (wymusza zmianę)
const now = new Date().toISOString();

const data = [
  {
    name: "Piotr S.",
    totalDistance: +(Math.random() * 500 + 100).toFixed(1),
    avgSpeed: +(Math.random() * 5 + 23).toFixed(1),
    avgElevation: Math.floor(Math.random() * 500),
    count: Math.floor(Math.random() * 20 + 5),
    updatedAt: now
  },
  {
    name: "Anna K.",
    totalDistance: +(Math.random() * 500 + 100).toFixed(1),
    avgSpeed: +(Math.random() * 5 + 23).toFixed(1),
    avgElevation: Math.floor(Math.random() * 500),
    count: Math.floor(Math.random() * 20 + 5),
    updatedAt: now
  }
];

fs.writeFileSync("data.json", JSON.stringify(data, null, 2));

console.log("✅ data.json updated:", now);
