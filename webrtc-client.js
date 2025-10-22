let localStream = null;
let pc = null;
let ws = null;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const SIGNAL_URL = "wss://webrtc-signal-server-tdk6.onrender.com";

// --- Utility: wait for WebSocket open ---
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
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
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
      console.log("🛰️ Received:", data.type, "State:", pc?.signalingState);

      if (data.type === "offer") {
        await handleOffer(data.offer);
      } 
      else if (data.type === "answer") {
        // ✅ Only apply answer once and at the right time
        if (!pc) {
          console.warn("⚠️ No PeerConnection yet, ignoring answer");
          return;
        }

        if (pc.signalingState !== "have-local-offer" || pc.remoteDescription) {
          console.warn("⚠️ Ignored duplicate or late answer, state:", pc.signalingState);
          return;
        }

        if (!pc) return;
        // Ignore duplicates or late answers
        if (pc.remoteDescription || pc.signalingState !== "have-local-offer") return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log("✅ Remote answer applied successfully");
          console.log("✅ Remote answer applied");
        } catch (err) {
          console.error("❌ Failed to apply answer:", err);
        }
      } 
      else if (data.type === "ice") {
        try {
          if (pc) {
            await pc.addIceCandidate(data.candidate);
            console.log("ICE candidate added");
          }
        } catch (e) {
          console.warn("ICE add error:", e);
        }
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
    console.log("Remote stream 🎥");
    remoteVideo.srcObject = e.streams[0];
  };

  if (localStream) {
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }
  }
}

// --- Create Offer ---
document.getElementById("createOffer").addEventListener("click", async () => {
  try {
    await connectSignaling();
    await createPeer();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await safeSend({ type: "offer", offer });
    console.log("Offer created & sent ✅");
  } catch (e) {
    console.error("Offer creation failed ❌", e);
  }
});

// --- Handle Offer ---
async function handleOffer(offer) {
  try {
    await connectSignaling();
    await createPeer();

    // ✅ Only process offer if stable (not already negotiating)
    if (pc.signalingState !== "stable") {
      console.warn("Already negotiating, skipping offer");
      return;
    // Reset peer if already negotiating
    if (pc && pc.signalingState !== "stable") {
      console.warn("⚠️ Peer not stable, resetting");
      pc.close();
      pc = null;
    }

    if (!pc) await createPeer();

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await safeSend({ type: "answer", answer });
    console.log("Answer created & sent ✅");
    console.log("✅ Answer created & sent");
  } catch (e) {
    console.error("Offer handling failed ❌", e);
  }
}

// --- Join button ---
document.getElementById("joinOffer").addEventListener("click", async () => {
  await connectSignaling();
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
