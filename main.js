// =========================
// Game Data & Constants
// =========================

const COST_GROWTH_DEFAULT = 1.16;
const AUTO_SAVE_INTERVAL_MS = 30 * 1000;
const OFFLINE_PROGRESS_CAP_SECONDS = 12 * 60 * 60; // 12 hours
const ENERGY_STORAGE_CAP = 1e12;
const SAVE_KEYS = {
  primary: "starFoundrySaveV2",
  legacy: "starFoundrySave",
};
const MAX_LOG_ENTRIES = 8;

const AUTOMATION_BLUEPRINTS = [
  {
    key: "drone",
    name: "Helios Drone Wing",
    description:
      "Autonomous collectors skim the stellar surface, hauling raw plasma to staging bays.",
    baseCost: { stardust: 25 },
    costGrowth: 1.15,
    outputs: { stardust: 0.9 },
  },
  {
    key: "refinery",
    name: "Plasma Refinery",
    description:
      "Stabilizes volatile plasma into refined Stardust ingots ready for export convoys.",
    baseCost: { stardust: 180, energy: 35 },
    costGrowth: 1.18,
    outputs: { stardust: 6 },
  },
  {
    key: "reactor",
    name: "Tri-Core Reactor",
    description:
      "A magnetic dynamo that channels stellar flares into dependable energy reserves.",
    baseCost: { stardust: 260 },
    costGrowth: 1.19,
    outputs: { energy: 4.5 },
  },
  {
    key: "orbitalArray",
    name: "Eclipse Orbital Array",
    description:
      "Massive orbital rings harvest solar winds and compress them into Stardust streams.",
    baseCost: { stardust: 980, energy: 180 },
    costGrowth: 1.2,
    outputs: { stardust: 28 },
  },
  {
    key: "researchLab",
    name: "Quantum Research Lab",
    description:
      "Dedicated thinkers feed on stellar data, trading energy for breakthrough research.",
    baseCost: { stardust: 720, energy: 140 },
    costGrowth: 1.21,
    outputs: { research: 1.8 },
    energyUpkeep: 3.2,
  },
  {
    key: "quantumForge",
    name: "Aetherforge Spire",
    description:
      "A megastructure that forges Stardust into exotic alloys while decoding cosmic truths.",
    baseCost: { stardust: 3400, energy: 520 },
    costGrowth: 1.22,
    outputs: { stardust: 60, research: 1 },
    energyUpkeep: 6,
    requiresUpgrade: "stellarMegastructure",
  },
];

const UPGRADE_DATA = [
  {
    key: "precisionExtraction",
    name: "Precision Extraction Protocols",
    description: "Manual pulses yield +2 Stardust and +1 Stellar Energy.",
    cost: { research: 45 },
    effects: {
      clickPower: 2,
      clickEnergy: 1,
    },
  },
  {
    key: "droneOverseer",
    name: "Helios Overseer AI",
    description: "Helios Drone Wings output 150% more Stardust.",
    cost: { research: 120 },
    effects: {
      automationMultipliers: { drone: 1.5 },
    },
  },
  {
    key: "refineryCatalysts",
    name: "Refinery Flux Catalysts",
    description: "Plasma Refineries output 90% more Stardust.",
    cost: { research: 190 },
    effects: {
      automationMultipliers: { refinery: 1.9 },
    },
  },
  {
    key: "stellarContainment",
    name: "Stellar Containment Grid",
    description: "All Stardust production increased by 55%.",
    cost: { research: 260 },
    effects: {
      globalMultipliers: { stardust: 1.55 },
    },
  },
  {
    key: "deepfieldSimulations",
    name: "Deepfield Simulation Array",
    description: "Research facilities generate 70% more insights.",
    cost: { research: 360 },
    effects: {
      globalMultipliers: { research: 1.7 },
    },
  },
  {
    key: "singularityCapacitors",
    name: "Singularity Capacitors",
    description: "Reactors output 120% more energy reserves.",
    cost: { research: 420 },
    effects: {
      automationMultipliers: { reactor: 2.2 },
      globalMultipliers: { energy: 1.1 },
    },
  },
  {
    key: "stellarMegastructure",
    name: "Aetherforge Megastructure",
    description: "Unlocks the Aetherforge Spire and boosts all production by 40%.",
    cost: { research: 620 },
    effects: {
      globalMultipliers: { stardust: 1.4, energy: 1.2, research: 1.3 },
    },
  },
];

