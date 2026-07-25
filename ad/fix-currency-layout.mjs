#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const filmPath = path.join(here, "film", "index.html");
let html = fs.readFileSync(filmPath, "utf8");

const marker = `  .metric .v{font-family:'SpaceG';font-size:62px;font-weight:700;letter-spacing:-.03em;}`;
const replacement = `${marker}\n  /* Currency values use a tighter, fixed-width treatment so every frame stays inside its card. */\n  #m3 .v{font-size:46px;letter-spacing:-.045em;line-height:1;white-space:nowrap;overflow:hidden;}\n  #rev .v{font-size:44px!important;letter-spacing:-.055em;line-height:1;white-space:nowrap;overflow:hidden;}`;

if (html.includes("#rev .v{font-size:48px!important")) {
  html = html.replace(
    "#rev .v{font-size:48px!important;letter-spacing:-.05em;line-height:1;white-space:nowrap;overflow:hidden;}",
    "#rev .v{font-size:44px!important;letter-spacing:-.055em;line-height:1;white-space:nowrap;overflow:hidden;}"
  );
} else if (!html.includes("#m3 .v{font-size:46px")) {
  if (!html.includes(marker)) throw new Error("Currency style insertion point not found");
  html = html.replace(marker, replacement);
}

fs.writeFileSync(filmPath, html);
console.log("Currency layout fixed in ad/film/index.html");
