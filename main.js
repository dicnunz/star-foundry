// =========================
// Game State
// =========================

const gameState = {
  stardust: 0,
  productionMultiplier: 1, // future upgrades can increase this
  lastUpdate: Date.now(),

  automations: [
    {
      key: "drone",
      name: "Drone",
      desc: "Small autonomous miner that scoops raw plasma.",
      baseCost: 10,
      count: 0,
      baseSPS: 0.1, // stardust per second per unit
    },
    {
      key: "refinery",
      name: "Refinery",
      desc: "Refines stellar plasma into dense Stardust.",
      baseCost: 100,
      count: 0,
      baseSPS: 1,
    },
    {
      key: "orbitalArray",
      name: "Orbital Array",
      desc: "Massive ring collectors locked in orbit.",
      baseCost: 1000,
      count: 0,
      baseSPS: 8,
    },
  ],
};

// how fast cost scales each time you buy the same automation
const COST_GROWTH = 1.15;
const AUTO_SAVE_INTERVAL_MS = 30 * 1000; // 30 seconds
const OFFLINE_PROGRESS_CAP_SECONDS = 12 * 60 * 60; // 12 hours

// DOM refs
const stardustDisplay = document.getElementById("stardustDisplay");
const spsDisplay = document.getElementById("spsDisplay");
const coreButton = document.getElementById("coreButton");
const shopList = document.getElementById("shopList");

const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const resetBtn = document.getElementById("resetBtn");
const statusMessage = document.getElementById("statusMessage");

const shopElements = new Map();
let statusTimeoutId = null;
let autoSaveIntervalId = null;

// =========================
// Utility math
// =========================

function computeAutomationCost(autoData) {
  // cost = baseCost * (COST_GROWTH ^ count)
  return autoData.baseCost * Math.pow(COST_GROWTH, autoData.count);
}

function computeAutomationSPS(autoData) {
  return autoData.baseSPS * autoData.count;
}

function computeTotalSPS() {
  let total = 0;
  for (const a of gameState.automations) {
    total += computeAutomationSPS(a);
  }
  total *= gameState.productionMultiplier;
  return total;
}

function formatNumber(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "0";
  if (value === 0) return "0";

  if (value >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(2) + "B";
  }
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + "M";
  }
  if (value >= 1_000) {
    return Math.floor(value).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });
  }
  if (value >= 10) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }
  if (Number.isInteger(value)) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const remSeconds = totalSeconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) {
    return `${hours}h ${remMinutes}m`;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
}

// =========================
// Game actions
// =========================

function manualExtractClick() {
  // base click yields 1 Stardust
  gameState.stardust += 1;
  render();
}

function buyAutomation(key) {
  const a = gameState.automations.find(x => x.key === key);
  if (!a) return;
  const cost = computeAutomationCost(a);

  if (gameState.stardust >= cost) {
    gameState.stardust -= cost;
    a.count += 1;
    render();
    saveGame();
  }
}

// =========================
// Rendering
// =========================

function renderTopBar() {
  stardustDisplay.textContent = formatNumber(gameState.stardust);
  spsDisplay.textContent = formatNumber(computeTotalSPS());
}

function buildShop() {
  shopList.innerHTML = "";
  shopElements.clear();

  for (const a of gameState.automations) {
    const item = document.createElement("div");
    item.className = "shop-item";

    const left = document.createElement("div");
    left.className = "shop-left";

    const titleRow = document.createElement("div");
    titleRow.className = "shop-title-row";

    const nameEl = document.createElement("div");
    nameEl.className = "shop-name";
    nameEl.textContent = a.name;

    const ownedEl = document.createElement("div");
    ownedEl.className = "shop-owned";
    ownedEl.textContent = "owned: " + a.count;

    titleRow.appendChild(nameEl);
    titleRow.appendChild(ownedEl);

    const descEl = document.createElement("div");
    descEl.className = "shop-desc";
    descEl.textContent = a.desc;

    const statsRow = document.createElement("div");
    statsRow.className = "shop-stats-row";
    statsRow.innerHTML =
      "Yield: " +
      formatNumber(a.baseSPS) +
      " /s each<br>Current total: " +
      formatNumber(computeAutomationSPS(a)) +
      " /s";

    left.appendChild(titleRow);
    left.appendChild(descEl);
    left.appendChild(statsRow);

    const right = document.createElement("div");
    right.className = "buy-area";

    const costLabel = document.createElement("div");
    costLabel.className = "cost-label";
    costLabel.textContent = "Cost";

    const costValue = document.createElement("div");
    costValue.className = "cost-value";
    const initialCost = computeAutomationCost(a);
    costValue.textContent = formatNumber(initialCost) + " Stardust";
    const btn = document.createElement("button");
    btn.className = "buy-btn";
    btn.textContent = "Buy";
    btn.disabled = gameState.stardust < initialCost;
    btn.addEventListener("click", () => buyAutomation(a.key));

    right.appendChild(costLabel);
    right.appendChild(costValue);
    right.appendChild(btn);

    item.appendChild(left);
    item.appendChild(right);

    shopList.appendChild(item);

    shopElements.set(a.key, {
      ownedEl,
      statsRow,
      costValue,
      button: btn,
      lastCount: a.count,
    });
  }
}

