// news-image-20261118 — WEDNESDAY 18 NOVEMBER 2026 in one picture.
// A 50-story, date-checked front page drawn entirely in code.
// Node 22 stdlib only (node:fs, node:path, node:zlib). No network, no clock,
// no randomness: two runs write byte-identical PNGs (1024x1024, <= 1 MiB).
//
// Design (article-poster + canvas-design + algorithmic-art):
// - article-poster: story data first — 50 sourced stories, each with a named
//   source and a CLAIM / CONFIRMED tag, grouped by section, not by decoration.
// - canvas-design: "Ink & Paper Broadsheet" — newsprint cream, one red, one
//   ink; the DATE is the brand; hierarchy by scale, rule and white space.
// - algorithmic-art: every picture is a deterministic procedure — flat-vector
//   illustrations, a schematic world map projected from lon/lat tables, and a
//   hand-built PNG encoder. Same seed, same bytes, every time.
//
// Content: researched 19 Nov 2026 from Reuters, AP, Al Jazeera, TechCrunch,
// TBS News, IMD, The Hindu, FinanceFeeds, PANA, Nile Intel, France 24, RHC,
// newsverified.org and 50kft. Nothing invented: numbers are the reported ones.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER = [247, 242, 231];
const INK = [17, 17, 17];
const RED = [185, 28, 28];
const RED_DK = [140, 20, 20];
const BLUE = [30, 64, 175];
const SKY = [198, 220, 235];
const SEA = [178, 205, 226];
const SAND = [232, 222, 198];
const LAND = [216, 205, 178];
const CARD = [255, 255, 255];
const GRAY = [96, 90, 82];
const LINE = [203, 192, 172];
const GOLD = [201, 162, 39];
const WHITE = [255, 255, 255];
const GREEN = [34, 120, 70];

// ---------------------------------------------------------------- pixels
const buf = new Uint8Array(W * H * 3);
function px(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}
function rect(x, y, w, h, c) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c);
}
function hline(x, y, w, c) { rect(x, y, w, 1, c); }
function vline(x, y, h, c) { rect(x, y, 1, h, c); }
function frame(x, y, w, h, c) {
  hline(x, y, w, c); hline(x, y + h - 1, w, c);
  vline(x, y, h, c); vline(x + w - 1, y, h, c);
}
function line(x0, y0, x1, y1, c) {
  let dx = Math.abs(x1 - x0); let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    px(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function disc(cx, cy, r, c) {
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -w; x <= w; x++) px(cx + x, cy + y, c);
  }
}
function ring(cx, cy, r, c) {
  for (let a = 0; a < 360; a += 2) {
    const t = a * Math.PI / 180;
    px(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}
function ellipse(cx, cy, rx, ry, c) {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    for (let x = -w; x <= w; x++) px(cx + x, cy + y, c);
  }
}
function fillPoly(pts, c) {
  let minY = 1e9; let maxY = -1e9;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(H - 1, Math.ceil(maxY)); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]; const b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(xs[k])); const x1 = Math.min(W - 1, Math.floor(xs[k + 1]));
      for (let x = x0; x <= x1; x++) px(x, y, c);
    }
  }
}
function strokePoly(pts, c) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]; const b = pts[(i + 1) % pts.length];
    line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), c);
  }
}

// ---------------------------------------------------------------- 5x7 font
// Hand-drawn bitmap caps. Lowercase input is uppercased on render.
const FONT = {
  "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  "C": [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  "G": [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "I": [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "J": ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  "N": ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  "Q": [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "V": ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  "Z": ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#..##", "#.#.#", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "\"": [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
  "$": ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "%": ["##..#", "##.#.", "....#", "...#.", "..#..", ".#.#.", "#..##"],
  "&": [".##..", "#..#.", "#..#.", ".#...", "#.##.", "#..#.", ".##.#"],
  "'": ["..#..", "..#..", ".....", ".....", ".....", ".....", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "*": [".....", ".#.#.", "..#..", "#####", "..#..", ".#.#.", "....."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  ",": [".....", ".....", ".....", ".....", ".....", "..#..", ".#..."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".....", "..#.."],
  "/": ["....#", "....#", "...#.", "...#.", "..#..", ".#...", "#...."],
  ":": [".....", "..#..", ".....", ".....", ".....", "..#..", "....."],
  ";": [".....", "..#..", ".....", ".....", ".....", "..#..", ".#..."],
  "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."],
  "[": [".###.", ".#...", ".#...", ".#...", ".#...", ".#...", ".###."],
  "\\": ["#....", "#....", ".#...", ".#...", "..#..", "..#..", "...#."],
  "]": [".###.", "...#.", "...#.", "...#.", "...#.", "...#.", ".###."],
  "^": ["..#..", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  "_": [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  "`": [".#...", ".#...", "..#..", ".....", ".....", ".....", "....."],
  "{": ["...##", "..#..", "..#..", ".##..", "..#..", "..#..", "...##"],
  "|": ["..#..", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  "}": ["##...", "..#..", "..#..", "..##.", "..#..", "..#..", "##..."],
  "~": [".....", ".....", ".##.#", "#.#.#", ".....", ".....", "....."],
};
function textWidth(s, sc) {
  let w = 0;
  for (const ch of String(s).toUpperCase()) w += 6 * sc;
  return w > 0 ? w - sc : 0;
}
function drawText(s, x, y, sc, c, bold) {
  s = String(s).toUpperCase();
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] || FONT["?"];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === "#") {
          rect(cx + col * sc, y + r * sc, sc, sc, c);
          if (bold) rect(cx + col * sc + 1, y + r * sc, sc, sc, c);
        }
      }
    }
    cx += 6 * sc;
  }
  return cx - x;
}
function wrap(s, maxW, sc) {
  const words = String(s).split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textWidth(t, sc) <= maxW) cur = t;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function centerText(s, cx, y, sc, c, bold) {
  drawText(s, cx - Math.floor(textWidth(s, sc) / 2), y, sc, c, bold);
}

