/* 
================================================================
   VidNest - Interactive Playground & Coordinator (app.js)
================================================================
*/

// Platform State
const appState = {
  type: 'tv', // 'tv' or 'movie'
  tmdbId: '273240',
  season: '1',
  episode: '1',
  showName: 'The Deal'
};

// Mock Show Names Dictionary for TMDB coordinates
const SHOW_NAMES = {
  '273240': 'The Deal',
  '105248': 'Cyberpunk: Edgerunners',
  '693134': 'Dune: Part Two',
  '564147': 'K.G.F: Chapter 1'
};

// DOM Elements
const tabTv = document.getElementById('tabTv');
const tabMovie = document.getElementById('tabMovie');
const inputsRow = document.getElementById('inputsRow');
const idLabel = document.getElementById('idLabel');
const tmdbIdInput = document.getElementById('tmdbIdInput');
const seasonInput = document.getElementById('seasonInput');
const episodeInput = document.getElementById('episodeInput');
const codeSnippet = document.getElementById('codeSnippet');
const previewIframe = document.getElementById('previewIframe');
const streamTitleText = document.getElementById('streamTitleText');
const streamCoordinatesText = document.getElementById('streamCoordinatesText');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const launchStreamBtn = document.getElementById('launchStreamBtn');
const toastContainer = document.getElementById('toastContainer');

// Showcase Cards list
const showCards = document.querySelectorAll('.show-card');

// Tabs in documentation
const docTabIframeBtn = document.getElementById('docTabIframeBtn');
const docTabJsonBtn = document.getElementById('docTabJsonBtn');
const docTabFailoverBtn = document.getElementById('docTabFailoverBtn');
const docTabIframe = document.getElementById('docTabIframe');
const docTabJson = document.getElementById('docTabJson');
const docTabFailover = document.getElementById('docTabFailover');

// Parse query parameters on load to auto-configure dashboard
function parseUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('type')) appState.type = urlParams.get('type');
  if (urlParams.has('id')) appState.tmdbId = urlParams.get('id');
  if (urlParams.has('s')) appState.season = urlParams.get('s');
  if (urlParams.has('season')) appState.season = urlParams.get('season');
  if (urlParams.has('e')) appState.episode = urlParams.get('e');
  if (urlParams.has('episode')) appState.episode = urlParams.get('episode');
  if (urlParams.has('server')) appState.server = urlParams.get('server');
}

// Initialize portal scripts
function initPortal() {
  setupEventListeners();
  parseUrlParams();
  updateGeneratorUI();
  updateSnippetCode();
  setupDocTabs();
  
  // If id is provided in parameters, auto-launch the stream instantly!
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('id')) {
    launchStream();
  }
}

// Coordinate TV/Movie inputs swapping
function setMediaType(type) {
  appState.type = type;
  if (type === 'movie') {
    tabTv.classList.remove('active');
    tabMovie.classList.add('active');
    inputsRow.classList.add('movie-mode');
    idLabel.innerText = "TMDB Movie Identifier";
    seasonInput.style.display = 'none';
    episodeInput.style.display = 'none';
  } else {
    tabMovie.classList.remove('active');
    tabTv.classList.add('active');
    inputsRow.classList.remove('movie-mode');
    idLabel.innerText = "TMDB ID & Coordinates";
    seasonInput.style.display = 'block';
    episodeInput.style.display = 'block';
  }
  updateSnippetCode();
}

// Generate Embed Syntax Snippet
function updateSnippetCode() {
  appState.tmdbId = tmdbIdInput.value.trim() || '273240';
  appState.season = seasonInput.value || '1';
  appState.episode = episodeInput.value || '1';

  const currentOrigin = window.location.origin;
  let embedUrl = `${currentOrigin}/embed/${appState.type}/${appState.tmdbId}`;
  if (appState.type === 'tv') {
    embedUrl += `/${appState.season}/${appState.episode}`;
  }
  
  if (appState.server) {
    embedUrl += `?server=${appState.server}`;
  }

  // Update Syntax Highlight Code block
  codeSnippet.innerHTML = `
    <span class="tag">&lt;iframe</span> 
    <span class="attr">src</span>=<span class="val">"${embedUrl}"</span> 
    <span class="attr">width</span>=<span class="val">"100%"</span> 
    <span class="attr">height</span>=<span class="val">"100%"</span> 
    <span class="attr">frameborder</span>=<span class="val">"0"</span> 
    <span class="attr">allowfullscreen</span><span class="tag">&gt;&lt;/iframe&gt;</span>
  `.trim();
}

// Sync Form Fields from State
function updateGeneratorUI() {
  tmdbIdInput.value = appState.tmdbId;
  seasonInput.value = appState.season;
  episodeInput.value = appState.episode;
  setMediaType(appState.type);
}

