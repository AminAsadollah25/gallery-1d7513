# Studio Furniture Planner: Complete Handoff for Claude Code

This document describes everything about the project so you can continue development without any other context. Read it fully before changing code. The current source is a single file, `index.html`, which the user will give you alongside this document. The floor plan reference image is `SEA-A4.png`.

---

## 1. What this is and why it exists

### 1.1 The real-world problem
The user (Amin) and his partner are moving out of a 2-bedroom apartment in Rotterdam (about 60 to 65 m² of floor area) into a much smaller rental **studio in the Sea Tower building, Engelandlaan, Zoetermeer (Netherlands), rented via Holland2Stay**. The unit type is **SEA-A4**. The studio is **semi-furnished: only basic kitchen items are included**, so all living furniture comes from their current home.

The core question the tool must answer:
> "Does our existing furniture fit in the new studio, where does each piece go, and what do we have to leave behind or sell?"

### 1.2 What the tool is
A browser-based **interactive 3D room planner** (three.js) that:
- Renders the studio (walls, windows, balcony, kitchen, bathroom, entrance corridor) to scale.
- Contains every piece of the user's real furniture at real IKEA / JYSK dimensions.
- Lets the user drag, rotate and flip furniture, in 3D or top view, on desktop and mobile.
- Validates every placement live (overlap, walls, fixtures, door/kitchen clearance) and colours each item's footprint by status.
- Shows a summary: how many items fit, which are left outside, how much floor is used.
- Remembers the layout in the browser (localStorage).
- Is deployed as a static single file on **Netlify** (drag-and-drop deploy of a folder containing `index.html`). A copy is also published as a Claude.ai artifact, which you cannot edit; Netlify is the primary target.

### 1.3 The user and how to work with him
- Communicates in **Persian (Farsi)**. The UI is fully in Persian, right-to-left.
- Wants **short, simple explanations**. No long step lists unless asked.
- **Never use the em dash character (U+2014) anywhere**: not in UI text, not in comments, not in commit messages, not in docs. Use a comma, a semicolon, a colon or a new sentence.
- He is technical enough to deploy on Netlify and test on his phone. Mobile matters a lot.

---

## 2. Tech stack and constraints

| Aspect | Current choice |
|---|---|
| Delivery | One self-contained `index.html` (HTML + CSS + JS inline) |
| 3D engine | three.js **r128** UMD from `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` |
| Camera controls | `OrbitControls` from `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js` (global `THREE.OrbitControls`) |
| Font | Vazirmatn (Google Fonts, weights 400/600/800), fallback Tahoma, Segoe UI, sans-serif |
| Build step | None |
| Hosting | Netlify drop (static) |
| Persistence | `localStorage` (per browser, per device) |
| Units | Centimetres everywhere in data and in three.js world space (1 world unit = 1 cm) |

Constraints to respect unless the user asks otherwise:
- Keep it deployable as a static site with no server. If you move to a multi-file project (for example Vite), the output must still be a static folder that can be dropped on Netlify, and you should tell the user in one sentence.
- r128 specifics: `THREE.CapsuleGeometry` does not exist; `OrbitControls` in r128 handles mouse via pointer events and touch via `touchstart/touchmove`; `renderer.outputEncoding` is intentionally **not** set (colours are authored for linear output; changing colour management will shift every colour).
- All user-facing text must be Persian, numbers shown with Persian digits via `toLocaleString('fa-IR')`.

---

## 3. Coordinate system (critical)

- **Plan coordinates** (all data): `x` grows to the right, `y` grows downward, exactly like the SEA-A4 image. Units: cm.
- **three.js world**: `X = plan x`, `Z = plan y`, `Y = up`. Floor at `Y = 0`.
- **Origin** `(0,0)` = inner corner of the main room at the **top-left** of the plan (floor edge of the top wall and the left/balcony wall).
- Plan shapes are drawn with `THREE.Shape` points `(x, -y)` and the mesh rotated `-PI/2` around X, which maps them to world `Z = y`.

