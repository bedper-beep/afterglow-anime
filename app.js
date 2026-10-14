
"use strict";

/* ==========================================
   AFTERGLOW — Anime, Your Way
   Catalog, search, favorites, history,
   featured anime, settings and watch links.
   ========================================== */

const API = "https://api.jikan.moe/v4";

const $ = selector => document.querySelector(selector);

const catalog = $("#catalog");
const favoritesGrid = $("#favorites");
const historyGrid = $("#historyGrid");
const searchInput = $("#search");
const dubOnly = $("#dubOnly");
const genreFilter = $("#genreFilter");
const details = $("#details");
const detailContent = $("#detailContent");
const playerDialog = $("#playerDialog");
const video = $("#video");

let animeList = [];
let favorites = readList("afterglow-favorites");
let history = readList("afterglow-history");
let activeAnime = null;
let featuredIndex = 0;
let featuredTimer = null;
let currentView = "home";
let loading = true;
let loadError = "";

const knownDubTitles = [
  "attack on titan",
  "spy x family",
  "demon slayer",
  "my hero academia",
  "death note",
  "haikyu!!",
  "fullmetal alchemist: brotherhood",
  "jujutsu kaisen",
  "naruto",
  "one piece",
  "solo leveling",
  "mob psycho 100",
  "hunter x hunter",
  "black clover",
  "dr. stone",
  "blue lock",
  "chainsaw man"
];

