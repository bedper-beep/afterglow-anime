
const API = "https://api.jikan.moe/v4";

const catalog = document.getElementById("catalog");
const favoritesGrid = document.getElementById("favorites");
const searchInput = document.getElementById("search");
const dubOnly = document.getElementById("dubOnly");
const details = document.getElementById("details");
const detailContent = document.getElementById("detailContent");

let animeList = [];
let favorites = readList("afterglow-favorites");
let history = readList("afterglow-history");
let featuredIndex = 0;
let featuredTimer = null;
let activeAnime = null;
let loading = true;
let loadError = "";

const knownDubTitles = [
  "attack on titan", "spy x family", "demon slayer",
  "my hero academia", "death note", "haikyu!!",
  "fullmetal alchemist: brotherhood", "your name",
  "jujutsu kaisen", "naruto", "one piece",
  "frieren: beyond journey's end", "solo leveling",
  "mob psycho 100", "hunter x hunter", "black clover",
  "dr. stone", "blue lock", "chainsaw man", "suzume"
];

/* Add only authorized video-provider checks here.
   Leave empty until a real provider is configured. */
const SOURCE_CHECKS = [];

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveData() {
  try {
    localStorage.setItem("afterglow-favorites", JSON.stringify(favorites));
    localStorage.setItem("afterglow-history", JSON.stringify(history));
  } catch {
    console.warn("Could not save Afterglow data.");
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function titleOf(anime) {
  return anime.title_english || anime.title || "Untitled anime";
}

function getPoster(anime) {
  return anime.images?.webp?.large_image_url ||
    anime.images?.jpg?.large_image_url ||
    anime.images?.webp?.image_url || "";
}

function safeImage(url) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol)
      ? parsed.href : "";
  } catch {
    return "";
  }
}

function hasKnownDub(anime) {
  return knownDubTitles.includes(titleOf(anime).trim().toLowerCase());
}

function addNavigation() {
  const nav = document.querySelector(".topbar nav");
  if (!nav) return;

  [
    ["operativeLink", "#operative", "Operative"],
    ["historyLink", "#recently-viewed", "Recently viewed"]
  ].forEach(([id, href, label]) => {
    if (document.getElementById(id)) return;
    const link = document.createElement("a");
    link.id = id;
    link.href = href;
    link.textContent = label;
    nav.appendChild(link);
  });
}

function addExtraSections() {
  if (!document.getElementById("recently-viewed")) {
    const section = document.createElement("section");
    section.id = "recently-viewed";
    section.className = "library";
    section.innerHTML = `
      <div class="section-heading">
        <div><p class="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
        <h2>Recently viewed</h2></div>
      </div>
      <div id="historyGrid" class="catalog"></div>`;
    document.querySelector("main")?.appendChild(section);
  }

  if (!document.getElementById("operative")) {
    const section = document.createElement("section");
    section.id = "operative";
    section.className = "library";
    section.innerHTML = `
      <div class="section-heading">
        <div><p class="eyebrow">SOURCE STATUS</p>
        <h2>Operative</h2>
        <p class="description">Check configured sources.</p></div>
        <button class="button" id="refreshSources">Check again</button>
      </div>
      <div id="sourceSummary" class="source-summary"></div>
      <div id="sourceList" class="source-list"></div>`;
    document.querySelector("main")?.appendChild(section);
  }
}

