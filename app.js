/* AFTERGLOW — app.js
   Anime information: Jikan public API.
   Video playback: only add sources you are authorized to use.
*/

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
let activeAnime = null;
let loading = true;
let loadError = "";

/* These are example title names, not live streaming availability.
   The dub filter only includes titles with known English-dub releases. */
const knownDubTitles = [
  "attack on titan",
  "spy x family",
  "demon slayer",
  "my hero academia",
  "death note",
  "haikyu!!",
  "fullmetal alchemist: brotherhood",
  "your name",
  "jujutsu kaisen",
  "naruto",
  "one piece",
  "frieren: beyond journey's end",
  "solo leveling",
  "mob psycho 100",
  "hunter x hunter",
  "black clover",
  "dr. stone",
  "blue lock",
  "chainsaw man",
  "suzume"
];

/*
  Add authorized source-check URLs here only when you have a real
  provider endpoint that permits this kind of checking.

  Leave this empty until a legitimate source is configured.
  A webpage URL is not necessarily a playable video URL.
*/
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
    console.warn("Afterglow could not save browser data.");
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function titleOf(anime) {
  return anime.title_english || anime.title || "Untitled anime";
}

function hasKnownDub(anime) {
  const title = titleOf(anime).trim().toLowerCase();
  return knownDubTitles.includes(title);
}

function getPoster(anime) {
  return anime.images?.webp?.large_image_url ||
         anime.images?.jpg?.large_image_url ||
         anime.images?.webp?.image_url ||
         "";
}

function safeImage(url) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol)
      ? parsed.href
      : "";
  } catch {
    return "";
  }
}

function addNavigation() {
  const nav = document.querySelector(".topbar nav");
  if (!nav) return;

  if (!document.getElementById("operativeLink")) {
    const link = document.createElement("a");
    link.id = "operativeLink";
    link.href = "#operative";
    link.textContent = "Operative";
    nav.appendChild(link);
  }

  if (!document.getElementById("historyLink")) {
    const link = document.createElement("a");
    link.href = "#recently-viewed";
    link.textContent = "Recently viewed";
    nav.appendChild(link);
  }
}

function addExtraSections() {
  if (!document.getElementById("recently-viewed")) {
    const section = document.createElement("section");
    section.id = "recently-viewed";
    section.className = "library";
    section.innerHTML = `
      <div class="section-heading">
        <div>
          <p class="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
          <h2>Recently viewed</h2>
        </div>
      </div>
      <div id="historyGrid" class="catalog"></div>
    `;

    document.querySelector("main")?.appendChild(section);
  }

  if (!document.getElementById("operative")) {
    const section = document.createElement("section");
    section.id = "operative";
    section.className = "library";
    section.innerHTML = `
      <div class="section-heading">
        <div>
          <p class="eyebrow">SOURCE STATUS</p>
          <h2>Operative</h2>
          <p class="description">
            Check configured sources and see which ones are ready.
          </p>
        </div>
        <button class="button" id="refreshSources">Check again</button>
      </div>
      <div id="sourceSummary" class="source-summary"></div>
      <div id="sourceList" class="source-list"></div>
    `;

    document.querySelector("main")?.appendChild(section);
  }
}

function animeCard(anime) {
  const id = Number(anime.mal_id);
  const saved = favorites.includes(id);
  const title = titleOf(anime);
  const poster = safeImage(getPoster(anime));
  const score = anime.score ? Number(anime.score).toFixed(1) : "N/A";
  const year = anime.year || anime.aired?.prop?.from?.year || "Year unknown";
  const genres = (anime.genres || [])
    .slice(0, 2)
    .map(item => item.name)
    .join(" · ") || "Anime";

  return `
    <article class="anime-card">
      <div class="poster" role="button" tabindex="0"
        data-open="${id}" aria-label="View ${escapeHTML(title)}">
        ${poster ? `
          <img src="${escapeHTML(poster)}"
            alt="${escapeHTML(title)} poster"
            loading="lazy"
            onerror="this.style.display='none'">
        ` : ""}
        <span class="poster-title">${escapeHTML(title)}</span>
        <span class="poster-label">AFTERGLOW COLLECTION</span>
      </div>
      <div class="card-info">
        <h3 title="${escapeHTML(title)}">${escapeHTML(title)}</h3>
        <span class="rating">★ ${score}</span>
      </div>
      <div class="card-meta">${year} · ${escapeHTML(genres)}</div>
      <span class="card-badge">
        ${hasKnownDub(anime) ? "English dub release known" : "Dub info unconfirmed"}
      </span>
      <div class="card-actions">
        <button data-open="${id}">View details</button>
        <button data-favorite="${id}" aria-pressed="${saved}">
          ${saved ? "♥ Saved" : "♡ My List"}
        </button>
      </div>
    </article>
  `;
}

