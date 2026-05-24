const state = {
  core: null,
  trading: null,
  stash: null,
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
  stashGrid: document.querySelector("#stashGrid"),
  stashUpdated: document.querySelector("#stashUpdated"),
  emptyState: document.querySelector("#emptyState"),

  itemCardTemplate: document.querySelector("#itemCardTemplate"),
};

const RARITY_ORDER = {
  Legendary: 0,
  Epic: 1,
  Rare: 2,
  Uncommon: 3,
  Common: 4,
  Unknown: 9,
};

async function fetchJson(file, fallback = null) {
  try {
    const res = await fetch(`${file}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Could not load ${file}`);
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

function normalizeStash(input) {
  if (!input?.items) {
    return {
      version: 2,
      profile: "imported",
      displayName: "Imported stash",
      updatedAt: "",
      summary: {},
      items: {},
      order: [],
      extractedCoreItems: {}
    };
  }

  return {
    version: input.version || 2,
    profile: input.profile || "imported",
    displayName: input.displayName || "Imported stash",
    updatedAt: input.updatedAt || "",
    summary: input.summary || {},
    items: input.items || {},
    order: Array.isArray(input.order) ? input.order : [],
    extractedCoreItems: input.extractedCoreItems || {}
  };
}

function getMeta(id, fallback = {}) {
  const coreItem = state.core?.items?.[id] || {};
  const importedItem = state.stash?.extractedCoreItems?.[id] || {};

  const name = fallback.name || coreItem.name || importedItem.name || id;

  return {
    id,
    name,
    rarity: fallback.rarity || coreItem.rarity || importedItem.rarity || "Unknown",
    category: fallback.category || coreItem.category || importedItem.category || inferCategoryFromName(name),
    image: fallback.image || coreItem.image || importedItem.image || imageFromId(id)
  };
}

function inferCategoryFromName(name) {
  const text = String(name || "").toLowerCase();

  if (text.includes("blueprint")) return "Blueprint";
  if (text.includes("key")) return "Key";
  if (text.includes("ammo")) return "Ammunition";
  if (text.includes("grenade") || text.includes("wolfpack") || text.includes("firecracker")) return "Throwable";
  if (text.includes("hullcracker") || text.includes("vulcano") || text.includes("anvil") || text.includes("burletta")) return "Weapon";
  if (text.includes("grip") || text.includes("stock") || text.includes("mag") || text.includes("silencer") || text.includes("choke") || text.includes("compensator")) return "Weapon Mod";

  return "Other";
}

function isReserved(item) {
  const reservedIds = state.trading?.reservedIds || [];
  const reservedNames = state.trading?.reservedNames || [];

  return reservedIds.includes(item.id) || reservedNames.includes(item.name);
}

function itemStatus(item) {
  if (item.status) return item.status;
  if (isReserved(item)) return "reserved";
  return "available";
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

function getStashItems() {
  const stash = state.stash;

  if (!stash?.items) return [];

  const ids = Object.keys(stash.items);
  const order = stash.order || [];

  return ids
    .map((id) => {
      const meta = getMeta(id);

      return {
        id,
        name: meta.name || id,
        quantity: Number(stash.items[id] || 0),
        rarity: meta.rarity || "Unknown",
        category: meta.category || "Other",
        image: meta.image || "",
        status: "",
        note: "",
      };
    })
    .filter((item) => item.quantity > 0)
    .sort((a, b) => {
      const ra = RARITY_ORDER[a.rarity] ?? RARITY_ORDER.Unknown;
      const rb = RARITY_ORDER[b.rarity] ?? RARITY_ORDER.Unknown;

      if (ra !== rb) return ra - rb;

      const ia = order.includes(a.id) ? order.indexOf(a.id) : Number.MAX_SAFE_INTEGER;
      const ib = order.includes(b.id) ? order.indexOf(b.id) : Number.MAX_SAFE_INTEGER;

      if (ia !== ib) return ia - ib;

      return a.name.localeCompare(b.name);
    });
}

function itemMatchesFilters(item) {
  const term = state.search.trim().toLowerCase();
  const status = itemStatus(item);

  if (term) {
    const haystack = [
      item.name,
      item.id,
      item.category,
      item.rarity,
      item.note,
      statusLabel(status),
    ].join(" ").toLowerCase();

    if (!haystack.includes(term)) return false;
  }

  if (state.category !== "all" && item.category !== state.category) return false;
  if (state.status !== "all" && status !== state.status) return false;

  return true;
}

function renderItemCard(item, forcedStatus = "") {
  const status = forcedStatus || itemStatus(item);
  const template = els.itemCardTemplate.content.cloneNode(true);
  const card = template.querySelector(".item-card");
  const img = template.querySelector("img");
  const fallback = template.querySelector(".item-fallback");
  const title = template.querySelector("h3");
  const pill = template.querySelector(".pill");
  const meta = template.querySelector(".item-meta");
  const note = template.querySelector(".item-note");

  card.classList.add(rarityClass(item.rarity), statusClass(status));

  title.textContent = item.name;
  pill.textContent = statusLabel(status);

  meta.textContent = `${item.category || "Other"} · ${item.rarity || "Unknown"} · x${item.quantity ?? "?"}`;

  if (item.note) {
    note.textContent = item.note;
  } else {
    note.remove();
  }

  if (item.image) {
    img.src = item.image;
    img.alt = item.name;
    fallback.remove();

    img.addEventListener("error", () => {
    img.remove();
  });
  } else {
    img.remove();
    fallback.textContent = firstLetters(item.name);
  }

  return card;
}

function countClass(item) {
  const current = Number(item.current || 0);
  const needed = Number(item.needed || 0);

  if (current >= needed) return "good";
  if (current <= 0) return "bad";
  return "warn";
}

function renderLookingGroup(group) {
  return `
    <article class="tracked-card">
      <div class="tracked-head">
        <div>
          <span class="chev">⌄</span>
          <strong>${escapeHtml(group.group)}</strong>
        </div>
      </div>

      <div class="tracked-body">
        ${(group.items || []).map((item) => {
          const meta = getMeta(item.id, item);
          const icon = meta.image ? `<img class="small-icon" src="${escapeHtml(meta.image)}" alt="">` : "";

          return `
            <div class="resource-row">
              <div class="resource-name">
                ${icon}
                <strong>${escapeHtml(item.name || meta.name)}</strong>
              </div>
              <span class="count ${countClass(item)}">${item.current}/${item.needed}</span>
            </div>
          `;
        }).join("")}
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
  const looking = state.trading?.lookingFor || [];
  const manualItems = getManualItems();
  const stashItems = getStashItems();
  const allFilterItems = [...manualItems, ...stashItems];

  els.totalLooking.textContent = looking.reduce((sum, group) => sum + (group.items || []).length, 0);
  els.totalHave.textContent = stashItems.length;

  updateCategoryOptions(allFilterItems);

  els.lookingList.innerHTML = looking.map(renderLookingGroup).join("");

  const filteredManual = manualItems.filter(itemMatchesFilters);
  const filteredStash = stashItems.filter(itemMatchesFilters);

  els.manualHaveGrid.innerHTML = "";
  for (const item of filteredManual) {
    els.manualHaveGrid.appendChild(renderItemCard(item, item.status));
  }

  els.stashGrid.innerHTML = "";
  for (const item of filteredStash) {
    els.stashGrid.appendChild(renderItemCard(item));
  }

  els.emptyState.hidden = filteredStash.length > 0;

  if (state.stash?.updatedAt) {
    const date = new Date(state.stash.updatedAt);
    els.stashUpdated.textContent = `Imported ${Number.isNaN(date.getTime()) ? state.stash.updatedAt : date.toLocaleString()}`;
  } else {
    els.stashUpdated.textContent = "No imported stash yet.";
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
  const [core, trading, stash] = await Promise.all([
    fetchJson("/data/stash.core.json", { items: {} }),
    fetchJson("/data/trading.json", {}),
    fetchJson("/data/stash.current.json", null),
  ]);

  state.core = normalizeCore(core);
  state.trading = trading || {};
  state.stash = normalizeStash(stash);

  const contact = state.trading.contact || {};
  const discordUsername = contact.discordUsername || "@sic4rio_";
  const discordProfileUrl = contact.discordProfileUrl || `https://discord.com/users/${contact.discordUserId || "422423016849408017"}`;

  els.discordName.textContent = discordUsername;
  els.discordProfileBtn.href = discordProfileUrl;

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

  els.statusFilter.addEventListener("change", () => {
    state.status = els.statusFilter.value;
    render();
  });

  render();
}

init().catch((err) => {
  console.error(err);
});