// ---------------------------------------------------------------- icons
// Small flat-vector marks for the tier-2 cards, drawn procedurally.
function drawIcon(name, x, y, s, c) {
  // s = box size (about 34). All icons are centred in (x, y, s, s).
  if (name === "chip") {
    rect(x + 9, y + 9, s - 18, s - 18, c);
    rect(x + 14, y + 14, s - 28, s - 28, PAPER);
    rect(x + 17, y + 17, s - 34, s - 34, c);
    for (let i = 0; i < 3; i++) {
      hline(x + 12 + i * 6, y + 4, 3, c); hline(x + 12 + i * 6, y + s - 7, 3, c);
      vline(x + 4, y + 12 + i * 6, 3, c); vline(x + s - 7, y + 12 + i * 6, 3, c);
    }
  } else if (name === "storm") {
    // cyclone spiral: three nested arcs + rain ticks
    for (let r = 14; r >= 5; r -= 4) {
      for (let a = 20; a < 300; a += 6) {
        const t = a * Math.PI / 180;
        px(Math.round(x + s / 2 + r * Math.cos(t)), Math.round(y + s / 2 - 2 + r * Math.sin(t)), c);
      }
    }
    disc(x + s / 2, y + s / 2 - 2, 2, c);
    line(x + 8, y + s - 8, x + 6, y + s - 3, c);
    line(x + 16, y + s - 8, x + 14, y + s - 3, c);
    line(x + 24, y + s - 8, x + 22, y + s - 3, c);
  } else if (name === "tank") {
    rect(x + 6, y + 18, 20, 8, c);
    rect(x + 10, y + 12, 12, 7, c);
    line(x + 22, y + 14, x + 31, y + 11, c);
    line(x + 22, y + 15, x + 31, y + 12, c);
    for (let i = 0; i < 5; i++) disc(x + 9 + i * 4, y + 28, 2, c);
  } else if (name === "flag") {
    vline(x + 8, y + 5, s - 10, c);
    fillPoly([[x + 8, y + 5], [x + 29, y + 9], [x + 8, y + 15]], RED);
    fillPoly([[x + 8, y + 15], [x + 29, y + 19], [x + 8, y + 25]], BLUE);
    rect(x + 8, y + 9, 21, 2, WHITE);
  } else if (name === "gavel") {
    line(x + 8, y + 26, x + 26, y + 8, c);
    line(x + 9, y + 27, x + 27, y + 9, c);
    rect(x + 20, y + 4, 10, 6, c);
    rect(x + 6, y + 24, 12, 3, c);
  } else if (name === "bank") {
    fillPoly([[x + 4, y + 12], [x + s / 2, y + 4], [x + s - 4, y + 12]], c);
    rect(x + 5, y + 28, s - 10, 3, c);
    for (let i = 0; i < 4; i++) vline(x + 8 + i * 7, y + 14, 13, c);
  } else if (name === "eye") {
    ellipse(x + s / 2, y + s / 2, 13, 8, c);
    ellipse(x + s / 2, y + s / 2, 10, 5, PAPER);
    disc(x + s / 2, y + s / 2, 3, c);
  } else if (name === "flame") {
    fillPoly([[x + 17, y + 4], [x + 24, y + 16], [x + 27, y + 22], [x + 20, y + 30], [x + 12, y + 30], [x + 7, y + 22], [x + 11, y + 15]], c);
    fillPoly([[x + 17, y + 16], [x + 21, y + 22], [x + 19, y + 27], [x + 14, y + 27], [x + 13, y + 22]], GOLD);
  } else if (name === "coin") {
    disc(x + s / 2, y + s / 2, 13, c);
    disc(x + s / 2, y + s / 2, 10, GOLD);
    drawText("$", x + s / 2 - 2, y + s / 2 - 3, 1, INK, true);
  } else if (name === "plane") {
    fillPoly([[x + 5, y + 18], [x + 28, y + 12], [x + 30, y + 15], [x + 16, y + 20], [x + 12, y + 26], [x + 9, y + 22]], c);
    line(x + 14, y + 16, x + 10, y + 8, c);
    line(x + 15, y + 17, x + 12, y + 9, c);
  } else if (name === "drone") {
    rect(x + 13, y + 13, 8, 8, c);
    line(x + 6, y + 6, x + 12, y + 12, c);
    line(x + 28, y + 6, x + 22, y + 12, c);
    line(x + 6, y + 28, x + 12, y + 22, c);
    line(x + 28, y + 28, x + 22, y + 22, c);
    hline(x + 3, y + 5, 8, c); hline(x + 23, y + 5, 8, c);
    hline(x + 3, y + 28, 8, c); hline(x + 23, y + 28, 8, c);
  } else if (name === "globe") {
    disc(x + s / 2, y + s / 2, 13, c);
    disc(x + s / 2, y + s / 2, 11, PAPER);
    ellipse(x + s / 2, y + s / 2, 11, 5, c);
    ellipse(x + s / 2, y + s / 2, 5, 11, c);
    hline(x + s / 2 - 11, y + s / 2, 22, c);
  }
}

