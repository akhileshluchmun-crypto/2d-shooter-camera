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
      console.log("Received:", data.type);
      console.log("🛰️ Received:", data.type, "State:", pc?.signalingState);

      if (data.type === "offer") await handleOffer(data.offer);
      if (data.type === "offer") {
        await handleOffer(data.offer);
      } 
      else if (data.type === "answer") {
        // ✅ Apply answer only if in the right state
        if (pc && pc.signalingState === "have-local-offer") {
        // ✅ Only apply answer once and at the right time
        if (!pc) {
          console.warn("⚠️ No PeerConnection yet, ignoring answer");
          return;
        }

        if (pc.signalingState !== "have-local-offer" || pc.remoteDescription) {
          console.warn("⚠️ Ignored duplicate or late answer, state:", pc.signalingState);
          return;
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log("Answer applied ✅");
        } else {
          console.warn("Ignored answer, state:", pc?.signalingState);
          console.log("✅ Remote answer applied successfully");
        } catch (err) {
          console.error("❌ Failed to apply answer:", err);
        }
      } else if (data.type === "ice") {
      } 
      else if (data.type === "ice") {
        try {
          await pc.addIceCandidate(data.candidate);
          console.log("ICE added");
          if (pc) {
            await pc.addIceCandidate(data.candidate);
            console.log("ICE candidate added");
          }
        } catch (e) {
          console.warn("ICE add error:", e);
        }
@@ -90,7 +108,9 @@
  };

  if (localStream) {
    for (const t of localStream.getTracks()) pc.addTrack(t, localStream);
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }
  }
}

@@ -115,7 +135,7 @@
    await connectSignaling();
    await createPeer();

    // ✅ Only handle if not already stable
    // ✅ Only process offer if stable (not already negotiating)
    if (pc.signalingState !== "stable") {
      console.warn("Already negotiating, skipping offer");
      return;
@@ -138,11 +158,19 @@

// --- Controls ---
document.getElementById("startLocalCamera").addEventListener("click", startLocalCamera);

document.getElementById("hangup").addEventListener("click", () => {
  if (pc) pc.close();
  if (ws) ws.close();
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