// =========================
// Game State
// =========================

const gameState = {
  stardust: 0,
  energy: 0,
  research: 0,
  lastUpdate: Date.now(),
  automations: AUTOMATION_BLUEPRINTS.map(blueprint => ({ key: blueprint.key, count: 0 })),
  purchasedUpgrades: [],
  log: [],
  clickPower: 1,
  clickEnergyGain: 0,
  clickResearchGain: 0,
  globalMultipliers: {
    stardust: 1,
    energy: 1,
    research: 1,
  },
  automationMultipliers: Object.fromEntries(
    AUTOMATION_BLUEPRINTS.map(blueprint => [blueprint.key, 1])
  ),
};

let statusTimeoutId = null;
let autoSaveIntervalId = null;
let energyWarningCooldown = 0;
let lastTickMetrics = {
  rates: { stardust: 0, energy: 0, research: 0 },
  energyUpkeep: 0,
  energyConsumptionRate: 0,
  energyRatio: 1,
  netEnergyRate: 0,
};

// =========================
// DOM References
// =========================

const stardustDisplay = document.getElementById("stardustDisplay");
const stardustRateDisplay = document.getElementById("stardustRateDisplay");
const energyDisplay = document.getElementById("energyDisplay");
const energyRateDisplay = document.getElementById("energyRateDisplay");
const researchDisplay = document.getElementById("researchDisplay");
const researchRateDisplay = document.getElementById("researchRateDisplay");
const clickYieldDisplay = document.getElementById("clickYieldDisplay");
const automationList = document.getElementById("automationList");
const upgradeList = document.getElementById("upgradeList");
const eventLog = document.getElementById("eventLog");
const statusMessage = document.getElementById("statusMessage");
const coreButton = document.getElementById("coreButton");
const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const resetBtn = document.getElementById("resetBtn");
const energyCard = document.querySelector(".resource-card[data-resource='energy']");

const automationElements = new Map();
const upgradeElements = new Map();

// =========================
// Utility Helpers
// =========================

function getAutomationBlueprint(key) {
  return AUTOMATION_BLUEPRINTS.find(blueprint => blueprint.key === key) || null;
}

function getUpgradeDefinition(key) {
  return UPGRADE_DATA.find(upgrade => upgrade.key === key) || null;
}

function getAutomationState(key) {
  return gameState.automations.find(auto => auto.key === key) || null;
}

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  const abs = Math.abs(num);
  if (abs >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return Math.round(num).toLocaleString();
  if (abs >= 10) return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatSignedRate(value) {
  const num = Number(value) || 0;
  const sign = num >= 0 ? "+" : "−";
  return `${sign}${formatNumber(Math.abs(num))} /s`;
}

function formatResourceName(resource) {
  switch (resource) {
    case "stardust":
      return "Stardust";
    case "energy":
      return "Energy";
    case "research":
      return "Research";
    default:
      return resource;
  }
}

function formatResourceMap(map, suffix = "") {
  const parts = [];
  for (const [resource, amount] of Object.entries(map)) {
    if (!amount) continue;
    const label = formatResourceName(resource);
    const suffixText = suffix ? ` ${suffix}` : "";
    parts.push(`${formatNumber(amount)} ${label}${suffixText}`);
  }
  return parts.join(" • ");
}

function computeAutomationCost(blueprint, ownedCount) {
  const growth = blueprint.costGrowth ?? COST_GROWTH_DEFAULT;
  const scale = Math.pow(growth, ownedCount);
  const cost = {};
  for (const [resource, base] of Object.entries(blueprint.baseCost)) {
    cost[resource] = Math.ceil(base * scale);
  }
  return cost;
}

function canAffordCost(cost) {
  if (!cost) return true;
  for (const [resource, amount] of Object.entries(cost)) {
    const available = gameState[resource];
    if (typeof available !== "number" || available < amount) {
      return false;
    }
  }
  return true;
}

function spendResources(cost) {
  for (const [resource, amount] of Object.entries(cost)) {
    if (typeof gameState[resource] === "number") {
      gameState[resource] = Math.max(0, gameState[resource] - amount);
    }
  }
}

function isAutomationUnlocked(blueprint) {
  if (!blueprint.requiresUpgrade) return true;
  return gameState.purchasedUpgrades.includes(blueprint.requiresUpgrade);
}

function computeAutomationOutputs(blueprint, count = 1) {
  const multiplier = gameState.automationMultipliers[blueprint.key] ?? 1;
  const outputs = {};
  for (const [resource, baseRate] of Object.entries(blueprint.outputs || {})) {
    const globalMultiplier = gameState.globalMultipliers[resource] ?? 1;
    outputs[resource] = baseRate * multiplier * globalMultiplier * count;
  }
  return outputs;
}

function computeAutomationUpkeep(blueprint, count = 1) {
  const multiplier = gameState.automationMultipliers[blueprint.key] ?? 1;
  const upkeep = blueprint.energyUpkeep || 0;
  return upkeep * multiplier * count;
}

function computeAutomationContributions() {
  const contributions = [];
  for (const blueprint of AUTOMATION_BLUEPRINTS) {
    const state = getAutomationState(blueprint.key);
    const count = state ? state.count : 0;
    if (!count) continue;
    const outputs = computeAutomationOutputs(blueprint, count);
    const upkeep = computeAutomationUpkeep(blueprint, count);
    contributions.push({ blueprint, outputs, upkeep });
  }
  return contributions;
}
function describeDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${remMinutes}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
}

