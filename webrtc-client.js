let localStream = null;
let pc = null;
let ws = null;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

// ✅ Use your Render WebSocket URL
const SIGNAL_URL = "wss://webrtc-signal-server-tdk6.onrender.com";

// ===== Utility: safe send with wait for open =====
// --- Utility: wait for WebSocket open ---
async function safeSend(message) {
  if (!ws) throw new Error("WebSocket not initialized");
  if (ws.readyState === WebSocket.CONNECTING) {
    await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
    await new Promise(r => ws.addEventListener("open", r, { once: true }));
  }
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    console.error("Cannot send, WebSocket not open. State:", ws.readyState);
    console.warn("⚠️ Tried to send but socket not open", ws.readyState);
  }
}

// ===== Camera Setup =====
// --- Camera setup ---
async function startLocalCamera() {
  try {
    console.log("Requesting camera...");
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    localVideo.srcObject = localStream;
    document.getElementById("toggleCameraPreview").checked = true;
@@ -37,46 +32,37 @@ async function startLocalCamera() {
  }
}

// ===== WebSocket Connection =====
// --- Signaling connection ---
function connectSignaling() {
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) return resolve();

    console.log("Connecting to signaling:", SIGNAL_URL);
    ws = new WebSocket(SIGNAL_URL);

    ws.onopen = () => {
      console.log("WebSocket connected ✅");
      resolve();
    };

    ws.onerror = (err) => {
      console.error("WebSocket error ❌", err);
      reject(err);
    ws.onerror = e => {
      console.error("WebSocket error ❌", e);
      reject(e);
    };

    ws.onmessage = async (msg) => {
    ws.onmessage = async msg => {
      const data = JSON.parse(msg.data);
      console.log("Received:", data.type);

      if (data.type === "offer") {
        await handleOffer(data.offer);
      }

      if (data.type === "offer") await handleOffer(data.offer);
      else if (data.type === "answer") {
        // ✅ Prevent setting answer twice
        // ✅ Apply answer only if in the right state
        if (pc && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log("Answer applied ✅");
        } else {
          console.warn("Ignoring answer because signalingState =", pc?.signalingState);
          console.warn("Ignored answer, state:", pc?.signalingState);
        }
      }

      else if (data.type === "ice") {
      } else if (data.type === "ice") {
        try {
          await pc.addIceCandidate(data.candidate);
          console.log("ICE candidate added");
          console.log("ICE added");
        } catch (e) {
          console.warn("ICE add error:", e);
        }
@@ -85,36 +71,32 @@ function connectSignaling() {
  });
}

// ===== Peer Connection Setup =====
// --- Create peer connection ---
async function createPeer() {
  console.log("Creating RTCPeerConnection");
  pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "turn:relay1.expressturn.com:3478", username: "efgh", credential: "efgh" }
    ]
  });

  pc.onicecandidate = (e) => {
  pc.onicecandidate = e => {
    if (e.candidate) safeSend({ type: "ice", candidate: e.candidate });
  };

  pc.ontrack = (e) => {
    console.log("Remote track received 🎥");
  pc.ontrack = e => {
    console.log("Remote stream 🎥");
    remoteVideo.srcObject = e.streams[0];
  };

  if (localStream) {
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }
    for (const t of localStream.getTracks()) pc.addTrack(t, localStream);
  }
}

// ===== Create Offer =====
// --- Create Offer ---
document.getElementById("createOffer").addEventListener("click", async () => {
  try {
    console.log("Create Offer clicked");
    await connectSignaling();
    await createPeer();

@@ -127,16 +109,15 @@ document.getElementById("createOffer").addEventListener("click", async () => {
  }
});

// ===== Handle Offer =====
// --- Handle Offer ---
async function handleOffer(offer) {
  try {
    console.log("Handling offer...");
    await connectSignaling();
    await createPeer();

    // ✅ Ignore duplicate offers when already connected
    if (pc.signalingState === "stable") {
      console.log("Ignoring duplicate offer (already stable)");
    // ✅ Only handle if not already stable
    if (pc.signalingState !== "stable") {
      console.warn("Already negotiating, skipping offer");
      return;
    }

@@ -146,23 +127,22 @@ async function handleOffer(offer) {
    await safeSend({ type: "answer", answer });
    console.log("Answer created & sent ✅");
  } catch (e) {
    console.error("Error handling offer ❌", e);
    console.error("Offer handling failed ❌", e);
  }
}

// ===== Join (for receiver) =====
// --- Join button ---
document.getElementById("joinOffer").addEventListener("click", async () => {
  console.log("Join clicked");
  await connectSignaling();
});

// ===== Buttons =====
// --- Controls ---
document.getElementById("startLocalCamera").addEventListener("click", startLocalCamera);
document.getElementById("hangup").addEventListener("click", () => {
  if (pc) pc.close();
  if (ws) ws.close();
  console.log("Call ended ❌");
});
document.getElementById("toggleCameraPreview").addEventListener("change", (e) => {
document.getElementById("toggleCameraPreview").addEventListener("change", e => {
  localVideo.srcObject = e.target.checked ? localStream : null;
});