### 3.1 Furniture local frame
Each furniture item is a `THREE.Group` built in local coordinates:
- Origin = centre of its footprint bounding box, on the floor.
- Local `+z` is the **front** (the side you use: sofa seat, drawer fronts, TV screen, wardrobe doors). Local `-z` is the back (goes against a wall).
- `w` = size along local x, `d` = size along local z, `h` = height (used for label and FAB placement).

### 3.2 Rotation
- `rot` is always one of `0, 90, 180, 270` degrees. `group.rotation.y = rot * PI / 180`.
- three.js Y rotation maps local `(x, z)` to world: `X = x*cos(a) + z*sin(a)`, `Z = -x*sin(a) + z*cos(a)`.
- Therefore the front (local +z) faces: `rot 0` -> +Z (down on plan), `rot 90` -> +X (right), `rot 180` -> -Z (up), `rot 270` -> -X (left).
- Footprints are computed in `worldRects(it)` by transforming the four corners of each local rect with `c = round(cos a)`, `s = round(sin a)` and taking min/max. Collisions are axis-aligned rectangles only.

### 3.3 Flip (mirror)
- Items have a boolean `flip`. Only the sofa exposes it in the UI ("شزلون به طرف دیگه", the FRIHETEN chaise can be mounted on either side).
- Rendering: `group.scale.x = flip ? -1 : 1` (three.js r128 handles negative determinant winding). The label sprite is a child of the group, so its `scale.x` sign is compensated in `place()` to keep text readable.
- Footprint: when `flip` is true each local rect `[x0,z0,x1,z1]` becomes `[-x1,z0,-x0,z1]` before rotation.

### 3.4 Multi-rect footprints
An item may define `rects: [[x0,z0,x1,z1], ...]` in local coordinates. Default is one rect `[-w/2,-d/2,w/2,d/2]`. The L-shaped sofa uses two rects so the empty corner of the L is not counted as occupied.

---

## 4. The floor plan (SEA-A4)

### 4.1 Source and scale
- Source: `SEA-A4.png`, a top-down perspective render from the landlord, **without dimensions**. Orientation used in the app = orientation of the image (balcony on the left, big windows on top, kitchen and bathroom block on the right, entrance corridor bottom-right).
- Because the render has perspective, the true **floor line of each wall is the inner edge of the beige wall-face band** (where the wood floor starts). The grey band is the top of the wall and appears further out.
- Measured floor-level pixel bounds of the main room in the image: left 465, top 215, right 1000, bottom 805 (image about 1500x1000).
- **Scale assumption: 1 px = 1 cm**, derived from the kitchen counter depth (about 60 px, standard counter = 60 cm) and cross-checked with the sink. This is the single biggest uncertainty. If the user provides the official m² or any real dimension, recalibrate everything (see backlog item "room calibration").
- A previous version of the app used an older, wrongly oriented render and a larger estimated room (560x640). That geometry is obsolete; do not revive it.
- Earlier guess from listings: Sea Tower studios are advertised around 41 m². Our measured model gives about 34 m² gross interior (including bathroom and kitchen) and about 27 m² usable floor. The difference may be scale error or the way the listing measures area. Flag this to the user if relevant.

### 4.2 Regions (plan cm)

| Name | Constant | Rect (x0, y0, x1, y1) | Meaning |
|---|---|---|---|
| Main room | `MAIN` | 0, 0, 535, 590 | Main living space, 5.35 x 5.90 m |
| Entrance corridor | `CORR` | 535, 480, 735, 590 | Corridor to the front door (bottom-right) |
| Hallway strip | `STRIP` | 0, 480, 735, 590 | Helper so items may straddle main room and corridor along the bottom band |
| Balcony | `BALC` | -185, 125, -25, 465 | Placeable balcony area outside the left wall |
| Staging area | `STAGE` | 580, 20, 930, 440 | Grey "outside the home" parking area (right of the building) for items that do not fit |

Floor polygon of the flat: `(0,0) (535,0) (535,480) (735,480) (735,590) (0,590)`.

### 4.3 Fixed obstacles (`OBST`, items may never overlap)

