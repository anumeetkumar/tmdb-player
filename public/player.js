/* 
================================================================
   VidNest - Interactive Video Playback Engine (player.js)
================================================================
*/

// WebVTT Subtitle Parser for custom floating HUD overlay
function parseVTT(vttText) {
  const cues = [];
  const lines = vttText.split(/\r?\n/);
  let currentCue = null;
  const timeRegex = /(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})/;
  const shortTimeRegex = /(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2})\.(\d{3})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let match = line.match(timeRegex);
    let start, end;
    if (match) {
      start = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseFloat(match[4] / 1000);
      end = parseInt(match[5]) * 3600 + parseInt(match[6]) * 60 + parseInt(match[7]) + parseFloat(match[8] / 1000);
    } else {
      match = line.match(shortTimeRegex);
      if (match) {
        start = parseInt(match[1]) * 60 + parseInt(match[2]) + parseFloat(match[3] / 1000);
        end = parseInt(match[4]) * 60 + parseInt(match[5]) + parseFloat(match[6] / 1000);
      }
    }

    if (match) {
      currentCue = { start, end, text: '' };
      cues.push(currentCue);
    } else if (currentCue && !line.match(/^\d+$/)) {
      if (currentCue.text) currentCue.text += '\n';
      currentCue.text += line;
    }
  }
  return cues;
}

// Fallback Mock Servers if Backend is Unavailable
const FALLBACK_STREAM_SERVERS = {
  lamda: {
    name: "Lamda",
    url: "https://d2zihajmogu5jn.cloudfront.net/bipbop/bipbopall.m3u8",
    sub: "Original Audio",
    status: "available",
    subtitles: []
  },
  ophim: {
    name: "Ophim",
    url: "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    sub: "Direct Stream",
    status: "available",
    subtitles: []
  },
  prime: {
    name: "Prime",
    url: "https://d2zihajmogu5jn.cloudfront.net/sintel/master.m3u8",
    sub: "Multi-Audio HQ",
    status: "available",
    subtitles: []
  },
  alfa: {
    name: "Alfa",
    url: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    sub: "Original Audio",
    status: "available",
    subtitles: []
  }
};

// Fallback Subtitle Data
const FALLBACK_SUBTITLE_DATA = {
  en: [
    { start: 1, end: 5, text: "Welcome to VidNest Streaming API Embed Platform." },
    { start: 6, end: 11, text: "Serving high-definition, ad-free video streams worldwide." },
    { start: 12, end: 17, text: "We offer advanced failover protection with up to 10 fallback servers." },
    { start: 18, end: 24, text: "This demo show is running inside a secure sandbox container." }
  ]
};

// Active Dynamic Server and Subtitle Data
let STREAM_SERVERS = { ...FALLBACK_STREAM_SERVERS };
let SUBTITLE_DATA = { ...FALLBACK_SUBTITLE_DATA };

// State variables
let playerState = {
  type: 'tv',
  id: '273240',
  season: '1',
  episode: '1',
  currentServer: '',
  currentSubtitle: 'none',
  skipIntroEnabled: true,
  autoPlayNextEnabled: false,
  playbackSpeed: 1.0,
  controlsTimeout: null,
  isMuted: false,
  volume: 0.8
};

// DOM Elements
const video = document.getElementById('mainVideo');
const playerWrapper = document.getElementById('playerWrapper');
const customControls = document.getElementById('customControls');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const muteBtn = document.getElementById('muteBtn');
const volumeIcon = document.getElementById('volumeIcon');
const volumeProgress = document.getElementById('volumeProgress');
const volumeSliderContainer = document.getElementById('volumeSliderContainer');
const currentTimeEl = document.getElementById('currentTime');
const durationTimeEl = document.getElementById('durationTime');

const seekbarContainer = document.getElementById('seekbarContainer');
const seekbarBuffer = document.getElementById('seekbarBuffer');
const seekbarProgress = document.getElementById('seekbarProgress');
const seekbarHandle = document.getElementById('seekbarHandle');
const seekbarTooltip = document.getElementById('seekbarTooltip');

const serverMenuBtn = document.getElementById('serverMenuBtn');
const serverMenu = document.getElementById('serverMenu');
const subMenuBtn = document.getElementById('subMenuBtn');
const subMenu = document.getElementById('subMenu');
const qualityMenuBtn = document.getElementById('qualityMenuBtn');
const qualityMenu = document.getElementById('qualityMenu');
const qualityDropdown = document.getElementById('qualityDropdown');
const settingsMenuBtn = document.getElementById('settingsMenuBtn');
const settingsMenu = document.getElementById('settingsMenu');

const speedOption = document.getElementById('speedOption');
const speedValue = document.getElementById('speedValue');
const skipIntroToggle = document.getElementById('skipIntroToggle');
const skipIntroState = document.getElementById('skipIntroState');
const autoPlayToggle = document.getElementById('autoPlayToggle');
const autoPlayState = document.getElementById('autoPlayState');

