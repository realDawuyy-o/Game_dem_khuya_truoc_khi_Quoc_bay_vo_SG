const lobbyForm = document.querySelector("#lobby-form");
const playerNameInput = document.querySelector("#player-name");
const nameStatus = document.querySelector("#name-status");
const openJoinButton = document.querySelector("#open-join");
const openHostButton = document.querySelector("#open-host");
const openSoloButton = document.querySelector("#open-solo");
const otherRoomsButton = document.querySelector("#other-rooms");
const roomDialog = document.querySelector("#room-dialog");
const dialogTitle = document.querySelector("#dialog-title");
const roomCodeLabel = document.querySelector("#room-code");
const roomModeLabel = document.querySelector("#room-mode");
const roomCloseButton = document.querySelector("#room-close");
const modePicker = document.querySelector("#mode-picker");
const modeCancelButton = document.querySelector("#mode-cancel");
const dialogNote = document.querySelector(".dialog-note");
const dialogActions = document.querySelector(".dialog-actions");
const roomMembers = document.querySelector("#room-members");
const memberCount = document.querySelector("#member-count");
const memberList = document.querySelector("#member-list");
const roomStatus = document.querySelector("#room-status");
const roomStartButton = document.querySelector("#room-start");
const gamePlay = document.querySelector("#game-play");
const gameStatus = document.querySelector("#game-status");
const roundHeading = document.querySelector("#round-heading");
const roundTimer = document.querySelector("#round-timer");
const roundAudio = document.querySelector("#round-audio");
const guessForm = document.querySelector("#guess-form");
const soundChoices = document.querySelector("#sound-choices");
const choicesPrompt = document.querySelector("#choices-prompt");
const submitGuessButton = document.querySelector("#submit-guess");
const roundResults = document.querySelector("#round-results");
const gameLeaderboard = document.querySelector("#game-leaderboard");
const gameScreen = document.querySelector("#game-screen");
const gamePlayerList = document.querySelector("#game-player-list");
const leaveGameButton = document.querySelector("#leave-game");
const joinForm = document.querySelector("#join-form");
const joinRoomCodeInput = document.querySelector("#join-room-code");
const copyCodeButton = document.querySelector("#copy-code");
const doneButton = document.querySelector("#dialog-done");
const menuToggle = document.querySelector("#menu-toggle");
const siteNav = document.querySelector("#site-nav");
const newsletterForm = document.querySelector("#newsletter-form");
const newsletterStatus = document.querySelector("#newsletter-status");
const characterInputs = document.querySelectorAll('input[name="character"]');
const muteToggle = document.querySelector("#mute-toggle");
const introAudio = document.querySelector("#intro-audio");
const readyScreen = document.querySelector("#ready-screen");
const startGameButton = document.querySelector("#start-game");
const lobbyPage = document.querySelector("#lobby-page");
const lobbyShell = document.querySelector(".lobby-shell");

const characterSprites = {
  krill: "magpie",
  remix: "koala",
  trumpet: "panda",
  bamboo: "tiger",
  maestro: "crane",
  boomer: "axolotl",
  howler: "jaguar",
  panpipe: "lemur",
  kalimba: "beaver",
  kiwi: "kiwi",
};

const gameModeNames = {
  sound_mix: "Sound Mix",
  beat_builder: "Beat Builder",
  animal_groove: "Animal Groove",
};

let activeRoomCode = "";
let roomSocket;
let currentRoomName = "";
let pendingRoomName = "";
let isSoloRoom = false;
let startSoloWhenReady = false;
let roomReady = false;
let roomHandshakeFailed = false;
let pendingHostName = "";
let pendingSoloMode = false;
let roundTimerId;
let audioContext;
let introHasStarted = false;
let introAutoplayBlocked = false;
const muteStorageKey = "badabum-muted";
let soundsMuted = readMutePreference();