// =========================
// Logging & Status Feedback
// =========================

function logEvent(message) {
  if (!message) return;
  const timestamp = new Date().toISOString();
  gameState.log.unshift({ message, timestamp });
  if (gameState.log.length > MAX_LOG_ENTRIES) {
    gameState.log.length = MAX_LOG_ENTRIES;
  }
  renderEventLog();
}

function renderEventLog() {
  if (!eventLog) return;
  eventLog.innerHTML = "";
  for (const entry of gameState.log) {
    const row = document.createElement("div");
    row.className = "log-entry";
    const timeEl = document.createElement("time");
    const time = new Date(entry.timestamp);
    timeEl.textContent = Number.isNaN(time.getTime())
      ? "--:--"
      : time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const messageEl = document.createElement("div");
    messageEl.textContent = entry.message;
    row.appendChild(timeEl);
    row.appendChild(messageEl);
    eventLog.appendChild(row);
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
  }, 4200);
}

// =========================
// Rendering Helpers
// =========================

function renderResources() {
  if (stardustDisplay) {
    stardustDisplay.textContent = formatNumber(gameState.stardust);
  }
  if (stardustRateDisplay) {
    stardustRateDisplay.textContent = formatSignedRate(lastTickMetrics.rates.stardust);
  }
  if (energyDisplay) {
    energyDisplay.textContent = formatNumber(gameState.energy);
  }
  if (energyRateDisplay) {
    energyRateDisplay.textContent = `${formatSignedRate(lastTickMetrics.netEnergyRate)} net`;
  }
  if (energyCard) {
    const detail =
      `Production ${formatNumber(lastTickMetrics.rates.energy)} /s • Upkeep ${formatNumber(
        lastTickMetrics.energyConsumptionRate
      )} /s`;
    energyCard.title = detail;
  }
  if (researchDisplay) {
    researchDisplay.textContent = formatNumber(gameState.research);
  }
  if (researchRateDisplay) {
    researchRateDisplay.textContent = formatSignedRate(lastTickMetrics.rates.research);
  }
}

function renderClickYield() {
  if (!clickYieldDisplay) return;
  const parts = [];
  if (gameState.clickPower > 0) {
    parts.push(`+${formatNumber(gameState.clickPower)} Stardust`);
  }
  if (gameState.clickEnergyGain > 0) {
    parts.push(`+${formatNumber(gameState.clickEnergyGain)} Energy`);
  }
  if (gameState.clickResearchGain > 0) {
    parts.push(`+${formatNumber(gameState.clickResearchGain)} Research`);
  }
  clickYieldDisplay.textContent = parts.join(" • ") || "+0";
}