// ---------------------------------------------------------------- hero art
// Four flat-vector illustrations, one per hero story. Each draws inside a
// 150 x 112 panel at (x, y).
function heroShenzhen(x, y) {
  rect(x, y, 150, 112, SKY);
  disc(x + 118, y + 24, 13, RED); // rising sun
  // skyline
  rect(x + 8, y + 58, 18, 54, INK);
  rect(x + 30, y + 44, 16, 68, INK);
  rect(x + 50, y + 66, 20, 46, INK);
  rect(x + 74, y + 38, 14, 74, INK);
  rect(x + 92, y + 60, 18, 52, INK);
  rect(x + 114, y + 50, 16, 62, INK);
  for (let wy = 0; wy < 5; wy++) for (let wx = 0; wx < 3; wx++) {
    px(x + 12 + wx * 5, y + 62 + wy * 9, GOLD);
    px(x + 34 + wx * 4, y + 48 + wy * 11, GOLD);
    px(x + 78 + wx * 4, y + 44 + wy * 12, GOLD);
  }
  hline(x, y + 104, 150, INK); hline(x, y + 105, 150, INK);
  // three flags: China, USA, Russia
  for (let f = 0; f < 3; f++) {
    const fx = x + 22 + f * 48;
    vline(fx, y + 76, 28, INK);
    if (f === 0) { rect(fx, y + 76, 20, 12, RED); disc(fx + 4, y + 80, 1, GOLD); disc(fx + 9, y + 79, 1, GOLD); }
    if (f === 1) { rect(fx, y + 76, 20, 12, WHITE); for (let s2 = 0; s2 < 3; s2++) hline(fx, y + 77 + s2 * 4, 20, RED); rect(fx, y + 76, 8, 6, BLUE); }
    if (f === 2) { rect(fx, y + 76, 20, 4, WHITE); rect(fx, y + 80, 20, 4, BLUE); rect(fx, y + 84, 20, 4, RED); }
  }
}
function heroGulf(x, y) {
  rect(x, y, 150, 62, SKY);
  rect(x, y + 62, 150, 50, SEA);
  // waves
  for (let wx = 0; wx < 150; wx += 18) {
    line(x + wx, y + 70, x + wx + 9, y + 66, WHITE);
    line(x + wx + 9, y + 66, x + wx + 18, y + 70, WHITE);
    line(x + wx + 6, y + 92, x + wx + 15, y + 88, WHITE);
    line(x + wx + 15, y + 88, x + wx + 24, y + 92, WHITE);
  }
  // tanker
  rect(x + 18, y + 74, 84, 12, INK);
  rect(x + 78, y + 62, 20, 12, INK);
  rect(x + 98, y + 66, 6, 8, RED);
  vline(x + 30, y + 58, 16, INK);
  rect(x + 30, y + 58, 12, 7, RED);
  // explosion starburst
  const ex = x + 122; const ey = y + 30;
  for (let a = 0; a < 12; a++) {
    const t = a * Math.PI / 6;
    line(ex, ey, Math.round(ex + 16 * Math.cos(t)), Math.round(ey + 16 * Math.sin(t)), RED);
  }
  disc(ex, ey, 7, GOLD); disc(ex, ey, 3, RED);
  // drones
  for (const d of [[x + 48, y + 18], [x + 84, y + 10]]) {
    hline(d[0] - 7, d[1], 14, INK); vline(d[0], d[1] - 3, 7, INK);
    disc(d[0] - 7, d[1], 2, INK); disc(d[0] + 7, d[1], 2, INK);
  }
}
function heroKerch(x, y) {
  rect(x, y, 150, 58, SKY);
  rect(x, y + 58, 150, 54, SEA);
  for (let wx = 0; wx < 150; wx += 22) {
    line(x + wx, y + 66, x + wx + 11, y + 62, WHITE);
    line(x + wx + 11, y + 62, x + wx + 22, y + 66, WHITE);
  }
  // bridge towers and deck, middle span collapsed
  rect(x + 18, y + 22, 6, 40, INK);
  rect(x + 126, y + 22, 6, 40, INK);
  hline(x + 6, y + 34, 52, INK); hline(x + 6, y + 35, 52, INK);
  hline(x + 92, y + 34, 52, INK); hline(x + 92, y + 35, 52, INK);
  line(x + 21, y + 22, x + 48, y + 34, INK);
  line(x + 129, y + 22, x + 102, y + 34, INK);
  // fallen span in the water, tilted
  line(x + 58, y + 36, x + 78, y + 62, INK);
  line(x + 58, y + 38, x + 80, y + 64, INK);
  line(x + 92, y + 36, x + 74, y + 60, INK);
  line(x + 92, y + 38, x + 76, y + 62, INK);
  // fallen arch under water
  for (let a = 180; a <= 360; a += 6) {
    const t = a * Math.PI / 180;
    px(Math.round(x + 75 + 16 * Math.cos(t)), Math.round(y + 78 + 8 * Math.sin(t)), INK);
  }
  disc(x + 75, y + 72, 3, RED); // smoke / marker
  disc(x + 60, y + 66, 2, RED); disc(x + 92, y + 68, 2, RED);
}
function heroSenate(x, y) {
  rect(x, y, 150, 112, SAND);
  // capitol dome
  ellipse(x + 75, y + 46, 34, 22, WHITE);
  rect(x + 41, y + 46, 68, 6, WHITE);
  rect(x + 70, y + 18, 10, 8, WHITE);
  disc(x + 75, y + 16, 3, INK);
  for (let i = 0; i < 6; i++) vline(x + 46 + i * 11, y + 52, 16, INK);
  rect(x + 38, y + 68, 74, 6, WHITE);
  rect(x + 30, y + 74, 90, 4, INK);
  // 100 seats: 56 blue, 44 red, in two rows of 50
  for (let i = 0; i < 100; i++) {
    const sx = x + 6 + (i % 50) * 2 + Math.floor((i % 50) / 10) * 1;
    const sy = y + 84 + Math.floor(i / 50) * 6;
    rect(sx, sy, 2, 4, i < 56 ? BLUE : RED);
  }
  drawText("56", x + 8, y + 98, 1, BLUE, true);
  drawText("44", x + 128, y + 98, 1, RED, true);
}

