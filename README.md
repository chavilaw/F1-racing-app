# Racetrack info-screens by Chavilah Wong, Aleksi Räisänen and Iida Puomila 

# Overview of the project

The **Beachside Racetrack** MVP-system for a real-time racing management platform designed to coordinate multiple user roles during race events.  
It provides synchronized interfaces for race control, lap tracking, and public viewing.  
The system is powered by **Node.js**, **Express**, and **Socket.IO**, enabling instant communication between different terminals and user roles.
---
## Install & Setup

1. Clone the Repository
git clone https://github.com/chavilaw/F1-racing-app
cd racetrack

2. Install Dependencies

This project requires Node.js
 (v18 or newer) and npm.
Install all required dependencies with:

```
npm install

```
3. Configure Environment Variables

Create a file named .env in the project root and add the following keys:

```
RECEPTIONIST_KEY=rec123
OBSERVER_KEY=obs123
SAFETY_KEY=saf123
PERSIST=true

```
These keys define access credentials for each user interface.
The optional PERSIST=true enables saving and reloading race data between server restarts.

4. Start the Server

Run the application using:

```
npm start

```
or to explicitly enable persistence:

```
npm run start:persist

```

---

## System Architecture
The application runs a single Node.js server that:
- Manages **race sessions** and **driver data**.
- Synchronizes race state across multiple connected clients.
- Exposes dedicated browser-based user interfaces for each operational role.
- Broadcasts live updates such as race mode changes, lap crossings, and leaderboard data.
 Tip: look up ERD-diagram for the relationships  


### Roles
Role/Route

**Receptionist/front-desk.html**  
* Registers drivers, assigns car numbers, and manages session/driver creation and deletion. Cars can be assigned from 1-8 per session. Automatically broadcasts all changes to other clients via `sessions` updates.


**Safety Officer/race-control.html**
* Controls race state (start, stop, mode changes, and completion). Switch between **SAFE**, **HAZARD**, **DANGER**, and **FINISH** modes overall managing the lifecycle of the race event. Control and broadcast race state updates (`race-state`, `race-mode-change`, `timer-update`).


**Lap Line Observer//lap-line-tracker.html** 
* Records lap crossings when cars pass the lap line. Sends `lap:crossed` events to the server.




**Public Visitors/eg.Leader Board Display/leader-board.html**  
* Displays the live leaderboard, race flag, and remaining time for all spectators. 
* Guests, race drivers, and spectators can view race information such as results, upcoming races, and countdowns.
---


Command to run server: RECEPTIONIST_KEY=rec123 OBSERVER_KEY=obs123 SAFETY_KEY=saf123 npm start
Run with persistence: RECEPTIONIST_KEY=rec123 OBSERVER_KEY=obs123 SAFETY_KEY=saf123 npm start -- --persist

## Access from Other Networks

To make the server accessible from devices on different networks (e.g., testing with phone):

1. Install ngrok: `brew install ngrok/ngrok/ngrok`
2. Sign up at https://dashboard.ngrok.com/signup and get your auth token
3. Configure: `ngrok config add-authtoken YOUR_TOKEN`
4. Start server: `npm start`
5. In another terminal: `./ngrok.sh` (or `ngrok http 3000`)
6. Use the ngrok Forwarding URL from any device