function buildAutomationCards() {
  if (!automationList) return;
  automationList.innerHTML = "";
  automationElements.clear();

  for (const blueprint of AUTOMATION_BLUEPRINTS) {
    const card = document.createElement("div");
    card.className = "card automation-card";

    const header = document.createElement("div");
    header.className = "card-header";

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = blueprint.name;

    const countEl = document.createElement("div");
    countEl.className = "card-count";
    countEl.textContent = "Owned: 0";

    header.appendChild(title);
    header.appendChild(countEl);
    card.appendChild(header);

    const desc = document.createElement("div");
    desc.className = "card-description";
    desc.textContent = blueprint.description;
    card.appendChild(desc);

    const stats = document.createElement("div");
    stats.className = "card-stats";

    const perUnitLine = document.createElement("div");
    perUnitLine.className = "card-stat-line";
    const perUnitLabel = document.createElement("strong");
    perUnitLabel.textContent = "Per Unit Output";
    const perUnitValue = document.createElement("span");
    perUnitValue.textContent = "";
    perUnitLine.appendChild(perUnitLabel);
    perUnitLine.appendChild(perUnitValue);

    const totalLine = document.createElement("div");
    totalLine.className = "card-stat-line";
    const totalLabel = document.createElement("strong");
    totalLabel.textContent = "Total Output";
    const totalValue = document.createElement("span");
    totalValue.textContent = "0";
    totalLine.appendChild(totalLabel);
    totalLine.appendChild(totalValue);

    stats.appendChild(perUnitLine);
    stats.appendChild(totalLine);

    let upkeepContainer = null;
    let upkeepValue = null;
    if (blueprint.energyUpkeep) {
      upkeepContainer = document.createElement("div");
      upkeepContainer.className = "card-stat-line";
      const upkeepLabel = document.createElement("strong");
      upkeepLabel.textContent = "Energy Upkeep";
      upkeepValue = document.createElement("span");
      upkeepValue.textContent = "";
      upkeepContainer.appendChild(upkeepLabel);
      upkeepContainer.appendChild(upkeepValue);
      stats.appendChild(upkeepContainer);
    }

    const efficiencyLine = document.createElement("div");
    efficiencyLine.className = "card-stat-line";
    efficiencyLine.style.display = "none";
    const efficiencyLabel = document.createElement("strong");
    efficiencyLabel.textContent = "Operational Efficiency";
    const efficiencyValue = document.createElement("span");
    efficiencyLine.appendChild(efficiencyLabel);
    efficiencyLine.appendChild(efficiencyValue);
    stats.appendChild(efficiencyLine);

    card.appendChild(stats);

    const footer = document.createElement("div");
    footer.className = "card-footer";

    const costDisplay = document.createElement("div");
    costDisplay.className = "cost-display";
    costDisplay.textContent = "Cost: -";

    const button = document.createElement("button");
    button.className = "buy-btn";
    button.textContent = "Deploy";
    button.addEventListener("click", () => buyAutomation(blueprint.key));

    footer.appendChild(costDisplay);
    footer.appendChild(button);
    card.appendChild(footer);

    automationList.appendChild(card);

    automationElements.set(blueprint.key, {
      card,
      countEl,
      perUnitValue,
      totalValue,
      upkeepValue,
      efficiencyLine,
      efficiencyValue,
      costDisplay,
      button,
    });
  }
}
function updateAutomationCards() {
  for (const blueprint of AUTOMATION_BLUEPRINTS) {
    const elements = automationElements.get(blueprint.key);
    if (!elements) continue;

    const state = getAutomationState(blueprint.key);
    const owned = state ? state.count : 0;
    const unlocked = isAutomationUnlocked(blueprint);

    elements.card.classList.toggle("locked", !unlocked);

    if (elements.countEl) {
      elements.countEl.textContent = unlocked ? `Owned: ${owned}` : "Locked";
    }

    const perUnitOutputs = computeAutomationOutputs(blueprint, 1);
    const perUnitText = formatResourceMap(perUnitOutputs, "/s") || "0";
    if (elements.perUnitValue) {
      elements.perUnitValue.textContent = perUnitText;
    }

    const totalOutputs = computeAutomationOutputs(blueprint, owned);
    const totalText = owned > 0 ? formatResourceMap(totalOutputs, "/s") : "--";
    if (elements.totalValue) {
      elements.totalValue.textContent = totalText || "--";
    }

    if (elements.upkeepValue) {
      const upkeepEach = computeAutomationUpkeep(blueprint, 1);
      const upkeepTotal = computeAutomationUpkeep(blueprint, owned);
      const upkeepParts = [];
      if (upkeepEach) {
        upkeepParts.push(`${formatNumber(upkeepEach)} Energy /s each`);
      }
      if (upkeepTotal) {
        upkeepParts.push(`${formatNumber(upkeepTotal)} Energy /s total`);
      }
      elements.upkeepValue.textContent = upkeepParts.join(" • ") || "0";
    }

    if (elements.efficiencyLine && elements.efficiencyValue) {
      if (blueprint.energyUpkeep && owned > 0 && lastTickMetrics.energyRatio < 0.999) {
        const percent = Math.round(lastTickMetrics.energyRatio * 100);
        elements.efficiencyLine.style.display = "flex";
        elements.efficiencyValue.textContent = `${percent}% (energy limited)`;
      } else {
        elements.efficiencyLine.style.display = "none";
      }
    }

    const cost = computeAutomationCost(blueprint, owned);
    if (elements.costDisplay) {
      if (!unlocked) {
        const requirement = getUpgradeDefinition(blueprint.requiresUpgrade);
        elements.costDisplay.textContent = requirement
          ? `Requires ${requirement.name}`
          : "Locked";
      } else {
        elements.costDisplay.textContent = `Cost: ${formatResourceMap(cost)}`;
      }
    }

    if (elements.button) {
      if (!unlocked) {
        elements.button.disabled = true;
        elements.button.textContent = "Locked";
      } else {
        elements.button.textContent = "Deploy";
        elements.button.disabled = !canAffordCost(cost);
      }
    }
  }
}

