# Sky / meadow preview

Run the existing local server (`npm run dev:staging`, port 3002), then open
http://localhost:3002/preview/sky . No database access, migrations, or deployment are required by this route.

The time control selects Auto / Morning / Day / Evening / Night. Auto uses the
browser's local hours, minutes and seconds, refreshed every 30 seconds. Colors
are smoothstep-interpolated through dawn, midday, sunset and night; full night
holds until 04:30, daylight holds from 12:00 to 15:00. These are artistic local
clock ranges, not location-based astronomical sunrise calculations.

Normal scrolling reveals perspective terrain and foreground grass. No scroll locking,
wheel interception or smooth-scroll controller is installed. The footer's
“静的表示で確認” checkbox unmounts both renderers and exercises the static route.

Architecture:
- Existing stack: Next 14, React 18, Three 0.183; add React Three Fiber 8.18 to
  match React 18. No drei, postprocessing, or motion dependency needed.
- SkyCanvas: one orthographic R3F canvas, seven transparent camera-facing PNG
  planes (four on small screens). Depth writes disabled, back-to-front order,
  transparent padding and soft alpha prevent rectangular edges and dark borders.
- Existing GlobeHero creates and owns its WebGL renderer. It remains separate
  to preserve interaction and texture behavior. An optional `paused` prop and
  pixel ratio cap let this preview stop offscreen/reduced-motion drawing. Default
  appearance and LP usage are unchanged. Geometry/material/texture cleanup added.
- DOM gradient and static local PNGs remain available if WebGL is unavailable,
  a context is lost, or textures fail. No fake cloud-shape substitute is used.
- Mobile uses DPR 1, 512px PNGs and four planes; desktop background DPR <= 1.5.
- Hidden tab: cloud frameloop switches to demand; globe frame loop pauses.
  Reduced motion: no cloud drift or globe auto-rotation; normal scroll remains.
- R3F disposes its geometries/materials; owned textures and event listeners are
  explicitly disposed/removed on unmount. The existing globe releases its GPU
  geometry/material/texture and renderer.

Assets: public/clouds/ATTRIBUTION.md records OlegVegan's CC0 pack and five source
filenames. Local optimized PNGs plus mobile variants total approximately 1.7 MB.
CLOUD_PATHS in SkyCanvas centralizes replacements. No Air logos, images or source
code are used. Production LP, DB and deployment are not changed by this preview.

Manual verification: desktop day/evening/night, meadow day/night, 390×844 mobile
(no horizontal overflow; both canvases DPR 1), static checkbox unmount/remount.
Remaining physical-device checks: Safari/iOS GPU behavior, prolonged memory/FPS
profiling, natural OS reduced-motion toggle and real context-loss recovery.


## Meadow refinement

The live meadow now shares the cloud R3F Canvas. MeadowField projects a real
height mesh with its own perspective matrix, leaving the cloud camera unchanged.
Ground normals, broad color variation and distance haze establish relief before
any animation is enabled. Grass is one instanced geometry (86,475 desktop /
12,792 mobile blades), built as seven-segment tapered, curved ribbons in irregular
clumps. Roots sample the same height function as the terrain. Vertex wind bends
only the upper blade using a squared height weight, with world-space phase and
slow travelling waves. The footer can freeze the grass independently of clouds.
Reduced motion disables grass wind; the existing hidden-tab frame policy remains.

Verified geometry generation and terrain/root agreement, day/night static views,
and visible wind versus frozen frames. Shader compile error encountered during
iteration was corrected; final page reloaded without shader errors. Physical
mobile GPU/FPS and long-run memory profiling remain unverified.


### Dense grass reference (2026-11-01)

Visual / rendering reference: https://al-ro.github.io/projects/grass/
Source inspected: https://github.com/al-ro/al-ro.github.io/tree/master/projects/grass
The project directory exposes grass.js and index.html; no reuse license was found
in the project directory, repository root or root README. Its overview says the
texture and alpha map originate from Eddie Lee's grass demo. No reference source
code, alpha maps, grass textures or camera-control code are copied here. The
height function, ribbon geometry, instancing distribution and shaders are locally
authored. Existing OlegVegan CC0 cloud assets and credits remain unchanged.

The fixed virtual camera is approximately two meters above local ground with no
orbit, drag, zoom or movement bindings. Three-blade clumps have independent widths,
heights, headings and rest curves. Root shading, leaf fold lighting and weak tip
transmission provide depth without an external blade texture. Near vegetation
extends below the viewport so its roots never end on a horizontal strip. The
terrain includes an asymmetric midground rise and shallow channel in addition to
the distant relief. Both are sampled by grass roots.