const fullscreenBtn = document.getElementById('fullscreenBtn');
const fullscreenIcon = document.getElementById('fullscreenIcon');
const playPauseOverlay = document.getElementById('playPauseOverlay');
const overlayIcon = document.getElementById('overlayIcon');
const bufferingSpinner = document.getElementById('bufferingSpinner');
const skipIntroBtn = document.getElementById('skipIntroBtn');
const subtitleCue = document.getElementById('subtitleCue');
const nextEpisodeBtn = document.getElementById('nextEpisodeBtn');

let hlsInstance = null;
let networkErrorCount = 0;

// Load settings from URL parameters
function parseUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  
  if (urlParams.has('type')) playerState.type = urlParams.get('type');
  if (urlParams.has('id')) playerState.id = urlParams.get('id');
  if (urlParams.has('s')) playerState.season = urlParams.get('s');
  if (urlParams.has('e')) playerState.episode = urlParams.get('e');
  if (urlParams.has('server')) playerState.currentServer = urlParams.get('server');
  if (urlParams.has('sub')) playerState.currentSubtitle = urlParams.get('sub');
  if (urlParams.has('url')) playerState.directUrl = urlParams.get('url');
  
  if (urlParams.get('autoplay') === '1') {
    video.autoplay = true;
    video.muted = true; // Modern browsers require muting for autoplay to trigger
    playerState.isMuted = true;
    playerState.autoPlayNextEnabled = true;
  }
}

// Fetch Streams dynamically from Backend Aggregator API
async function fetchBackendStreams() {
  bufferingSpinner.classList.add('active');
  
  if (playerState.directUrl) {
    console.log(`[Player] Direct URL play mode detected: ${playerState.directUrl}`);
    const urlParams = new URLSearchParams(window.location.search);

    // Restore referer header persisted by persistStreamToUrl()
    const referer = urlParams.get('ref') || '';
    // Restore server label if we know the key
    const serverKey = urlParams.get('server') || 'direct';
    const serverLabel = serverKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    STREAM_SERVERS = {
      [serverKey]: {
        name: serverLabel,
        url: playerState.directUrl,
        sub: "Shared Link",
        status: "available",
        subtitles: [],
        headers: referer ? { Referer: referer } : {},
        isPlaceholder: false,
        sr: null
      }
    };
    
    // Support custom subtitles in parameters
    if (urlParams.has('subtitle') || urlParams.has('sub_url')) {
      const subUrl = urlParams.get('subtitle') || urlParams.get('sub_url');
      const subLabel = urlParams.get('sub_label') || urlParams.get('label') || "English";
      STREAM_SERVERS[serverKey].subtitles.push({
        label: subLabel,
        url: subUrl
      });
    }

    playerState.currentServer = serverKey;
    bufferingSpinner.classList.remove('active');
    return;
  }
  
  // Map 'tv' type to 'series' for backend API compatibility
  const typeParam = playerState.type === 'tv' ? 'series' : 'movie';
  let apiUrl = `/api/streams/${typeParam}/${playerState.id}`;
  
  if (playerState.type === 'tv') {
    apiUrl += `?season=${playerState.season}&episode=${playerState.episode}`;
  }

  console.log(`[Player] Fetching streams from Backend: ${apiUrl}`);

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    
    const data = await res.json();
    if (data.success && data.streams && data.streams.length > 0) {
      console.log(`[Player] Loaded ${data.streams.length} live stream(s) from backend.`);
      
      // Clean and reconstruct STREAM_SERVERS
      STREAM_SERVERS = {};
      data.streams.forEach((stream) => {
        const serverKey = stream.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        
        // Detect Vidzee placeholder objects
        const isPlaceholder = stream.url.startsWith('placeholder_vidzee_');
        const sr = isPlaceholder ? stream.url.split('_').pop() : null;

        STREAM_SERVERS[serverKey] = {
          name: stream.name,
          url: stream.url,
          sub: stream.quality || 'Auto',
          status: "available",
          subtitles: stream.subtitles || [],
          headers: stream.headers || {},
          isPlaceholder,
          sr
        };
      });

      // Prefer server from URL ?server= param if it exists in the fetched list; else use first
      const keys = Object.keys(STREAM_SERVERS);
      const requestedServer = playerState.currentServer; // set earlier by parseUrlParams()
      if (requestedServer && STREAM_SERVERS[requestedServer]) {
        console.log(`[Player] URL param server found: ${requestedServer} — using it.`);
        // keep playerState.currentServer as-is
      } else {
        playerState.currentServer = keys[0];
        if (requestedServer) console.warn(`[Player] Requested server '${requestedServer}' not found; defaulting to ${keys[0]}.`);
      }
    } else {
      console.warn("[Player] No live streams resolved. Falling back to mock sources.");
      STREAM_SERVERS = { ...FALLBACK_STREAM_SERVERS };
      playerState.currentServer = 'prime';
    }
  } catch (err) {
    console.error(`[Player] Backend fetch failed: ${err.message}. Loading fallback demo sources.`);
    STREAM_SERVERS = { ...FALLBACK_STREAM_SERVERS };
    playerState.currentServer = 'prime';
  } finally {
    bufferingSpinner.classList.remove('active');
  }
}