| Name (UI) | Rect | Notes |
|---|---|---|
| حمام (bathroom block) | 370, 190, 535, 480 | Includes a small closet/technical cupboard and shower |
| آشپزخونه (kitchen) | 310, 155, 370, 480 | Single-row kitchen, 60 cm deep, facing left (-x). Tall unit (fridge column) at the top end y 155 to 215 |

### 4.4 Clearance zones (`ZONES` plus balcony door; overlap = warning, not error)

| Name (UI) | Rect | Notes |
|---|---|---|
| جلوی آشپزخونه | 230, 155, 310, 480 | 80 cm working clearance in front of the kitchen |
| جلوی در حمام | 420, 115, 505, 190 | Bathroom door is on the top wall of the bathroom block and swings up into the room |
| جلوی در ورودی | 645, 485, 735, 590 | Front door swing at the end of the corridor |
| جلوی در بالکن (bottom) | 0, 345, 75, 465 | Active when `balDoor === 'bottom'` (default) |
| جلوی در بالکن (top) | 0, 130, 75, 240 | Active when `balDoor === 'top'` |

**Open question:** the left wall has two floor-to-ceiling glass openings toward the balcony and the render does not show which one is the door. The user toggles it with the toolbar button "در بالکن: پایینی / بالایی"; the choice is saved in `localStorage` under `KEY + '-door'`. Ask the user to confirm on site; then you may remove the toggle.

### 4.5 Walls and openings
Built by `buildWalls()` using `wallRun(group, horizontal, a0, a1, fixedCoord, sign, openings, H, thickness)`. `sign` pushes the wall body outward from the interior floor line (`-1` = toward negative axis). Openings are `{a, b, t}` along the run.

| Run | From/To | Thickness | Openings |
|---|---|---|---|
| Top wall, y=0, outward -Z | x -20 to 555 | 20 | glass x 110 to 450 (the big window band) |
| Right wall, x=535, outward +X | y -20 to 480 | 20 | none |
| Corridor top / bathroom bottom, y=480, outward -Z | x 370 to 755 | 10 | none |
| Corridor end, x=735, outward +X | y 480 to 590 | 20 | front door y 495 to 585 |
| Bottom wall, y=590, outward +Z | x -20 to 755 | 20 | none |
| Left wall, x=0, outward -X | y -20 to 610 | 20 | glass y 130 to 240 and y 345 to 465 (balcony side) |
| Bathroom top, y=190, outward -Z | x 370 to 535 | 8 | bathroom door x 420 to 505 |
| Bathroom left, x=370, outward +X | y 190 to 480 | 8 | none |

Opening types in `wallRun`:
- `solid`: full height.
- `window`: sill 0 to 70 solid, glass 70 to 240, header above 240 (currently unused in SEA-A4).
- `glassdoor`: glass 0 to 230, header above (used for all floor-to-ceiling glazing).
- `door`: empty below 210, header above.

Wall height `H` is 110 cm by default ("low walls" so the interior is visible) and 260 cm when the toolbar toggle "دیوار بلند" is on. The whole wall group is rebuilt on toggle.

### 4.6 Fixed fixtures (visual only, in `fixed` group)
- Kitchen: tall unit 60x215x60 at (340, 185); base run 58x86x265 centred (341, 347.5); dark worktop; sink at y about 262; black cooktop at y about 357; upper cabinets 36 deep at 145 to 215 height.
- Bathroom: vanity (515, 242); toilet facing +x near (400, 288); shower tray (505, 420) 60x90; closet box 90x120x60 at (425, 380).
- Balcony: grey slab and floor x -190 to -20, y 120 to 470; glass railing on the three open sides with dark top rails.

---

## 5. Furniture catalogue (the user's real items)

All dimensions in cm, `w x d x h` in the item's local frame (w = width along front, d = depth). Sources: IKEA order history (Oct 2024, delivered to their current home) and the user's own list. JYSK wardrobe depth is an assumption.

