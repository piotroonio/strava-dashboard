import fs from "fs";

// symulacja danych
const users = [
  { name: "Piotr S." },
  { name: "Anna K." },
  { name: "Marek Z." }
];

// generujemy losowe dane (symulacja API)
const data = users.map(u => ({
  name: u.name,
  totalDistance: +(Math.random() * 500 + 100).toFixed(1),
  avgSpeed: +(Math.random() * 5 + 23).toFixed(1),
  avgElevation: Math.floor(Math.random() * 500),
  count: Math.floor(Math.random() * 20 + 5)
}));

fs.writeFileSync("data.json", JSON.stringify(data, null, 2));

console.log("✅ data.json updated");