// ---------------------------------------------------------------- the news
// 50 stories. Every one carries a named source and a CLAIM / CONFIRMED tag.
// Regions: ASIA-PACIFIC, THE GULF, EUROPE, N. AMERICA, LATIN AMERICA,
// AFRICA, MARKETS & TECH — seven in all.
const HEROES = [
  {
    n: 1, region: "ASIA-PACIFIC", tag: "CONFIRMED", src: "REUTERS", art: "shenzhen",
    head: "TRUMP LANDS IN SHENZHEN AS XI AND PUTIN WAIT",
    deck: "Xi greets Trump on the tarmac ahead of Thursday's first-ever three-way summit. Xi hits protectionism; Putin hits sanctions.",
  },
  {
    n: 2, region: "THE GULF", tag: "CONFIRMED", src: "AP / REUTERS", art: "gulf",
    head: "GULF WAR WIDENS: IRAN HITS US BASES, TANKERS BURN",
    deck: "Iran drones strike Ali Al Salem base in Kuwait and sites in Bahrain after US jets hit Qeshm Island. An ADNOC tanker is hit; one crew missing, 11 hurt.",
  },
  {
    n: 3, region: "EUROPE", tag: "CONFIRMED", src: "REUTERS", art: "kerch",
    head: "KERCH BRIDGE SPAN FALLS INTO THE SEA",
    deck: "Ukrainian strikes collapse the road span after two nights of attacks. Russia answers by hitting Izmail port and a cargo ship on the Danube.",
  },
  {
    n: 4, region: "N. AMERICA", tag: "CONFIRMED", src: "AP", art: "senate",
    head: "SENATE 56-44: DEMOCRATS TAKE CONTROL",
    deck: "Mary Peltola flips Alaska, the ninth Democratic gain of the midterms and the biggest since 1958. The House stands at 257 Democrats.",
  },
];
const CARDS = [
  { n: 5, region: "MARKETS & TECH", tag: "CONFIRMED", src: "REUTERS", icon: "chip", head: "ANTHROPIC IPO $81.3B, LARGEST EVER" },
  { n: 6, region: "ASIA-PACIFIC", tag: "CONFIRMED", src: "IMD", icon: "storm", head: "CYCLONE AKVAN BEARS DOWN ON ANDHRA" },
  { n: 7, region: "THE GULF", tag: "CONFIRMED", src: "NEWSVERIFIED", icon: "tank", head: "ISRAELI TANKS CROSS GAZA CEASEFIRE LINE" },
  { n: 8, region: "LATIN AMERICA", tag: "CONFIRMED", src: "AP / REUTERS", icon: "flag", head: "HEGSETH SIGNS DEAL IN CARACAS VISIT" },
  { n: 9, region: "N. AMERICA", tag: "CONFIRMED", src: "REUTERS", icon: "gavel", head: "JEFFRIES NOMINATED SPEAKER, 251-11" },
  { n: 10, region: "EUROPE", tag: "CONFIRMED", src: "REUTERS", icon: "bank", head: "IMAMOGLU GETS 2 MORE YEARS, NEW BAN" },
  { n: 11, region: "THE GULF", tag: "CONFIRMED", src: "REUTERS", icon: "eye", head: "MOSSAD CHIEF PUSHED US ON IRAN STRIKES" },
  { n: 12, region: "THE GULF", tag: "CONFIRMED", src: "REUTERS", icon: "flame", head: "HOUTHIS RETAKE BAB EL-MANDEB, NEAR ADEN" },
  { n: 13, region: "MARKETS & TECH", tag: "CONFIRMED", src: "REUTERS", icon: "coin", head: "FED MINUTES: INFLATION FEARS, HAWK TALK" },
  { n: 14, region: "ASIA-PACIFIC", tag: "CONFIRMED", src: "REUTERS", icon: "plane", head: "RUSSIAN BOMBERS FLY TO EAST ASIA" },
  { n: 15, region: "EUROPE", tag: "CONFIRMED", src: "GEN. STAFF", icon: "drone", head: "KYIV DOWNS 126 OF 141 DRONES; HITS REFINERIES" },
  { n: 16, region: "AFRICA", tag: "CLAIM", src: "MWENENDO / AP", icon: "globe", head: "ETHIOPIA, SUDAN TRADE BLAME AS TIES FRAY" },
];
const BRIEFS = [
  [17, "NVIDIA BEATS, SHARES -3%; SEC PROBE", "REUTERS"],
  [18, "BAPCO REFINERY ABOVE 80% CAPACITY", "REUTERS"],
  [19, "IRAQ CRACKS DOWN ON KATAIB HEZBOLLAH OIL RING", "REUTERS"],
  [20, "IAEA: US-SAUDI NUCLEAR DEAL 'VERY SATISFACTORY'", "REUTERS"],
  [21, "IRAN: THREE TANKERS HIT MINES EAST OF HORMUZ", "IRAN NAVY, CLAIM"],
  [22, "DRONES HIT THREE SHIPS IN ROMANIAN WATERS", "50KFT"],
  [23, "GAZA HOSPITAL CHIEF HELD SIX MORE MONTHS", "REUTERS"],
  [24, "UK INFLATION RISES TO 3.6% IN OCTOBER", "REUTERS"],
  [25, "BURNHAM TO EU SUMMIT FOR POST-BREXIT RESET", "REUTERS"],
  [26, "ECB TO DEBATE RAISING RESERVE RULE", "REUTERS"],
  [27, "MARKETS: S&P -0.2%, DOW -1.1%, NASDAQ +0.4%", "REUTERS"],
  [28, "HUMANA -12%, UNITEDHEALTH -10%, PALO ALTO +10%", "REUTERS"],
  [29, "US MAY FORCE FIRMS TO DISCLOSE CHINA AI USE", "REUTERS"],
  [30, "RUSSIAN STRIKES KILL AT LEAST FIVE IN UKRAINE", "AL JAZEERA"],
  [31, "MARCOS ORDERS JOLLIBEE FOR TRUMP TEAM", "REUTERS"],
  [32, "PUTIN-TRUMP HANDSHAKE; BILATERAL PLANNED", "REUTERS"],
  [33, "COALITION OF THE WILLING MEETS IN BERLIN THU", "50KFT"],
  [34, "AI FAKES OF KERCH COLLAPSE FLAGGED", "FRANCE 24"],
  [35, "AMNESTY: RSF DRONE STRIKES 'WAR CRIMES'", "PANA"],
  [36, "VANCE: NO 'FOREVER WAR' IN GULF, NO END DATE", "REUTERS"],
  [37, "SAUDI SEES HOUTHI WAR INTO NEXT YEAR", "REUTERS"],
  [38, "BAHRAIN STOPPED IRANIAN ATTACKS 3X IN A WEEK", "REUTERS"],
  [39, "POLYMARKET: 70% ODDS OF 2 QUIET WEEKS VS IRAN", "REUTERS"],
  [40, "MOLDOVA SUMMONS RUSSIA OVER 7 DRONES", "50KFT"],
  [41, "SOUTH SUDAN VOTE DELAYED TO FEB 2027", "NILE INTEL"],
  [42, "SIX FED OFFICIALS SPEAK; WALLER WARNS ON PRICES", "REUTERS"],
  [43, "HOUSE: DEMOCRATS 257 SEATS, CEILING 261", "AP"],
  [44, "ANTHROPIC ADDS $26B PRIVATE PLACEMENT", "REUTERS"],
  [45, "ANTHROPIC 9-MO REVENUE $33.24B, UP 13X", "FINANCEFEEDS"],
  [46, "SPACEX RECORD BEATEN: $81.3B VS $75B", "TECHCRUNCH"],
  [47, "THREE CYCLONES IN A MONTH, RARE FOR ANDHRA", "THE HINDU"],
  [48, "FIRE BURNS 250-300 FISHING NETS IN ANDHRA", "FISHERIES INDIA"],
  [49, "RAIN OF 21CM+ FORECAST FOR ANDHRA, ODISHA", "IMD"],
  [50, "ARGENTINA THRASH COSTA RICA 7-0", "RHC"],
];
const TIMELINE = [
  ["~02:00 UTC", "IRAN DRONES HIT US BASE IN KUWAIT; BAHRAIN SITES STRUCK"],
  ["~04:00 UTC", "IMD: AKVAN NOW A SEVERE STORM; TRACK SHIFTS NORTH"],
  ["~05:00 UTC", "PELTOLA FLIPS ALASKA; SENATE 56-44 CALLED"],
  ["~07:00 UTC", "RUSSIA HITS IZMAIL PORT, A DAY AFTER KERCH SPAN FALLS"],
  ["09:00 UTC", "IMD RED WARNING: ANDHRA + ODISHA COASTS"],
  ["~10:00 UTC", "TRUMP LANDS IN SHENZHEN; XI GREETS HIM ON TARMAC"],
  ["21:26 UTC", "ANTHROPIC PRICES IPO AT $83; $81.3B RAISED"],
  ["22:11 UTC", "LARGEST IPO IN HISTORY CONFIRMED"],
];