function readMutePreference() {
  try {
    return window.localStorage.getItem(muteStorageKey) === "true";
  } catch (error) {
    if (!(error instanceof DOMException)) {
      throw error;
    }
    console.error("Unable to read the Badabum sound preference.", error);
    return false;
  }
}

function saveMutePreference() {
  try {
    window.localStorage.setItem(muteStorageKey, String(soundsMuted));
  } catch (error) {
    if (!(error instanceof DOMException)) {
      throw error;
    }
    console.error("Unable to save the Badabum sound preference.", error);
  }
}

function updateMuteToggle() {
  if (introAutoplayBlocked && !soundsMuted && !introHasStarted) {
    muteToggle.textContent = "PLAY INTRO";
    muteToggle.setAttribute("aria-pressed", "false");
    muteToggle.setAttribute("aria-label", "Play intro music");
    return;
  }

  muteToggle.textContent = soundsMuted ? "SOUND OFF" : "SOUND ON";
  muteToggle.setAttribute("aria-pressed", String(soundsMuted));
  muteToggle.setAttribute(
    "aria-label",
    soundsMuted ? "Unmute game sounds" : "Mute game sounds",
  );
}

function attemptIntroPlayback() {
  if (soundsMuted || introAudio.ended) {
    return;
  }

  introAudio.play().then(() => {
    introHasStarted = true;
    introAutoplayBlocked = false;
    updateMuteToggle();
  }).catch((error) => {
    if (error.name === "NotAllowedError") {
      introAutoplayBlocked = true;
      updateMuteToggle();
      return;
    }
    if (error.name === "AbortError" && soundsMuted) {
      return;
    }
    console.error("Unable to play the Badabum intro music.", error);
  });
}

introAudio.addEventListener("error", () => {
  console.error("Unable to load the Badabum intro music.", introAudio.error);
});