function animeCard(anime) {
  const id = Number(anime.mal_id);
  const title = titleOf(anime);
  const poster = safeImage(getPoster(anime));
  const saved = favorites.includes(id);
  const score = anime.score ? Number(anime.score).toFixed(1) : "N/A";
  const year = anime.year || anime.aired?.prop?.from?.year || "Year unknown";
  const genres = (anime.genres || []).slice(0, 2)
    .map(item => item.name).join(" · ") || "Anime";

  return `
    <article class="anime-card">
      <div class="poster" role="button" tabindex="0" data-open="${id}"
        aria-label="View ${escapeHTML(title)}">
        ${poster ? `<img src="${escapeHTML(poster)}"
          alt="${escapeHTML(title)} poster" loading="lazy"
          onerror="this.style.display='none'">` : ""}
        <span class="poster-title">${escapeHTML(title)}</span>
        <span class="poster-label">AFTERGLOW</span>
      </div>
      <div class="card-info">
        <h3>${escapeHTML(title)}</h3>
        <span class="rating">★ ${score}</span>
      </div>
      <div class="card-meta">${escapeHTML(String(year))} · ${escapeHTML(genres)}</div>
      <span class="card-badge">${hasKnownDub(anime)
        ? "English dub release known" : "Dub info unconfirmed"}</span>
      <div class="card-actions">
        <button data-open="${id}">Details</button>
        <button data-favorite="${id}" aria-pressed="${saved}">
          ${saved ? "♥ Saved" : "♡ Favorite"}
        </button>
      </div>
    </article>`;
}

function emptyMessage(message) {
  return `<p class="empty">${escapeHTML(message)}</p>`;
}

function renderCatalog() {
  if (!catalog || !favoritesGrid) return;

  if (loading) {
    catalog.innerHTML = emptyMessage("Loading anime artwork…");
    favoritesGrid.innerHTML = emptyMessage("Your favorites will appear here.");
    return;
  }

  if (!animeList.length) {
    catalog.innerHTML = emptyMessage(loadError || "No anime loaded.");
    favoritesGrid.innerHTML = emptyMessage("Your favorites will appear here.");
    return;
  }

  const query = (searchInput?.value || "").trim().toLowerCase();
  const filtered = animeList.filter(anime => {
    const title = titleOf(anime).toLowerCase();
    const genres = (anime.genres || []).map(g => g.name).join(" ").toLowerCase();
    return (title.includes(query) || genres.includes(query)) &&
      (!dubOnly?.checked || hasKnownDub(anime));
  });

  catalog.innerHTML = filtered.length
    ? filtered.map(animeCard).join("")
    : emptyMessage("No matches. Try another search or disable the dub filter.");

  const saved = animeList.filter(anime => favorites.includes(Number(anime.mal_id)));
  favoritesGrid.innerHTML = saved.length
    ? saved.map(animeCard).join("")
    : emptyMessage("Your list is empty. Save an anime to find it here.");

  renderHistory();
}

function renderHistory() {
  const grid = document.getElementById("historyGrid");
  if (!grid) return;
  const recent = history.map(id =>
    animeList.find(anime => Number(anime.mal_id) === Number(id))
  ).filter(Boolean);
  grid.innerHTML = recent.length
    ? recent.map(animeCard).join("")
    : emptyMessage("Open an anime to add it to your recent history.");
}

function addToHistory(id) {
  history = [id, ...history.filter(item => Number(item) !== id)].slice(0, 12);
  saveData();
  renderHistory();
}