// ---------------------------------------------------------------- sections
function drawMasthead() {
  drawText("ONE DAY OF WORLD NEWS, IN ONE PICTURE", 20, 26, 1, RED, true);
  const rc = "50 STORIES - 7 REGIONS";
  drawText(rc, 1004 - textWidth(rc, 1), 26, 1, RED, true);
  centerText("WEDNESDAY 18 NOVEMBER 2026", 512, 42, 5, INK, true);
  hline(20, 84, 984, RED); hline(20, 84, 984, RED);
  rect(20, 86, 984, 2, INK);
}
function drawTimeline() {
  drawText("THE DAY IN UTC", 20, 96, 1, RED, true);
  drawText("~ MEANS APPROXIMATE HOUR; 21:26 AND 22:11 ARE REPORTED TIMES", 1004 - textWidth("~ MEANS APPROXIMATE HOUR; 21:26 AND 22:11 ARE REPORTED TIMES", 1), 96, 1, GRAY, false);
  const cw = 240; const gap = 8;
  for (let i = 0; i < 8; i++) {
    const col = i % 4; const row = Math.floor(i / 4);
    const x = 20 + col * (cw + gap); const y = 108 + row * 36;
    rect(x, y, cw, 32, CARD);
    frame(x, y, cw, 32, LINE);
    drawText(TIMELINE[i][0], x + 6, y + 3, 1, RED, true);
    const lines = wrap(TIMELINE[i][1], cw - 12, 1);
    for (let l = 0; l < Math.min(2, lines.length); l++) drawText(lines[l], x + 6, y + 13 + l * 9, 1, INK, false);
  }
  hline(20, 182, 984, INK);
}
function drawHero(h, x, y) {
  const w = 488; const hh = 112;
  rect(x, y, w, hh, CARD);
  frame(x, y, w, hh, INK);
  if (h.art === "shenzhen") heroShenzhen(x + 1, y + 1);
  else if (h.art === "gulf") heroGulf(x + 1, y + 1);
  else if (h.art === "kerch") heroKerch(x + 1, y + 1);
  else heroSenate(x + 1, y + 1);
  frame(x + 1, y + 1, 150, 110, INK);
  const tx = x + 158;
  drawText("NO. " + h.n + "  |  " + h.region + "  |  " + h.tag, tx, y + 6, 1, RED, true);
  const hl = wrap(h.head, w - 166, 2);
  for (let l = 0; l < Math.min(2, hl.length); l++) drawText(hl[l], tx, y + 17 + l * 15, 2, INK, true);
  const dk = wrap(h.deck, w - 166, 1);
  for (let l = 0; l < Math.min(3, dk.length); l++) drawText(dk[l], tx, y + 50 + l * 9, 1, INK, false);
  hline(tx, y + 84, w - 166, LINE);
  drawText("SOURCE: " + h.src, tx, y + 91, 1, GRAY, false);
}
function drawCard(c, x, y) {
  const w = 240; const hh = 46;
  rect(x, y, w, hh, CARD);
  frame(x, y, w, hh, LINE);
  rect(x + 5, y + 5, 34, 34, PAPER);
  frame(x + 5, y + 5, 34, 34, LINE);
  drawIcon(c.icon, x + 5, y + 5, 34, INK);
  const tx = x + 45;
  drawText(c.n + " - " + c.region, tx, y + 5, 1, RED, true);
  const hl = wrap(c.head, w - 51, 1);
  for (let l = 0; l < Math.min(2, hl.length); l++) drawText(hl[l], tx, y + 15 + l * 9, 1, INK, true);
  drawText(c.src + " - " + c.tag, tx, y + 35, 1, GRAY, false);
}
function drawBriefs() {
  drawText("ALSO ON WEDNESDAY - 34 MORE STORIES", 20, 606, 1, RED, true);
  hline(20, 616, 984, INK);
  for (let i = 0; i < 34; i++) {
    const b = BRIEFS[i];
    const col = i < 17 ? 0 : 1;
    const row = i % 17;
    const x = 20 + col * 496; const y = 622 + row * 11;
    drawText(b[0] + ".", x, y, 1, RED, true);
    drawText(b[1] + " - " + b[2], x + 24, y, 1, INK, false);
  }
}

