const lobbyForm = document.querySelector("#lobby-form");
const playerNameInput = document.querySelector("#player-name");
const roomDialog = document.querySelector("#room-dialog");
const dialogTitle = document.querySelector("#dialog-title");
const roomCodeLabel = document.querySelector("#room-code");
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

let activeRoomCode = "";
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

if (!soundsMuted) {
  attemptIntroPlayback();
}

function createRoomCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(5);
  window.crypto.getRandomValues(values);
  return Array.from(values, (value) => characters[value % characters.length]).join("");
}

function openRoomDialog(title, roomCode) {
  dialogTitle.textContent = title;
  roomCodeLabel.textContent = roomCode;
  roomCodeLabel.hidden = false;
  joinForm.hidden = true;
  activeRoomCode = roomCode;

  if (!roomDialog.open) {
    roomDialog.showModal();
  }
}

function openJoinDialog() {
  dialogTitle.textContent = "Join a game";
  roomCodeLabel.hidden = true;
  joinForm.hidden = false;
  copyCodeButton.hidden = true;
  joinRoomCodeInput.value = "";
  roomDialog.showModal();
  joinRoomCodeInput.focus();
}

function closeMenu() {
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
  siteNav.classList.remove("is-open");
}

lobbyForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const playerName = playerNameInput.value.trim();
  if (!playerName) {
    playerNameInput.setCustomValidity("Enter a name.");
    playerNameInput.reportValidity();
    playerNameInput.addEventListener(
      "input",
      () => playerNameInput.setCustomValidity(""),
      { once: true },
    );
    return;
  }

  playerNameInput.value = playerName;
  const action = event.submitter.value;

  if (action === "host") {
    copyCodeButton.textContent = "Copy code";
    openRoomDialog("Your room code", createRoomCode());
    copyCodeButton.hidden = false;
    return;
  }

  openJoinDialog();
});

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const roomCode = joinRoomCodeInput.value.trim();
  if (!roomCode) {
    joinRoomCodeInput.setCustomValidity("Enter a room code.");
    joinRoomCodeInput.reportValidity();
    joinRoomCodeInput.addEventListener(
      "input",
      () => joinRoomCodeInput.setCustomValidity(""),
      { once: true },
    );
    return;
  }

  joinRoomCodeInput.setCustomValidity("");
  openRoomDialog("Join request", roomCode.toUpperCase());
  copyCodeButton.hidden = true;
});

copyCodeButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(activeRoomCode);
    copyCodeButton.textContent = "Copied";
  } catch {
    copyCodeButton.textContent = "Copy failed";
  }
});

doneButton.addEventListener("click", () => {
  roomDialog.close();
  copyCodeButton.textContent = "Copy code";
});

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