function buildUpgradeCards() {
  if (!upgradeList) return;
  upgradeList.innerHTML = "";
  upgradeElements.clear();

  for (const upgrade of UPGRADE_DATA) {
    const card = document.createElement("div");
    card.className = "card upgrade-card";

    const header = document.createElement("div");
    header.className = "card-header";

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = upgrade.name;

    const status = document.createElement("div");
    status.className = "upgrade-status";
    status.textContent = "Available";

    header.appendChild(title);
    header.appendChild(status);
    card.appendChild(header);

    const desc = document.createElement("div");
    desc.className = "card-description";
    desc.textContent = upgrade.description;
    card.appendChild(desc);

    const footer = document.createElement("div");
    footer.className = "card-footer";

    const costDisplay = document.createElement("div");
    costDisplay.className = "cost-display";
    costDisplay.textContent = `Cost: ${formatResourceMap(upgrade.cost)}`;

    const button = document.createElement("button");
    button.className = "buy-btn";
    button.textContent = "Research";
    button.addEventListener("click", () => purchaseUpgrade(upgrade.key));

    footer.appendChild(costDisplay);
    footer.appendChild(button);
    card.appendChild(footer);

    upgradeList.appendChild(card);

    upgradeElements.set(upgrade.key, {
      card,
      status,
      costDisplay,
      button,
    });
  }
}

function updateUpgradeCards() {
  for (const upgrade of UPGRADE_DATA) {
    const elements = upgradeElements.get(upgrade.key);
    if (!elements) continue;

    const purchased = gameState.purchasedUpgrades.includes(upgrade.key);
    if (elements.card) {
      elements.card.classList.toggle("purchased", purchased);
    }
    if (elements.status) {
      elements.status.textContent = purchased ? "Purchased" : "Available";
    }
    if (elements.button) {
      if (purchased) {
        elements.button.disabled = true;
        elements.button.textContent = "Installed";
      } else {
        elements.button.disabled = !canAffordCost(upgrade.cost);
        elements.button.textContent = "Research";
      }
    }
    if (elements.costDisplay) {
      elements.costDisplay.textContent = `Cost: ${formatResourceMap(upgrade.cost)}`;
    }
  }
}

function render() {
  renderResources();
  renderClickYield();
  updateAutomationCards();
  updateUpgradeCards();
}

// =========================
// Game Mechanics
// =========================

function manualExtractClick() {
  gameState.stardust += gameState.clickPower;
  if (gameState.clickEnergyGain > 0) {
    gameState.energy = Math.min(ENERGY_STORAGE_CAP, gameState.energy + gameState.clickEnergyGain);
  }
  if (gameState.clickResearchGain > 0) {
    gameState.research += gameState.clickResearchGain;
  }
  render();
}

function buyAutomation(key) {
  const blueprint = getAutomationBlueprint(key);
  const state = getAutomationState(key);
  if (!blueprint || !state) return;
  if (!isAutomationUnlocked(blueprint)) {
    showStatus("Automation requires additional research.");
    return;
  }

  const cost = computeAutomationCost(blueprint, state.count);
  if (!canAffordCost(cost)) {
    showStatus("Insufficient resources.");
    return;
  }

  spendResources(cost);
  state.count += 1;
  logEvent(`${blueprint.name} deployed. Infrastructure scaling.`);
  render();
  saveGame();
}