// ---------------------------------------------------------------- map
// Schematic world map: continents are lon/lat polygons projected
// equirectangular into the map box. Pins are the numbered story places.
const MAP = { x0: 28, y0: 834, w: 324, h: 76 };
function project(lon, lat) {
  return [
    MAP.x0 + ((lon + 170) / 360) * MAP.w,
    MAP.y0 + ((75 - lat) / 130) * MAP.h,
  ];
}
const CONTINENTS = [
  [[-168, 66], [-140, 70], [-125, 72], [-110, 73], [-95, 80], [-85, 70], [-75, 62], [-65, 60], [-55, 52], [-60, 46], [-70, 42], [-75, 35], [-80, 32], [-85, 30], [-90, 21], [-97, 16], [-105, 20], [-115, 28], [-125, 40], [-125, 49], [-140, 60], [-155, 58], [-165, 60]],
  [[-80, 10], [-75, 5], [-60, 0], [-50, 0], [-40, -5], [-35, -10], [-40, -20], [-48, -28], [-58, -35], [-65, -45], [-70, -52], [-73, -40], [-73, -25], [-77, -12], [-81, -5]],
  [[-17, 15], [-10, 30], [0, 35], [10, 37], [20, 32], [30, 31], [35, 28], [40, 15], [48, 11], [51, 10], [48, 0], [40, -10], [35, -20], [30, -30], [20, -35], [15, -30], [12, -18], [9, -1], [9, 4], [-8, 5], [-15, 12]],
  [[-10, 36], [-9, 43], [-2, 48], [0, 50], [5, 53], [8, 57], [10, 59], [18, 56], [21, 55], [24, 59], [28, 60], [30, 62], [32, 68], [40, 68], [45, 65], [40, 55], [35, 50], [30, 46], [28, 44], [23, 40], [19, 42], [12, 44], [8, 44], [3, 42], [-2, 37], [-9, 37]],
  [[40, 68], [60, 70], [80, 73], [100, 77], [120, 73], [140, 72], [160, 70], [178, 66], [170, 60], [162, 55], [158, 50], [150, 45], [142, 40], [140, 35], [135, 33], [130, 35], [127, 40], [122, 38], [120, 32], [115, 23], [110, 20], [105, 10], [100, 8], [97, 15], [92, 21], [88, 22], [85, 19], [80, 13], [77, 8], [75, 15], [72, 20], [66, 25], [60, 25], [55, 27], [50, 29], [48, 30], [44, 29], [40, 32], [36, 36], [33, 42], [30, 46]],
  [[113, -22], [114, -30], [115, -35], [120, -34], [129, -32], [132, -32], [136, -35], [140, -38], [146, -39], [150, -37], [153, -32], [153, -27], [150, -22], [146, -19], [142, -15], [142, -11], [137, -12], [135, -15], [130, -13], [126, -14], [122, -17], [118, -20]],
];
const PINS = [
  [114.1, 22.5, "1", 0, 0], [50, 27, "2", 8, -6], [36.5, 47, "3", -8, -6], [-149.9, 61.2, "4", 0, 0],
  [80.5, 16.0, "5", 0, 0], [30, 30, "6", -8, 8], [-66.9, 10.5, "7", 0, 0], [41, 7, "8", 8, 6],
];
function drawMapPanel() {
  rect(20, 816, 340, 120, CARD);
  frame(20, 816, 340, 120, INK);
  drawText("WHERE IT HAPPENED", 28, 822, 1, RED, true);
  rect(28, 834, 324, 76, [232, 240, 244]);
  for (const cont of CONTINENTS) {
    const pts = cont.map((p) => project(p[0], p[1]));
    fillPoly(pts, LAND);
    strokePoly(pts, INK);
  }
  for (const pin of PINS) {
    const p = project(pin[0], pin[1]);
    const cx = Math.round(p[0]) + pin[3]; const cy = Math.round(p[1]) + pin[4];
    if (pin[3] || pin[4]) line(Math.round(p[0]), Math.round(p[1]), cx, cy, GRAY);
    disc(cx, cy, 5, RED);
    ring(cx, cy, 5, WHITE);
    drawText(pin[2], cx - 2, cy - 3, 1, WHITE, true);
  }
  drawText("1 SHENZHEN  2 KUWAIT  3 KERCH  4 ALASKA", 28, 914, 1, INK, false);
  drawText("5 ANDHRA  6 GAZA  7 CARACAS  8 ADDIS", 28, 924, 1, INK, false);
}
function drawNumbersPanel() {
  rect(368, 816, 636, 120, CARD);
  frame(368, 816, 636, 120, INK);
  drawText("THE DAY IN NUMBERS", 376, 822, 1, RED, true);
  const stats = [
    ["50", "STORIES ON THIS PAGE"],
    ["$81.3B", "ANTHROPIC IPO, LARGEST EVER"],
    ["56-44", "SENATE: DEMOCRATS TAKE IT"],
    ["1,441", "DRONES RUSSIA SAYS IT DOWNED"],
    ["90-100", "KM/H: AKVAN WINDS AT LANDFALL"],
  ];
  for (let i = 0; i < 5; i++) {
    const x = 376 + i * 127;
    drawText(stats[i][0], x, 844, 3, RED, true);
    const cap = wrap(stats[i][1], 120, 1);
    for (let l = 0; l < Math.min(2, cap.length); l++) drawText(cap[l], x, 872 + l * 9, 1, INK, false);
    if (i > 0) vline(x - 7, 840, 52, LINE);
  }
}
function drawDateCheck() {
  rect(20, 944, 984, 30, RED);
  drawText("DATE CHECK - LEFT OUT ON PURPOSE: THURSDAY'S TRILATERAL - ANTHROPIC FIRST TRADE (ANT) - AKVAN LANDFALL (FRI)", 28, 949, 1, WHITE, true);
  drawText("NOT YET CONFIRMED: KERCH DAMAGE TOLL + CHANNEL CLEARANCE - ADNOC CREW: 1 STILL MISSING - US-SAUDI DEAL SIGNING", 28, 960, 1, WHITE, true);
}
function drawFooter() {
  drawText("SOURCES: REUTERS - AP - AL JAZEERA - TECHCRUNCH - TBS NEWS - IMD - THE HINDU - FINANCEFEEDS - NEWSVERIFIED - 50KFT", 20, 980, 1, GRAY, false);
  drawText("ALSO: PANA - NILE INTEL - FISHERIES INDIA - RHC - FRANCE 24 - DRAWN ENTIRELY IN CODE - NO PHOTOGRAPHS - ALL TIMES UTC", 20, 991, 1, GRAY, false);
}