function playTone(context, frequency, duration, type = "sine", volume = 0.08, endFrequency) {
  const start = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) {
    oscillator.frequency.linearRampToValueAtTime(endFrequency, start + duration);
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function playHowler(context) {
  const start = context.currentTime;
  const oscillator = context.createOscillator();
  const vibrato = context.createOscillator();
  const vibratoGain = context.createGain();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(280, start);
  oscillator.frequency.linearRampToValueAtTime(430, start + 0.12);
  oscillator.frequency.linearRampToValueAtTime(300, start + 0.25);
  vibrato.frequency.value = 7;
  vibratoGain.gain.value = 12;
  vibrato.connect(vibratoGain);
  vibratoGain.connect(oscillator.frequency);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(0.07, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
  oscillator.connect(gain);
  gain.connect(context.destination);
  vibrato.start(start);
  oscillator.start(start);
  vibrato.stop(start + 0.25);
  oscillator.stop(start + 0.25);
}

function playPanpipe(context) {
  const start = context.currentTime;
  const noiseBuffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.22), context.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let index = 0; index < noiseData.length; index += 1) {
    noiseData[index] = Math.random() * 2 - 1;
  }

  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  noise.buffer = noiseBuffer;
  filter.type = "lowpass";
  filter.frequency.value = 1300;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(0.025, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  noise.start(start);
  noise.stop(start + 0.22);
  playTone(context, 480, 0.22, "sine", 0.045);
}

async function previewCharacter(characterId) {
  if (soundsMuted) {
    return;
  }

  if (!audioContext) {
    audioContext = new window.AudioContext();
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  switch (characterId) {
    case "krill":
      playTone(audioContext, 220, 0.22, "sine", 0.07);
      break;
    case "remix":
      playTone(audioContext, 520, 0.09, "sine", 0.07);
      window.setTimeout(() => playTone(audioContext, 760, 0.1, "sine", 0.07), 90);
      break;
    case "trumpet":
      playTone(audioContext, 180, 0.25, "sawtooth", 0.045, 440);
      break;
    case "bamboo":
      playTone(audioContext, 720, 0.18, "triangle", 0.075);
      break;
    case "maestro":
      playTone(audioContext, 392, 0.22, "triangle", 0.065);
      break;
    case "boomer":
      playTone(audioContext, 150, 0.19, "sine", 0.11, 55);
      break;
    case "howler":
      playHowler(audioContext);
      break;
    case "panpipe":
      playPanpipe(audioContext);
      break;
    case "kalimba":
      playTone(audioContext, 440, 0.2, "sine", 0.075);
      playTone(audioContext, 880, 0.17, "sine", 0.025);
      break;
    case "kiwi":
      playTone(audioContext, 260, 0.25, "sine", 0.07, 185);
      break;
  }
}

updateMuteToggle();
startGameButton.addEventListener("click", () => {
  readyScreen.hidden = true;
  lobbyPage.hidden = false;
  if (soundsMuted) {
    soundsMuted = false;
    saveMutePreference();
  }
  updateMuteToggle();
  attemptIntroPlayback();
});

muteToggle.addEventListener("click", () => {
  if (introAutoplayBlocked && !soundsMuted && !introHasStarted) {
    attemptIntroPlayback();
    return;
  }

  soundsMuted = !soundsMuted;
  saveMutePreference();
  updateMuteToggle();
  if (soundsMuted) {
    introAudio.pause();
  } else {
    attemptIntroPlayback();
  }
});

characterInputs.forEach((input) => {
  input.addEventListener("change", async () => {
    if (input.checked) {
      await previewCharacter(input.value);
    }
  });
});

function backendBaseURL() {
  const configuredBackend = document.querySelector('meta[name="game-backend"]').content.trim();
  if (configuredBackend) {
    return new URL(
      configuredBackend.includes("://")
        ? configuredBackend
        : `${window.location.protocol}//${configuredBackend}`,
    );
  }

  const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const origin = localHost
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : window.location.origin;
  return new URL(origin);
}

function openRoomDashboard(title) {
  dialogTitle.textContent = title;
  roomCodeLabel.textContent = "CONNECTING";
  roomCodeLabel.hidden = false;
  roomModeLabel.hidden = true;
  joinForm.hidden = true;
  modePicker.hidden = true;
  dialogNote.hidden = false;
  dialogActions.hidden = false;
  roomMembers.hidden = true;
  roomStartButton.hidden = true;
  gamePlay.hidden = true;
  gameScreen.hidden = true;
  lobbyShell.hidden = false;
  lobbyPage.classList.remove("is-playing");
  copyCodeButton.hidden = true;
  roomStatus.textContent = "Connecting to the game server...";
  roomStatus.hidden = false;
  roomStatus.classList.remove("is-error");
  roomMembers.hidden = false;
  memberCount.textContent = "0 / 32";
  memberList.replaceChildren();
  activeRoomCode = "";
  roomDialog.hidden = false;
  lobbyPage.classList.add("has-room-dashboard");
}

function openModePicker(playerName, solo = false) {
  openRoomDashboard("Choose a game mode");
  pendingHostName = playerName;
  pendingSoloMode = solo;
  roomCodeLabel.hidden = true;
  roomMembers.hidden = true;
  roomStatus.hidden = true;
  modePicker.hidden = false;
  dialogNote.hidden = true;
  dialogActions.hidden = true;
}

function openJoinDialog() {
  openRoomDashboard("Join a game");
  roomCodeLabel.hidden = true;
  roomMembers.hidden = true;
  joinForm.hidden = false;
  roomStatus.textContent = "Enter the four-letter room code.";
  joinRoomCodeInput.value = "";
  joinRoomCodeInput.focus();
}

function sendRoomMessage(message) {
  if (roomSocket?.readyState !== WebSocket.OPEN) {
    roomStatus.textContent = "Not connected to the game server.";
    roomStatus.classList.add("is-error");
    return false;
  }
  roomStatus.classList.remove("is-error");
  gameStatus.classList.remove("is-error");
  roomSocket.send(JSON.stringify(message));
  return true;
}

function connectRoom(message, solo = false) {
  stopRoundTimer();
  roundAudio.pause();
  roundAudio.removeAttribute("src");
  roundAudio.load();
  roundResults.hidden = true;
  gameLeaderboard.hidden = true;
  guessForm.hidden = false;
  gameStatus.textContent = "";
  gameStatus.classList.remove("is-error");
  if (roomSocket && roomSocket.readyState < WebSocket.CLOSING) {
    roomSocket.close(1000, "Switching rooms");
  }
  roomSocket = null;
  message.character = document.querySelector('input[name="character"]:checked').value;
  openRoomDashboard(message.type === "create" ? "Your room" : "Joining room");
  currentRoomName = message.name;
  pendingRoomName = "";
  isSoloRoom = solo;
  startSoloWhenReady = solo;
  roomReady = false;
  roomHandshakeFailed = false;

  let socket;
  try {
    const backend = backendBaseURL();
    const endpoint = new URL("/ws", backend);
    endpoint.protocol = backend.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(endpoint);
  } catch (error) {
    console.error("Unable to create the game server connection.", error);
    roomStatus.textContent = "The game server address is invalid.";
    roomStatus.classList.add("is-error");
    return;
  }
  roomSocket = socket;
  socket.addEventListener("open", () => {
    if (roomSocket === socket) {
      socket.send(JSON.stringify(message));
    }
  });
  socket.addEventListener("message", (event) => {
    if (roomSocket !== socket) {
      return;
    }
    let response;
    try {
      response = JSON.parse(event.data);
    } catch (error) {
      console.error("The game server sent invalid JSON.", error);
      roomStatus.textContent = "Received an invalid response from the game server.";
      roomStatus.classList.add("is-error");
      return;
    }
    handleServerMessage(response);
  });
  socket.addEventListener("error", () => {
    if (roomSocket === socket) {
      if (!roomReady) {
        roomHandshakeFailed = true;
      }
      roomStatus.textContent = "Could not connect to the game server.";
      roomStatus.classList.add("is-error");
    }
  });
  socket.addEventListener("close", () => {
    if (roomSocket === socket) {
      roomSocket = null;
      if (!roomHandshakeFailed) {
        roomStatus.textContent = "Disconnected from the game server.";
        roomStatus.classList.add("is-error");
      }
    }
  });
}

function stopRoundTimer() {
  if (roundTimerId !== undefined) {
    window.clearInterval(roundTimerId);
    roundTimerId = undefined;
  }
}

function showRoundCountdown(endsAt) {
  stopRoundTimer();
  const update = () => {
    const remaining = Math.max(0, endsAt - Date.now());
    roundTimer.textContent = `${Math.ceil(remaining / 1000)}s`;
  };
  update();
  roundTimerId = window.setInterval(update, 250);
}

function showGameScreen(isPlaying) {
  gameScreen.hidden = !isPlaying;
  lobbyShell.hidden = isPlaying;
  roomDialog.hidden = isPlaying;
  lobbyPage.classList.toggle("is-playing", isPlaying);
}

function createAvatar(character) {
  const svgNS = "http://www.w3.org/2000/svg";
  const avatar = document.createElementNS(svgNS, "svg");
  const use = document.createElementNS(svgNS, "use");
  avatar.classList.add("player-avatar");
  avatar.setAttribute("viewBox", "0 0 24 24");
  avatar.setAttribute("aria-hidden", "true");
  use.setAttribute("href", `#sprite-${characterSprites[character] ?? characterSprites.krill}`);
  avatar.append(use);
  return avatar;
}

function renderRoomState(state) {
  roomReady = true;
  if (pendingRoomName && state.players.some((player) => player.name === pendingRoomName)) {
    currentRoomName = pendingRoomName;
    pendingRoomName = "";
  }
  activeRoomCode = state.code;
  roomCodeLabel.textContent = state.code;
  roomCodeLabel.hidden = false;
  roomModeLabel.textContent = `MODE · ${gameModeNames[state.mode] ?? state.mode}`;
  roomModeLabel.hidden = false;
  copyCodeButton.hidden = !isSoloRoom && state.host !== currentRoomName;
  memberCount.textContent = `${state.players.length} / ${state.maxPlayers}`;
  memberList.replaceChildren();
  gamePlayerList.replaceChildren();

  state.players.forEach((player) => {
    const item = document.createElement("li");
    const identity = document.createElement("span");
    identity.className = "member-identity";
    identity.append(createAvatar(player.character));
    const name = document.createElement("span");
    name.textContent = player.name + (player.connected ? "" : " (disconnected)");
    identity.append(name);
    item.append(identity);
    if (player.name === state.host) {
      const badge = document.createElement("span");
      badge.className = "member-host";
      badge.textContent = "HOST";
      item.append(badge);
    }
    memberList.append(item);

    const gameItem = document.createElement("li");
    const gameIdentity = document.createElement("span");
    gameIdentity.className = "score-identity";
    gameIdentity.append(createAvatar(player.character));
    const gameName = document.createElement("span");
    gameName.className = "game-player-name";
    gameName.textContent = player.name;
    gameIdentity.append(gameName);
    const score = document.createElement("span");
    score.className = "game-player-score";
    score.textContent = String(player.score);
    gameItem.append(gameIdentity, score);
    gamePlayerList.append(gameItem);
  });

  const isPlaying = state.phase !== "lobby";
  showGameScreen(isPlaying);
  roomStartButton.hidden = state.host !== currentRoomName || isPlaying;
  roomStartButton.disabled =
    !isSoloRoom && state.players.filter((player) => player.connected).length < state.minPlayers;
  roomStartButton.textContent = isSoloRoom ? "Start solo test" : "Start game";
  roomStatus.classList.remove("is-error");
  if (state.phase === "lobby") {
    roomStatus.textContent = roomStartButton.disabled
      ? "Waiting for at least one more player."
      : "Room is ready.";
  } else {
    roomStatus.textContent = `Round ${state.round} of ${state.totalRounds}`;
  }

  if (!isPlaying) {
    gamePlay.hidden = true;
    stopRoundTimer();
  } else {
    gamePlay.hidden = false;
  }

  if (startSoloWhenReady && state.phase === "lobby" && state.host === currentRoomName) {
    startSoloWhenReady = false;
    sendRoomMessage({ type: "start" });
  }
}

function renderRoundStart(round) {
  showGameScreen(true);
  gamePlay.hidden = false;
  roomStartButton.hidden = true;
  roundHeading.textContent = `ROUND ${round.round} / ${round.totalRounds}`;
  gameStatus.textContent = `Select up to ${round.count} sound${round.count === 1 ? "" : "s"}.`;
  choicesPrompt.textContent = `Which ${round.count} sound${round.count === 1 ? "" : "s"} do you hear?`;
  roundResults.hidden = true;
  gameLeaderboard.hidden = true;
  gameStatus.classList.remove("is-error");
  guessForm.hidden = false;
  submitGuessButton.disabled = false;
  soundChoices.replaceChildren();
  const legend = document.createElement("legend");
  legend.id = "choices-prompt";
  legend.textContent = choicesPrompt.textContent;
  soundChoices.append(legend);

  round.choices.forEach((choice) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "sound";
    checkbox.value = choice;
    checkbox.addEventListener("change", () => {
      const checked = soundChoices.querySelectorAll('input[name="sound"]:checked');
      if (checked.length > round.count) {
        checkbox.checked = false;
        gameStatus.textContent = `Choose no more than ${round.count} sounds.`;
      }
    });
    const text = document.createElement("span");
    text.textContent = choice.replaceAll("_", " ");
    label.append(checkbox, text);
    soundChoices.append(label);
  });

  const audioURL = new URL(round.audioUrl, backendBaseURL());
  roundAudio.src = audioURL.href;
  roundAudio.load();
  introAudio.pause();
  roundAudio.play().catch((error) => {
    if (error.name !== "NotAllowedError") {
      console.error("Unable to play the round audio.", error);
      gameStatus.textContent = "Audio could not be played. Use the audio controls to try again.";
    }
  });
  showRoundCountdown(round.endsAt);
}

function renderRoundEnd(round) {
  stopRoundTimer();
  roundTimer.textContent = "";
  guessForm.hidden = true;
  roundResults.hidden = false;
  const answerItem = document.createElement("li");
  answerItem.textContent = `Answer: ${round.answer.join(", ")}`;
  roundResults.replaceChildren(answerItem);
  round.results.forEach((result) => {
    const item = document.createElement("li");
    const identity = document.createElement("span");
    identity.className = "score-identity";
    identity.append(createAvatar(result.character));
    const summary = document.createElement("span");
    summary.textContent = `${result.name}: ${result.picks ? result.picks.join(", ") : "No answer"} (+${result.points})`;
    identity.append(summary);
    item.append(identity);
    roundResults.append(item);
  });
  gameStatus.textContent = "Round complete. Next round starts shortly.";
}

function renderGameOver(game) {
  gameLeaderboard.replaceChildren();
  game.leaderboard.forEach((player, index) => {
    const item = document.createElement("li");
    const identity = document.createElement("span");
    identity.className = "score-identity";
    identity.append(createAvatar(player.character));
    const name = document.createElement("span");
    name.textContent = `${index + 1}. ${player.name} — ${player.score}`;
    identity.append(name);
    item.append(identity);
    gameLeaderboard.append(item);
  });
  gameLeaderboard.hidden = false;
  gamePlay.hidden = false;
  showGameScreen(true);
  gameStatus.textContent = "Game over. Final scores:";
}

function handleServerMessage(message) {
  switch (message.type) {
    case "room_state":
      renderRoomState(message);
      break;
    case "round_start":
      renderRoundStart(message);
      break;
    case "round_end":
      renderRoundEnd(message);
      break;
    case "game_over":
      renderGameOver(message);
      break;
    case "error":
      pendingRoomName = "";
      if (!roomReady) {
        roomHandshakeFailed = true;
      }
      roomStatus.textContent = message.message;
      roomStatus.classList.add("is-error");
      gameStatus.textContent = message.message;
      gameStatus.classList.add("is-error");
      break;
    default:
      console.error("The game server sent an unknown message type.", message);
      roomStatus.textContent = "Received an unknown response from the game server.";
      roomStatus.classList.add("is-error");
  }
}

function closeRoomDashboard() {
  const socket = roomSocket;
  roomSocket = null;
  if (socket && socket.readyState < WebSocket.CLOSING) {
    socket.close(1000, "Leaving room");
  }
  stopRoundTimer();
  roundAudio.pause();
  roundAudio.removeAttribute("src");
  roundAudio.load();
  roomDialog.hidden = true;
  gameScreen.hidden = true;
  lobbyShell.hidden = false;
  lobbyPage.classList.remove("is-playing");
  lobbyPage.classList.remove("has-room-dashboard");
  copyCodeButton.textContent = "Copy code";
  activeRoomCode = "";
  currentRoomName = "";
  pendingHostName = "";
  pendingSoloMode = false;
  isSoloRoom = false;
  startSoloWhenReady = false;
}

function closeMenu() {
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
  siteNav.classList.remove("is-open");
}

function confirmPlayerName() {
  const playerName = playerNameInput.value.trim();
  if (!playerName) {
    playerNameInput.setCustomValidity("Enter a name.");
    playerNameInput.reportValidity();
    playerNameInput.addEventListener(
      "input",
      () => playerNameInput.setCustomValidity(""),
      { once: true },
    );
    return "";
  }

  playerNameInput.setCustomValidity("");
  playerNameInput.value = playerName;
  nameStatus.textContent = `Name confirmed: ${playerName}`;
  if (roomSocket && playerName !== currentRoomName) {
    if (sendRoomMessage({ type: "rename", name: playerName })) {
      pendingRoomName = playerName;
    }
  }
  return playerName;
}

playerNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    confirmPlayerName();
  }
});

