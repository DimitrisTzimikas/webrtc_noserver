"use strict";

/* ==============================
 Global Variables
 ================================ */
const AUDIO_ENABLED = false;
const VIDEO_ENABLED = true;

const constrains = {
  audio: AUDIO_ENABLED,
  video: VIDEO_ENABLED,
};

let disconnectButton = null;
let sendButton = null;
let createOfferButton = null;
let answerButton = null;
let copyOfferButton = null;
let copyAnswerOfferButton = null;
let sendFileButton = null;

let messageInputBox = null;
let offerInput = null;
let answerOfferInput = null;

let receiveBox = null;
let dataChannel = null;
let fileChannel = null;
let localVideo = null;
let remoteVideo = null;
let fileDownload = null;
let fileTransfer = null;

let sendFileDom = {};
let recFileDom = {};
let receiveBuffer = [];
let receivedSize = 0;
let theFile;

/* ===========================================================================
 This configuration is passed when we create a new peer connection object.
 It provides a set of servers used to establish a connection. STUN servers
 are used to discover our external IP address, and TURN servers (none listed
 here) are used to proxy a connection when a peer is behind a restrictive
 firewall that prevents a direct connection.
 These public STUN servers are not suitable for public use.
 ============================================================================= */
const peerConnectionConfig = {
  'iceServers': [
    { 'urls': 'stun:stun.l.google.com:19302' },
    /*{ 'urls': 'stun:stun1.l.google.com:19302' },
     { 'urls': 'stun:stun2.l.google.com:19302' },
     { 'urls': 'stun:stun3.l.google.com:19302' },
     { 'urls': 'stun:stun4.l.google.com:19302' },*/
  ],
};

//let peerConnectionConfig = {iceServers: [{urls: []}]};
let pc = new RTCPeerConnection(peerConnectionConfig);

/* ==============================
 Set things up, connect event listeners, etc.
 ================================ */
function startup() {
  disconnectButton = document.getElementById('disconnectButton');
  sendButton = document.getElementById('sendButton');
  answerButton = document.getElementById('answerButton');
  createOfferButton = document.getElementById('createOfferButton');
  copyOfferButton = document.getElementById('copyOfferButton');
  copyAnswerOfferButton = document.getElementById('copyAnswerOfferButton');
  sendFileButton = document.getElementById('sendFileButton');
  localVideo = document.getElementById('localVideo');
  remoteVideo = document.getElementById('remoteVideo');
  
  messageInputBox = document.getElementById('message');
  receiveBox = document.getElementById('receivebox');
  answerOfferInput = document.getElementById('answerOfferInput');
  offerInput = document.getElementById('offerInput');
  fileDownload = document.getElementById('fileDownload');
  fileTransfer = document.getElementById('fileTransfer');
  
  // Set event listeners for user interface widgets
  disconnectButton.addEventListener('click', disconnectPeers, false);
  sendButton.addEventListener('click', sendMessage, false);
  createOfferButton.addEventListener('click', createOffer, false);
  answerButton.addEventListener('click', createAnswer, false);
  copyOfferButton.addEventListener('click', copyOffer, false);
  copyAnswerOfferButton.addEventListener('click', copyAnswerOffer, false);
  sendFileButton.addEventListener('click', sendFile, false);
  fileTransfer.addEventListener('change', uploadFile, false);
}

function copy(id) {
  const copyText = document.getElementById(id);
  copyText.select();
  document.execCommand("copy");
}

function copyAnswerOffer() {
  copy('answerOfferInput');
}

function copyOffer() {
  copy('offerInput');
}

/* ======================================================
 Create Offer/Answer for peers
 ======================================================= */
async function createOffer() {
  dataChannel = pc.createDataChannel("dataChannel");
  fileChannel = pc.createDataChannel("fileChannel");
  
  dataChannelHandlers();
  fileChannelHandlers();
  
  try {
    const description = await pc.createOffer();
    await pc.setLocalDescription(description);
    console.log('setLocalDescription ok');
    
    setTimeout(() => {
      console.log("pc.iceGatheringState = " + pc.iceGatheringState);
      if (pc.iceGatheringState === "complete") {
        console.log('pc.iceGatheringState === "complete"');
      } else {
        console.log('after iceGathering Timeout');
        offerInput.value = JSON.stringify(pc.localDescription);
      }
    }, 2000);
  } catch (e) {console.log(e);}
}

async function createAnswer() {
  const remoteOffer = new RTCSessionDescription(JSON.parse(answerOfferInput.value));
  console.log('remoteOffer:\n', remoteOffer);
  
  try {
    await pc.setRemoteDescription(remoteOffer);
    console.log('setRemoteDescription ok');
    
    if (remoteOffer.type === "offer") {
      const description = await pc.createAnswer();
      await pc.setLocalDescription(description);
      
      console.log('createAnswer:\n', description);
    }
  } catch (e) {console.log(e);}
}

/* ======================================================
 Peers listeners
 ======================================================= */
pc.ondatachannel = function (event) {
  if (event.channel.label === "fileChannel") {
    console.log('fileChannel received: ', event);
    fileChannel = event.channel;
    fileChannelHandlers();
  }
  
  if (event.channel.label === "dataChannel") {
    console.log('dataChannel received: ', event);
    dataChannel = event.channel;
    dataChannelHandlers();
  }
};

pc.onicecandidate = function (event) {
  const candidate = event.candidate;
  
  if (!candidate) {
    console.log("pc.iceGatheringState = " + pc.iceGatheringState);
    //console.log(pc.localDescription);
    offerInput.value = JSON.stringify(pc.localDescription);
  } else {
    console.log(candidate.candidate);
  }
};