| id | Product | Persian label (fa) | w | d | h | Colour rule | Notes |
|---|---|---|---|---|---|---|---|
| sofa | IKEA FRIHETEN corner sofa-bed with storage, Skiftebo dark grey | مبل ال تخت‌شو | 230 | 151 | 66 | Grey fabric, light wood legs | L-shape: main part 230x88, chaise 80 wide and 151 deep. `rects: [[-115,-75.5,115,12.5],[35,12.5,115,75.5]]`. Flippable |
| tv | IKEA LACK TV bench + 55" TV | میز تلویزیون با تلویزیون | 160 | 35 | 116 | **White bench (the only non-wood cabinet)**, black TV | TV body 123x71x5 on a stand; screen has slight emissive blue. `h` includes TV for label placement |
| coffee | IKEA LACK coffee table | میز جلومبلی | 90 | 55 | 45 | Light wood | Top + lower shelf + 5x5 legs |
| side | IKEA OLSERÖD side table | میز کناری | 53 | 50 | 63 | Dark metal frame, wood top | Can slide over the sofa seat in reality |
| bed | IKEA TARVA 160x200 + LURÖY slats x2 + SKORVA beam + ÅKREHAMN foam mattress 160x200 | تخت با تشک ÅKREHAMN | 167 | 209 | 92 | Light wood frame, white mattress, blue-grey duvet | Headboard at local -z |
| wardrobe | JYSK VELLERUP 151x200, 3 doors, 3 drawers | کمد لباس JYSK | 151 | 59 | 200 | Light wood | Depth 59 assumed from the same JYSK series (not confirmed) |
| malm6 | IKEA MALM chest of 6 drawers | دراور ۶ کشو | 160 | 48 | 78 | Light wood | 2 columns x 3 rows of drawer fronts |
| malm2a, malm2b | IKEA MALM chest of 2 drawers (x2) | پاتختی ۲ کشو | 40 | 48 | 55 | Light wood | Used as bedside tables |
| mirror | IKEA VÄRSNÄS standing mirror 30x150 | آینه قدی | 30 | 35 | 150 | Light wood (bamboo) frame | Leans back about 0.12 rad with a rear strut; footprint depth 35 includes the lean |
| rigga | IKEA RIGGA clothes rack | رگال لباس | 111 | 51 | 175 | Metal grey, coloured hanging clothes | Currently does not fit |
| table | IKEA PINNTORP dining table | میز ناهارخوری | 125 | 75 | 75 | Light wood | |
| c1..c4 | IKEA PINNTORP chair + MALINDA cushion (x4) | صندلی با کوسن | 42 | 50 | 88 | Light wood, grey cushion | Backrest at local -z |
| bt | IKEA TÄRNÖ outdoor table | میز بالکن | 55 | 54 | 70 | Acacia slats (darker wood), black steel | Balcony set |
| bc1, bc2 | IKEA TÄRNÖ folding chair (x2) | صندلی تاشو | 39 | 40 | 79 | Acacia slats, black steel | Balcony set |

Not placeable, listed for completeness: IKEA SKUBB 6-compartment organisers x2 (35x45x125), they hang inside the wardrobe.

Items the user has explicitly said leave: washer and dryer (rental, returned). Kitchen items come with the studio.

### 5.1 Colour and material rules (user requirement)
- **Everything that is furniture is light wood**, except the **LACK TV bench which is white**, the TV (black), fabrics (sofa grey, mattress white, duvet blue-grey, chair cushions grey) and metal parts (RIGGA, OLSERÖD frame, TÄRNÖ frame).
- Wood uses procedural canvas grain textures via `grainTex(base)`:
  - `WOOD` base `#DDBF90` (bodies), `WOOD_D` `#C79E6A` (tops, legs, accents), `WOOD_L` `#E6CCA2` (drawer and door fronts).
- The floor is a darker, cooler oak plank texture (`woodTex()`, tones around `#A58867`) so light furniture stands out.
- All furniture boxes get thin edge lines (`EdgesGeometry`, colour `0x6B4A2A`, opacity 0.32) for a crisp illustrated look. Edges are only added while building furniture (`EDGE = true` inside the item loop).