function purchaseUpgrade(key) {
  const upgrade = getUpgradeDefinition(key);
  if (!upgrade) return;
  if (gameState.purchasedUpgrades.includes(key)) return;
  if (!canAffordCost(upgrade.cost)) {
    showStatus("Research data insufficient.");
    return;
  }

  spendResources(upgrade.cost);
  gameState.purchasedUpgrades.push(key);
  recalculateUpgradeEffects();
  logEvent(`${upgrade.name} integrated into the command network.`);
  showStatus(`${upgrade.name} researched.`);
  render();
  saveGame();
}

function recalculateUpgradeEffects() {
  gameState.clickPower = 1;
  gameState.clickEnergyGain = 0;
  gameState.clickResearchGain = 0;
  gameState.globalMultipliers = {
    stardust: 1,
    energy: 1,
    research: 1,
  };
  gameState.automationMultipliers = Object.fromEntries(
    AUTOMATION_BLUEPRINTS.map(blueprint => [blueprint.key, 1])
  );

  for (const key of gameState.purchasedUpgrades) {
    const upgrade = getUpgradeDefinition(key);
    if (!upgrade) continue;
    const effects = upgrade.effects || {};

    if (typeof effects.clickPower === "number") {
      gameState.clickPower += effects.clickPower;
    }
    if (typeof effects.clickEnergy === "number") {
      gameState.clickEnergyGain += effects.clickEnergy;
    }
    if (typeof effects.clickResearch === "number") {
      gameState.clickResearchGain += effects.clickResearch;
    }

    if (effects.globalMultipliers) {
      for (const [resource, multiplier] of Object.entries(effects.globalMultipliers)) {
        if (typeof multiplier === "number" && multiplier > 0) {
          gameState.globalMultipliers[resource] =
            (gameState.globalMultipliers[resource] || 1) * multiplier;
        }
      }
    }

    if (effects.automationMultipliers) {
      for (const [keyName, multiplier] of Object.entries(effects.automationMultipliers)) {
        if (typeof multiplier === "number" && multiplier > 0) {
          gameState.automationMultipliers[keyName] =
            (gameState.automationMultipliers[keyName] || 1) * multiplier;
        }
      }
    }
  }
}
function computeRatesSnapshot() {
  const contributions = computeAutomationContributions();
  const rates = { stardust: 0, energy: 0, research: 0 };
  let energyUpkeepRate = 0;

  for (const contribution of contributions) {
    for (const [resource, amount] of Object.entries(contribution.outputs)) {
      rates[resource] += amount;
    }
    energyUpkeepRate += contribution.upkeep || 0;
  }

  return { contributions, rates, energyUpkeepRate };
}

function applyDelta(deltaSeconds, options = {}) {
  if (deltaSeconds <= 0) {
    return {
      rates: lastTickMetrics.rates,
      energyUpkeep: lastTickMetrics.energyUpkeep,
      energyConsumptionRate: lastTickMetrics.energyConsumptionRate,
      energyRatio: lastTickMetrics.energyRatio,
      netEnergyRate: lastTickMetrics.netEnergyRate,
      stardustGain: 0,
      researchGain: 0,
      netEnergyGain: 0,
    };
  }

  const { contributions, rates: theoreticalRates, energyUpkeepRate } = computeRatesSnapshot();

  const prevEnergy = gameState.energy;
  const energyProducedRate = theoreticalRates.energy;
  const energyProduced = energyProducedRate * deltaSeconds;
  const energyRequired = energyUpkeepRate * deltaSeconds;
  const energyAvailable = prevEnergy + energyProduced;
  const energySpent = Math.min(energyAvailable, energyRequired);
  const energyRatio = energyRequired > 0 ? energySpent / energyRequired : 1;
  const actualEnergyConsumptionRate = energyRequired > 0 ? energySpent / deltaSeconds : 0;

  const actualRates = { stardust: 0, energy: energyProducedRate, research: 0 };

  for (const contribution of contributions) {
    const scaling = contribution.upkeep ? energyRatio : 1;
    const outputs = contribution.outputs;
    if (outputs.stardust) {
      actualRates.stardust += outputs.stardust * scaling;
    }
    if (outputs.energy) {
      actualRates.energy += outputs.energy * (scaling - 1); // adjust only if scaling differs
    }
    if (outputs.research) {
      actualRates.research += outputs.research * scaling;
    }
  }

  const stardustGain = actualRates.stardust * deltaSeconds;
  const researchGain = actualRates.research * deltaSeconds;
  const energyAfterConsumption = Math.max(0, energyAvailable - energySpent);
  const energyFinal = Math.min(ENERGY_STORAGE_CAP, energyAfterConsumption);
  const netEnergyGain = energyFinal - prevEnergy;

  gameState.stardust += stardustGain;
  gameState.research += researchGain;
  gameState.energy = energyFinal;

  const netEnergyRate = actualRates.energy - actualEnergyConsumptionRate;

  return {
    rates: actualRates,
    energyUpkeep: energyUpkeepRate,
    energyConsumptionRate: actualEnergyConsumptionRate,
    energyRatio,
    netEnergyRate,
    stardustGain,
    researchGain,
    netEnergyGain,
  };
}