/* ---------- Storage and helpers ---------- */

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
  } catch (error) {
    console.warn("Could not save Afterglow data.", error);
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

function posterOf(anime) {
  return anime.images?.webp?.large_image_url ||
    anime.images?.jpg?.large_image_url ||
    anime.images?.webp?.image_url ||
    "";
}

function knownDub(anime) {
  return knownDubTitles.includes(
    titleOf(anime).trim().toLowerCase()
  );
}

function emptyMessage(message) {
  return `<p class="empty">${escapeHTML(message)}</p>`;
}

function genresOf(anime) {
  return (anime.genres || []).map(item => item.name);
}

function yearOf(anime) {
  return anime.year || anime.aired?.prop?.from?.year || "Year unknown";
}

/* ---------- Anime cards ---------- */

function animeCard(anime) {
  const id = Number(anime.mal_id);
  const title = titleOf(anime);
  const poster = posterOf(anime);
  const saved = favorites.includes(id);
  const year = yearOf(anime);
  const genres = genresOf(anime).slice(0, 2).join(" · ") || "Anime";

  return `
    <article class="anime-card">
      <button class="poster" type="button"
        data-open="${id}"
        aria-label="View ${escapeHTML(title)}">
        ${poster
          ? `<img src="${escapeHTML(poster)}"
              alt="${escapeHTML(title)} poster" loading="lazy">`
          : ""}
        <span class="poster-label">AFTERGLOW</span>
        <span class="poster-title">${escapeHTML(title)}</span>
      </button>

      <div class="card-info">
        <h3>${escapeHTML(title)}</h3>
        <span class="rating">
          ★ ${anime.score ? Number(anime.score).toFixed(1) : "N/A"}
        </span>
      </div>

      <div class="card-meta">
        ${escapeHTML(String(year))} · ${escapeHTML(genres)}
      </div>

      <span class="card-badge">
        ${knownDub(anime) ? "Dub release known" : "Dub info unconfirmed"}
      </span>

      <div class="card-actions">
        <button type="button" data-open="${id}">Details</button>
        <button type="button" data-favorite="${id}"
          aria-pressed="${saved}">
          ${saved ? "★ Saved" : "☆ My List"}
        </button>
      </div>
    </article>
  `;
}

function filteredAnime() {
  const query = (searchInput?.value || "").trim().toLowerCase();
  const genre = genreFilter?.value || "all";

  return animeList.filter(anime => {
    const title = titleOf(anime).toLowerCase();
    const genres = genresOf(anime);

    const matchesSearch =
      title.includes(query) ||
      genres.join(" ").toLowerCase().includes(query);

    const matchesGenre = genre === "all" ||
      genres.some(item => item.toLowerCase() === genre.toLowerCase());

    const matchesDub = !dubOnly?.checked || knownDub(anime);

    return matchesSearch && matchesGenre && matchesDub;
  });
}

/* ---------- Catalog rendering ---------- */

function renderCatalog() {
  if (!catalog) return;

  if (loading) {
    catalog.innerHTML = emptyMessage("Loading anime...");
    return;
  }

  if (loadError && !animeList.length) {
    catalog.innerHTML = `
      ${emptyMessage(loadError)}
      <button class="button primary" id="retryCatalog">Try again</button>
    `;
    return;
  }

  const filtered = filteredAnime();

  catalog.innerHTML = filtered.length
    ? filtered.map(animeCard).join("")
    : emptyMessage("No matches. Try another search or filter.");

  renderFavorites();
  renderHistory();
}

function renderFavorites() {
  if (!favoritesGrid) return;

  const saved = animeList.filter(anime =>
    favorites.includes(Number(anime.mal_id))
  );

  favoritesGrid.innerHTML = saved.length
    ? saved.map(animeCard).join("")
    : emptyMessage("Your list is empty. Save an anime to find it here.");
}

function renderHistory() {
  if (!historyGrid) return;

  const recent = history.map(id =>
    animeList.find(anime => Number(anime.mal_id) === Number(id))
  ).filter(Boolean);

  historyGrid.innerHTML = recent.length
    ? recent.map(animeCard).join("")
    : emptyMessage("Open an anime to add it to your recent history.");
}

function addToHistory(id) {
  history = [
    id,
    ...history.filter(item => Number(item) !== id)
  ].slice(0, 12);

  saveData();
  renderHistory();
}

/* ---------- Official viewing options ---------- */

function viewingLinks(title) {
  const query = encodeURIComponent(title);

  return `
    <div class="detail-actions">
      <a class="button secondary"
        href="https://www.justwatch.com/us/search?q=${query}"
        target="_blank" rel="noopener noreferrer">
        Find where to watch ↗
      </a>

      <a class="button ghost"
        href="https://www.crunchyroll.com/search?q=${query}"
        target="_blank" rel="noopener noreferrer">
        Search Crunchyroll ↗
      </a>

      <a class="button ghost"
        href="https://www.netflix.com/search?q=${query}"
        target="_blank" rel="noopener noreferrer">
        Search Netflix ↗
      </a>

      <a class="button ghost"
        href="https://www.hulu.com/search?q=${query}"
        target="_blank" rel="noopener noreferrer">
        Search Hulu ↗
      </a>
    </div>
  `;
}

/* ---------- Anime details ---------- */

function openDetails(id) {
  const anime = animeList.find(
    item => Number(item.mal_id) === Number(id)
  );

  if (!anime || !details || !detailContent) return;

  activeAnime = anime;
  addToHistory(Number(id));

  const title = titleOf(anime);
  const poster = posterOf(anime);
  const genres = genresOf(anime).join(" · ") || "Anime";
  const saved = favorites.includes(Number(id));

  detailContent.innerHTML = `
    <div class="detail-hero">
      ${poster
        ? `<img class="detail-poster"
            src="${escapeHTML(poster)}"
            alt="${escapeHTML(title)} poster">`
        : ""}

      <div class="detail-copy">
        <p class="eyebrow muted">ANIME DETAILS</p>
        <h2>${escapeHTML(title)}</h2>

        <p>
          ★ ${anime.score
            ? Number(anime.score).toFixed(1)
            : "Not rated"} / 10
          · ${escapeHTML(String(yearOf(anime)))}
        </p>

        <p>${escapeHTML(genres)}</p>

        <p>${escapeHTML(
          anime.synopsis || "No description available."
        )}</p>
      </div>
    </div>

    <div class="detail-facts">
      <span>
        <strong>Episodes</strong>
        ${escapeHTML(String(anime.episodes || "Unknown"))}
      </span>
      <span>
        <strong>Status</strong>
        ${escapeHTML(anime.status || "Unknown")}
      </span>
    </div>

    <div class="watch-panel">
      <p class="eyebrow">WATCH OPTIONS</p>
      <h3>Find an official streaming service</h3>

      <p>
        Check these services for availability.
        Titles and subscriptions vary by country.
      </p>

      ${viewingLinks(title)}

      <p class="source-help">
        These links search official services or a viewing guide.
        Availability is not guaranteed. Afterglow does not unlock
        protected streams or include streaming subscriptions.
      </p>

      <div class="detail-actions">
        <button class="button primary" id="playInside" type="button">
          ▶ Open in player
        </button>

        <button class="button ghost" id="detailFavorite" type="button">
          ${saved ? "★ In My List" : "☆ Add to My List"}
        </button>
      </div>

      <p class="source-help">
        The in-app player requires a compatible direct video URL
        that you are authorized to play.
      </p>
    </div>
  `;

  if (!details.open) details.showModal();

  $("#playInside")?.addEventListener("click", () => {
    openPlayer(title);
  });

  $("#detailFavorite")?.addEventListener("click", () => {
    toggleFavorite(Number(id));
  });
}

/* ---------- Favorites ---------- */

function toggleFavorite(id) {
  id = Number(id);

  favorites = favorites.includes(id)
    ? favorites.filter(item => Number(item) !== id)
    : [...favorites, id];

  saveData();
  renderCatalog();

  if (
    activeAnime &&
    Number(activeAnime.mal_id) === id &&
    details?.open
  ) {
    openDetails(id);
  }
}

/* ---------- Featured hero ---------- */

function renderFeatured() {
  const hero = $("#hero");
  if (!hero || !animeList.length) return;

  const featured = animeList.filter(posterOf).slice(0, 8);
  if (!featured.length) return;

  featuredIndex = featuredIndex % featured.length;

  const anime = featured[featuredIndex];
  const title = titleOf(anime);
  const poster = posterOf(anime);

  hero.classList.add("featured-hero");

  hero.innerHTML = `
    <img class="featured-backdrop"
      src="${escapeHTML(poster)}" alt="">
    <div class="featured-shade"></div>

    <div class="featured-content">
      <p class="eyebrow">
        FEATURED ANIME · ${featuredIndex + 1} / ${featured.length}
      </p>

      <h1>${escapeHTML(title)}</h1>

      <p class="featured-description">
        ${escapeHTML(
          anime.synopsis || "Discover your next favorite story."
        )}
      </p>

      <p class="hero-note">
        ★ ${anime.score ? Number(anime.score).toFixed(1) : "Not rated"}
      </p>

      <div class="featured-controls">
        <button class="button primary" id="featuredPlay">
          View details ↗
        </button>
        <button class="button ghost" id="featuredPrev"
          aria-label="Previous anime">‹</button>
        <button class="button ghost" id="featuredNext"
          aria-label="Next anime">›</button>
      </div>

      <div class="featured-dots">
        ${featured.map((item, index) => `
          <button class="${index === featuredIndex ? "active" : ""}"
            data-feature-index="${index}"
            aria-label="Show ${escapeHTML(titleOf(item))}">
          </button>
        `).join("")}
      </div>
    </div>
  `;

  $("#featuredPlay")?.addEventListener("click", () => {
    openDetails(Number(anime.mal_id));
  });

  $("#featuredPrev")?.addEventListener("click", () => changeFeatured(-1));
  $("#featuredNext")?.addEventListener("click", () => changeFeatured(1));

  hero.querySelectorAll("[data-feature-index]").forEach(button => {
    button.addEventListener("click", () => {
      featuredIndex = Number(button.dataset.featureIndex);
      renderFeatured();
      startFeaturedRotation();
    });
  });
}

function changeFeatured(direction) {
  const total = animeList.filter(posterOf).slice(0, 8).length;
  if (!total) return;

  featuredIndex = (featuredIndex + direction + total) % total;
  renderFeatured();
}

function startFeaturedRotation() {
  if (featuredTimer) clearInterval(featuredTimer);

  featuredTimer = setInterval(() => {
    if (document.hidden || details?.open || playerDialog?.open) return;
    changeFeatured(1);
  }, 7000);
}

/* ---------- Catalog API ---------- */

async function fetchTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function loadCatalog() {
  loading = true;
  loadError = "";
  renderCatalog();

  try {
    const response = await fetchTimeout(
      `${API}/top/anime?limit=24&sfw=true`
    );

    if (!response.ok) throw new Error("Catalog request failed.");

    const result = await response.json();

    if (!Array.isArray(result.data) || !result.data.length) {
      throw new Error("No anime returned.");
    }

    animeList = result.data;
  } catch (error) {
    console.warn("Jikan failed; trying AniList.", error);

    try {
      const query = `
        query {
          Page(page: 1, perPage: 24) {
            media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
              id
              title { romaji english }
              coverImage { large }
              description(asHtml: false)
              averageScore
              episodes
              seasonYear
              genres
              status
            }
          }
        }
      `;

      const response = await fetchTimeout(
        "https://graphql.anilist.co",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query })
        }
      );

      if (!response.ok) {
        throw new Error("Backup catalog request failed.");
      }

      const result = await response.json();
      const items = result.data?.Page?.media || [];

      if (!items.length) throw new Error("No anime returned.");

      animeList = items.map(item => ({
        mal_id: item.id,
        title: item.title?.romaji || item.title?.english || "Untitled anime",
        title_english: item.title?.english || "",
        images: {
          webp: { large_image_url: item.coverImage?.large || "" }
        },
        score: item.averageScore ? item.averageScore / 10 : null,
        year: item.seasonYear,
        synopsis: item.description || "",
        episodes: item.episodes,
        status: item.status,
        genres: (item.genres || []).map(name => ({ name }))
      }));
    } catch (backupError) {
      console.error("Catalog sources failed.", backupError);
      animeList = [];
      loadError =
        "The anime catalog could not connect. Check your internet and try again.";
    }
  }

  loading = false;
  renderCatalog();

  if (animeList.length) {
    renderFeatured();
    startFeaturedRotation();
  }
}