// Download and Parse Subtitles dynamically
async function fetchAndParseSubtitle(subKey, url) {
  if (SUBTITLE_DATA[subKey]) return; // already parsed and cached
  try {
    console.log(`[Player] Downloading subtitle: ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    SUBTITLE_DATA[subKey] = parseVTT(text);
    console.log(`[Player] Parsed VTT: cached ${SUBTITLE_DATA[subKey].length} cues`);
  } catch (e) {
    console.error(`[Player] Subtitle download/parse failed:`, e.message);
  }
}

// Triggers Playback with Promise Handling
function triggerPlay() {
  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      bufferingSpinner.classList.remove('active');
      playIcon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`;
    }).catch(error => {
      console.log("Playback blocked by browser policy. User gesture required to play audio.", error);
      bufferingSpinner.classList.remove('active');
      playIcon.innerHTML = `<path d="M8 5v14l11-7z"/>`;
      video.pause();
    });
  }
}

// Trigger Automatic Failover to the next available server in the list
function triggerAutomaticFailover() {
  console.log("[Player] Triggering automatic failover...");
  const keys = Object.keys(STREAM_SERVERS);
  const currentIndex = keys.indexOf(playerState.currentServer);
  if (currentIndex === -1) return;

  // Find the next available server that is NOT marked as offline
  let nextIndex = currentIndex + 1;
  let nextServerKey = null;
  while (nextIndex < keys.length) {
    const key = keys[nextIndex];
    if (STREAM_SERVERS[key] && STREAM_SERVERS[key].status !== 'offline') {
      nextServerKey = key;
      break;
    }
    nextIndex++;
  }

  if (nextServerKey) {
    console.log(`[Player] Failover: Switching from ${playerState.currentServer} to ${nextServerKey}`);
    playerState.currentServer = nextServerKey;
    populateMenus(); // Refresh UI active states and borders
    initVideoSource(nextServerKey);
  } else {
    console.error("[Player] Failover failed: No more fallback servers available.");
    bufferingSpinner.classList.remove('active');
    subtitleCue.style.display = 'none';
  }
}

// Persist the resolved stream URL into the browser address bar.
// A link copied after this runs can be opened anywhere and plays immediately
// without hitting the backend — it goes through the existing directUrl path.
function persistStreamToUrl(serverKey, streamUrl, server) {
  try {
    const urlParams = new URLSearchParams(window.location.search);

    // Stamp the raw stream URL so opening the share link plays via directUrl path
    urlParams.set('url', streamUrl);
    urlParams.set('server', serverKey);

    // Persist referer header so CORS-protected streams still work on reload
    const referer = server?.headers?.Referer || server?.headers?.referer || '';
    if (referer) {
      urlParams.set('ref', referer);
    } else {
      urlParams.delete('ref');
    }

    // Remove TMDB fetch params — not needed when replaying via direct URL
    // (keep type/id/s/e so the player still shows correct poster & next-ep info)
    history.replaceState(null, '', '?' + urlParams.toString());
    console.log('[Player] Share URL updated with resolved stream.');
  } catch (e) {
    console.warn('[Player] Could not update share URL:', e.message);
  }
}

