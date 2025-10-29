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

// DOM refs
const stardustDisplay = document.getElementById("stardustDisplay");
const spsDisplay = document.getElementById("spsDisplay");
const coreButton = document.getElementById("coreButton");
const shopList = document.getElementById("shopList");

const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const resetBtn = document.getElementById("resetBtn");

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
  // simple formatter for readability
  if (n >= 1_000_000_000) {
    return (n / 1_000_000_000).toFixed(2) + "B";
  }
  if (n >= 1_000_000) {
    return (n / 1_000_000).toFixed(2) + "M";
  }
  if (n >= 1_000) {
    return (n / 1_000).toFixed(2) + "K";
  }
  return Math.floor(n).toString();
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
  }
}

// =========================
// Rendering
// =========================

function renderTopBar() {
  stardustDisplay.textContent = formatNumber(gameState.stardust);
  spsDisplay.textContent = computeTotalSPS().toFixed(2);
}

function renderShop() {
  // clear
  shopList.innerHTML = "";

  for (const a of gameState.automations) {
    const cost = computeAutomationCost(a);
    const canAfford = gameState.stardust >= cost;

    // container
    const item = document.createElement("div");
    item.className = "shop-item";

    // left side
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
      a.baseSPS +
      " /s each<br>Current total: " +
      computeAutomationSPS(a).toFixed(2) +
      " /s";

    left.appendChild(titleRow);
    left.appendChild(descEl);
    left.appendChild(statsRow);

    // right side
    const right = document.createElement("div");
    right.className = "buy-area";

    const costLabel = document.createElement("div");
    costLabel.className = "cost-label";
    costLabel.textContent = "Cost";

    const costValue = document.createElement("div");
    costValue.className = "cost-value";
    costValue.textContent = formatNumber(cost) + " Stardust";

    const btn = document.createElement("button");
    btn.className = "buy-btn";
    btn.textContent = "Buy";
    btn.disabled = !canAfford;
    btn.addEventListener("click", () => buyAutomation(a.key));

    right.appendChild(costLabel);
    right.appendChild(costValue);
    right.appendChild(btn);

    // assemble
    item.appendChild(left);
    item.appendChild(right);

    shopList.appendChild(item);
  }
}

function render() {
  renderTopBar();
  renderShop();
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

function saveGame() {
  const data = JSON.stringify(gameState);
  try {
    localStorage.setItem("starFoundrySave", data);
  } catch (e) {
    // ignore quota or privacy mode errors
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem("starFoundrySave");
    if (!raw) return;
    const parsed = JSON.parse(raw);

    // minimal schema validation to avoid crashes
    if (typeof parsed.stardust === "number") {
      gameState.stardust = parsed.stardust;
    }
    if (typeof parsed.productionMultiplier === "number") {
      gameState.productionMultiplier = parsed.productionMultiplier;
    }
    if (Array.isArray(parsed.automations)) {
      for (const savedAuto of parsed.automations) {
        const localAuto = gameState.automations.find(
          a => a.key === savedAuto.key
        );
        if (!localAuto) continue;
        if (typeof savedAuto.count === "number") {
          localAuto.count = savedAuto.count;
        }
      }
    }
  } catch (e) {
    // ignore invalid JSON
  }
  render();
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
}

// =========================
// Init
// =========================

coreButton.addEventListener("click", manualExtractClick);
saveBtn.addEventListener("click", () => {
  saveGame();
  render();
});
loadBtn.addEventListener("click", () => {
  loadGame();
  render();
});
resetBtn.addEventListener("click", () => {
  resetGame();
  render();
});

// initial render and load
loadGame();
render();
// start loop
gameState.lastUpdate = Date.now();
requestAnimationFrame(tick);