// Launch Video Stream in Iframe
async function launchStream() {
  updateSnippetCode();
  
  // Attempt to fetch real dynamic TMDB metadata from our backend API
  try {
    const metaRes = await fetch(`/api/metadata/${appState.type}/${appState.tmdbId}`);
    if (metaRes.ok) {
      const metaData = await metaRes.json();
      if (metaData.success && metaData.title) {
        appState.showName = metaData.title;
      } else {
        appState.showName = SHOW_NAMES[appState.tmdbId] || `Custom ID: ${appState.tmdbId}`;
      }
    } else {
      appState.showName = SHOW_NAMES[appState.tmdbId] || `Custom ID: ${appState.tmdbId}`;
    }
  } catch (e) {
    appState.showName = SHOW_NAMES[appState.tmdbId] || `Custom ID: ${appState.tmdbId}`;
  }
  
  // Format coordinate display
  let coordinates = "";
  if (appState.type === 'movie') {
    coordinates = "Movie • Direct HD Feed";
  } else {
    coordinates = `TV Show • Season ${appState.season} • Episode ${appState.episode}`;
  }

  // Update visual text elements
  streamTitleText.innerText = appState.showName;
  streamCoordinatesText.innerText = coordinates;

  // Build simulated child player URL
  let playerUrl = `player.html?type=${appState.type}&id=${appState.tmdbId}`;
  if (appState.type === 'tv') {
    playerUrl += `&s=${appState.season}&e=${appState.episode}`;
  }
  if (appState.server) {
    playerUrl += `&server=${appState.server}`;
  }
  playerUrl += `&autoplay=1&v=2.2`;

  // Force Iframe reload
  previewIframe.src = playerUrl;
  
  showToast("Streaming stream feed triggered successfully!");
}

// Copy Code to Clipboard
function copySnippet() {
  // Extract plain text string
  const currentOrigin = window.location.origin;
  let embedUrl = `${currentOrigin}/embed/${appState.type}/${appState.tmdbId}`;
  if (appState.type === 'tv') {
    embedUrl += `/${appState.season}/${appState.episode}`;
  }
  if (appState.server) {
    embedUrl += `?server=${appState.server}`;
  }
  
  const iframeString = `<iframe src="${embedUrl}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;
  
  navigator.clipboard.writeText(iframeString).then(() => {
    showToast("Embed code copied to clipboard!");
  }).catch(err => {
    console.error("Failed to copy code: ", err);
  });
}

// Display Beautiful Glass Toast Messages
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);

  // Auto remove toast after animation
  setTimeout(() => {
    toast.style.animation = 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 2500);
}

// Set up developer doc tab click transitions
function setupDocTabs() {
  const triggers = [docTabIframeBtn, docTabJsonBtn, docTabFailoverBtn];
  const contents = [docTabIframe, docTabJson, docTabFailover];

  triggers.forEach((trigger, idx) => {
    trigger.addEventListener('click', () => {
      // Clear active states
      triggers.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));

      // Make chosen active
      trigger.classList.add('active');
      contents[idx].classList.add('active');
    });
  });
}

// Event Listeners coordination
function setupEventListeners() {
  // Type toggles
  tabTv.addEventListener('click', () => setMediaType('tv'));
  tabMovie.addEventListener('click', () => setMediaType('movie'));

  // Inputs update code real-time
  tmdbIdInput.addEventListener('input', updateSnippetCode);
  seasonInput.addEventListener('input', updateSnippetCode);
  episodeInput.addEventListener('input', updateSnippetCode);

  // Buttons triggers
  launchStreamBtn.addEventListener('click', launchStream);
  copyCodeBtn.addEventListener('click', copySnippet);

  // Showcase Cards clicks coordination
  showCards.forEach(card => {
    card.addEventListener('click', () => {
      const type = card.getAttribute('data-type');
      const id = card.getAttribute('data-id');
      const name = card.getAttribute('data-name');
      
      appState.type = type;
      appState.tmdbId = id;
      appState.showName = name;

      if (type === 'tv') {
        appState.season = card.getAttribute('data-season') || '1';
        appState.episode = card.getAttribute('data-episode') || '1';
      }

      updateGeneratorUI();
      launchStream();
      
      // Smooth scroll back to playground
      document.getElementById('playground').scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Communication receiver from player iframe
  window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data) return;

    if (data.type === 'next-episode') {
      // Simulated autoplay next episode coordination
      appState.episode = data.episode.toString();
      updateGeneratorUI();
      updateSnippetCode();
      
      // Update portal metadata
      streamCoordinatesText.innerText = `TV Show • Season ${appState.season} • Episode ${appState.episode}`;
      showToast(`Automatically transitioned to Episode ${appState.episode}!`);
    }
    
    if (data.type === 'server-change') {
      // Child player changed server
      showToast(`Routed to Server ${data.serverName || data.server}`);
    }
  });
}

// App start
window.onload = initPortal;