// Initialize Playback
async function initVideoSource(serverKey) {
  const server = STREAM_SERVERS[serverKey];
  if (!server || server.status === 'offline') return;

  // Show loading spinner
  bufferingSpinner.classList.add('active');

  // 1. Dynamic On-Demand Decryption if this server is a placeholder
  if (server.isPlaceholder) {
    console.log(`[Player] Server ${server.name} is in standby (placeholder). Decrypting on-demand...`);
    
    const typeParam = playerState.type === 'tv' ? 'series' : 'movie';
    let apiUrl = `/api/streams/vidzee/${typeParam}/${playerState.id}?sr=${server.sr}`;
    if (playerState.type === 'tv') {
      apiUrl += `&season=${playerState.season}&episode=${playerState.episode}`;
    }

    try {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();
      
      if (data.success && data.streams && data.streams.length > 0) {
        const decryptedStream = data.streams[0];
        console.log(`[Player] On-demand decryption complete for ${server.name}`);
        
        // Cache decrypted details in state
        server.url = decryptedStream.url;
        server.isPlaceholder = false;
        server.subtitles = decryptedStream.subtitles || [];
        server.headers = decryptedStream.headers || {};
        
        // Refresh menus to show dynamic subtitles list
        populateMenus();
      } else {
        throw new Error("No functional stream returned from dynamic check.");
      }
    } catch (err) {
      console.error(`[Player] Dynamic decryption failed: ${err.message}`);
      bufferingSpinner.classList.remove('active');
      if (STREAM_SERVERS[serverKey]) {
        STREAM_SERVERS[serverKey].status = 'offline';
      }
      populateMenus();
      triggerAutomaticFailover();
      return; // Stop loading if failed
    }
  }

  console.log(`[Player] Playing stream: ${server.name} (${server.url})`);

  // Clear previous HLS instance
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  // Clear previous tracks inside video tag
  while (video.firstChild) {
    video.removeChild(video.firstChild);
  }

  const streamUrl = server.url;

  // Persist resolved stream URL into the address bar so the share link plays directly
  persistStreamToUrl(serverKey, streamUrl, server);

  // Reset current playback time to 0 (starts from initial!)
  video.currentTime = 0;

  // Add tracks dynamically to HTML5 video tag for accessibility/native fallback
  if (server.subtitles && server.subtitles.length > 0) {
    server.subtitles.forEach((s, idx) => {
      const track = document.createElement('track');
      track.kind = 'captions';
      track.label = s.label;
      track.srclang = s.label.toLowerCase();
      track.src = s.url;
      if (idx === 0) track.default = true;
      video.appendChild(track);
    });
  }

  if (streamUrl.includes('.m3u8')) {
    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true
      });
      hlsInstance.loadSource(streamUrl);
      hlsInstance.attachMedia(video);
      
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
        bufferingSpinner.classList.remove('active');
        triggerPlay();
        // Populate quality levels now that the manifest is fully parsed
        populateQualityMenu();
      });

      // Re-sync quality badge when ABR auto-selects a new level
      hlsInstance.on(Hls.Events.LEVEL_SWITCHED, function(event, data) {
        // Update active state in menu without rebuilding the whole list
        qualityMenu.querySelectorAll('.dropdown-item').forEach(btn => btn.classList.remove('active'));
        const autoEl = document.getElementById('quality-auto');
        const levelEl = document.getElementById(`quality-level-${data.level}`);
        if (hlsInstance.currentLevel === -1 && autoEl) autoEl.classList.add('active');
        else if (levelEl) levelEl.classList.add('active');
      });
      
      hlsInstance.on(Hls.Events.ERROR, function(event, data) {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              networkErrorCount++;
              if (networkErrorCount > 2) {
                console.warn("HLS stream CORS/network blocks.");
                networkErrorCount = 0;
                bufferingSpinner.classList.remove('active');
                if (STREAM_SERVERS[playerState.currentServer]) {
                  STREAM_SERVERS[playerState.currentServer].status = 'offline';
                }
                populateMenus();
                hlsInstance.destroy();
                hlsInstance = null;
                triggerAutomaticFailover();
              } else {
                hlsInstance.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hlsInstance.recoverMediaError();
              break;
            default:
              console.error("HLS fatal error occurred, triggering failover:", data);
              if (STREAM_SERVERS[playerState.currentServer]) {
                STREAM_SERVERS[playerState.currentServer].status = 'offline';
              }
              populateMenus();
              hlsInstance.destroy();
              hlsInstance = null;
              bufferingSpinner.classList.remove('active');
              triggerAutomaticFailover();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple Safari HLS support
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        bufferingSpinner.classList.remove('active');
        triggerPlay();
      });
    }
  } else {
    // Normal direct video file (MP4, WebM) — quality levels not available
    qualityDropdown.style.display = 'none';
    video.src = streamUrl;
    video.load();
    video.addEventListener('loadedmetadata', () => {
      bufferingSpinner.classList.remove('active');
      triggerPlay();
    });
  }

  // Inject current TMDB show poster dynamically
  fetchPosterImage();
}

function fetchPosterImage() {
  // Map TMDB IDs to high quality backdrop posters
  const backdrops = {
    '273240': 'https://image.tmdb.org/t/p/w1280/nMl7h2ZYE2nMfQWLgsh09Zaqarj.jpg', // The Deal
    '105248': 'https://image.tmdb.org/t/p/w1280/5i6SjiaZ28rR86i2Xw8iBh4R95Y.jpg', // Cyberpunk Edgerunners
    '693134': 'https://image.tmdb.org/t/p/w1280/xOMo8BRK7PqaJ2wDw06JivR8RPB.jpg', // Dune 2
    '564147': 'https://wsrv.nl/?url=https://image.tmdb.org/t/p/original//4i1ofsSpfTuswHXcgPtXbZrSnoe.jpg' // K.G.F Chapter 1
  };
  
  if (backdrops[playerState.id]) {
    video.poster = backdrops[playerState.id];
  } else {
    // Attempt to fetch from TMDB placeholder or resolve dynamically
    video.poster = `https://wsrv.nl/?url=https://image.tmdb.org/t/p/w1280/`;
  }
}