function openDetails(id) {
  const anime = animeList.find(item => Number(item.mal_id) === id);
  if (!anime || !details || !detailContent) return;

  activeAnime = anime;
  addToHistory(id);

  const title = titleOf(anime);
  const poster = safeImage(getPoster(anime));
  const genres = (anime.genres || []).map(g => g.name).join(" · ") || "Anime";

  detailContent.innerHTML = `
    <div class="detail-hero">
      ${poster ? `<img class="detail-poster" src="${escapeHTML(poster)}"
        alt="${escapeHTML(title)} poster">` : ""}
      <div class="detail-copy">
        <p class="eyebrow">FEATURED COLLECTION</p>
        <h2>${escapeHTML(title)}</h2>
        <p>★ ${anime.score ? Number(anime.score).toFixed(1) : "Not rated"}</p>
        <p>${escapeHTML(genres)}</p>
        <span class="card-badge">${hasKnownDub(anime)
          ? "English dub release known — verify provider"
          : "Dub availability unconfirmed"}</span>
      </div>
    </div>
    <p class="detail-synopsis">${escapeHTML(anime.synopsis || "No description available.")}</p>
    <div class="detail-facts">
      <span><strong>Episodes</strong>${escapeHTML(String(anime.episodes || "Unknown"))}</span>
      <span><strong>Status</strong>${escapeHTML(anime.status || "Unknown")}</span>
    </div>
    <div class="watch-panel">
      <p class="eyebrow">WATCH OPTIONS</p>
      <h3>Find where to watch</h3>
      <p>Actual playback needs a compatible, authorized video source.</p>
      <a class="button" href="https://www.justwatch.com/us/search?q=${encodeURIComponent(title)}"
        target="_blank" rel="noopener noreferrer">Find legal viewing options ↗</a>
    </div>
    <div class="detail-actions">
      <button class="button" id="detailFavorite" data-favorite="${id}">
        ${favorites.includes(id) ? "♥ In My List" : "♡ Add to My List"}
      </button>
      <button class="button secondary-button" id="closeDetailBottom">Close</button>
    </div>`;

  details.showModal();
  document.getElementById("closeDetailBottom")?.addEventListener("click", () => details.close());
}

function renderFeatured() {
  const hero = document.querySelector(".hero");
  if (!hero || !animeList.length) return;

  const featured = animeList.filter(anime => getPoster(anime)).slice(0, 8);
  if (!featured.length) return;

  featuredIndex = featuredIndex % featured.length;
  const anime = featured[featuredIndex];
  const title = titleOf(anime);
  const poster = safeImage(getPoster(anime));

  hero.classList.add("featured-hero");
  hero.innerHTML = `
    <img class="featured-backdrop" src="${escapeHTML(poster)}" alt=""
      onerror="this.style.display='none'">
    <div class="featured-shade"></div>
    <div class="featured-content">
      <p class="eyebrow">FEATURED ANIME · ${featuredIndex + 1} / ${featured.length}</p>
      <h1>${escapeHTML(title)}</h1>
      <p class="featured-description">${escapeHTML(anime.synopsis || "Discover your next favorite story.")}</p>
      <p class="hero-note">★ ${anime.score ? Number(anime.score).toFixed(1) : "Not rated"}</p>
      <div class="featured-controls">
        <button class="featured-play" id="featuredPlay">▶ Play</button>
        <button id="featuredPrev" aria-label="Previous anime">‹</button>
        <button id="featuredNext" aria-label="Next anime">›</button>
      </div>
      <div class="featured-dots">
        ${featured.map((item, index) => `
          <button class="${index === featuredIndex ? "active" : ""}"
            data-feature-index="${index}"
            aria-label="Show ${escapeHTML(titleOf(item))}"></button>`).join("")}
      </div>
    </div>`;

  document.getElementById("featuredPlay")?.addEventListener("click", () => {
    openDetails(Number(anime.mal_id));
  });
  document.getElementById("featuredPrev")?.addEventListener("click", () => changeFeatured(-1));
  document.getElementById("featuredNext")?.addEventListener("click", () => changeFeatured(1));

  hero.querySelectorAll("[data-feature-index]").forEach(button => {
    button.addEventListener("click", () => {
      featuredIndex = Number(button.dataset.featureIndex);
      renderFeatured();
      startFeaturedRotation();
    });
  });
}

function changeFeatured(direction) {
  const total = animeList.filter(anime => getPoster(anime)).slice(0, 8).length;
  if (!total) return;
  featuredIndex = (featuredIndex + direction + total) % total;
  renderFeatured();
}

function startFeaturedRotation() {
  if (featuredTimer) clearInterval(featuredTimer);
  featuredTimer = setInterval(() => {
    if (document.hidden || details?.open) return;
    changeFeatured(1);
  }, 6000);
}