playerNameInput.addEventListener("input", () => {
  nameStatus.textContent = "";
});

joinRoomCodeInput.addEventListener("input", () => {
  joinRoomCodeInput.value = joinRoomCodeInput.value.toUpperCase();
  joinRoomCodeInput.setCustomValidity("");
});

lobbyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  confirmPlayerName();
});

openHostButton.addEventListener("click", () => {
  const playerName = confirmPlayerName();
  if (!playerName) {
    return;
  }
  openModePicker(playerName);
});

openSoloButton.addEventListener("click", () => {
  const playerName = confirmPlayerName();
  if (!playerName) {
    return;
  }
  openModePicker(playerName, true);
});

modePicker.addEventListener("click", (event) => {
  const option = event.target.closest("[data-game-mode]");
  if (!option || option.disabled || !pendingHostName) {
    return;
  }
  connectRoom(
    {
      type: "create",
      name: pendingHostName,
      mode: option.dataset.gameMode,
      solo: pendingSoloMode,
    },
    pendingSoloMode,
  );
});

modeCancelButton.addEventListener("click", closeRoomDashboard);

function showJoinDialog() {
  if (!confirmPlayerName()) {
    return;
  }
  openJoinDialog();
}

openJoinButton.addEventListener("click", showJoinDialog);
otherRoomsButton.addEventListener("click", showJoinDialog);

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const roomCode = joinRoomCodeInput.value.trim().toUpperCase();
  if (!/^[A-HJ-NP-Z]{4}$/.test(roomCode)) {
    joinRoomCodeInput.setCustomValidity("Enter a valid 4-character room code.");
    joinRoomCodeInput.reportValidity();
    joinRoomCodeInput.addEventListener(
      "input",
      () => joinRoomCodeInput.setCustomValidity(""),
      { once: true },
    );
    return;
  }

  joinRoomCodeInput.setCustomValidity("");
  const playerName = confirmPlayerName();
  if (!playerName) {
    return;
  }
  connectRoom({ type: "join", room: roomCode, name: playerName });
});