function emptyMessage(message) {
  return `<p class="empty">${escapeHTML(message)}</p>`;
}

function renderCatalog() {
  if (!catalog || !favoritesGrid) return;

  if (loading) {
    catalog.innerHTML = emptyMessage("Loading anime artwork…");
    favoritesGrid.innerHTML = emptyMessage("Your saved anime will appear here.");
    return;
  }

  if (loadError && animeList.length === 0) {
    catalog.innerHTML = `
      <div class="empty">
        <p>${escapeHTML(loadError)}</p>
        <button class="button" id="retryCatalog">Try again</button>
      </div>
    `;
    favoritesGrid.innerHTML = emptyMessage("Your list will appear when the catalog loads.");
    return;
  }

  const query = (searchInput?.value || "").trim().toLowerCase();

  const filtered = animeList.filter(anime => {
    const title = titleOf(anime).toLowerCase();
    const genres = (anime.genres || []).map(g => g.name).join(" ").toLowerCase();
    const matchesSearch = title.includes(query) || genres.includes(query);
    const matchesDub = !dubOnly?.checked || hasKnownDub(anime);
    return matchesSearch && matchesDub;
  });

  catalog.innerHTML = filtered.length
    ? filtered.map(animeCard).join("")
    : emptyMessage("No matches. Try another search or turn off the dub filter.");

  const savedAnime = animeList.filter(anime =>
    favorites.includes(Number(anime.mal_id))
  );

  favoritesGrid.innerHTML = savedAnime.length
    ? savedAnime.map(animeCard).join("")
    : emptyMessage("Your list is empty. Save an anime to find it here.");

  renderHistory();
}

function renderHistory() {
  const grid = document.getElementById("historyGrid");
  if (!grid) return;

  const recent = history
    .map(id => animeList.find(anime => Number(anime.mal_id) === Number(id)))
    .filter(Boolean);

  grid.innerHTML = recent.length
    ? recent.map(animeCard).join("")
    : emptyMessage("Open an anime to add it to your recent history.");
}

function addToHistory(id) {
  history = [id, ...history.filter(item => Number(item) !== Number(id))].slice(0, 12);
  saveData();
  renderHistory();
}

function openDetails(id) {
  const anime = animeList.find(item => Number(item.mal_id) === Number(id));
  if (!anime || !details || !detailContent) return;

  activeAnime = anime;
  addToHistory(id);

  const title = titleOf(anime);
  const poster = safeImage(getPoster(anime));
  const genres = (anime.genres || []).map(item => item.name).join(" · ") || "Anime";
  const score = anime.score ? Number(anime.score).toFixed(1) : "Not rated";
  const synopsis = anime.synopsis || "No description is available yet.";
  const episodes = anime.episodes || "Not listed";
  const status = anime.status || "Unknown";

  detailContent.innerHTML = `
    <div class="detail-hero">
      ${poster ? `
        <img class="detail-poster"
          src="${escapeHTML(poster)}"
          alt="${escapeHTML(title)} poster">
      ` : ""}
      <div class="detail-copy">
        <p class="eyebrow">AFTERGLOW ORIGINAL INTERFACE</p>
        <h2>${escapeHTML(title)}</h2>
        <p>★ ${score} · ${escapeHTML(String(anime.year || "Year unknown"))}</p>
        <p>${escapeHTML(genres)}</p>
        <span class="card-badge">
          ${hasKnownDub(anime)
            ? "English dub release known — check provider"
            : "English dub availability not confirmed"}
        </span>
      </div>
    </div>

    <p class="detail-synopsis">${escapeHTML(synopsis)}</p>

    <div class="detail-facts">
      <span><strong>Episodes</strong>${escapeHTML(String(episodes))}</span>
      <span><strong>Status</strong>${escapeHTML(status)}</span>
    </div>

    <div class="watch-panel">
      <p class="eyebrow">WATCH</p>
      <h3>Choose where to watch</h3>
      <p>
        Afterglow doesn't have an authorized video source configured for this
        title yet. We won't show a fake Play button or claim a stream is ready
        when it isn't.
      </p>
      <a class="button provider-search"
        href="https://www.justwatch.com/us/search?q=${encodeURIComponent(title)}"
        target="_blank" rel="noopener noreferrer">
        Find legal streaming options ↗
      </a>
    </div>

    <div class="detail-actions">
      <button class="button" id="detailFavorite" data-favorite="${Number(anime.mal_id)}">
        ${favorites.includes(Number(anime.mal_id)) ? "♥ In My List" : "♡ Add to My List"}
      </button>
      <button class="button secondary-button" id="closeDetailBottom">Close</button>
    </div>
  `;

  details.showModal();

  document.getElementById("closeDetailBottom")?.addEventListener("click", () => {
    details.close();
  });
}

