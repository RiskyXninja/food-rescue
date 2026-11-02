# Food Rescue Management System (MERN)

Donors list surplus food -> Admin approves -> Volunteer claims -> picks up -> delivers.
Every status change is pushed live to all connected clients via Socket.io.

## Run
1. MongoDB running locally (or use an Atlas URI)
2. Server:
   cd server && cp .env.example .env && npm install && npm run seed && npm run dev
3. Client (new terminal):
   cd client && npm install && npm run dev
4. Open http://localhost:5173  (admin: admin@foodrescue.dev / Admin@123)

## Status pipeline
pending -> approved | rejected   (admin)
approved -> claimed              (volunteer)
claimed -> picked_up -> delivered (assigned volunteer)
pending -> cancelled             (donor)