// Format Seconds into MM:SS
function formatTime(seconds) {
  if (isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Toggle Play / Pause
function togglePlay() {
  if (video.paused) {
    video.play();
    playIcon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`;
    triggerOverlayPulse('play');
  } else {
    video.pause();
    playIcon.innerHTML = `<path d="M8 5v14l11-7z"/>`;
    triggerOverlayPulse('pause');
  }
}

function triggerOverlayPulse(type) {
  playPauseOverlay.className = 'player-overlay';
  void playPauseOverlay.offsetWidth; // Force CSS Reflow
  
  if (type === 'play') {
    overlayIcon.innerHTML = `<path d="M8 5v14l11-7z"/>`;
    playPauseOverlay.classList.add('pulse-play');
  } else {
    overlayIcon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`;
    playPauseOverlay.classList.add('pulse-pause');
  }
}

// Volume controls
function setVolume(val) {
  playerState.volume = Math.max(0, Math.min(1, val));
  video.volume = playerState.volume;
  video.muted = playerState.volume === 0;
  
  volumeProgress.style.width = `${playerState.volume * 100}%`;
  
  // Update icons
  if (video.muted || playerState.volume === 0) {
    volumeIcon.innerHTML = `<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.03c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>`;
  } else if (playerState.volume < 0.5) {
    volumeIcon.innerHTML = `<path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>`;
  } else {
    volumeIcon.innerHTML = `<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>`;
  }
}

function toggleMute() {
  video.muted = !video.muted;
  if (video.muted) {
    volumeProgress.style.width = '0%';
    volumeIcon.innerHTML = `<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.03c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>`;
  } else {
    setVolume(playerState.volume);
  }
}

// Fullscreen Management — cross-browser + iOS + Android orientation lock
function toggleFullscreen() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);

  if (!isFs) {
    // Request fullscreen with all vendor prefixes
    const el = playerWrapper;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (req) {
      req.call(el).then(() => {
        // Lock to landscape for video content
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      }).catch(err => {
        console.warn('[Player] Fullscreen request failed:', err.message);
      });
    }
    fullscreenIcon.innerHTML = `<path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"></path>`;
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    if (exit) exit.call(document);
    // Release orientation lock
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }
    fullscreenIcon.innerHTML = `<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>`;
  }
}

// Sync fullscreen icon when changed externally (e.g. Esc key)
document.addEventListener('fullscreenchange', () => {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  fullscreenIcon.innerHTML = isFs
    ? `<path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"></path>`
    : `<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>`;
});
document.addEventListener('webkitfullscreenchange', () => {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  fullscreenIcon.innerHTML = isFs
    ? `<path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"></path>`
    : `<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>`;
});

// Menus opening & closing
function closeAllMenus() {
  serverMenu.classList.remove('active');
  subMenu.classList.remove('active');
  qualityMenu.classList.remove('active');
  settingsMenu.classList.remove('active');
}

// Build Quality Dropdown from HLS.js levels
// Only shown for HLS (.m3u8) streams that expose multiple renditions
function populateQualityMenu() {
  if (!hlsInstance || !hlsInstance.levels || hlsInstance.levels.length === 0) {
    qualityDropdown.style.display = 'none';
    return;
  }

  const levels = hlsInstance.levels;

  // Hide button if only one level exists (nothing to switch between)
  if (levels.length <= 1) {
    qualityDropdown.style.display = 'none';
    return;
  }

  qualityDropdown.style.display = '';
  qualityMenu.innerHTML = '';

  // Auto (ABR) option — always first
  const autoBtn = document.createElement('button');
  autoBtn.className = `dropdown-item ${hlsInstance.currentLevel === -1 ? 'active' : ''}`;
  autoBtn.id = 'quality-auto';
  autoBtn.innerHTML = `<span>Auto</span><span style="font-size:0.65rem;color:var(--text-dark)">Adaptive</span>`;
  autoBtn.addEventListener('click', () => {
    hlsInstance.currentLevel = -1; // -1 = ABR auto
    populateQualityMenu();
    closeAllMenus();
  });
  qualityMenu.appendChild(autoBtn);

  // Sort levels highest-to-lowest by height (resolution)
  const sortedLevels = levels
    .map((l, idx) => ({ ...l, idx }))
    .sort((a, b) => (b.height || b.bitrate) - (a.height || a.bitrate));

  sortedLevels.forEach(level => {
    const label = level.height ? `${level.height}p` : `Level ${level.idx + 1}`;
    const bitKbps = level.bitrate ? `${Math.round(level.bitrate / 1000)}k` : '';
    const btn = document.createElement('button');
    btn.className = `dropdown-item ${hlsInstance.currentLevel === level.idx ? 'active' : ''}`;
    btn.id = `quality-level-${level.idx}`;
    btn.innerHTML = `<span>${label}</span><span style="font-size:0.65rem;color:var(--text-dark)">${bitKbps}</span>`;
    btn.addEventListener('click', () => {
      hlsInstance.currentLevel = level.idx; // lock to this rendition
      populateQualityMenu();
      closeAllMenus();
    });
    qualityMenu.appendChild(btn);
  });
}

