let localStream = null;
let pc = null;
let ws = null;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const SIGNAL_URL = "wss://webrtc-signal-server-tdk6.onrender.com";

// --- Utility: Wait for WebSocket open ---
async function safeSend(message) {
  if (!ws) throw new Error("WebSocket not initialized");
  if (ws.readyState === WebSocket.CONNECTING) {
    await new Promise(r => ws.addEventListener("open", r, { once: true }));
  }
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    console.warn("⚠️ Tried to send but socket not open", ws.readyState);
  }
}

// --- Camera setup ---
async function startLocalCamera() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    document.getElementById("toggleCameraPreview").checked = true;
    console.log("Camera started ✅");
  } catch (err) {
    console.error("Camera error:", err);
    alert("Camera access failed: " + err.message);
  }
}

// --- Signaling connection ---
function connectSignaling() {
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) return resolve();

    ws = new WebSocket(SIGNAL_URL);

    ws.onopen = () => {
      console.log("WebSocket connected ✅");
      resolve();
    };

    ws.onerror = e => {
      console.error("WebSocket error ❌", e);
      reject(e);
    };

    ws.onmessage = async msg => {
      const data = JSON.parse(msg.data);
      console.log("🛰️ Received:", data.type, "| State:", pc?.signalingState);

      try {
        if (data.type === "offer") {
          await handleOffer(data.offer);
        } 
        else if (data.type === "answer") {
          if (!pc) {
            console.warn("⚠️ No PeerConnection yet, ignoring answer");
            return;
          }

          if (pc.signalingState !== "have-local-offer" || pc.remoteDescription) {
            console.warn("⚠️ Ignored duplicate or late answer, state:", pc.signalingState);
            return;
          }

          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log("✅ Remote answer applied successfully");
        } 
        else if (data.type === "ice") {
          if (pc) {
            await pc.addIceCandidate(data.candidate);
            console.log("ICE candidate added");
          }
        }
      } catch (err) {
        console.error("❌ Message handling failed:", err);
      }
    };
  });
}

// --- Create peer connection ---
async function createPeer() {
  pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "turn:relay1.expressturn.com:3478", username: "efgh", credential: "efgh" }
    ]
  });

  pc.onicecandidate = e => {
    if (e.candidate) safeSend({ type: "ice", candidate: e.candidate });
  };

  pc.ontrack = e => {
    console.log("🎥 Remote stream received");
    remoteVideo.srcObject = e.streams[0];
  };

  if (localStream) {
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }
  }
}

// --- Handle Offer (when received) ---
async function handleOffer(offer) {
  try {
    // Reset old connection if needed
    if (pc && pc.signalingState !== "stable") {
      console.warn("⚠️ Peer not stable, resetting...");
      pc.close();
      pc = null;
    }

    await connectSignaling();
    if (!pc) await createPeer();

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await safeSend({ type: "answer", answer });

    console.log("✅ Answer created & sent");
  } catch (e) {
    console.error("Offer handling failed ❌", e);
  }
}

// --- Create Offer (when starting a call) ---
document.getElementById("createOffer").addEventListener("click", async () => {
  try {
    await connectSignaling();
    await createPeer();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await safeSend({ type: "offer", offer });

    console.log("✅ Offer created & sent");
  } catch (e) {
    console.error("Offer creation failed ❌", e);
  }
});

// --- Join button (for second peer) ---
document.getElementById("joinOffer").addEventListener("click", async () => {
  await connectSignaling();
  console.log("Joined signaling server ✅");
});

// --- Controls ---
document.getElementById("startLocalCamera").addEventListener("click", startLocalCamera);

document.getElementById("hangup").addEventListener("click", () => {
  if (pc) {
    pc.close();
    pc = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  console.log("Call ended ❌");
});

document.getElementById("toggleCameraPreview").addEventListener("change", e => {
  localVideo.srcObject = e.target.checked ? localStream : null;
});
