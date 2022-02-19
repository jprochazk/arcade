// - call `yarn build` on every game
// - copy files to `build/${game}`
// - create `build/index.html` with a page that redirects to the games

const fs = require("fs");
const path = require("path");
const proc = require("child_process");

if (fs.existsSync("build")) {
  fs.rmSync("build", { recursive: true, force: true });
}
fs.mkdirSync("build");

const games = ["pong"];

for (const game of games) {
  console.log(`Building ${game}...`);
  proc.execSync(`cd ${game} && yarn install && yarn build`, { stdio: "inherit" });
  fs.cpSync(`${game}/dist`, `build/${game}`, { recursive: true });
  fs.writeFileSync(
    `build/${game}/index.html`,
    fs.readFileSync(`build/${game}/index.html`, "utf-8").replace(/\/\{\{BASE_URL\}\}/g, "."),
    "utf-8"
  );
}

console.log("Writing index.html");
const links = `<ul>${games.map((game) => `<li><a href="${game}">${game}</a></li>`)}</ul>`;
fs.writeFileSync(
  "build/index.html",
  fs.readFileSync("./index.template.html", "utf-8").replace("{{LINKS}}", links),
  "utf-8"
);

console.log("Done");