// ---------------------------------------------------------------- PNG out
const CRC_TABLE = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    Buffer.from(buf.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- main
function main() {
  const total = HEROES.length + CARDS.length + BRIEFS.length;
  if (total !== 50) throw new Error("story count is " + total + ", must be 50");
  rect(0, 0, W, H, PAPER);
  frame(8, 8, 1008, 1008, INK);
  frame(9, 9, 1006, 1006, INK);
  frame(13, 13, 998, 998, LINE);
  drawMasthead();
  drawTimeline();
  drawHero(HEROES[0], 20, 190);
  drawHero(HEROES[1], 516, 190);
  drawHero(HEROES[2], 20, 310);
  drawHero(HEROES[3], 516, 310);
  drawText("MORE OF THE DAY - 12 STORIES", 20, 432, 1, RED, true);
  hline(20, 442, 984, INK);
  for (let i = 0; i < 12; i++) {
    const col = i % 4; const row = Math.floor(i / 4);
    drawCard(CARDS[i], 20 + col * 248, 446 + row * 52);
  }
  drawBriefs();
  drawMapPanel();
  drawNumbersPanel();
  drawDateCheck();
  drawFooter();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, png);
  console.log("wrote " + outPath + " " + png.length + " bytes, " + total + " stories");
}
main();