### 5.2 The `box()` helper (read this, a past bug came from it)
`box(parent, w, h, d, x, y0, z, c, o)` creates a box whose **bottom** is at `y0` (not its centre). Material resolution order: if `c` is a `THREE.Material` use it; else if `o` is a material use it; else create/cache `MeshStandardMaterial` from colour string `c` with options `o`.
History: an earlier version ignored materials passed as `c`, so all wood materials silently became white. The user noticed ("I still see them white"). Keep this resolution logic.

---

## 6. Default layout (current, for SEA-A4)

Centre coordinates in plan cm. Rationale: sleeping near the top windows (top-left), dining near the kitchen top end, living zone lower-left facing a TV that stands against the bed's foot as a room divider, storage (MALM 6) and mirror along the bottom wall of the entrance hallway, balcony set on the balcony.

| id | x | y | rot | flip | Resulting footprint |
|---|---|---|---|---|---|
| malm2a | 20 | 24 | 0 | | x 0..40, y 0..48 |
| bed | 123.5 | 104.5 | 0 | | x 40..207, y 0..209 (headboard on top wall) |
| malm2b | 227 | 24 | 0 | | x 207..247, y 0..48 |
| table | 292.5 | 92.5 | 90 | | x 255..330, y 30..155 |
| c1 | 355 | 70 | 270 | | x 330..380, y 49..91 |
| c2 | 355 | 125 | 270 | | x 330..380, y 104..146 |
| wardrobe | 459.5 | 29.5 | 0 | | x 384..535, y 0..59 (top-right corner) |
| tv | 110 | 231.5 | 0 | | x 30..190, y 214..249 (back against bed foot, screen faces down) |
| coffee | 107.5 | 440 | 90 | | x 80..135, y 395..485 |
| sofa | 115 | 514.5 | 180 | true | main x 0..230, y 502..590; chaise x 150..230, y 439..502 |
| malm6 | 450 | 566 | 180 | | x 370..530, y 542..590 (hallway, leaves about 62 cm walkway) |
| mirror | 345 | 572.5 | 180 | | x 330..360, y 555..590 |
| bt | -105 | 295 | 0 | | balcony |
| bc1 | -105 | 235 | 0 | | balcony |
| bc2 | -105 | 355 | 180 | | balcony |
| side | 830 | 80 | 0 | | staging (does not fit) |
| rigga | 700 | 80 | 0 | | staging (does not fit) |
| c3 | 650 | 210 | 0 | | staging |
| c4 | 720 | 210 | 0 | | staging |

Result with bottom balcony door: **15 of 19 placed without errors or warnings**; RIGGA, OLSERÖD and 2 dining chairs are outside. With the top balcony door, the bed and TV bench get "جلوی در بالکن" warnings.

Known compromises the user should be aware of: walkway between bed and dining table about 48 cm; hallway walkway beside MALM 6 about 62 cm; bed accessible mainly from its right side.

---

## 7. Validation logic (`evaluate()`)

For every item compute `wr = worldRects(it)`, then assign the first matching status:

1. **out** (grey `--out`): no rect touches the home (`MAIN`, `CORR` or `BALC`). Reason: "بیرون از خونه مونده".
2. **bad** (red `--bad`): any rect is not fully inside `MAIN`, `CORR`, `STRIP` or `BALC`. Reason: "رفته توی دیوار".
3. **bad**: any rect overlaps an `OBST`. Reason: "افتاده روی حمام/آشپزخونه".
4. **bad**: overlaps another item that is not "out". Reason: "افتاده روی <name>".
5. **warn** (amber `--warn`): overlaps an active clearance zone (`zonesActive()`). Reason: "<zone> رو گرفته".
6. **ok** (green `--ok`): "جاش خوبه".

Overlap is strict (`ov()` uses a 0.01 cm tolerance), so touching edges are allowed. Each item's footprint planes (children of its group, at Y 0.8) are coloured by status; the selected item's footprint opacity is 0.75, others 0.35.

