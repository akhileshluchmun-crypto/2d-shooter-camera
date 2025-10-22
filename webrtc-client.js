// webrtc-client.js — final working version
let localStream = null;
let pc = null;
let ws = null;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// ✅ Use your actual Render URL (yours was this)
const SIGNAL_URL = "wss://webrtc-signal-server-tdk6.onrender.com";

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

// ===== WebSocket Connection (with Promise to wait for ready) =====
function connectSignaling() {
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return resolve();
    }

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
      { urls: "turn:relay1.expressturn.com:3478", username: "efgh", credential: "efgh" } // optional relay
    ]
  });

  pc.onicecandidate = (e) => {
    if (e.candidate && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ice", candidate: e.candidate }));
      console.log("Sent ICE candidate");
    }
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

// ===== Offer Creation =====
document.getElementById("createOffer").addEventListener("click", async () => {
  try {
    console.log("Create Offer clicked");
    await connectSignaling();
    await createPeer();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "offer", offer }));
    console.log("Offer created & sent ✅");
  } catch (e) {
    console.error("Offer creation failed ❌", e);
  }
});

// ===== Handle Offer (Receiver) =====
async function handleOffer(offer) {
  try {
    console.log("Handling offer...");
    await connectSignaling();
    await createPeer();

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    ws.send(JSON.stringify({ type: "answer", answer }));
    console.log("Answer created & sent ✅");
  } catch (e) {
    console.error("Error handling offer ❌", e);
  }
}

// ===== Join Connection =====
document.getElementById("joinOffer").addEventListener("click", async () => {
  console.log("Join clicked");
  await connectSignaling();
});

// ===== Camera & Hangup Controls =====
document.getElementById("startLocalCamera").addEventListener("click", startLocalCamera);

document.getElementById("hangup").addEventListener("click", () => {
  if (pc) pc.close();
  if (ws) ws.close();
  console.log("Call ended ❌");
});

document.getElementById("toggleCameraPreview").addEventListener("change", (e) => {
  localVideo.srcObject = e.target.checked ? localStream : null;
});