/* ---------- In-app video player ---------- */

function openPlayer(title) {
  $("#playerTitle").textContent = title || "Now Playing";
  $("#playerStatus").textContent =
    "Enter a compatible, authorized video URL below.";

  $("#sourceUrl").value = "";
  stopVideo();

  if (!playerDialog.open) playerDialog.showModal();
}

function stopVideo() {
  if (!video) return;

  video.pause();
  video.removeAttribute("src");
  video.load();
}

$("#sourceForm")?.addEventListener("submit", event => {
  event.preventDefault();

  let url;

  try {
    url = new URL($("#sourceUrl").value.trim());
  } catch {
    $("#playerStatus").textContent = "Enter a valid video URL.";
    return;
  }

  if (!["https:", "http:"].includes(url.protocol)) {
    $("#playerStatus").textContent =
      "Only HTTP and HTTPS video URLs are supported.";
    return;
  }

  stopVideo();
  video.src = url.href;
  video.load();

  $("#playerStatus").textContent = "Loading video…";

  video.play().then(() => {
    $("#playerStatus").textContent = "Playing inside Afterglow.";
  }).catch(() => {
    $("#playerStatus").textContent =
      "Video loaded. Press Play, or check whether the source permits playback.";
  });
});

video?.addEventListener("error", () => {
  $("#playerStatus").textContent =
    "This video could not play. The URL may not be a direct video source or may block playback.";
});