Summary numbers (`renderUI()`):
- Score = items not out minus bad items, shown as "X از N وسیله درست جا شده".
- `USABLE = (535*590 + 200*110 - 165*290 - 60*325) / 10000` which is about 27.0 m².
- Furniture area = sum of footprint rect areas that are indoor (balcony excluded), shown as m² and percent of `USABLE`.
- Lists names of items left outside, and counts of bad and warn items.
- Static comparison line: current home is about 60 m².

---

## 8. Interaction design

### 8.1 Layout
- Desktop: flex row, RTL. Left: 3D stage (`#stage`, fills). Right: panel (`#panel`, 350 px, scrollable).
- Mobile (max-width 820 px): column; **3D stage first** (`order:-1`, height `62svh`), panel below. The user explicitly asked for render on top on mobile.
- Safe areas: `viewport-fit=cover`, `:root` padding with `env(safe-area-inset-*)`.
- Light/dark via CSS tokens and `prefers-color-scheme`, plus `data-theme` override hooks.

### 8.2 Panel contents (top to bottom)
1. Title "چیدمان استودیو جدید" and one-line instructions.
2. Big score number + text.
3. Facts box (usable area, furniture area, outside items, bad and warn counts).
4. Selection card: name, Persian label, dimensions, status reason (in status colour), buttons: "چرخش ۹۰ درجه", "ببر بیرون" / "بیار توی خونه", "جای پیشنهادی", and for the sofa "شزلون به طرف دیگه".
5. Grouped item list (نشیمن، خواب، ناهارخوری، بالکن) with status dot, name, label, size. Click or Enter selects. SKUBB listed as a static row.
6. Note about scale assumption and the balcony door toggle.
7. Reset button "برگرد به چیدمان پیشنهادی".