// Build Dropdown Menus dynamically
function populateMenus() {
  // 1. Populate Servers
  serverMenu.innerHTML = '';
  Object.keys(STREAM_SERVERS).forEach(key => {
    const srv = STREAM_SERVERS[key];
    const srvBtn = document.createElement('button');
    srvBtn.className = `dropdown-item ${srv.status === 'offline' ? 'disabled' : ''} ${playerState.currentServer === key ? 'active' : ''}`;
    srvBtn.innerHTML = `
      <span>${srv.name}</span>
      <span style="font-size: 0.65rem; color: var(--text-dark)">${srv.sub}</span>
    `;
    
    if (srv.status !== 'offline') {
      srvBtn.addEventListener('click', () => {
        playerState.currentServer = key;
        // Push server key into URL so the link can be shared / reloaded on the same server
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set('server', key);
        history.replaceState(null, '', '?' + urlParams.toString());
        initVideoSource(key);
        populateMenus(); // refresh active state
        closeAllMenus();
        // Notify parent iframe about server change
        window.parent.postMessage({ type: 'server-change', server: key }, '*');
      });
    }
    serverMenu.appendChild(srvBtn);
  });

  // 2. Populate Subtitles
  subMenu.innerHTML = '';
  
  const subs = [
    { key: 'none', label: 'None / Captions Off', url: null }
  ];

  // Retrieve subtitles dynamically for selected server
  const currentServerObj = STREAM_SERVERS[playerState.currentServer];
  if (currentServerObj && currentServerObj.subtitles && currentServerObj.subtitles.length > 0) {
    currentServerObj.subtitles.forEach((s, idx) => {
      const subKey = `dynamic_${playerState.currentServer}_${idx}`;
      subs.push({
        key: subKey,
        label: s.label,
        url: s.url
      });
    });
  } else {
    // fallback subtitles
    subs.push(
      { key: 'en', label: 'English', url: null },
      { key: 'es', label: 'Spanish / Español', url: null },
      { key: 'fr', label: 'French / Français', url: null }
    );
  }

  subs.forEach(s => {
    const subBtn = document.createElement('button');
    subBtn.className = `dropdown-item ${playerState.currentSubtitle === s.key ? 'active' : ''}`;
    subBtn.innerHTML = `<span>${s.label}</span>`;
    
    subBtn.addEventListener('click', async () => {
      playerState.currentSubtitle = s.key;
      
      // If subtitle needs to be downloaded and parsed dynamically
      if (s.url) {
        bufferingSpinner.classList.add('active');
        await fetchAndParseSubtitle(s.key, s.url);
        bufferingSpinner.classList.remove('active');
      }

      // Sync HTML5 native track displaying
      for (let i = 0; i < video.textTracks.length; i++) {
        const textTrack = video.textTracks[i];
        if (textTrack.label === s.label) {
          textTrack.mode = 'showing';
        } else {
          textTrack.mode = 'disabled';
        }
      }

      populateMenus();
      closeAllMenus();
    });
    subMenu.appendChild(subBtn);
  });
}

// Subtitles rendering system based on video current time (custom HUD overlay)
function updateSubtitleOverlay() {
  if (playerState.currentSubtitle === 'none') {
    subtitleCue.style.display = 'none';
    return;
  }

  const time = video.currentTime;
  const cues = SUBTITLE_DATA[playerState.currentSubtitle];
  if (!cues) return;

  const activeCue = cues.find(c => time >= c.start && time <= c.end);

  if (activeCue) {
    subtitleCue.innerText = activeCue.text;
    subtitleCue.style.display = 'block';
  } else {
    subtitleCue.style.display = 'none';
  }
}

// Seekbar calculations
function updateSeekbar() {
  const duration = video.duration;
  const current = video.currentTime;
  
  if (duration) {
    const progressPercent = (current / duration) * 100;
    seekbarProgress.style.width = `${progressPercent}%`;
    seekbarHandle.style.left = `${progressPercent}%`;
    currentTimeEl.innerText = formatTime(current);
    
    // Update buffered amount
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const bufferPercent = (bufferedEnd / duration) * 100;
      seekbarBuffer.style.width = `${bufferPercent}%`;
    }
  }
}

function handleSeek(e) {
  const rect = seekbarContainer.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
  const seekTo = (clickX / rect.width) * (video.duration || 0);
  if (!isNaN(seekTo)) video.currentTime = seekTo;
}

// Skip Intro logic trigger
function handleSkipIntroDisplay() {
  if (!playerState.skipIntroEnabled) {
    skipIntroBtn.classList.remove('active');
    return;
  }

  const curTime = video.currentTime;
  // Intro duration configured from 8s to 20s
  if (curTime >= 8 && curTime <= 20) {
    skipIntroBtn.classList.add('active');
  } else {
    skipIntroBtn.classList.remove('active');
  }
}

// Fire the next episode load transition
async function triggerNextEpisode() {
  bufferingSpinner.classList.add('active');
  
  const nextEpisode = parseInt(playerState.episode) + 1;
  playerState.episode = nextEpisode.toString();
  
  // Notify parent dashboard to sync input values
  window.parent.postMessage({ type: 'next-episode', episode: nextEpisode }, '*');
  
  // Re-fetch backend HLS streams and start playback
  await fetchBackendStreams();
  populateMenus();
  initVideoSource(playerState.currentServer);
}

// Autoplay / Auto-next triggering
function checkAutoPlayEnd() {
  if (playerState.autoPlayNextEnabled && video.ended) {
    triggerNextEpisode();
  }
}