function updateShopDetails() {
  for (const a of gameState.automations) {
    const entry = shopElements.get(a.key);
    if (!entry) continue;

    const cost = computeAutomationCost(a);

    if (entry.lastCount !== a.count) {
      entry.ownedEl.textContent = "owned: " + a.count;
      entry.statsRow.innerHTML =
        "Yield: " +
        formatNumber(a.baseSPS) +
        " /s each<br>Current total: " +
        formatNumber(computeAutomationSPS(a)) +
        " /s";

      entry.costValue.textContent = formatNumber(cost) + " Stardust";
      entry.lastCount = a.count;
    }

    if (entry.button) {
      entry.button.disabled = gameState.stardust < cost;
    }
  }
}

function showStatus(message) {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.classList.add("visible");

  if (statusTimeoutId) {
    clearTimeout(statusTimeoutId);
  }
  statusTimeoutId = setTimeout(() => {
    statusMessage.classList.remove("visible");
  }, 4000);
}

function render() {
  renderTopBar();
  updateShopDetails();
}

// =========================
// Passive generation loop
// =========================

function tick() {
  const now = Date.now();
  const deltaMs = now - gameState.lastUpdate;
  gameState.lastUpdate = now;

  // convert deltaMs to seconds
  const deltaSec = deltaMs / 1000;

  // gain = totalSPS * deltaSec
  const gain = computeTotalSPS() * deltaSec;
  gameState.stardust += gain;

  render();
  requestAnimationFrame(tick);
}

// =========================
// Save / Load / Reset
// =========================

function saveGame(options = {}) {
  const { showFeedback = false } = options;
  try {
    const snapshot = {
      ...gameState,
      lastUpdate: Date.now(),
    };
    const data = JSON.stringify(snapshot);
    localStorage.setItem("starFoundrySave", data);
    if (showFeedback) {
      showStatus("Game saved.");
    }
  } catch (e) {
    if (showFeedback) {
      showStatus("Unable to save (storage unavailable).");
    }
  }
}

function loadGame(options = {}) {
  const { showFeedback = false } = options;
  let raw;
  try {
    raw = localStorage.getItem("starFoundrySave");
  } catch (e) {
    if (showFeedback) {
      showStatus("Unable to access save data.");
    }
    return false;
  }

  if (!raw) {
    if (showFeedback) {
      showStatus("No save found.");
    }
    return false;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    if (showFeedback) {
      showStatus("Save data is corrupt.");
    }
    return false;
  }

  let loadedSomething = false;

  if (typeof parsed.stardust === "number" && Number.isFinite(parsed.stardust)) {
    gameState.stardust = Math.max(0, parsed.stardust);
    loadedSomething = true;
  }

  if (
    typeof parsed.productionMultiplier === "number" &&
    Number.isFinite(parsed.productionMultiplier)
  ) {
    gameState.productionMultiplier = Math.max(0, parsed.productionMultiplier);
  }

  if (Array.isArray(parsed.automations)) {
    for (const savedAuto of parsed.automations) {
      const localAuto = gameState.automations.find(a => a.key === savedAuto.key);
      if (!localAuto) continue;

      if (typeof savedAuto.count === "number" && Number.isFinite(savedAuto.count)) {
        localAuto.count = Math.max(0, Math.floor(savedAuto.count));
        loadedSomething = true;
      }
    }
  }

  let offlineMessage = null;
  if (typeof parsed.lastUpdate === "number" && Number.isFinite(parsed.lastUpdate)) {
    let offlineSeconds = (Date.now() - parsed.lastUpdate) / 1000;
    offlineSeconds = Math.max(0, Math.min(offlineSeconds, OFFLINE_PROGRESS_CAP_SECONDS));

    if (offlineSeconds >= 1) {
      const offlineGain = computeTotalSPS() * offlineSeconds;
      if (offlineGain > 0.01) {
        gameState.stardust += offlineGain;
        offlineMessage =
          "Recovered " +
          formatNumber(offlineGain) +
          " Stardust while away (" +
          formatDuration(offlineSeconds) +
          ")";
      }
    }
  }

  gameState.lastUpdate = Date.now();
  render();

  if (offlineMessage) {
    showStatus(offlineMessage);
  } else if (showFeedback) {
    showStatus("Save loaded.");
  }

  saveGame();
  return loadedSomething;
}

function resetGame() {
  if (!confirm("Reset all progress?")) return;

  gameState.stardust = 0;
  gameState.productionMultiplier = 1;
  for (const a of gameState.automations) {
    a.count = 0;
  }
  gameState.lastUpdate = Date.now();
  render();
  saveGame();
  showStatus("Progress reset.");
}

function startAutoSaveLoop() {
  if (autoSaveIntervalId) {
    clearInterval(autoSaveIntervalId);
  }
  autoSaveIntervalId = setInterval(() => {
    saveGame();
  }, AUTO_SAVE_INTERVAL_MS);
}

// =========================
// Init
// =========================

coreButton.addEventListener("click", manualExtractClick);
saveBtn.addEventListener("click", () => {
  saveGame({ showFeedback: true });
});
loadBtn.addEventListener("click", () => {
  loadGame({ showFeedback: true });
});
resetBtn.addEventListener("click", resetGame);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveGame();
  }
});

window.addEventListener("beforeunload", () => {
  saveGame();
});

// initial render and load
buildShop();
render();
loadGame();
startAutoSaveLoop();
// start loop
gameState.lastUpdate = Date.now();
requestAnimationFrame(tick);