$("#closePlayer")?.addEventListener("click", () => {
  playerDialog.close();
});

playerDialog?.addEventListener("close", stopVideo);

/* ---------- Global interactions ---------- */

document.addEventListener("click", event => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const openButton = target.closest("[data-open]");
  const favoriteButton = target.closest("[data-favorite]");

  if (openButton) {
    openDetails(Number(openButton.dataset.open));
    return;
  }

  if (favoriteButton) {
    toggleFavorite(Number(favoriteButton.dataset.favorite));
    return;
  }

  if (target.id === "retryCatalog") {
    loadCatalog();
  }

  if (target.closest("[data-close-info]")) {
    $("#infoDialog")?.close();
  }
});

$("#closeDetails")?.addEventListener("click", () => details.close());

details?.addEventListener("click", event => {
  if (event.target === details) details.close();
});

searchInput?.addEventListener("input", renderCatalog);
dubOnly?.addEventListener("change", renderCatalog);
genreFilter?.addEventListener("change", renderCatalog);

$("#exploreBtn")?.addEventListener("click", () => {
  $("#library").scrollIntoView({ behavior: "smooth" });
});

$("#howBtn")?.addEventListener("click", () => {
  $("#infoDialog")?.showModal();
});

document.querySelectorAll("[data-close-info]").forEach(button => {
  button.addEventListener("click", () => $("#infoDialog")?.close());
});

