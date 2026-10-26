# Print Shop

Online and walk-in print order app.

## Stack
React (Vite) + Node/Express + MongoDB Atlas + Cloudinary

## Run locally
cd server && npm install && npm run dev
cd client && npm install && npm run dev

## Environment
See server/.env.example and client/.env.example

## Deploy
Server: Render (root dir: server). Client: Netlify (base dir: client).

## TODO
- Consider moving file storage from Cloudinary to Google Drive (only server/utils/storage.js needs to change)
- Client accounts (order history)
- Backups: export orders from Atlas monthly