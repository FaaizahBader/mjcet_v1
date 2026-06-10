# MJCET Campus Navigation MVP PRD

## Product Name

MJCET Campus Navigation

---

## Overview

MJCET Campus Navigation is a lightweight web application that helps students, visitors, faculty, and guests navigate the MJCET campus.

The application provides real-time location tracking, destination-based navigation, and voice-powered destination selection using a custom campus map built from GeoJSON data.

The goal is to create a Google Maps-like experience exclusively for MJCET outdoor navigation.

---

## Problem Statement

New students and visitors often struggle to find buildings, canteens, prayer areas, departments, and facilities within the MJCET campus.

Traditional maps provide location information but do not offer campus-specific route guidance.

Users need a simple way to know:

* Where they currently are.
* How to reach a destination.
* Navigation assistance while walking.

---

## Goal

Enable users to:

1. View their live location on the MJCET campus map.
2. Select or speak a destination.
3. Receive the shortest walking route.
4. Follow the route while their live location updates in real time.

---

## Target Users

* First-year students
* Visitors
* Parents
* Faculty
* Event attendees

---

## MVP Scope

The MVP includes only three core features.

### Feature 1: Live Location Tracking

#### Description

Display the user's current location on the campus map.

#### User Story

As a student, I want to see where I am on campus so that I can orient myself.

#### Requirements

* Request location permission from the user.
* Track user location using browser GPS.
* Show current position as a blue marker.
* Continuously update location while moving.
* Center map on current location when application loads.

#### Acceptance Criteria

* User grants location permission.
* Blue location marker appears.
* Marker updates as the user walks.

---

### Feature 2: Destination Navigation

#### Description

Allow users to select a destination and receive the shortest walking route.

#### User Story

As a visitor, I want to select a destination and receive navigation guidance so that I can reach it easily.

#### Requirements

* Searchable destination selector.
* List destinations from GeoJSON nodes.
* Determine nearest graph node to current location.
* Calculate shortest path using A* algorithm.
* Display route as highlighted polyline.
* Update user location in real time while route remains visible.
* Display destination marker.

#### Acceptance Criteria

* User selects destination.
* Route appears within 2 seconds.
* Route follows mapped walkways.
* User can visually follow route while moving.

---

### Feature 3: Voice Destination Selection

#### Description

Allow users to speak their destination instead of manually selecting it.

#### User Story

As a student, I want to say where I want to go so that I can start navigation quickly.

#### Requirements

* Microphone button.
* Speech-to-text using browser speech recognition.
* Match spoken text to available destinations.
* Automatically generate route.
* Provide voice confirmation.

#### Example Commands

* "Take me to the library"
* "Navigate to Block 5"
* "Take me to the Masjid"
* "I want to go to the Veg Canteen"

#### Example Responses

* "Navigating to Library."
* "Navigating to Masjid."
* "Destination not found."

#### Acceptance Criteria

* User speaks destination.
* System identifies destination correctly.
* Route is generated automatically.

---

## User Flow

### Dropdown Navigation

Open App
→ Allow Location Access
→ View Live Location
→ Select Destination
→ Generate Route
→ Follow Route
→ Reach Destination

### Voice Navigation

Open App
→ Allow Location Access
→ Tap Microphone
→ Speak Destination
→ Destination Recognized
→ Generate Route
→ Follow Route
→ Reach Destination

---

## Technical Requirements

### Frontend

* React
* Vite
* React Leaflet
* Leaflet

### Mapping

* GeoJSON Campus Map
* OpenStreetMap Tiles

### Routing

* Graph-based Routing
* A* Pathfinding Algorithm

### Location

* Browser Geolocation API
* navigator.geolocation.watchPosition()

### Voice

* Web Speech API
* Speech Recognition
* Speech Synthesis

### Deployment

* Vercel

---

## Non-Goals

The following are explicitly excluded from the MVP:

* Indoor navigation
* Multi-floor routing
* User authentication
* User profiles
* Admin dashboard
* Analytics
* QR code navigation
* AI chatbot
* Multi-campus support
* AR navigation
* Offline mode

---

## UI Requirements

The interface should remain extremely simple.

Components:

1. Campus Map
2. Destination Search Dropdown
3. Microphone Button
4. Current Location Marker
5. Route Polyline

No sidebars, dashboards, or complex menus.

Mobile-first design.

---

## Success Criteria

The MVP is successful when a user can:

1. Open the application.
2. See their live location.
3. Select or speak a destination.
4. Receive a route.
5. Walk while their location updates.
6. Reach the destination successfully.

If these six actions work reliably on a mobile device within the MJCET campus, the MVP is considered complete.