/* ---------- Main navigation ---------- */

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;

    document.querySelectorAll("[data-view]").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    catalog.hidden = currentView !== "home";
    $("#favoritesSection").hidden = currentView !== "favorites";
    $("#historySection").hidden = currentView !== "history";

    $("#sectionTitle").textContent =
      currentView === "favorites"
        ? "My List"
        : currentView === "history"
          ? "Recently Viewed"
          : "Discover anime";

    $("#sectionDescription").textContent =
      currentView === "favorites"
        ? "The anime you saved."
        : currentView === "history"
          ? "Titles you recently opened."
          : "Explore popular series and save the ones you love.";

    if (currentView === "favorites") renderFavorites();
    if (currentView === "history") renderHistory();

    $("#library").scrollIntoView({ behavior: "smooth" });
  });
});

/* ---------- Settings ---------- */

const settingsKeys = {
  appearance: "afterglow-appearance",
  wallpaper: "afterglow-wallpaper",
  glow: "afterglow-glow",
  motion: "afterglow-motion"
};

function loadSettings() {
  const appearance =
    localStorage.getItem(settingsKeys.appearance) || "dark";

  const wallpaper =
    localStorage.getItem(settingsKeys.wallpaper) || "glass";

  const glow = localStorage.getItem(settingsKeys.glow) !== "false";
  const motion = localStorage.getItem(settingsKeys.motion) !== "false";

  $("#appearance").value = appearance;
  $("#wallpaper").value = wallpaper;
  $("#glowEnabled").checked = glow;
  $("#motionEnabled").checked = motion;

  applySettings();
}

function applySettings() {
  const appearance = $("#appearance").value;
  const wallpaper = $("#wallpaper").value;

  document.documentElement.dataset.appearance =
    appearance === "system"
      ? (
          matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark"
        )
      : appearance;

  document.documentElement.dataset.wallpaper = wallpaper;

  document.documentElement.classList.toggle(
    "no-glow",
    !$("#glowEnabled").checked
  );

  document.documentElement.classList.toggle(
    "no-motion",
    !$("#motionEnabled").checked
  );
}

$("#settingsBtn")?.addEventListener("click", () => {
  $("#settingsDialog").showModal();
});

$("#closeSettings")?.addEventListener("click", () => {
  $("#settingsDialog").close();
});

$("#saveSettings")?.addEventListener("click", () => {
  localStorage.setItem(
    settingsKeys.appearance,
    $("#appearance").value
  );

  localStorage.setItem(
    settingsKeys.wallpaper,
    $("#wallpaper").value
  );

  localStorage.setItem(
    settingsKeys.glow,
    String($("#glowEnabled").checked)
  );

  localStorage.setItem(
    settingsKeys.motion,
    String($("#motionEnabled").checked)
  );

  applySettings();
  $("#settingsDialog").close();
});

/* ---------- Start Afterglow ---------- */

loadSettings();
loadCatalog();