function tick() {
  const now = Date.now();
  const deltaSeconds = (now - gameState.lastUpdate) / 1000;
  gameState.lastUpdate = now;

  const metrics = applyDelta(deltaSeconds);
  lastTickMetrics = metrics;

  if (metrics.energyRatio < 0.98) {
    energyWarningCooldown = Math.max(0, energyWarningCooldown - deltaSeconds);
    if (energyWarningCooldown <= 0) {
      showStatus("Energy reserves strained. Research throughput reduced.");
      logEvent("Energy reserves strained; some facilities are idling.");
      energyWarningCooldown = 12;
    }
  } else {
    energyWarningCooldown = Math.max(0, energyWarningCooldown - deltaSeconds);
  }

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
      version: 2,
      stardust: gameState.stardust,
      energy: gameState.energy,
      research: gameState.research,
      automations: gameState.automations,
      purchasedUpgrades: gameState.purchasedUpgrades,
      log: gameState.log,
      lastUpdate: Date.now(),
    };
    localStorage.setItem(SAVE_KEYS.primary, JSON.stringify(snapshot));
    if (showFeedback) {
      showStatus("Game saved.");
    }
  } catch (error) {
    if (showFeedback) {
      showStatus("Unable to save — storage unavailable.");
    }
  }
}

function loadLegacySave(raw) {
  try {
    const legacy = JSON.parse(raw);
    if (!legacy || typeof legacy !== "object") return false;

    if (typeof legacy.stardust === "number") {
      gameState.stardust = Math.max(0, legacy.stardust);
    }
    if (Array.isArray(legacy.automations)) {
      for (const auto of legacy.automations) {
        if (!auto || typeof auto.key !== "string") continue;
        const state = getAutomationState(auto.key);
        if (!state) continue;
        if (typeof auto.count === "number" && Number.isFinite(auto.count)) {
          state.count = Math.max(0, Math.floor(auto.count));
        }
      }
    }
    if (typeof legacy.productionMultiplier === "number") {
      const multiplier = Math.max(1, legacy.productionMultiplier);
      gameState.globalMultipliers.stardust *= multiplier;
    }
    return true;
  } catch (error) {
    return false;
  }
}

