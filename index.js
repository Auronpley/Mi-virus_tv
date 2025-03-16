require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const B2 = require("backblaze-b2");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const KEY_ID = process.env.B2_KEY_ID || "0051e29680b2f630000000003";
const APPLICATION_KEY = process.env.B2_APPLICATION_KEY || "K005Y61rUkgGLsRYN4wAhATywjVN/+U";
const BUCKET_NAME = "virtus-tv";

const b2 = new B2({
  applicationKeyId: KEY_ID,
  applicationKey: APPLICATION_KEY,
});

let videoList = [];
let currentVideo = null;
let startTime = Date.now(); // Guarda el tiempo de inicio

// Función para cargar los videos desde Backblaze
async function loadVideos() {
  await b2.authorize();
  const files = await b2.listFileNames({ bucketId: "81cef2d9d6f890ab925f0613" });

  videoList = files.data.files.map(file => ({
    name: file.fileName,
    url: `https://f005.backblazeb2.com/file/${BUCKET_NAME}/${encodeURIComponent(file.fileName)}`,
    duration: 180 // Debes ajustar esto con la duración real de los videos
  }));

  selectRandomVideo(); // Selecciona un video aleatorio al inicio
}

// Selecciona un video aleatorio de la lista
function selectRandomVideo() {
  if (videoList.length === 0) return;

  const randomIndex = Math.floor(Math.random() * videoList.length);
  currentVideo = videoList[randomIndex];
  startTime = Date.now(); // Reinicia el tiempo de inicio
}

// Cargar videos al iniciar el servidor
loadVideos();

// WebSocket para sincronizar clientes
wss.on("connection", ws => {
  // Envía el video actual al nuevo cliente
  ws.send(JSON.stringify({
    currentVideo,
    elapsedTime: (Date.now() - startTime) / 1000
  }));

  ws.on("message", message => {
    const data = JSON.parse(message);
    if (data.action === "video-ended") {
      selectRandomVideo(); // Selecciona un nuevo video aleatorio cuando termine uno
      broadcastCurrentVideo();
    }
  });
});

// Función para enviar el video actual a todos los clientes
function broadcastCurrentVideo() {
  const data = JSON.stringify({
    currentVideo,
    elapsedTime: 0 // Empieza desde el inicio
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// API para servir el HTML
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Iniciar el servidor
server.listen(3000, () => console.log("Servidor corriendo en http://localhost:3000"));