Verification: desktop daytime frozen view first; then world-space travelling wind,
night view and 390x844 mobile view. Pixel comparison in an opaque foreground crop:
wind enabled changes frames; frozen wind yields 0.0 mean RGB difference. Geometry
checks confirm roots match the heightfield, tips taper to zero and mobile density
is lower. Mobile render reports 12,792 instances, DPR 1 and no horizontal overflow.
TypeScript and git diff whitespace checks pass. Real-device sustained FPS / thermal
behavior and long-session GPU memory remain unverified.


## Language exchange hero

The hero now explains reciprocal language practice with the supplied copy and a
local Open Peeps illustration for Haru / Alex. Dialogue is explicitly labelled as
an example and no demo send/call controls or automatic audio are present. The
only hero action remains a normal Link to /app; authentication and matching are
unchanged. Open Peeps assets and CC0 source are recorded in avatars/ATTRIBUTION.md.

GlobeHero and its country plates are no longer mounted anywhere in this preview.
The reusable component remains in src/components/GlobeHero.tsx for existing users.
Only the sky/grass background Canvas remains here. Earlier globe-specific preview
notes above describe the previous version, not the current hero. Landscape code,
cloud assets, time interpolation and grass decoration were not changed in this step.

Desktop: copy left, two profiles and example conversation right. Mobile: copy,
CTA, then the scene. Serif headings use local EB Garamond; all small type is Arial.
CSS animates only portrait transforms and a one-time message entrance; reduced
motion displays all messages immediately and disables floating. Hidden tabs pause
portrait movement. No live region announces the static example.

## Scroll greetings

Current avatar treatment uses six locally served, generated fictional portraits.
The hero shows Haru / Japanese and Alex / English; the cloud crossing introduces
Camille / French and Diego / Spanish; the meadow introduces Mina / Korean and
Omar / Arabic. Each has a circular photo, pastel ring, readable name/language
caption and native-language greeting bubble. These replace the prior two-person
conversation layout; its component remains available but is not mounted.

IntersectionObserver reveals the portrait then its bubble as a normal scroll
enters the viewport. Seen state is retained when scrolling back. Float animation
pauses offscreen or when the tab is hidden; reduced motion uses no transitions or
float. The group has pointer-events:none and no fake interactive controls, online
status, reviews or user counts. The full globe and /app CTA remain unchanged.

## Current section order

Hero (two greeting avatars only) → How it works (three concrete steps) → meadow
CTA. The globe and lower-page greeting groups are not mounted. Reusable globe,
photo assets and earlier scene components remain available. CTA still targets
/app; authentication, matching and landscape rendering are unchanged.

## Scroll story / rotating greeting plates

How it works uses a pinned left illustration and three vertically spaced right
steps on desktop. IntersectionObserver selects the step nearest the viewport
center; only that explanation is emphasized and its language/match/chat example
is shown on the left. On mobile each example sits directly above its text, using
ordinary document scrolling. No wheel interception, scroll snapping or fake form
controls are added. A preview-scoped overflow:clip override on the outer layout
allows sticky positioning without changing other routes.

The two hero photos have no name/language captions. Greeting plates reuse the
original globe's global .globe-greeting styling and countryGreeting helper, with
its tilted colored rectangle, white type and flag. Eleven greetings cycle every
4.5 seconds. Timers stop offscreen, in hidden tabs and with reduced motion. The
text transition is small, and no live region repeatedly announces changes.

Verified: left panel remains at y=175px while active step changes 1→2 and then 3;
mobile 390px has no horizontal overflow and no avatar captions; greeting text
changes through multiple languages; TypeScript and whitespace checks pass.

## Current hero copy / paired avatar rotation

Headline restored: “Find someone who actually wants to practice.” Supporting text:
“Teach each other your languages. Practice together through chat or voice calls.”
The existing /app CTA and simple three-card How it works section remain.

The six fictional portrait/language pairs now rotate together, rather than
changing a greeting on the same face. Left slot cycles Japanese → French → Korean;
right slot cycles English → Spanish → Arabic. Photo layers preload the two shared
portrait atlases to prevent an unloaded new photo briefly lagging its greeting.
Names/language captions remain hidden; borders are a thin neutral cream. Previous
notes about eleven independent greetings describe the earlier version only.

## Applied as the landing page

The shared client UI now lives in LandingExperience.tsx. The root route renders it
without preview controls and retains AuthRedirectHandler for existing auth hash
links. /preview/sky renders the same component with its inspection controls.
Root footer contains existing Sign in and contact destinations. No DB migration
or deployment is part of this promotion. Root rendering and CTA → /app navigation
were checked in the browser; TypeScript passed.