function loadGame(options = {}) {
  const { showFeedback = false } = options;
  let raw = null;
  let usedLegacy = false;

  try {
    raw = localStorage.getItem(SAVE_KEYS.primary);
  } catch (error) {
    if (showFeedback) {
      showStatus("Unable to access save data.");
    }
    return false;
  }

  if (!raw) {
    try {
      raw = localStorage.getItem(SAVE_KEYS.legacy);
      usedLegacy = Boolean(raw);
    } catch (error) {
      // ignore
    }
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
  } catch (error) {
    if (usedLegacy) {
      const success = loadLegacySave(raw);
      if (success) {
        recalculateUpgradeEffects();
        render();
        saveGame();
        showStatus("Legacy save imported.");
        logEvent("Legacy systems imported into the new command deck.");
        return true;
      }
    }
    if (showFeedback) {
      showStatus("Save data is corrupt.");
    }
    return false;
  }

  if (!parsed || typeof parsed !== "object") {
    if (showFeedback) {
      showStatus("Save data is invalid.");
    }
    return false;
  }

  if (typeof parsed.stardust === "number" && Number.isFinite(parsed.stardust)) {
    gameState.stardust = Math.max(0, parsed.stardust);
  }
  if (typeof parsed.energy === "number" && Number.isFinite(parsed.energy)) {
    gameState.energy = Math.max(0, parsed.energy);
  }
  if (typeof parsed.research === "number" && Number.isFinite(parsed.research)) {
    gameState.research = Math.max(0, parsed.research);
  }

  if (Array.isArray(parsed.automations)) {
    for (const auto of parsed.automations) {
      if (!auto || typeof auto.key !== "string") continue;
      const state = getAutomationState(auto.key);
      if (!state) continue;
      if (typeof auto.count === "number" && Number.isFinite(auto.count)) {
        state.count = Math.max(0, Math.floor(auto.count));
      }
    }
  }

  if (Array.isArray(parsed.purchasedUpgrades)) {
    const filtered = parsed.purchasedUpgrades.filter(
      key => typeof key === "string" && getUpgradeDefinition(key)
    );
    gameState.purchasedUpgrades = Array.from(new Set(filtered)).slice(0, 32);
  }

  if (Array.isArray(parsed.log)) {
    gameState.log = parsed.log
      .map(entry => ({
        message: String(entry.message || ""),
        timestamp: entry.timestamp || new Date().toISOString(),
      }))
      .slice(0, MAX_LOG_ENTRIES);
  }

  recalculateUpgradeEffects();

  let offlineMessage = null;
  if (typeof parsed.lastUpdate === "number" && Number.isFinite(parsed.lastUpdate)) {
    let deltaSeconds = (Date.now() - parsed.lastUpdate) / 1000;
    deltaSeconds = Math.max(0, Math.min(deltaSeconds, OFFLINE_PROGRESS_CAP_SECONDS));
    if (deltaSeconds > 1) {
      const metrics = applyDelta(deltaSeconds, { offline: true });
      lastTickMetrics = metrics;
      const stardustRecovered = metrics.stardustGain;
      const researchRecovered = metrics.researchGain;
      const energyChange = metrics.netEnergyGain;
      const parts = [];
      if (stardustRecovered > 0.01) {
        parts.push(`${formatNumber(stardustRecovered)} Stardust`);
      }
      if (researchRecovered > 0.01) {
        parts.push(`${formatNumber(researchRecovered)} Research`);
      }
      if (Math.abs(energyChange) > 0.01) {
        const sign = energyChange >= 0 ? "secured" : "spent";
        parts.push(`${formatNumber(Math.abs(energyChange))} Energy ${sign}`);
      }
      if (parts.length > 0) {
        offlineMessage = `Recovered ${parts.join(" • ")} while away (${describeDuration(deltaSeconds)})`;
      }
    }
  }

  gameState.lastUpdate = Date.now();
  render();
  renderEventLog();
  saveGame();

  if (offlineMessage) {
    showStatus(offlineMessage);
    logEvent(offlineMessage);
  } else if (showFeedback) {
    showStatus("Save loaded.");
  }

  return true;
}

function resetGame() {
  if (!confirm("Reset all progress?")) return;

  gameState.stardust = 0;
  gameState.energy = 0;
  gameState.research = 0;
  gameState.automations.forEach(auto => {
    auto.count = 0;
  });
  gameState.purchasedUpgrades = [];
  gameState.log = [];
  recalculateUpgradeEffects();
  renderEventLog();
  logEvent("All systems reset. Fresh star harness initiated.");
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
// Event Bindings
// =========================

coreButton.addEventListener("click", () => {
  coreButton.classList.add("pressed");
  setTimeout(() => coreButton.classList.remove("pressed"), 140);
  manualExtractClick();
});

saveBtn.addEventListener("click", () => saveGame({ showFeedback: true }));
loadBtn.addEventListener("click", () => loadGame({ showFeedback: true }));
resetBtn.addEventListener("click", resetGame);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveGame();
  }
});

window.addEventListener("beforeunload", () => {
  saveGame();
});

// =========================
// Initialization
// =========================

recalculateUpgradeEffects();
buildAutomationCards();
buildUpgradeCards();
render();

const loaded = loadGame();
if (!loaded) {
  logEvent("Command deck online. Systems nominal.");
  renderEventLog();
}

startAutoSaveLoop();

gameState.lastUpdate = Date.now();
requestAnimationFrame(tick);