function renderOperative() {
  const summary = document.getElementById("sourceSummary");
  const list = document.getElementById("sourceList");
  if (!summary || !list) return;

  if (SOURCE_CHECKS.length === 0) {
    summary.innerHTML = `
      <div class="source-status">
        <span class="status-dot status-idle"></span>
        <div>
          <strong>No sources configured</strong>
          <p>Afterglow needs a legitimate provider or playable video source before it can test playback.</p>
        </div>
      </div>
    `;
    list.innerHTML = emptyMessage(
      "There are no configured sources to test yet. Anime information can load independently of video playback."
    );
    return;
  }

  summary.innerHTML = `
    <div class="source-status">
      <span class="status-dot status-idle"></span>
      <div>
        <strong>Configured sources</strong>
        <p>Checking whether the configured endpoints respond.</p>
      </div>
    </div>
  `;

  list.innerHTML = SOURCE_CHECKS.map((source, index) => `
    <div class="source-status" id="source-${index}">
      <span class="status-dot status-checking"></span>
      <div>
        <strong>${escapeHTML(source.name || `Source ${index + 1}`)}</strong>
        <p>Waiting for a check…</p>
      </div>
      <span class="source-label">Checking</span>
    </div>
  `).join("");

  /*
    A browser cannot reliably prove that a video is playable by checking
    an arbitrary webpage. This simple check only tests whether a configured
    endpoint responds to a browser request; it does not bypass restrictions.
  */
  SOURCE_CHECKS.forEach(async (source, index) => {
    const row = document.getElementById(`source-${index}`);
    if (!row) return;

    try {
      const url = new URL(source.url);
      if (!["https:", "http:"].includes(url.protocol)) {
        throw new Error("Invalid URL");
      }

      const response = await fetch(url.href, {
        method: "HEAD",
        mode: "cors",
        cache: "no-store"
      });

      const ready = response.ok;
      row.querySelector("p").textContent = ready
        ? "Endpoint responded. Playback still needs a separate test."
        : `Endpoint responded with status ${response.status}.`;
      row.querySelector(".source-label").textContent = ready ? "Responding" : "Unavailable";
      row.querySelector(".status-dot").className =
        `status-dot ${ready ? "status-ready" : "status-offline"}`;
    } catch {
      row.querySelector("p").textContent =
        "Could not verify this endpoint from the browser.";
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

    if (!response.ok) {
      throw new Error(`Catalog request failed (${response.status})`);
    }

    const result = await response.json();
    animeList = Array.isArray(result.data) ? result.data : [];

    if (animeList.length === 0) {
      throw new Error("The catalog returned no anime.");
    }
  } catch (error) {
    loadError = "We couldn't load anime artwork right now. Check your connection and try again.";
    console.error("Afterglow catalog error:", error);
  } finally {
    loading = false;
    renderCatalog();
    renderOperative();
  }
}

/* Click handling */
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

  if (event.target.id === "retryCatalog") {
    loadCatalog();
  }
});

document.addEventListener("keydown", event => {
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches(".poster[role='button']")
  ) {
    event.preventDefault();
    openDetails(Number(event.target.dataset.open));
  }
});

document.getElementById("closeDetails")?.addEventListener("click", () => {
  details.close();
});

details?.addEventListener("click", event => {
  if (event.target === details) details.close();
});

searchInput?.addEventListener("input", renderCatalog);
dubOnly?.addEventListener("change", renderCatalog);
document.addEventListener("change", event => {
  if (event.target === dubOnly) renderCatalog();
});

document.addEventListener("click", event => {
  if (event.target.id === "refreshSources") renderOperative();
});

addNavigation();
addExtraSections();
renderOperative();
loadCatalog();
