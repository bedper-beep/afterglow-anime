const animeList = [
  {
    id: 1,
    title: "Attack on Titan",
    symbol: "進",
    rating: "9.1",
    year: 2013,
    genres: "Action · Fantasy",
    dub: true,
    color: "linear-gradient(145deg,#293a4b,#a45f4c)",
    description: "Humanity fights for survival behind enormous walls in a world threatened by mysterious Titans.",
    video: ""
  },
  {
    id: 2,
    title: "Spy x Family",
    symbol: "家",
    rating: "8.4",
    year: 2022,
    genres: "Comedy · Action",
    dub: true,
    color: "linear-gradient(145deg,#354c40,#b5a16c)",
    description: "A spy, an assassin, and a telepath form an unusual family while hiding their secrets.",
    video: ""
  },
  {
    id: 3,
    title: "Demon Slayer",
    symbol: "滅",
    rating: "8.7",
    year: 2019,
    genres: "Action · Fantasy",
    dub: true,
    color: "linear-gradient(145deg,#2a514c,#a64248)",
    description: "A determined young swordsman searches for a way to save his sister and confront demons.",
    video: ""
  },
  {
    id: 4,
    title: "My Hero Academia",
    symbol: "力",
    rating: "8.2",
    year: 2016,
    genres: "Action · Superhero",
    dub: true,
    color: "linear-gradient(145deg,#3b634e,#4b76a0)",
    description: "A student works toward becoming a hero in a world where special powers are common.",
    video: ""
  },
  {
    id: 5,
    title: "Death Note",
    symbol: "死",
    rating: "8.9",
    year: 2006,
    genres: "Thriller · Mystery",
    dub: true,
    color: "linear-gradient(145deg,#24232d,#75545e)",
    description: "A student discovers a mysterious notebook and becomes involved in a dangerous battle of wits.",
    video: ""
  },
  {
    id: 6,
    title: "Haikyu!!",
    symbol: "飛",
    rating: "8.7",
    year: 2014,
    genres: "Sports · Comedy",
    dub: true,
    color: "linear-gradient(145deg,#bc663e,#4c6c7a)",
    description: "A determined volleyball player joins his school team and dreams of reaching the top.",
    video: ""
  },
  {
    id: 7,
    title: "Fullmetal Alchemist: Brotherhood",
    symbol: "鋼",
    rating: "9.1",
    year: 2009,
    genres: "Adventure · Fantasy",
    dub: true,
    color: "linear-gradient(145deg,#726b51,#a65d43)",
    description: "Two brothers search for a way to restore what they lost after a forbidden experiment.",
    video: ""
  },
  {
    id: 8,
    title: "Your Name",
    symbol: "君",
    rating: "8.4",
    year: 2016,
    genres: "Romance · Fantasy",
    dub: true,
    color: "linear-gradient(145deg,#627f9e,#b68a9b)",
    description: "Two teenagers begin mysteriously switching lives and try to understand their connection.",
    video: ""
  }
];

const catalog = document.getElementById("catalog");
const favoritesGrid = document.getElementById("favorites");
const searchInput = document.getElementById("search");
const dubOnly = document.getElementById("dubOnly");
const details = document.getElementById("details");
const detailContent = document.getElementById("detailContent");

const readList = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
};

let favorites = readList("afterglow-favorites");
let history = readList("afterglow-history");

