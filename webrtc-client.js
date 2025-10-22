// ============================================
// WebRTC Client (Automatic Role, Stable Build)
// ============================================

let localStream = null;
let pc = null;
let ws = null;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const SIGNAL_URL = "wss://webrtc-signal-server-tdk6.onrender.com";

let isCaller = false; // will auto-detect based on message order

// ---------- Safe send through WebSocket ----------
async function safeSend(message) {
  if (!ws) throw new Error("WebSocket not initialized");
  if (ws.readyState === WebSocket.CONNECTING) {
    await new Promise(r => ws.addEventListener("open", r, { once: true }));
  }
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// ---------- Start camera ----------
async function startLocalCamera() {
  try {
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      localVideo.srcObject = localStream;
      console.log("📸 Local camera started ✅");
    }
  } catch (err) {
    console.error("Camera error ❌", err);
    alert("Camera access failed: " + err.message);
  }
}

// ---------- Connect to signaling server ----------
function connectSignaling() {
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) return resolve();

    ws = new WebSocket(SIGNAL_URL);

    ws.onopen = () => {
      console.log("🌐 WebSocket connected ✅");
      resolve();
    };

    ws.onerror = e => {
      console.error("WebSocket error ❌", e);
      reject(e);
    };

    ws.onmessage = async msg => {
      const data = JSON.parse(msg.data);
      console.log("🛰️ Received:", data.type, "| State:", pc?.signalingState);

      if (data.type === "offer") {
        // If we get an offer first, we are the callee
        isCaller = false;
        await handleOffer(data.offer);
      } 
      else if (data.type === "answer") {
        if (!pc) return;
        if (pc.signalingState !== "have-local-offer") {
          console.warn("⚠️ Ignored answer (wrong state):", pc.signalingState);
          return;
        }
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log("✅ Remote answer applied");
        } catch (err) {
          console.error("❌ Failed to apply answer:", err);
        }
      } 
      else if (data.type === "ice") {
        if (pc && data.candidate) {
          try {
            await pc.addIceCandidate(data.candidate);
            console.log("🧊 ICE candidate added");
          } catch (e) {
            console.warn("ICE add error:", e);
          }
        }
      }
    };
  });
}

// ---------- Create peer connection ----------
async function createPeer() {
  pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:relay1.expressturn.com:3478",
        username: "efgh",
        credential: "efgh"
      }
    ]
  });

  // Debug logs
  pc.onsignalingstatechange = () => console.log("🌀 Signaling:", pc.signalingState);
  pc.onconnectionstatechange = () => console.log("🔗 Connection:", pc.connectionState);
  pc.oniceconnectionstatechange = () => console.log("🧊 ICE:", pc.iceConnectionState);

  // Send ICE candidates
  pc.onicecandidate = e => {
    if (e.candidate) safeSend({ type: "ice", candidate: e.candidate });
  };

  // Handle remote stream
  pc.ontrack = e => {
    console.log("🎥 Remote stream received");
    remoteVideo.srcObject = e.streams[0];
  };

  // Start local camera automatically if not started
  if (!localStream) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      localVideo.srcObject = localStream;
      console.log("📸 Auto camera start");
    } catch (err) {
      console.error("❌ Camera failed:", err);
      alert("Camera permission is required on both devices");
      return;
    }
  }

  // Add local tracks
  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }
}

// ---------- Create Offer ----------
document.getElementById("createOffer").addEventListener("click", async () => {
  isCaller = true;
  await startCall();
});

// ---------- Join Offer ----------
document.getElementById("joinOffer").addEventListener("click", async () => {
  isCaller = false;
  await startCall();
});

async function startCall() {
  try {
    await connectSignaling();
    await startLocalCamera();
    await createPeer();

    if (isCaller) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await safeSend({ type: "offer", offer });
      console.log("📨 Offer created & sent ✅");
    } else {
      console.log("👂 Waiting for offer...");
    }
  } catch (e) {
    console.error("❌ Call start failed:", e);
  }
}

// ---------- Handle Offer ----------
async function handleOffer(offer) {
  try {
    await connectSignaling();
    if (!pc) await createPeer();

    if (pc.signalingState === "have-local-offer") {
      console.warn("⚠️ Rolling back before applying new offer");
      await Promise.all([
        pc.setLocalDescription({ type: "rollback" }),
        pc.setRemoteDescription(new RTCSessionDescription(offer))
      ]);
    } 
    else if (pc.signalingState !== "stable") {
      console.warn("⚠️ Not stable, skipping re-offer");
      return;
    } 
    else {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await safeSend({ type: "answer", answer });
    console.log("✅ Answer created & sent");
  } catch (e) {
    console.error("Offer handling failed ❌", e);
  }
}

// ---------- Hang Up ----------
document.getElementById("hangup").addEventListener("click", () => {
  if (pc) {
    pc.close();
    pc = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  console.log("📴 Call ended ❌");
});

// ---------- Toggle Camera Preview ----------
document.getElementById("toggleCameraPreview").addEventListener("change", e => {
  localVideo.srcObject = e.target.checked ? localStream : null;
});
