// WebRTC client — works with your Render signaling server
let localStream = null;
let pc = null;
let ws = null;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// 🔹 Replace this with your actual Render WebSocket URL once deployed
const SIGNAL_URL = "wss://webrtc-signal-server-tdk6.onrender.com";

async function startLocalCamera() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    localVideo.srcObject = localStream;
    document.getElementById('toggleCameraPreview').checked = true;
  } catch (err) {
    alert("Camera access failed: " + err.message);
  }
}

function connectSignaling() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  ws = new WebSocket(SIGNAL_URL);
  ws.onmessage = async (msg) => {
    const data = JSON.parse(msg.data);
    if (data.type === "offer") await handleOffer(data.offer);
    else if (data.type === "answer") await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    else if (data.type === "ice") try { await pc.addIceCandidate(data.candidate); } catch (e) { console.warn(e); }
  };
}

async function createPeer() {
  pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  pc.onicecandidate = (e) => { if (e.candidate) ws.send(JSON.stringify({ type: "ice", candidate: e.candidate })); };
  pc.ontrack = (e) => (remoteVideo.srcObject = e.streams[0]);
  if (localStream) for (const t of localStream.getTracks()) pc.addTrack(t, localStream);
}

async function createOffer() {
  connectSignaling();
  await createPeer();
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({ type: "offer", offer }));
}

async function handleOffer(offer) {
  connectSignaling();
  await createPeer();
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  ws.send(JSON.stringify({ type: "answer", answer }));
}

document.getElementById("startLocalCamera").addEventListener("click", startLocalCamera);
document.getElementById("createOffer").addEventListener("click", createOffer);
document.getElementById("joinOffer").addEventListener("click", () => connectSignaling());
document.getElementById("hangup").addEventListener("click", () => { if (pc) pc.close(); if (ws) ws.close(); });
document.getElementById("toggleCameraPreview").addEventListener("change", (e) => {
  localVideo.srcObject = e.target.checked ? localStream : null;
});