function renderOperative() {
  const summary = document.getElementById("sourceSummary");
  const list = document.getElementById("sourceList");
  if (!summary || !list) return;

  if (!SOURCE_CHECKS.length) {
    summary.innerHTML = `
      <div class="source-status">
        <span class="status-dot status-idle"></span>
        <div><strong>No video sources configured</strong>
        <p>Configure a legitimate provider before testing playback.</p></div>
      </div>`;
    list.innerHTML = emptyMessage("No sources are configured yet. Anime information loads separately.");
    return;
  }

  summary.innerHTML = `<div class="source-status"><strong>Checking configured sources…</strong></div>`;
  list.innerHTML = SOURCE_CHECKS.map((source, index) => `
    <div class="source-status" id="source-${index}">
      <span class="status-dot status-checking"></span>
      <div><strong>${escapeHTML(source.name || `Source ${index + 1}`)}</strong>
      <p>Checking endpoint…</p></div><span class="source-label">Checking</span>
    </div>`).join("");

  SOURCE_CHECKS.forEach(async (source, index) => {
    const row = document.getElementById(`source-${index}`);
    if (!row) return;

    try {
      const url = new URL(source.url);
      if (!["https:", "http:"].includes(url.protocol)) throw new Error();

      const response = await fetch(url.href, {
        method: "HEAD", mode: "cors", cache: "no-store"
      });
      const ready = response.ok;

      row.querySelector("p").textContent = ready
        ? "Endpoint responded; playback still needs testing."
        : `Endpoint returned status ${response.status}.`;
      row.querySelector(".source-label").textContent = ready ? "Responding" : "Unavailable";
      row.querySelector(".status-dot").className =
        `status-dot ${ready ? "status-ready" : "status-offline"}`;
    } catch {
      row.querySelector("p").textContent = "Endpoint could not be verified from this browser.";
      row.querySelector(".source-label").textContent = "Unverified";
      row.querySelector(".status-dot").className = "status-dot status-offline";
    }
  });
}

async function loadCatalog() {
  loading = true;
  loadError = "";
  renderCatalog();

  try {
    const response = await fetch(`${API}/top/anime?limit=24&sfw=true`);
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);

    const result = await response.json();
    animeList = Array.isArray(result.data) ? result.data : [];
    if (!animeList.length) throw new Error("No anime returned.");
  } catch (error) {
    console.error("Afterglow catalog error:", error);
    loadError = "Anime data couldn't load. Check your connection and try again.";
  } finally {
    loading = false;
    renderCatalog();
    renderOperative();

    if (animeList.length) {
      renderFeatured();
      startFeaturedRotation();
    }
  }
}

document.addEventListener("click", event => {
  const openButton = event.target.closest("[data-open]");
  const favoriteButton = event.target.closest("[data-favorite]");

  if (openButton) {
    openDetails(Number(openButton.dataset.open));
    return;
  }

  if (favoriteButton) {
    const id = Number(favoriteButton.dataset.favorite);
    favorites = favorites.includes(id)
      ? favorites.filter(item => item !== id)
      : [...favorites, id];
    saveData();
    renderCatalog();

    if (activeAnime && Number(activeAnime.mal_id) === id && details?.open) {
      openDetails(id);
    }
    return;
  }

  if (event.target.id === "retryCatalog") loadCatalog();
  if (event.target.id === "refreshSources") renderOperative();
});

document.addEventListener("keydown", event => {
  if ((event.key === "Enter" || event.key === " ") &&
      event.target.matches(".poster[role='button']")) {
    event.preventDefault();
    openDetails(Number(event.target.dataset.open));
  }
});

document.getElementById("closeDetails")?.addEventListener("click", () => details.close());
details?.addEventListener("click", event => {
  if (event.target === details) details.close();
});

searchInput?.addEventListener("input", renderCatalog);
dubOnly?.addEventListener("change", renderCatalog);

addNavigation();
addExtraSections();
renderOperative();
loadCatalog();
