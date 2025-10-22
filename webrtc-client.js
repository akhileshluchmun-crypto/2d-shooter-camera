let localStream = null;
let pc = null;
let ws = null;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const SIGNAL_URL = "wss://webrtc-signal-server-tdk6.onrender.com";

// ✅ Utility: waits until WebSocket is open before sending
async function safeSend(message) {
  if (!ws) throw new Error("WebSocket not initialized");
  if (ws.readyState === WebSocket.CONNECTING) {
    await new Promise((resolve) => {
      ws.addEventListener("open", resolve, { once: true });
    });
  }
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    console.error("Cannot send, WebSocket not open:", ws.readyState);
  }
}

// ===== Camera Setup =====
async function startLocalCamera() {
  try {
    console.log("Requesting camera...");
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    localVideo.srcObject = localStream;
    document.getElementById('toggleCameraPreview').checked = true;
    console.log("Camera started ✅");
  } catch (err) {
    console.error("Camera error:", err);
    alert("Camera access failed: " + err.message);
  }
}

// ===== WebSocket Connection =====
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
    };
    ws.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);
      console.log("Received:", data.type);
      if (data.type === "offer") await handleOffer(data.offer);
      else if (data.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log("Answer applied ✅");
      } else if (data.type === "ice") {
        try {
          await pc.addIceCandidate(data.candidate);
          console.log("ICE candidate added");
        } catch (e) {
          console.warn("ICE add error:", e);
        }
      }
    };
  });
}

// ===== Peer Connection =====
async function createPeer() {
  console.log("Creating RTCPeerConnection");
  pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "turn:relay1.expressturn.com:3478", username: "efgh", credential: "efgh" }
    ]
  });

  pc.onicecandidate = (e) => {
    if (e.candidate) safeSend({ type: "ice", candidate: e.candidate });
  };

  pc.ontrack = (e) => {
    console.log("Remote track received 🎥");
    remoteVideo.srcObject = e.streams[0];
  };

  if (localStream) {
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }
  }
}

// ===== Create Offer =====
document.getElementById("createOffer").addEventListener("click", async () => {
  try {
    console.log("Create Offer clicked");
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

// ===== Handle Offer =====
async function handleOffer(offer) {
  try {
    console.log("Handling offer...");
    await connectSignaling();
    await createPeer();

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await safeSend({ type: "answer", answer });
    console.log("Answer created & sent ✅");
  } catch (e) {
    console.error("Error handling offer ❌", e);
  }
}

// ===== Join =====
document.getElementById("joinOffer").addEventListener("click", async () => {
  console.log("Join clicked");
  await connectSignaling();
});

// ===== Camera & Hangup =====
document.getElementById("startLocalCamera").addEventListener("click", startLocalCamera);
document.getElementById("hangup").addEventListener("click", () => {
  if (pc) pc.close();
  if (ws) ws.close();
  console.log("Call ended ❌");
});
document.getElementById("toggleCameraPreview").addEventListener("change", (e) => {
  localVideo.srcObject = e.target.checked ? localStream : null;
});
