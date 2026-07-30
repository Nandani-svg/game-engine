# Growth Engine

An endless generative ecosystem that grows forever. No resets. No terminal state.

Built on **space colonization** — Colonies sprout from seeds,grow tips toward food,branch on sucess,avoid colliding with neighbors.Upto 20 coexist,each with a unique name,hue and personality.

---

## Colonies

### Normal Colonies
Grow outward by seeking randomly scattered **attraction points** (food). Each colony has a procedurally generated name (e.g. *Xyloform*, *Venaspore*) and a unique color palette derived from its hue.

---

## Features

- **Space colonization algorithm** — biologically inspired branching growth
- **Spatial hashing** — fast O(1) neighbor queries for tips, food points, and segments
- **Up to 20 concurrent colonies** — each auto-named with a procedural color palette
- **Live HUD** — real-time FPS, tip count, segment count, colony count, and tick
- **Colony inspector** — click any colony to see its stats, type, and color palette
- **Controls panel** — adjustable speed, toggleable glow/food overlays, ambient audio
- **Infinite pan & zoom** — drag to pan, scroll to zoom, reset anytime

---

## Controls

| Action | How |
|---|---|
| Pan | Click & drag |
| Zoom | Scroll wheel |
| Inspect colony | Click on it (or hover) |
| Speed | Slider in control dock |
| Toggle glow / food | Buttons in control dock |
| Reset view | ⌖ RESET VIEW button |

---

## Colony Inspector

| Field | Normal Colony | Predator Colony |
|---|---|---|
| TYPE | ● Normal | ☠ PREDATOR |
| FOOD LEFT | Remaining attraction points | — |
| SEGS EATEN | — | Segments consumed (live count) |
| ACTIVE | ● alive / ○ dormant | ● alive / ○ dormant |

---

## Configuration

All simulation parameters live in the `CFG` object at the top of `engine.js`:

| Key | Default | Description |
|---|---|---|
| `INFLUENCE_RADIUS` | 72 | How far a normal tip looks for food |
| `KILL_RADIUS` | 9 | Food consumed when a tip gets this close |
| `MAX_TIPS` | 580 | Cap on simultaneous growth tips |
| `MAX_COLONIES` | 20 | Maximum coexisting colonies |
| `AP_COUNT` | 320 | Attraction points per normal colony |
| `SPAWN_TICKS` | 260 | Ticks between new colony spawns |

---

## ♾️ Why It Belongs in the Endless Theme

Growth Engine has no reference point, no end, no boundary and it simply exists. As every colony perish, space becomes available for new colonies that are about to grow and be born, every starving predator passes by making room for survivors. There are no scheduled events, the ecosystem functions on its own using competition.

The infinite canvas makes the simulation endless. There is no fresh start: a point of attraction will disappear and will be replaced, a new colony will arise, predators will come and go.

Every session is different. Each colony gets a unique name, color, and personality. Predators may or may not collapse the place before their colonies, or they might do everything at once and the outcome of events is always unpredictable.

---

*Pure HTML + Canvas + JavaScript. Zero dependencies.*