### 8.3 3D stage overlay
- Toolbar (top, inline-start): "سه‌بعدی", "از بالا", "دیوار بلند" (toggle), "نام وسایل" (toggle labels), "در بالکن: پایینی/بالایی".
- Hint (top, inline-end, hidden on mobile).
- Legend (bottom): ok, warn, bad, out colours.
- **Floating rotate button (`#rotFab`)**: 44 px accent circle with a rotate SVG icon. Appears next to the selected item and follows it every frame (`updateFab()` projects `(x, h*0.6, y)` to screen, then offsets to the right by the item's projected radius, clamped 34 to 140 px, and clamps inside the stage). Hidden when nothing is selected or the point is behind the camera. The user asked for this to rotate faster while arranging.

### 8.4 Input
- Pointer down on an item (capture phase on the canvas, before OrbitControls): select, disable controls, start drag. Drag moves the item on the floor plane with **5 cm snapping** and live validation. Pointer up re-enables controls and saves.
- Pointer down on empty space: orbit as usual; a tap without movement (< 5 px) deselects.
- Keyboard: arrows move 5 cm (Shift: 1 cm); `R` or Persian `ق` rotates; `Esc` deselects.
- "ببر بیرون" searches the staging area on a 30 cm grid for a free spot; "بیار توی خونه" drops the item at (300, 500) for the user to drag.

### 8.5 Camera and lighting
- `PerspectiveCamera(38°)`, `OrbitControls` with damping, `maxPolarAngle = 0.48*PI`, distance 200 to 4000.
- Target `(270, 0, 300)`. 3D view position `(420, 880, 1230)`. Top view position `(270, 1400, 301)` (the tiny Z offset keeps plan orientation identical to SEA-A4).
- Lights: hemisphere (white / `#B8A58C`, 0.8), warm fill directional 0.25 from (-600, 700, -400), sun directional 0.75 from (700, 1300, 1000) with 2048 PCF soft shadows, shadow frustum ±800.

### 8.6 Labels
Canvas sprites with the product name (Latin), rounded white pill, `depthTest:false`, raycast disabled. Rebuilt once Vazirmatn has loaded (`document.fonts.load`). A larger sprite "بیرون از خونه / وسایلی که جا نشدن" marks the staging area.

### 8.7 Persistence
- `localStorage[KEY]` with `KEY = 'studio-layout-v5'`: `{ id: {x, y, rot, flip} }`.
- `localStorage[KEY + '-door']`: `'top' | 'bottom'`.
- **Bump `KEY` whenever default positions or plan geometry change**, otherwise users keep stale layouts that may now be invalid.
- All storage access is wrapped in try/catch.

---

## 9. Design tokens

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#E4EBEE` | `#162027` |
| `--panel` | `#FFFFFF` | `#1E2A31` |
| `--ink` | `#1E2B33` | `#E4ECF0` |
| `--muted` | `#5B6B75` | `#98A8B1` |
| `--line` | `#D3DCE0` | `#2E3D46` |
| `--accent` | `#2E6B8A` | `#6FB0D0` |
| `--ok` | `#3C8D5A` | same |
| `--warn` | `#C98318` | same |
| `--bad` | `#C2412D` | same |
| `--out` | `#8A949A` | same |

Walls `#F3F3EF`; glass `#A9CFE0` at 0.35 opacity (no shadows); clearance zones `#E0A33A` at 0.22 opacity; staging area grey at 0.18 opacity. Scene background follows `--bg` and updates on colour-scheme change.

---

## 10. Code map (inside the single IIFE in `index.html`)

| Area | Functions / objects |
|---|---|
| Helpers | `fa(n,d)` Persian number format, `css(var)` read CSS token |
| Plan data | `MAIN, CORR, STRIP, OBST, ZONES, BAL_DOORS, balDoor, zonesActive(), BALC, STAGE, USABLE` |
| Furniture data | `DEFS` array, `KEY` |
| Scene setup | renderer, scene, camera, controls, `view3d()`, `viewTop()`, `applyBg()`, lights |
| Materials and meshes | `M()` cached materials, `EDGE`, `edgeMat`, `box()`, `grainTex()`, `WOOD*`, `woodTex()`, `planShape()`, `flat()`, `rectPts()` |
| Plan meshes | floor, bathroom floor, zone planes, `balZoneMesh` + `showBalZone()`, staging plane, balcony (`fixed` group) |
| Walls | `pieces()`, `wallRun()`, `buildWalls()`, `tall` flag |
| Fixtures | kitchen and bathroom boxes in `fixed` |
| Labels | `sprite(text, sub)` |
| Builders | object `B` with `sofa, bed, wardrobe, malm6, malm2, lacktv, coffee, olserod, table, chair, rigga, mirror, tarnoTable, tarnoChair` |
| Items | `items` Map, `pickables`, `localRects()`, `place()`, `worldRects()`, `ov()`, `inside()`, `inHouse()`, `touchesHouse()`, `indoor()` |
| Logic and UI | `evaluate()`, `renderUI()`, `select()`, `changed()`, `rotateSel()`, `toggleOut()` |
| Input | raycaster, `setNDC()`, `pick()`, pointer handlers, `endDrag()`, tap-to-deselect, keydown |
| Toolbar | view, walls, labels, balcony door, reset |
| Persistence | `save()`, `load()` |
| Loop | `resize()` via ResizeObserver, `updateFab()`, render loop |

---

## 11. Testing

There is no test suite. Logic is verified with a small Node harness that extracts constants and `worldRects` from the HTML and evaluates the default layout. Recreate it as `scripts/check-layout.js` if useful:

```js
const s = require('fs').readFileSync('index.html', 'utf8');
const js = s.split('<script>')[1].split('</script>')[0];
const pick = (a, b) => js.slice(js.indexOf(a), js.indexOf(b)).replace(/const |let /g, 'var ');
eval(pick('const MAIN', 'const USABLE'));
eval(pick('const DEFS', 'const KEY'));
function localRects(d){ return d.rects || [[-d.w/2, -d.d/2, d.w/2, d.d/2]]; }
eval(pick('function worldRects', 'function evaluate'));
for (const door of ['bottom', 'top']) {
  balDoor = door;
  const all = DEFS.map(d => Object.assign({}, d, { flip: !!d.flip }));
  all.forEach(it => it.wr = worldRects(it));
  all.forEach(it => {
    const R = it.wr; let st = 'ok';
    if (R.every(r => !touchesHouse(r))) st = 'out';
    else if (R.some(r => !inHouse(r))) st = 'bad-wall';
    else {
      const o = OBST.find(ob => R.some(r => ov(r, ob)));
      if (o) st = 'bad ' + o.fa;
      else {
        const other = all.find(x => x !== it && x.wr.some(q => touchesHouse(q)) && x.wr.some(q => R.some(r => ov(r, q))));
        if (other) st = 'bad on ' + other.id;
        else { const z = zonesActive().find(zz => R.some(r => ov(r, zz))); if (z) st = 'warn ' + z.fa; }
      }
    }
    console.log(door, it.id.padEnd(9), st);
  });
}
```

Also run a syntax check: `new Function(js)`. Visual checks must be done in a real browser (desktop and a phone). Always test: drag on touch, rotate FAB, flip sofa, toggle walls, top view, dark mode, reload persistence, and the Netlify build.

If you refactor into modules, please keep the evaluation logic pure (no three.js dependency) so it stays testable.

---

## 12. Change history (why things are the way they are)

1. First version: estimated room from an old, wrongly oriented render; all furniture placed; RIGGA and LACK TV left out.
2. Converted to a Netlify-ready `index.html`; furniture given wood colours; TV added on LACK TV bench; MALM 6 moved to hallway.
3. User: everything except the TV bench must be wood. Found and fixed the `box()` material bug (wood materials were ignored, everything rendered white). Switched to light wood, added edge lines, redesigned the mirror, warmer lighting. Added TÄRNÖ balcony set.
4. Added floating rotate button next to the selected item; tap on empty floor deselects.
5. Mobile: 3D view on top, panel below.
6. User supplied the real plan SEA-A4 ("the balcony position was wrong"). Rebuilt all geometry in the SEA-A4 orientation, recalculated scale from the kitchen depth, added balcony door toggle and sofa flip, new default layout. Usable floor dropped from about 33 m² (old estimate) to about 27 m².

---

## 13. Backlog (prioritised, from the user conversation)

1. **Room calibration.** Input for real room width/length or total m²; scale the whole plan (all plan constants) while furniture keeps real size. Most important, because the current scale is an assumption.
2. **Door and drawer swing zones per item.** When the wardrobe, MALM chests or the fridge column are selected, show the area their doors/drawers need (wardrobe doors about 50 cm, MALM drawers about 45 cm) and warn if blocked. Also model the fridge door.
3. **Measuring tool.** Tap two points, show the distance in cm; ideally auto-show the minimum walkway gaps between items (flag anything under 60 cm).
4. **Custom items.** "وسیله جدید" with name, w, d, h and a simple box model (for plants, boxes, shoe rack, drying rack).
5. **Multiple layouts and sharing.** Save named variants (for example "with RIGGA" / "without RIGGA"); share via URL hash (base64 JSON of positions) so the partner opens the same layout on Netlify.
6. **Moving checklist.** Per item: moves / sell / give away / storage, box numbers, export as text or print.
7. **Undo / redo.**
8. Confirm which balcony opening is the door, then drop the toggle.
9. Optional polish: arbitrary rotation (15° steps) with OBB collision, rug and plants, eye-level walk mode, screenshot export, better sofa cushion modelling, soft ambient occlusion.

When implementing, keep the UI Persian, short and simple, and keep the one-sentence-per-concept tone of the current copy.

---

## 14. Acceptance checklist for any change

- [ ] Opens from a static host (Netlify) with no console errors.
- [ ] Desktop and mobile layouts both work; mobile shows 3D first.
- [ ] Drag, rotate (button, FAB, R key), flip, out/in, reset all work with mouse and touch.
- [ ] Statuses and summary update live and match the rules in section 7.
- [ ] All furniture is light wood except the white LACK TV bench, TV, fabrics and metal parts.
- [ ] Default layout still validates (run the harness), and `KEY` was bumped if defaults or geometry changed.
- [ ] No em dash characters anywhere in the repo.
- [ ] All new UI text is Persian with Persian digits.