pc.oniceconnectionstatechange = function () {
  if (pc) {
    console.log('oniceconnectionstatechange:');
    console.log(pc.iceConnectionState);
    
    if (pc.iceConnectionState === "disconnected") {
      sendButton.disabled = true;
      sendFileButton.disabled = true;
      alert("You are disconnected with from partner");
    }
  }
};

pc.ontrack = function (event) {
  console.log('remote ontrack', event);
  
  if (remoteVideo.srcObject) return;
  remoteVideo.srcObject = event.streams[0];
};

pc.onconnectionstatechange = function (event) {
  console.log('onconnectionstatechange ', event);
};

function displayMessage(msg) {
  receivebox.innerHTML += "<pre class=sent>" + msg + "<" + "/pre>";
}

function dataChannelHandlers() {
  console.log('dataChannelHandlers: ' + JSON.stringify(dataChannel, null, '\t'));
  dataChannel.onopen = function (event) {
    console.log('data channel is open', event);
    
    messageInputBox.disabled = false;
    messageInputBox.focus();
    sendButton.disabled = false;
    disconnectButton.disabled = false;
  };
  
  dataChannel.onmessage = function (event) {
    displayMessage(event.data);
    console.log(event.data);
  };
  
  dataChannel.onclose = function () {
    console.log('data channel closed');
    
    messageInputBox.disabled = true;
    sendButton.disabled = true;
    disconnectButton.disabled = true;
    offerInput.value = '';
    answerOfferInput.value = '';
  };
}

/* ==============================
 File transfer
 ================================ */
function uploadFile() {
  const files = fileTransfer.files;
  if (files.length > 0) {
    theFile = files[0];
    sendFileDom.name = theFile.name;
    sendFileDom.size = theFile.size;
    sendFileDom.type = theFile.type;
    sendFileDom.fileInfo = "areYouReady";
    console.log(sendFileDom);
  } else {
    console.log('No file selected');
  }
}

function sendFile() {
  if (!fileTransfer.value) return;
  const fileInfo = JSON.stringify(sendFileDom);
  fileChannel.send(fileInfo);
  console.log('file sent');
}

function fileChannelHandlers() {
  fileChannel.onopen = function (event) {
    console.log('file channel is open', event);
  };
  
  fileChannel.onmessage = function (event) {
    // Figure out data type
    const type = Object.prototype.toString.call(event.data);
    let data;
    
    if (type === "[object ArrayBuffer]") {
      data = event.data;
      receiveBuffer.push(data);
      receivedSize += data.byteLength;
      recFileProg.value = receivedSize;
      if (receivedSize === recFileDom.size) {
        const received = new window.Blob(receiveBuffer);
        fileDownload.href = URL.createObjectURL(received);
        fileDownload.innerHTML = "download";
        fileDownload.download = recFileDom.name;
        
        receiveBuffer = [];
        receivedSize = 0;
      }
    } else if (type === "[object String]") {
      data = JSON.parse(event.data);
    }
    
    // Handle initial msg exchange
    if (data.fileInfo) {
      if (data.fileInfo === "areYouReady") {
        recFileDom = data;
        recFileProg.max = data.size;
        const sendData = JSON.stringify({ fileInfo: "readyToReceive" });
        fileChannel.send(sendData);
      } else if (data.fileInfo === "readyToReceive") {
        sendFileProg.max = sendFileDom.size;
        sendFileInChannel(); // Start sending the file
      }
      console.log('fileChannel: ', data.fileInfo);
    }
  };
  
  fileChannel.onclose = function () {
    console.log('file channel closed');
  };
}

function sendFileInChannel() {
  const chunkSize = 16384;
  let sliceFile = function (offset) {
    let reader = new window.FileReader();
    reader.onload = (function () {
      return function (event) {
        fileChannel.send(event.target.result);
        if (theFile.size > offset + event.target.result.byteLength) {
          window.setTimeout(sliceFile, 0, offset + chunkSize);
        }
        sendFileProg.value = offset + event.target.result.byteLength;
      };
    })(theFile);
    const slice = theFile.slice(offset, offset + chunkSize);
    reader.readAsArrayBuffer(slice);
  };
  sliceFile(0);
}

/* ========================================
 Transmitting a message to the remote peer.
 ========================================== */
function sendMessage() {
  const message = messageInputBox.value;
  displayMessage(message);
  dataChannel.send(message);
  
  // Clear the input box and re-focus it, so that we're
  // ready for the next message.
  messageInputBox.value = "";
  messageInputBox.focus();
}

/* ========================================================
 Close the connection, including channels if they're open.
 Also update the UI to reflect the disconnected status.
 ========================================================== */
function disconnectPeers() {
  // Close the RTCDataChannel if they're open.
  dataChannel.close();
  
  // Close the RTCPeerConnection
  pc.close();
  
  dataChannel = null;
  pc = null;
  
  // Update user interface elements
  disconnectButton.disabled = true;
  sendButton.disabled = true;
  
  messageInputBox.value = "";
  messageInputBox.disabled = true;
}

/* ==============================
 Get local Stream
 ================================ */
(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constrains);
    
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    
    localVideo.srcObject = stream;
  } catch (error) {console.log(error);}
})();

/* ==============================
 Set up an event listener which will run the startup
 function once the page is done loading.
 ================================ */
window.addEventListener('load', startup, false);
