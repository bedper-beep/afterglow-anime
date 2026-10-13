/* Project Afterglow — app.js */
(() => {
  "use strict";

  const API = "https://api.jikan.moe/v4";
  const ANILIST_API = "https://graphql.anilist.co";
  const FAV_KEY = "afterglow-favorites";
  const HISTORY_KEY = "afterglow-history";
  const SETTINGS_KEY = "afterglow-settings";
  const $ = (selector, root = document) => root.querySelector(selector);

  const searchInput = $("#search");
  const catalog = $("#catalog");
  const detailsDialog = $("#details");
  const detailContent = $("#detailContent");
  const favoritesRoot = $("#favorites");
  const hero = $(".hero");

  let animeList = [];
  let featuredIndex = 0;
  let featuredTimer = null;
  let currentFilter = "";
  let settings = {
    wallpaper: "neon",
    appearance: "dark",
    glow: true,
    particles: true,
    motion: true
  };

  const safeRead = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  const safeWrite = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  const favorites = () => safeRead(FAV_KEY, []);
  const history = () => safeRead(HISTORY_KEY, []);

  const escapeHTML = (value = "") =>
    String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const titleOf = anime =>
    anime?.title_english || anime?.title || "Untitled anime";

  const imageOf = anime =>
    anime?.images?.webp?.large_image_url ||
    anime?.images?.jpg?.large_image_url ||
    anime?.coverImage?.extraLarge ||
    anime?.coverImage?.large ||
    "";

  const scoreOf = anime =>
    Number(anime?.score || anime?.averageScore / 10 || 0);

  const synopsisOf = anime =>
    anime?.synopsis ||
    anime?.description?.replace(/<[^>]*>/g, "") ||
    "No description is available yet.";

  const legalSearch = title =>
    `https://www.justwatch.com/us/search?q=${encodeURIComponent(title)}`;

  function normalizeAniList(item) {
    return {
      mal_id: item.id,
      title:
        item.title?.english ||
        item.title?.romaji ||
        item.title?.native ||
        "Untitled anime",
      title_english: item.title?.english || "",
      synopsis:
        item.description?.replace(/<[^>]*>/g, "") ||
        "No description is available yet.",
      score: item.averageScore ? item.averageScore / 10 : 0,
      episodes: item.episodes || null,
      year: item.seasonYear || null,
      status: item.status || "",
      images: {
        webp: {
          large_image_url:
            item.coverImage?.extraLarge ||
            item.coverImage?.large ||
            ""
        }
      },
      genres: item.genres || [],
      source: "AniList"
    };
  }

  async function fetchWithTimeout(url, options = {}, timeout = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadAnime() {
    setStatus("Loading anime catalog…");

    try {
      const result = await fetchWithTimeout(
        `${API}/top/anime?limit=24&sfw=true`
      );

      animeList = (result.data || []).map(item => ({
        ...item,
        source: "Jikan"
      }));

      if (!animeList.length) {
        throw new Error("No anime returned");
      }

      setStatus("Catalog updated from Jikan");
      renderAll();
      renderFeatured();
    } catch {
      try {
        const query = `
          query {
            Page(page: 1, perPage: 24) {
              media(
                type: ANIME,
                sort: POPULARITY_DESC,
                isAdult: false
              ) {
                id
                title {
                  romaji
                  english
                  native
                }
                description
                averageScore
                episodes
                seasonYear
                status
                coverImage {
                  large
                  extraLarge
                }
                genres
              }
            }
          }
        `;

        const data = await fetchWithTimeout(ANILIST_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ query })
        });

        animeList = (data.data?.Page?.media || [])
          .map(normalizeAniList);

        if (!animeList.length) {
          throw new Error("No backup results");
        }

        setStatus("Catalog updated from AniList");
        renderAll();
        renderFeatured();
      } catch {
        setStatus(
          "Could not load the catalog. Check your connection and try again.",
          true
        );

        if (catalog) {
          catalog.innerHTML = `
            <div class="empty-state">
              <h3>Catalog unavailable</h3>
              <p>Connect to the internet, then try again.</p>
              <button class="action-button" id="retryCatalog">
                Try again
              </button>
            </div>
          `;

          $("#retryCatalog")?.addEventListener("click", loadAnime);
        }
      }
    }
  }

  function setStatus(message, error = false) {
    let status = $("#sourceStatus");

    if (!status) {
      status = document.createElement("p");
      status.id = "sourceStatus";
      status.className = "source-status";

      const target = $("#discover") || catalog?.parentElement;
      target?.append(status);
    }

    status.textContent = message;
    status.classList.toggle("is-error", error);
  }

  function matchesFilter(anime) {
    const query = currentFilter.trim().toLowerCase();

    return !query ||
      [
        titleOf(anime),
        anime.title,
        anime.title_english,
        synopsisOf(anime),
        ...(anime.genres || [])
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
  }

  function cardMarkup(anime) {
    const id = String(anime.mal_id ?? anime.id);
    const isFav = favorites().some(
      item => String(item.mal_id ?? item.id) === id
    );

    const title = titleOf(anime);
    const image = imageOf(anime);

    return `
      <article class="anime-card" data-anime-id="${escapeHTML(id)}">
        <button
          class="poster-button"
          data-action="details"
          data-id="${escapeHTML(id)}"
          aria-label="View ${escapeHTML(title)} details"
        >
          ${
            image
              ? `<img
                  class="poster"
                  src="${escapeHTML(image)}"
                  alt="${escapeHTML(title)}"
                  loading="lazy"
                >`
              : `<span class="poster poster-placeholder">✦</span>`
          }
          <span class="poster-overlay">
            <span>View details ↗</span>
          </span>
        </button>

        <div class="card-copy">
          <div class="card-title-row">
            <h3>${escapeHTML(title)}</h3>

            <button
              class="favorite-button ${isFav ? "is-favorite" : ""}"
              data-action="favorite"
              data-id="${escapeHTML(id)}"
              aria-label="${isFav ? "Remove from" : "Add to"} favorites"
            >${isFav ? "★" : "☆"}</button>
          </div>

          <p class="card-meta">
            ${scoreOf(anime)
              ? `★ ${scoreOf(anime).toFixed(1)}`
              : "Score unavailable"}
            ${anime.year ? ` · ${escapeHTML(anime.year)}` : ""}
            ${anime.episodes
              ? ` · ${escapeHTML(anime.episodes)} eps`
              : ""}
          </p>

          <button
            class="text-link"
            data-action="details"
            data-id="${escapeHTML(id)}"
          >
            Explore anime <span>→</span>
          </button>
        </div>
      </article>
    `;
  }

  function renderCatalog() {
    if (!catalog) return;

    const filtered = animeList.filter(matchesFilter);

    catalog.innerHTML = filtered.length
      ? filtered.map(cardMarkup).join("")
      : `
        <div class="empty-state">
          <h3>No matches found</h3>
          <p>Try another title or search term.</p>
        </div>
      `;
  }

  function renderFavorites() {
    if (!favoritesRoot) return;

    const list = favorites();

    favoritesRoot.innerHTML = list.length
      ? list.map(cardMarkup).join("")
      : `
        <div class="empty-state compact-empty">
          <p>Your saved anime will appear here.</p>
          <span class="empty-star">✦</span>
        </div>
      `;
  }

  function renderHistory() {
    let section = $("#recentlyViewed");

    if (!section) {
      const main = $("main");
      if (!main) return;

      section = document.createElement("section");
      section.id = "recentlyViewed";
      section.className = "library-section";

      section.innerHTML = `
        <div class="section-heading">
          <div>
            <p class="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
            <h2>Recently viewed</h2>
          </div>
        </div>
        <div id="historyCards" class="anime-grid"></div>
      `;

      const favoritesSection = $("#my-list");

      if (favoritesSection) {
        favoritesSection.before(section);
      } else {
        main.append(section);
      }
    }

    const target = $("#historyCards");
    if (!target) return;

    const recent = history()
      .map(saved =>
        animeList.find(item =>
          String(item.mal_id ?? item.id) ===
          String(saved.mal_id ?? saved.id)
        ) || saved
      )
      .slice(0, 6);

    target.innerHTML = recent.length
      ? recent.map(cardMarkup).join("")
      : `
        <div class="empty-state compact-empty">
          <p>Anime you explore will show up here.</p>
        </div>
      `;
  }

  function renderAll() {
    renderCatalog();
    renderFavorites();
    renderHistory();
  }

  function getAnime(id) {
    return (
      animeList.find(
        item => String(item.mal_id ?? item.id) === String(id)
      ) ||
      favorites().find(
        item => String(item.mal_id ?? item.id) === String(id)
      ) ||
      history().find(
        item => String(item.mal_id ?? item.id) === String(id)
      )
    );
  }

  function openDetails(id) {
    const anime = getAnime(id);

    if (!anime || !detailContent || !detailsDialog) return;

    const title = titleOf(anime);
    const img = imageOf(anime);

    const genres = (anime.genres || [])
      .map(genre => typeof genre === "string" ? genre : genre.name)
      .filter(Boolean);

    const isFav = favorites().some(
      item => String(item.mal_id ?? item.id) ===
        String(anime.mal_id ?? anime.id)
    );

    detailContent.innerHTML = `
      <div class="detail-layout">
        <div class="detail-poster-wrap">
          ${
            img
              ? `<img
                  class="detail-poster"
                  src="${escapeHTML(img)}"
                  alt="${escapeHTML(title)}"
                >`
              : `<div class="detail-poster poster-placeholder">✦</div>`
          }
        </div>

        <div class="detail-copy">
          <p class="eyebrow">ANIME DETAILS</p>
          <h2>${escapeHTML(title)}</h2>

          <p class="detail-meta">
            ${scoreOf(anime)
              ? `★ ${scoreOf(anime).toFixed(1)} / 10`
              : "Score unavailable"}
            ${anime.year ? ` · ${escapeHTML(anime.year)}` : ""}
            ${anime.episodes
              ? ` · ${escapeHTML(anime.episodes)} episodes`
              : ""}
          </p>

          ${
            genres.length
              ? `<div class="genre-list">
                  ${genres.map(genre =>
                    `<span>${escapeHTML(genre)}</span>`
                  ).join("")}
                </div>`
              : ""
          }

          <p class="detail-synopsis">
            ${escapeHTML(synopsisOf(anime))}
          </p>

          <div class="detail-actions">
            <a
              class="action-button primary-action"
              href="${legalSearch(title)}"
              target="_blank"
              rel="noopener noreferrer"
            >Find legal viewing options ↗</a>

            <button
              class="action-button secondary-action"
              data-action="favorite"
              data-id="${escapeHTML(anime.mal_id ?? anime.id)}"
            >${isFav ? "★ Saved to My List" : "☆ Add to My List"}</button>
          </div>

          <p class="legal-note">
            Availability depends on your region and subscription.
            This link searches for licensed viewing options.
          </p>
        </div>
      </div>
    `;

    const oldHistory = history().filter(
      item => String(item.mal_id ?? item.id) !==
        String(anime.mal_id ?? anime.id)
    );

    safeWrite(HISTORY_KEY, [
      { ...anime, viewedAt: Date.now() },
      ...oldHistory
    ].slice(0, 12));

    renderHistory();

    if (typeof detailsDialog.showModal === "function") {
      detailsDialog.showModal();
    } else {
      detailsDialog.setAttribute("open", "");
    }
  }

  function toggleFavorite(id) {
    const anime = getAnime(id);
    if (!anime) return;

    const list = favorites();

    const exists = list.some(
      item => String(item.mal_id ?? item.id) === String(id)
    );

    safeWrite(
      FAV_KEY,
      exists
        ? list.filter(
            item => String(item.mal_id ?? item.id) !== String(id)
          )
        : [{ ...anime }, ...list]
    );

    renderAll();

    if (detailsDialog?.open) {
      openDetails(id);
    }
  }

  function renderFeatured() {
    if (!animeList.length) return;

    const titleEl =
      $("#heroTitle") || $(".hero h1") || $(".hero h2");

    const descriptionEl =
      $("#heroDescription") || $(".hero p");

    const imageEl =
      $("#heroImage") || $(".hero img");

    const exploreBtn =
      $("#heroExplore") || $(".hero [data-action='details']");

    const dots = $("#heroDots");
    const anime = animeList[featuredIndex % animeList.length];
    const synopsis = synopsisOf(anime);

    if (titleEl) {
      titleEl.textContent = titleOf(anime);
    }

    if (descriptionEl) {
      descriptionEl.textContent =
        synopsis.slice(0, 220) +
        (synopsis.length > 220 ? "…" : "");
    }

    if (imageEl && imageOf(anime)) {
      imageEl.src = imageOf(anime);
      imageEl.alt = titleOf(anime);
    } else if (hero && imageOf(anime)) {
      hero.style.setProperty(
        "--hero-art",
        `url("${imageOf(anime)}")`
      );
    }

    if (exploreBtn) {
      exploreBtn.dataset.action = "details";
      exploreBtn.dataset.id = String(anime.mal_id ?? anime.id);

      if (exploreBtn.tagName === "A") {
        exploreBtn.href = "#discover";
      }
    }

    if (dots) {
      dots.innerHTML = animeList
        .slice(0, Math.min(5, animeList.length))
        .map((_, index) => `
          <button
            class="hero-dot ${
              index === featuredIndex % 5 ? "active" : ""
            }"
            data-feature-index="${index}"
            aria-label="Featured anime ${index + 1}"
          ></button>
        `)
        .join("");
    }
  }

  function setupFeaturedRotation() {
    $("#heroNext")?.addEventListener("click", () => {
      featuredIndex =
        (featuredIndex + 1) % Math.max(animeList.length, 1);
      renderFeatured();
    });

    $("#heroPrevious")?.addEventListener("click", () => {
      featuredIndex =
        (featuredIndex - 1 + animeList.length) %
        Math.max(animeList.length, 1);
      renderFeatured();
    });

    if (featuredTimer) clearInterval(featuredTimer);

    featuredTimer = setInterval(() => {
      if (!document.hidden && settings.motion && animeList.length > 1) {
        featuredIndex = (featuredIndex + 1) % animeList.length;
        renderFeatured();
      }
    }, 6500);
  }

  function addSettingsAndSplash() {
    const topbar = $(".topbar");

    if (topbar && !$("#settingsToggle")) {
      const button = document.createElement("button");

      button.id = "settingsToggle";
      button.className = "settings-toggle";
      button.type = "button";
      button.setAttribute("aria-label", "Open appearance settings");
      button.title = "Appearance settings";

      button.innerHTML = `
        <span aria-hidden="true">⚙</span>
        <span class="settings-label">Settings</span>
      `;

      const search = $("#search");

      if (search) {
        search.insertAdjacentElement("afterend", button);
      } else {
        topbar.append(button);
      }
    }

    if (!$("#settingsPanel")) {
      const panel = document.createElement("aside");

      panel.id = "settingsPanel";
      panel.className = "settings-panel";
      panel.hidden = true;
      panel.setAttribute("aria-label", "Appearance settings");

      panel.innerHTML = `
        <div class="settings-head">
          <div>
            <p class="eyebrow">MAKE IT YOURS</p>
            <h2>Appearance</h2>
          </div>
          <button
            class="icon-button"
            id="closeSettings"
            aria-label="Close settings"
          >×</button>
        </div>

        <label class="setting-label">Wallpaper</label>

        <div class="wallpaper-options">
          <button class="wallpaper-choice neon" data-wallpaper="neon">
            <span>Neon City</span>
          </button>
          <button class="wallpaper-choice sunset" data-wallpaper="sunset">
            <span>Sunset Beach</span>
          </button>
          <button class="wallpaper-choice galaxy" data-wallpaper="galaxy">
            <span>Galaxy</span>
          </button>
          <button class="wallpaper-choice glass" data-wallpaper="glass">
            <span>Frosted Glass</span>
          </button>
        </div>

        <label class="setting-label" for="appearanceChoice">
          Appearance mode
        </label>

        <select id="appearanceChoice" class="settings-select">
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">Match device</option>
        </select>

        <div class="setting-switch">
          <span>
            <strong>Glow effects</strong>
            <small>Soft neon highlights</small>
          </span>
          <input type="checkbox" id="glowChoice">
        </div>

        <div class="setting-switch">
          <span>
            <strong>Floating particles</strong>
            <small>Subtle background detail</small>
          </span>
          <input type="checkbox" id="particlesChoice">
        </div>

        <div class="setting-switch">
          <span>
            <strong>Motion effects</strong>
            <small>Gentle movement and rotation</small>
          </span>
          <input type="checkbox" id="motionChoice">
        </div>

        <p class="settings-footnote">
          Your choices are saved on this device.
        </p>
      `;

      document.body.append(panel);
    }

    if (
      !$("#afterglowSplash") &&
      !safeRead("afterglow-splash-seen", false)
    ) {
      const splash = document.createElement("div");

      splash.id = "afterglowSplash";
      splash.className = "splash-screen";

      splash.innerHTML = `
        <div class="splash-logo">✦</div>
        <div class="splash-name">afterglow<span>.</span></div>
        <p>Your next anime discovery starts here.</p>
        <div class="splash-loader"><i></i></div>
      `;

      document.body.append(splash);

      window.setTimeout(() => {
        splash.classList.add("splash-hidden");
        safeWrite("afterglow-splash-seen", true);

        window.setTimeout(() => splash.remove(), 500);
      }, 1900);
    }
  }

  function applySettings() {
    document.documentElement.dataset.wallpaper =
      settings.wallpaper || "neon";

    document.documentElement.dataset.appearance =
      settings.appearance || "dark";

    document.documentElement.classList.toggle(
      "no-glow",
      !settings.glow
    );

    document.documentElement.classList.toggle(
      "no-particles",
      !settings.particles
    );

    document.documentElement.classList.toggle(
      "no-motion",
      !settings.motion
    );

    const panel = $("#settingsPanel");

    if (panel) {
      $("#appearanceChoice").value =
        settings.appearance || "dark";

      $("#glowChoice").checked = !!settings.glow;
      $("#particlesChoice").checked = !!settings.particles;
      $("#motionChoice").checked = !!settings.motion;

      panel.querySelectorAll("[data-wallpaper]").forEach(button => {
        button.classList.toggle(
          "selected",
          button.dataset.wallpaper === settings.wallpaper
        );
      });
    }

    safeWrite(SETTINGS_KEY, settings);
  }

  function setupSettings() {
    settings = {
      ...settings,
      ...safeRead(SETTINGS_KEY, {})
    };

    applySettings();

    $("#settingsToggle")?.addEventListener("click", () => {
      const panel = $("#settingsPanel");
      panel.hidden = !panel.hidden;
      panel.classList.toggle("panel-open", !panel.hidden);
    });

    $("#closeSettings")?.addEventListener("click", () => {
      $("#settingsPanel").hidden = true;
      $("#settingsPanel").classList.remove("panel-open");
    });

    $("#settingsPanel")?.addEventListener("click", event => {
      const button = event.target.closest("[data-wallpaper]");

      if (button) {
        settings.wallpaper = button.dataset.wallpaper;
        applySettings();
      }
    });

    $("#appearanceChoice")?.addEventListener("change", event => {
      settings.appearance = event.target.value;
      applySettings();
    });

    [
      ["glowChoice", "glow"],
      ["particlesChoice", "particles"],
      ["motionChoice", "motion"]
    ].forEach(([id, key]) => {
      $(`#${id}`)?.addEventListener("change", event => {
        settings[key] = event.target.checked;
        applySettings();
      });
    });

    document.addEventListener("click", event => {
      const panel = $("#settingsPanel");
      const toggle = $("#settingsToggle");

      if (
        panel &&
        !panel.hidden &&
        !panel.contains(event.target) &&
        !toggle?.contains(event.target)
      ) {
        panel.hidden = true;
        panel.classList.remove("panel-open");
      }
    });

    document.addEventListener("keydown", event => {
      const panel = $("#settingsPanel");

      if (event.key === "Escape" && panel && !panel.hidden) {
        panel.hidden = true;
        panel.classList.remove("panel-open");
      }
    });
  }

  document.addEventListener("click", event => {
    const action = event.target.closest("[data-action]");

    if (action) {
      const id = action.dataset.id;

      if (action.dataset.action === "details") {
        openDetails(id);
      }

      if (action.dataset.action === "favorite") {
        event.preventDefault();
        toggleFavorite(id);
      }
    }

    const featureDot = event.target.closest("[data-feature-index]");

    if (featureDot) {
      featuredIndex = Number(featureDot.dataset.featureIndex) || 0;
      renderFeatured();
    }
  });

  searchInput?.addEventListener("input", event => {
    currentFilter = event.target.value;
    renderCatalog();
  });

  $("#dubOnly")?.addEventListener("change", event => {
    if (event.target.checked) {
      setStatus(
        "Dub filter is a rough title-based guide, not a verified dub database."
      );
    } else {
      setStatus("Catalog ready");
    }
  });

  detailsDialog?.addEventListener("click", event => {
    if (event.target === detailsDialog) {
      detailsDialog.close();
    }
  });

  $("#closeDetails")?.addEventListener("click", () => {
    detailsDialog?.close();
  });

  addSettingsAndSplash();
  setupSettings();
  setupFeaturedRotation();
  renderAll();
  loadAnime();
})();