function saveData() {
  localStorage.setItem("afterglow-favorites", JSON.stringify(favorites));
  localStorage.setItem("afterglow-history", JSON.stringify(history));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function animeCard(anime) {
  const saved = favorites.includes(anime.id);

  return `
    <article class="anime-card">
      <div class="poster"
        style="background:${anime.color}"
        role="button"
        tabindex="0"
        data-open="${anime.id}"
        aria-label="View ${escapeHTML(anime.title)}">
        <span class="poster-symbol">${escapeHTML(anime.symbol)}</span>
        <span class="poster-title">${escapeHTML(anime.title)}</span>
        <span class="poster-label">ANIME COLLECTION</span>
      </div>
      <div class="card-info">
        <h3>${escapeHTML(anime.title)}</h3>
        <span class="rating">★ ${anime.rating}</span>
      </div>
      <div class="card-meta">${anime.year} · ${escapeHTML(anime.genres)}</div>
      <span class="card-badge">${anime.dub ? "English dub listed" : "Dub unconfirmed"}</span>
      <div class="card-actions">
        <button data-open="${anime.id}">Details</button>
        <button data-favorite="${anime.id}" aria-pressed="${saved}">
          ${saved ? "♥ Saved" : "♡ Favorite"}
        </button>
      </div>
    </article>
  `;
}

function renderCatalog() {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = animeList.filter(anime => {
    const matchesSearch =
      anime.title.toLowerCase().includes(query) ||
      anime.genres.toLowerCase().includes(query);

    return matchesSearch && (!dubOnly.checked || anime.dub);
  });

  catalog.innerHTML = filtered.length
    ? filtered.map(animeCard).join("")
    : '<p class="empty">No anime found. Try another search.</p>';

  const savedAnime = animeList.filter(anime => favorites.includes(anime.id));

  favoritesGrid.innerHTML = savedAnime.length
    ? savedAnime.map(animeCard).join("")
    : '<p class="empty">Your list is empty. Save an anime to find it here.</p>';
}

function openDetails(id) {
  const anime = animeList.find(item => item.id === id);
  if (!anime) return;

  if (!history.includes(id)) history.unshift(id);
  history = history.filter(item => animeList.some(a => a.id === item)).slice(0, 20);
  saveData();

  detailContent.innerHTML = `
    <p class="eyebrow">AFTERGLOW COLLECTION</p>
    <h2>${escapeHTML(anime.title)}</h2>
    <p>★ ${anime.rating} · ${anime.year} · ${escapeHTML(anime.genres)}</p>
    <span class="card-badge">${anime.dub ? "English dub listed — verify availability" : "English dub not confirmed"}</span>
    <p>${escapeHTML(anime.description)}</p>
    <h3>Watch options</h3>
    <p>Choose an authorized video URL below to play a video you have permission to stream.</p>
    <input id="videoURL" class="source-input" type="url"
      placeholder="Paste an authorized MP4 or HLS video URL">
    <button class="button" id="playVideo">Play video</button>
    <video id="videoPlayer" controls playsinline preload="metadata" hidden></video>
    <p id="playerMessage" role="status"></p>
    <button class="button" id="retryVideo" hidden>Retry source</button>
    <h3>Backup sources</h3>
    <p>Try a different authorized video URL if the first one does not work.</p>
    <input id="backupURL" class="source-input" type="url"
      placeholder="Paste backup video URL">
    <button class="button" id="playBackup">Try backup source</button>
  `;

  details.showModal();

  const video = document.getElementById("videoPlayer");
  const message = document.getElementById("playerMessage");
  const retry = document.getElementById("retryVideo");
  const videoURL = document.getElementById("videoURL");
  const backupURL = document.getElementById("backupURL");

  function playSource(url) {
    if (!url) {
      message.textContent = "Enter a valid video URL first.";
      return;
    }

    try {
      const parsed = new URL(url);
      if (!["https:", "http:"].includes(parsed.protocol)) {
        throw new Error("Unsupported URL");
      }

      video.hidden = false;
      video.src = parsed.href;
      video.load();
      retry.hidden = false;
      message.textContent = "Loading video…";

      video.onerror = () => {
        message.textContent =
          "This source did not play. Check the URL, format, permissions, or try your backup source.";
      };

      video.oncanplay = () => {
        message.textContent = "Video ready.";
      };

      video.play().catch(() => {
        message.textContent =
          "Video loaded. Press Play; some browsers require a direct tap.";
      });
    } catch {
      message.textContent = "That URL does not look valid.";
    }
  }

  document.getElementById("playVideo").addEventListener("click", () => {
    playSource(videoURL.value.trim());
  });

  document.getElementById("playBackup").addEventListener("click", () => {
    playSource(backupURL.value.trim());
  });

  retry.addEventListener("click", () => {
    if (video.src) {
      video.load();
      video.play().catch(() => {});
      message.textContent = "Retrying video…";
    }
  });
}

document.addEventListener("click", event => {
  const openButton = event.target.closest("[data-open]");
  const favoriteButton = event.target.closest("[data-favorite]");

  if (openButton) {
    openDetails(Number(openButton.dataset.open));
  }

  if (favoriteButton) {
    const id = Number(favoriteButton.dataset.favorite);

    favorites = favorites.includes(id)
      ? favorites.filter(item => item !== id)
      : [...favorites, id];

    saveData();
    renderCatalog();
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

document.getElementById("closeDetails").addEventListener("click", () => {
  details.close();
});

searchInput.addEventListener("input", renderCatalog);
dubOnly.addEventListener("change", renderCatalog);

renderCatalog();


