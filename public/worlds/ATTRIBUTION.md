# Meadow landscape

The active landing-page landscape is the original procedural Three.js meadow.
Terrain, instanced grass and flowers are generated locally; no external model or ground texture is used.

`meadow-day.jpg` and `meadow-night.jpg` are local captures of the meadow, used for the static WebGL fallback.
The sky cloud textures retain their separate credits in `/clouds/ATTRIBUTION.md`.

The landscape selector and other landscape loading/rendering modules have been removed.
Only the meadow is loaded in the shared sky Canvas, lazily as the lower section approaches.