roomStartButton.addEventListener("click", () => {
  sendRoomMessage({ type: "start" });
});

guessForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const picks = Array.from(
    soundChoices.querySelectorAll('input[name="sound"]:checked'),
    (input) => input.value,
  );
  if (picks.length === 0) {
    gameStatus.textContent = "Choose at least one sound before submitting.";
    return;
  }
  if (sendRoomMessage({ type: "guess", picks })) {
    submitGuessButton.disabled = true;
    soundChoices.querySelectorAll("input").forEach((input) => {
      input.disabled = true;
    });
    gameStatus.textContent = "Answer locked in.";
  }
});

copyCodeButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(activeRoomCode);
    copyCodeButton.textContent = "Copied";
  } catch (error) {
    console.error("Unable to copy the room code.", error);
    copyCodeButton.textContent = "Copy failed";
  }
});

doneButton.addEventListener("click", () => {
  closeRoomDashboard();
});

roomCloseButton.addEventListener("click", closeRoomDashboard);
leaveGameButton.addEventListener("click", closeRoomDashboard);

menuToggle.addEventListener("click", () => {
  const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isExpanded));
  menuToggle.setAttribute("aria-label", isExpanded ? "Open navigation" : "Close navigation");
  siteNav.classList.toggle("is-open", !isExpanded);

  if (!isExpanded) {
    siteNav.querySelector("a").focus();
  }
});

siteNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    closeMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !roomDialog.hidden) {
    closeRoomDashboard();
  }

  if (event.key === "Escape" && siteNav.classList.contains("is-open")) {
    closeMenu();
    menuToggle.focus();
  }
});

newsletterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  newsletterStatus.textContent =
    "Thanks for trying it. This preview isn’t connected to a mailing list yet.";
});

if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.body.classList.add("js-ready");
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );

  document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));
} else {
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
}
