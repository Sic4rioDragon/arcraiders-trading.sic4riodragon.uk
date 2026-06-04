const state = {
  core: null,
  trading: null,
  search: "",
  category: "all",
  status: "all",
};

const els = {
  discordName: document.querySelector("#discordName"),
  discordProfileBtn: document.querySelector("#discordProfileBtn"),
  copyDiscordBtn: document.querySelector("#copyDiscordBtn"),

  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  statusFilter: document.querySelector("#statusFilter"),

  totalLooking: document.querySelector("#totalLooking"),
  totalHave: document.querySelector("#totalHave"),

  lookingList: document.querySelector("#lookingList"),
  manualHaveGrid: document.querySelector("#manualHaveGrid"),

  itemCardTemplate: document.querySelector("#itemCardTemplate"),
};

function siteRoot() {
  const scriptSrc = document.currentScript?.src || "";
  const marker = "/assets/js/";

  const index = scriptSrc.indexOf(marker);

  if (index !== -1) {
    return scriptSrc.slice(0, index + 1);
  }

  return `${location.origin}/`;
}

const SITE_ROOT = siteRoot();

async function fetchJson(file, fallback = null) {
  try {
    const cleanFile = String(file).replace(/^\/+/, "");
    const url = new URL(cleanFile, SITE_ROOT);

    url.searchParams.set("v", Date.now());

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) throw new Error(`Could not load ${url.pathname}`);

    return await res.json();
  } catch (err) {
    console.warn(err.message);
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstLetters(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function rarityClass(rarity) {
  return String(rarity || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

function normalizeCore(input) {
  return {
    version: input?.version || 1,
    items: input?.items || {},
  };
}

function imageFromId(id) {
  if (!id) return "";
  return `https://cdn.arctracker.io/items/v2/${id}.png`;
}

function inferCategoryFromName(name) {
  const text = String(name || "").toLowerCase();

  if (text.includes("blueprint")) return "Blueprint";
  if (text.includes("key")) return "Key";
  if (text.includes("ammo")) return "Ammunition";
  if (text.includes("grenade") || text.includes("wolfpack") || text.includes("firecracker")) return "Throwable";
  if (text.includes("hullcracker") || text.includes("vulcano") || text.includes("anvil") || text.includes("burletta") || text.includes("jupiter")) return "Weapon";
  if (text.includes("grip") || text.includes("stock") || text.includes("mag") || text.includes("silencer") || text.includes("choke") || text.includes("compensator")) return "Weapon Mod";

  return "Other";
}

function getMeta(id, fallback = {}) {
  const coreItem = state.core?.items?.[id] || {};
  const name = fallback.name || coreItem.name || id;

  return {
    id,
    name,
    rarity: fallback.rarity || coreItem.rarity || "Unknown",
    category: fallback.category || coreItem.category || inferCategoryFromName(name),
    image: fallback.image || coreItem.image || imageFromId(id)
  };
}

function priorityLabel(priority) {
  if (priority === "high") return "high";
  return "lf";
}

function priorityClass(priority) {
  if (priority === "high") return "high";
  return "normal";
}

function getLookingItems() {
  const flat = state.trading?.lookingForItems;

  if (Array.isArray(flat)) {
    return flat.map((item) => {
      const meta = getMeta(item.id, item);

      return {
        id: item.id,
        name: item.name || meta.name,
        rarity: item.rarity || meta.rarity,
        category: item.category || meta.category,
        image: item.image || meta.image,
        priority: item.priority || "normal"
      };
    });
  }

  const seen = new Map();

  for (const group of state.trading?.lookingFor || []) {
    for (const item of group.items || []) {
      if (seen.has(item.id)) continue;

      const current = Number(item.current || 0);

      if (current > 200) continue;

      const meta = getMeta(item.id, item);

      seen.set(item.id, {
        id: item.id,
        name: item.name || meta.name,
        rarity: item.rarity || meta.rarity,
        category: item.category || meta.category,
        image: item.image || meta.image,
        priority: item.priority || "normal"
      });
    }
  }

  return [...seen.values()];
}

function statusLabel(status) {
  if (status === "reserved") return "not trading";
  if (status === "available") return "available";
  if (status === "looking") return "looking for";
  return status || "listed";
}

function statusClass(status) {
  return String(status || "available").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function getManualItems() {
  return (state.trading?.manualHave || []).map((item) => {
    const meta = getMeta(item.id, item);

    return {
      id: item.id,
      name: item.name || meta.name,
      quantity: item.quantity ?? 1,
      rarity: item.rarity || meta.rarity,
      category: item.category || meta.category,
      image: item.image || meta.image,
      status: item.status || "reserved",
      note: item.note || "",
    };
  });
}

function itemMatchesFilters(item) {
  const term = state.search.trim().toLowerCase();

  if (term) {
    const haystack = [
      item.name,
      item.id,
      item.category,
      item.rarity,
      item.note,
      item.priority,
      statusLabel(item.status),
    ].join(" ").toLowerCase();

    if (!haystack.includes(term)) return false;
  }

  if (state.category !== "all" && item.category !== state.category) return false;

  if (state.status === "high" && item.priority !== "high") return false;
  if (state.status === "normal" && item.priority === "high") return false;
  if (state.status === "available" && item.status !== "available") return false;
  if (state.status === "reserved" && item.status !== "reserved") return false;

  return true;
}

function renderItemCard(item) {
  const template = els.itemCardTemplate.content.cloneNode(true);
  const card = template.querySelector(".item-card");
  const img = template.querySelector("img");
  const fallback = template.querySelector(".item-fallback");
  const title = template.querySelector("h3");
  const pill = template.querySelector(".pill");
  const meta = template.querySelector(".item-meta");
  const note = template.querySelector(".item-note");

  card.classList.add(rarityClass(item.rarity), statusClass(item.status || item.priority || "looking"));

  title.textContent = item.name;
  pill.textContent = item.status ? statusLabel(item.status) : priorityLabel(item.priority);

  if (item.status) {
    meta.textContent = `${item.category || "Other"} · ${item.rarity || "Unknown"} · x${item.quantity ?? "?"}`;
  } else {
    meta.textContent = `${item.category || "Other"} · ${item.rarity || "Unknown"}`;
  }

  if (item.note) {
    note.textContent = item.note;
  } else {
    note.remove();
  }

  if (item.image) {
    img.src = item.image;
    img.alt = item.name;
    img.addEventListener("error", () => {
      img.remove();
      fallback.textContent = firstLetters(item.name);
    });
    fallback.remove();
  } else {
    img.remove();
    fallback.textContent = firstLetters(item.name);
  }

  return card;
}

function renderLookingCard(item) {
  const meta = getMeta(item.id, item);
  const icon = meta.image ? `<img class="small-icon" src="${escapeHtml(meta.image)}" alt="">` : "";

  return `
    <article class="lf-card ${priorityClass(item.priority)}">
      <div class="resource-name">
        ${icon}
        <strong>${escapeHtml(item.name || meta.name)}</strong>
      </div>
    </article>
  `;
}

function updateCategoryOptions(items) {
  const current = els.categoryFilter.value;
  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  els.categoryFilter.innerHTML = `<option value="all">All categories</option>`;

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.categoryFilter.appendChild(option);
  }

  if ([...els.categoryFilter.options].some((option) => option.value === current)) {
    els.categoryFilter.value = current;
  }
}

function render() {
  const lookingItems = getLookingItems();
  const manualItems = getManualItems();

  const filteredLooking = lookingItems.filter(itemMatchesFilters);
  const filteredManual = manualItems.filter(itemMatchesFilters);

  els.totalLooking.textContent = lookingItems.length;
  els.totalHave.textContent = manualItems.length;

  updateCategoryOptions([...lookingItems, ...manualItems]);

  els.lookingList.innerHTML = filteredLooking.map(renderLookingCard).join("");

  if (!filteredLooking.length) {
    els.lookingList.innerHTML = `<p class="empty-state">No LF items found.</p>`;
  }

  els.manualHaveGrid.innerHTML = "";

  for (const item of filteredManual) {
    els.manualHaveGrid.appendChild(renderItemCard(item));
  }

  if (!filteredManual.length) {
    els.manualHaveGrid.innerHTML = `<p class="empty-state">No listed trade items yet.</p>`;
  }
}

async function copyText(text, button, normalText) {
  await navigator.clipboard.writeText(text);
  button.textContent = "Copied!";
  setTimeout(() => {
    button.textContent = normalText;
  }, 1400);
}

async function init() {
  const [core, trading] = await Promise.all([
    fetchJson("/data/stash.core.json", { items: {} }),
    fetchJson("/data/trading.json", {}),
  ]);

  state.core = normalizeCore(core);
  state.trading = trading || {};

  const contact = state.trading.contact || {};
  const discordUsername = contact.discordUsername || "@sic4rio_";
  const discordProfileUrl = contact.discordProfileUrl || `https://discord.com/users/${contact.discordUserId || "422423016849408017"}`;

  els.discordName.textContent = discordUsername;
  els.discordProfileBtn.href = discordProfileUrl;
  els.copyDiscordBtn.textContent = `Copy ${discordUsername}`;

  els.copyDiscordBtn.addEventListener("click", () => {
    copyText(discordUsername, els.copyDiscordBtn, `Copy ${discordUsername}`);
  });

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value;
    render();
  });

  els.categoryFilter.addEventListener("change", () => {
    state.category = els.categoryFilter.value;
    render();
  });

  els.statusFilter.innerHTML = `
    <option value="all">All priorities</option>
    <option value="high">High priority</option>
    <option value="normal">Normal</option>
    <option value="available">Available trade items</option>
    <option value="reserved">Not trading</option>
  `;

  els.statusFilter.addEventListener("change", () => {
    state.status = els.statusFilter.value;
    render();
  });

  render();
}

init().catch((err) => {
  console.error(err);
});