// Auto-hide Control Overlays
// Set controlsTimeout to run in window scope to allow clearance
function resetControlsTimer() {
  playerWrapper.classList.add('show-controls');
  document.body.style.cursor = 'default';
  
  clearTimeout(playerState.controlsTimeout);
  
  // Hide controls after 3 seconds of inactivity
  playerState.controlsTimeout = setTimeout(() => {
    if (!video.paused) {
      playerWrapper.classList.remove('show-controls');
      document.body.style.cursor = 'none';
      closeAllMenus();
    }
  }, 3000);
}

// Sync Center Play Overlay Visually
// Make player-overlay visible only when paused
function updateOverlayState() {
  if (video.paused) {
    playPauseOverlay.style.opacity = '1';
    playPauseOverlay.style.pointerEvents = 'auto';
    overlayIcon.innerHTML = `<path d="M8 5v14l11-7z"/>`;
  } else {
    playPauseOverlay.style.opacity = '0';
    playPauseOverlay.style.pointerEvents = 'none';
  }
}

// Event Listeners setup
function setupEventListeners() {
  
  // Play toggling via dedicated button (always safe)
  playBtn.addEventListener('click', togglePlay);

  // Desktop: clicking wrapper/video/overlay toggles play
  // Mobile: single tap shows/hides controls; double-tap seeks (handled in touchstart below)
  const isTouchDevice = () => ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  playerWrapper.addEventListener('click', (e) => {
    if (isTouchDevice()) return; // handled by touch events below
    if (e.target === playerWrapper || e.target === video || e.target === playPauseOverlay || e.target === overlayIcon || overlayIcon.contains(e.target)) {
      togglePlay();
    }
  });

  // Desktop: mouse move shows controls
  playerWrapper.addEventListener('mousemove', () => {
    resetControlsTimer();
  });
  
  // Media status
  video.addEventListener('play', () => {
    playIcon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`;
    bufferingSpinner.classList.remove('active');
    updateOverlayState();
  });
  
  video.addEventListener('pause', () => {
    playIcon.innerHTML = `<path d="M8 5v14l11-7z"/>`;
    bufferingSpinner.classList.remove('active');
    updateOverlayState();
  });
  
  video.addEventListener('error', (e) => {
    if (video.error) {
      console.error("[Player] Native video element error occurred:", video.error.code, video.error.message);
      const serverKey = playerState.currentServer;
      if (STREAM_SERVERS[serverKey] && STREAM_SERVERS[serverKey].status !== 'offline') {
        STREAM_SERVERS[serverKey].status = 'offline';
        populateMenus();
        triggerAutomaticFailover();
      }
    }
  });
  
  video.addEventListener('loadedmetadata', () => {
    durationTimeEl.innerText = formatTime(video.duration);
  });
  
  video.addEventListener('timeupdate', () => {
    updateSeekbar();
    updateSubtitleOverlay();
    handleSkipIntroDisplay();
    if (video.currentTime > 0) {
      bufferingSpinner.classList.remove('active');
    }
  });

  video.addEventListener('waiting', () => {
    if (!video.paused) {
      bufferingSpinner.classList.add('active');
    } else {
      bufferingSpinner.classList.remove('active');
    }
  });

  video.addEventListener('playing', () => {
    bufferingSpinner.classList.remove('active');
    updateOverlayState();
  });

  video.addEventListener('ended', () => {
    playIcon.innerHTML = `<path d="M8 5v14l11-7z"/>`;
    updateOverlayState();
    checkAutoPlayEnd();
  });

  // Timeline Interactions — click (desktop) + touch (mobile)
  seekbarContainer.addEventListener('click', handleSeek);
  seekbarContainer.addEventListener('touchstart', (e) => { e.stopPropagation(); handleSeek(e); }, { passive: true });
  let seekDragging = false;
  seekbarContainer.addEventListener('touchmove', (e) => {
    e.stopPropagation();
    handleSeek(e);
    seekDragging = true;
  }, { passive: true });
  seekbarContainer.addEventListener('touchend', () => { seekDragging = false; });
  
  // Volume interactions
  muteBtn.addEventListener('click', toggleMute);
  
  volumeSliderContainer.addEventListener('click', (e) => {
    const rect = volumeSliderContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    setVolume(clickX / width);
  });

  // Dropdown Triggers
  serverMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const active = serverMenu.classList.contains('active');
    closeAllMenus();
    if (!active) serverMenu.classList.add('active');
  });

  subMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const active = subMenu.classList.contains('active');
    closeAllMenus();
    if (!active) subMenu.classList.add('active');
  });

  qualityMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const active = qualityMenu.classList.contains('active');
    closeAllMenus();
    if (!active) qualityMenu.classList.add('active');
  });

  settingsMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const active = settingsMenu.classList.contains('active');
    closeAllMenus();
    if (!active) settingsMenu.classList.add('active');
  });

  // Settings Actions
  speedOption.addEventListener('click', (e) => {
    e.stopPropagation();
    // Cycle speeds: 1.0x -> 1.25x -> 1.5x -> 2.0x -> 0.5x -> 1.0x
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.5];
    let nextIdx = (speeds.indexOf(playerState.playbackSpeed) + 1) % speeds.length;
    playerState.playbackSpeed = speeds[nextIdx];
    video.playbackRate = playerState.playbackSpeed;
    speedValue.innerText = `${playerState.playbackSpeed}x`;
  });

  skipIntroToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    playerState.skipIntroEnabled = !playerState.skipIntroEnabled;
    skipIntroState.innerText = playerState.skipIntroEnabled ? 'On' : 'Off';
    skipIntroState.style.color = playerState.skipIntroEnabled ? 'var(--success)' : 'var(--text-dark)';
  });

  autoPlayToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    playerState.autoPlayNextEnabled = !playerState.autoPlayNextEnabled;
    autoPlayState.innerText = playerState.autoPlayNextEnabled ? 'On' : 'Off';
    autoPlayState.style.color = playerState.autoPlayNextEnabled ? 'var(--success)' : 'var(--text-dark)';
  });

  // Skip Intro Action Button
  skipIntroBtn.addEventListener('click', () => {
    video.currentTime = 25; // Skip past the 25s mark
    skipIntroBtn.classList.remove('active');
  });

  // Next Episode Action
  if (nextEpisodeBtn) {
    nextEpisodeBtn.addEventListener('click', triggerNextEpisode);
  }

  // Fullscreen action
  fullscreenBtn.addEventListener('click', toggleFullscreen);

  // Auto-hide controls triggers
  playerWrapper.addEventListener('mousemove', resetControlsTimer);
  playerWrapper.addEventListener('mouseleave', () => {
    playerWrapper.classList.remove('show-controls');
  });

  // Close menus on click away
  document.addEventListener('click', closeAllMenus);

  // Keyboard Shortcuts Controls
  document.addEventListener('keydown', (e) => {
    resetControlsTimer();
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
        break;
      case 'ArrowRight':
        e.preventDefault();
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setVolume(video.volume + 0.05);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setVolume(video.volume - 0.05);
        break;
      case 'KeyF':
        toggleFullscreen();
        break;
      case 'KeyM':
        toggleMute();
        break;
    }
  });

  // ── Mobile Touch Handler ──────────────────────────────────────────────────
  // Single tap → show/hide controls (NOT play/pause, to avoid accidental pausing)
  // Double tap → seek ±10s
  // Controls auto-hide after 3 s of no interaction
  let lastTapTime = 0;
  let tapTimer = null;

  playerWrapper.addEventListener('touchstart', (e) => {
    // Ignore touches that originate from controls themselves
    const target = e.target;
    const isControl = customControls.contains(target) || skipIntroBtn.contains(target);
    if (isControl) return;

    const now = Date.now();
    const gap = now - lastTapTime;
    lastTapTime = now;

    if (gap < 300 && gap > 30) {
      // ── Double tap: seek ───────────────────────────────────────────────────
      clearTimeout(tapTimer);
      const touchX = e.touches[0].clientX;
      const rect = playerWrapper.getBoundingClientRect();
      const relX = touchX - rect.left;

      if (relX < rect.width / 3) {
        video.currentTime = Math.max(0, video.currentTime - 10);
        triggerOverlayPulse('rewind');
      } else if (relX > (rect.width * 2) / 3) {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
        triggerOverlayPulse('forward');
      } else {
        // Double tap center = play/pause
        togglePlay();
      }
      e.preventDefault();
    } else {
      // ── Single tap: toggle controls visibility ─────────────────────────────
      tapTimer = setTimeout(() => {
        const controlsVisible = playerWrapper.classList.contains('show-controls');
        if (controlsVisible && !video.paused) {
          // Controls already visible → hide them
          playerWrapper.classList.remove('show-controls');
          document.body.style.cursor = 'none';
        } else {
          // Show controls (and reset auto-hide timer)
          resetControlsTimer();
        }
      }, 220);
    }
  }, { passive: false });
}

// Message listener from Parent for embedded commands
window.addEventListener('message', async (e) => {
  const data = e.data;
  if (!data) return;
  
  if (data.type === 'load-show') {
    playerState.type = data.showType;
    playerState.id = data.id;
    playerState.season = data.season;
    playerState.episode = data.episode;
    
    // Toggle HUD next-episode button visibility
    if (nextEpisodeBtn) {
      nextEpisodeBtn.style.display = playerState.type === 'tv' ? 'inline-flex' : 'none';
    }

    // Fetch live streams and then play
    await fetchBackendStreams();
    populateMenus();
    initVideoSource(playerState.currentServer);
  }
});

// App Startup
async function startApp() {
  parseUrlParams();
  setupEventListeners();
  
  // Toggle HUD next-episode button visibility
  if (nextEpisodeBtn) {
    nextEpisodeBtn.style.display = playerState.type === 'tv' ? 'inline-flex' : 'none';
  }

  // Load live streams first
  await fetchBackendStreams();
  
  populateMenus();
  initVideoSource(playerState.currentServer);
  setVolume(playerState.volume);
  updateOverlayState();
  resetControlsTimer();
}

window.onload = startApp;
