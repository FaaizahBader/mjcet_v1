# MJCET Campus Navigation — Implementation Todo

Implementation checklist for the MVP defined in [prd.md](prd.md).

---

## Dependencies to Install

### Required (npm)

```bash
npm install leaflet react-leaflet
```

| Package | Purpose |
|---------|---------|
| `leaflet` | Core map library; renders OSM tiles, markers, and polylines |
| `react-leaflet` | React components for Leaflet (`MapContainer`, `TileLayer`, `Marker`, `Polyline`, etc.) |

### Recommended (npm)

```bash
npm install fuse.js
```

| Package | Purpose |
|---------|---------|
| `fuse.js` | Fuzzy matching of spoken or typed destination names against GeoJSON node labels |

### Optional dev dependencies

```bash
npm install -D @types/leaflet
```

| Package | Purpose |
|---------|---------|
| `@types/leaflet` | TypeScript/IDE autocomplete for Leaflet APIs (helpful even in a `.jsx` project) |

### Already installed (no action needed)

| Package | Purpose |
|---------|---------|
| `react` | UI framework |
| `react-dom` | React DOM renderer |
| `vite` | Build tool and dev server |
| `@vitejs/plugin-react` | React support in Vite |

### Browser APIs (no npm install)

| API | Purpose |
|-----|---------|
| `navigator.geolocation.watchPosition()` | Live GPS location tracking |
| `window.SpeechRecognition` / `webkitSpeechRecognition` | Speech-to-text for voice destination input |
| `window.speechSynthesis` | Voice confirmation responses |
| OpenStreetMap tile URLs | Base map tiles (loaded at runtime via Leaflet) |

### Custom code (no npm install)

| Module | Purpose |
|--------|---------|
| A* pathfinding | Shortest walking route on campus graph (implement in `src/lib/`) |
| GeoJSON parser | Load campus walkways and destination nodes from local `.geojson` files |

### Deployment

| Tool | Purpose |
|------|---------|
| Vercel | Host the static Vite build (no extra npm package required) |

---

## Phase 0: Project Setup

- [ ] Install required dependencies (`leaflet`, `react-leaflet`)
- [ ] Install recommended dependency (`fuse.js`)
- [ ] Import Leaflet CSS in the app entry (`import 'leaflet/dist/leaflet.css'`)
- [ ] Fix or remove broken `hero.png` import in `src/App.jsx`
- [ ] Remove Vite starter template UI and replace with navigation layout
- [ ] Create folder structure:
  - `src/components/` — UI components
  - `src/hooks/` — geolocation, speech, routing hooks
  - `src/lib/` — A*, graph builder, destination matcher
  - `public/data/` or `src/data/` — GeoJSON campus map files
- [ ] Add mobile-first global styles (full-screen map, overlay controls)

---

## Phase 1: Campus Map

- [ ] Obtain or create GeoJSON data for MJCET campus walkways (paths/edges)
- [ ] Obtain or create GeoJSON data for destination nodes (buildings, canteens, masjid, library, etc.)
- [ ] Build `CampusMap` component with React Leaflet
- [ ] Add OpenStreetMap `TileLayer`
- [ ] Set initial map bounds/center to MJCET campus coordinates
- [ ] Render walkway paths from GeoJSON (optional visual layer)
- [ ] Ensure map is responsive and fills the viewport on mobile

---

## Phase 2: Live Location Tracking (Feature 1)

- [ ] Create `useGeolocation` hook using `navigator.geolocation.watchPosition()`
- [ ] Request location permission on app load
- [ ] Handle permission denied / unavailable GPS errors with user-friendly messages
- [ ] Show blue current-location marker on the map
- [ ] Continuously update marker position while user moves
- [ ] Center map on user location when app first loads
- [ ] Verify marker updates smoothly while walking on campus

---

## Phase 3: Destination Navigation (Feature 2)

- [ ] Parse destination list from GeoJSON node properties
- [ ] Build routing graph from walkway GeoJSON (nodes + edges + weights)
- [ ] Implement nearest-node lookup from current GPS coordinates
- [ ] Implement A* shortest-path algorithm in `src/lib/pathfinding.js`
- [ ] Create searchable destination dropdown component
- [ ] On destination select: snap start to nearest node, run A*, render route
- [ ] Display route as highlighted `Polyline` on the map
- [ ] Display destination marker on the map
- [ ] Keep route visible while live location continues to update
- [ ] Confirm route renders within 2 seconds
- [ ] Confirm route follows mapped walkways only

---

## Phase 4: Voice Destination Selection (Feature 3)

- [ ] Create `useSpeechRecognition` hook (Web Speech API)
- [ ] Add microphone button to the UI
- [ ] Convert spoken text to destination match using `fuse.js` (or equivalent matcher)
- [ ] Support example phrases:
  - "Take me to the library"
  - "Navigate to Block 5"
  - "Take me to the Masjid"
  - "I want to go to the Veg Canteen"
- [ ] Auto-generate route when destination is recognized
- [ ] Add voice confirmation via `speechSynthesis` ("Navigating to Library.")
- [ ] Handle unrecognized destinations ("Destination not found.")
- [ ] Test on mobile Chrome (primary browser for Web Speech API)

---

## Phase 5: UI Polish

- [ ] Finalize mobile-first layout (map full screen, controls overlaid)
- [ ] Style destination search dropdown
- [ ] Style microphone button (active/listening state)
- [ ] Ensure touch targets are large enough for mobile
- [ ] Add loading and error states (GPS, routing, speech)
- [ ] Remove all non-MVP UI (sidebars, dashboards, extra menus)

---

## Phase 6: Deployment

- [ ] Run production build (`npm run build`)
- [ ] Deploy to Vercel
- [ ] Test on a real mobile device within MJCET campus
- [ ] Validate all six success criteria from [prd.md](prd.md)

---

## MVP Success Checklist

From the PRD — the MVP is complete when a user can:

- [ ] Open the application
- [ ] See their live location
- [ ] Select or speak a destination
- [ ] Receive a route
- [ ] Walk while their location updates
- [ ] Reach the destination successfully

---

## Out of Scope (Do Not Implement for MVP)

- Indoor navigation
- Multi-floor routing
- User authentication / profiles
- Admin dashboard
- Analytics
- QR code navigation
- AI chatbot
- Multi-campus support
- AR navigation
- Offline mode
