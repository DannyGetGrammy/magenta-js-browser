// Seed sequences
const SEEDS = {
  cmajor: {
    notes: [
      { pitch: 60, quantizedStartStep: 0, quantizedEndStep: 4 },  // C
      { pitch: 62, quantizedStartStep: 4, quantizedEndStep: 8 },  // D
      { pitch: 64, quantizedStartStep: 8, quantizedEndStep: 12 }, // E
      { pitch: 65, quantizedStartStep: 12, quantizedEndStep: 16 }, // F
      { pitch: 67, quantizedStartStep: 16, quantizedEndStep: 20 }, // G
      { pitch: 69, quantizedStartStep: 20, quantizedEndStep: 24 }, // A
      { pitch: 71, quantizedStartStep: 24, quantizedEndStep: 28 }, // B
      { pitch: 72, quantizedStartStep: 28, quantizedEndStep: 32 }, // C
    ],
    totalQuantizedSteps: 32,
    quantizationInfo: { stepsPerQuarter: 4 },
  },
  cminor: {
    notes: [
      { pitch: 60, quantizedStartStep: 0, quantizedEndStep: 4 },  // C
      { pitch: 62, quantizedStartStep: 4, quantizedEndStep: 8 },  // D
      { pitch: 63, quantizedStartStep: 8, quantizedEndStep: 12 }, // Eb
      { pitch: 65, quantizedStartStep: 12, quantizedEndStep: 16 }, // F
      { pitch: 67, quantizedStartStep: 16, quantizedEndStep: 20 }, // G
      { pitch: 68, quantizedStartStep: 20, quantizedEndStep: 24 }, // Ab
      { pitch: 70, quantizedStartStep: 24, quantizedEndStep: 28 }, // Bb
      { pitch: 72, quantizedStartStep: 28, quantizedEndStep: 32 }, // C
    ],
    totalQuantizedSteps: 32,
    quantizationInfo: { stepsPerQuarter: 4 },
  },
  cmajorarp: {
    notes: [
      { pitch: 60, quantizedStartStep: 0, quantizedEndStep: 4 },   // C
      { pitch: 64, quantizedStartStep: 4, quantizedEndStep: 8 },   // E
      { pitch: 67, quantizedStartStep: 8, quantizedEndStep: 12 },  // G
      { pitch: 72, quantizedStartStep: 12, quantizedEndStep: 16 }, // C
      { pitch: 67, quantizedStartStep: 16, quantizedEndStep: 20 }, // G
      { pitch: 64, quantizedStartStep: 20, quantizedEndStep: 24 }, // E
      { pitch: 60, quantizedStartStep: 24, quantizedEndStep: 32 }, // C
    ],
    totalQuantizedSteps: 32,
    quantizationInfo: { stepsPerQuarter: 4 },
  },
  blues: {
    notes: [
      { pitch: 60, quantizedStartStep: 0, quantizedEndStep: 4 },   // C
      { pitch: 63, quantizedStartStep: 4, quantizedEndStep: 8 },   // Eb
      { pitch: 64, quantizedStartStep: 8, quantizedEndStep: 10 },  // E
      { pitch: 63, quantizedStartStep: 10, quantizedEndStep: 12 }, // Eb
      { pitch: 60, quantizedStartStep: 12, quantizedEndStep: 16 }, // C
      { pitch: 67, quantizedStartStep: 16, quantizedEndStep: 20 }, // G
      { pitch: 65, quantizedStartStep: 20, quantizedEndStep: 24 }, // F
      { pitch: 63, quantizedStartStep: 24, quantizedEndStep: 28 }, // Eb
      { pitch: 60, quantizedStartStep: 28, quantizedEndStep: 32 }, // C
    ],
    totalQuantizedSteps: 32,
    quantizationInfo: { stepsPerQuarter: 4 },
  },
};

// Model instances
let musicRNN;
let musicVAE;
let player;

const FAVORITES_STORAGE_KEY = 'magentaFavorites';
const PLAYBACK_TEMPO_STORAGE_KEY = 'magentaPlaybackTempo';
const DEFAULT_PLAYBACK_TEMPO = 120;

// Visualizers
let seedVisualizer;
let continuationVisualizer;
let startSeedVisualizer;
let endSeedVisualizer;

// Sequences
let currentContinuation = null;
let currentSamples = [];
let currentInterpolations = [];
let favoriteSequences = [];

// Selected seeds
let selectedContinuationSeed = 'cmajor';
let selectedStartSeed = 'cmajor';
let selectedEndSeed = 'cmajorarp';

// Initialization function
async function initialize() {
  try {
    // Initialize the player
    player = new core.Player();

    // Set up UI elements that do not depend on the models.
    setupUIElements();
    setupSeedVisualizers();
    initializePlaybackTempo();
    loadFavorites();

    // Update status indicators
    updateStatusBadge('musicRnnStatus', 'loading');
    updateStatusBadge('musicVaeStatus', 'loading');

    // Initialize MusicRNN model
    musicRNN = new music_rnn.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn');
    await musicRNN.initialize();
    console.log('MusicRNN initialized');
    updateStatusBadge('musicRnnStatus', 'ready', 'MusicRNN: Ready');
    document.getElementById('generateContinuation').disabled = false;

    // Initialize MusicVAE model
    musicVAE = new music_vae.MusicVAE('https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_2bar_small');
    await musicVAE.initialize();
    console.log('MusicVAE initialized');
    updateStatusBadge('musicVaeStatus', 'ready', 'MusicVAE: Ready');
    document.getElementById('generateSamples').disabled = false;
    document.getElementById('generateInterpolation').disabled = false;

    // Show notification
    showNotification('Models loaded successfully! You can now start generating music.');
  } catch (error) {
    console.error('Error initializing models:', error);
    updateStatusBadge('musicRnnStatus', 'error', 'MusicRNN: Error');
    updateStatusBadge('musicVaeStatus', 'error', 'MusicVAE: Error');
    showNotification('Error loading models. Please try refreshing the page.', true);
  }
}

function updateStatusBadge(id, status, text) {
  const badge = document.getElementById(id);

  // Remove all status classes
  badge.classList.remove('loading', 'ready', 'error');

  // Add the current status class
  badge.classList.add(status);

  // Update text if provided
  if (text) {
    badge.querySelector('span:not(.dot)').textContent = text;
  }
}

function setupUIElements() {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Stop any playing music when switching tabs
      if (player.isPlaying()) {
        player.stop();
        updatePlayButtons();
      }

      // Switch tabs
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  // Continuation slider values
  document.getElementById('continuationSteps').addEventListener('input', function () {
    document.getElementById('continuationStepsValue').textContent = this.value;
  });

  document.getElementById('continuationTemperature').addEventListener('input', function () {
    document.getElementById('continuationTemperatureValue').textContent = parseFloat(this.value).toFixed(1);
  });

  // Sampling slider values
  document.getElementById('samplesCount').addEventListener('input', function () {
    document.getElementById('samplesCountValue').textContent = this.value;
  });

  document.getElementById('samplesTemperature').addEventListener('input', function () {
    document.getElementById('samplesTemperatureValue').textContent = parseFloat(this.value).toFixed(1);
  });

  // Interpolation slider values
  document.getElementById('numInterpolations').addEventListener('input', function () {
    document.getElementById('numInterpolationsValue').textContent = this.value;
  });

  document.getElementById('playbackTempo').addEventListener('input', function () {
    const tempo = parseInt(this.value, 10);
    updatePlaybackTempoDisplay(tempo);
    localStorage.setItem(PLAYBACK_TEMPO_STORAGE_KEY, String(tempo));
  });

  // Seed selectors for continuation
  document.querySelectorAll('.seed-selector[data-seed]').forEach(selector => {
    if (!selector.dataset.target) {
      selector.addEventListener('click', () => {
        document.querySelectorAll('.seed-selector:not([data-target])').forEach(s => s.classList.remove('selected'));
        selector.classList.add('selected');
        selectedContinuationSeed = selector.dataset.seed;
        updateSeedVisualizer();
      });
    }
  });

  // Seed selectors for interpolation
  document.querySelectorAll('.seed-selector[data-target="start"]').forEach(selector => {
    selector.addEventListener('click', () => {
      document.querySelectorAll('.seed-selector[data-target="start"]').forEach(s => s.classList.remove('selected'));
      selector.classList.add('selected');
      selectedStartSeed = selector.dataset.seed;
      updateStartSeedVisualizer();
    });
  });

  document.querySelectorAll('.seed-selector[data-target="end"]').forEach(selector => {
    selector.addEventListener('click', () => {
      document.querySelectorAll('.seed-selector[data-target="end"]').forEach(s => s.classList.remove('selected'));
      selector.classList.add('selected');
      selectedEndSeed = selector.dataset.seed;
      updateEndSeedVisualizer();
    });
  });

  // Generation buttons
  document.getElementById('generateContinuation').addEventListener('click', generateContinuation);
  document.getElementById('generateSamples').addEventListener('click', generateSamples);
  document.getElementById('generateInterpolation').addEventListener('click', generateInterpolation);

  // Player buttons for continuation
  document.getElementById('playContinuation').addEventListener('click', () => {
    togglePlayback(currentContinuation, 'playContinuation');
  });

  // Player buttons for seed melodies
  document.getElementById('playSeed').addEventListener('click', () => {
    togglePlayback(SEEDS[selectedContinuationSeed], 'playSeed');
  });

  document.getElementById('playStartSeed').addEventListener('click', () => {
    togglePlayback(SEEDS[selectedStartSeed], 'playStartSeed');
  });

  document.getElementById('playEndSeed').addEventListener('click', () => {
    togglePlayback(SEEDS[selectedEndSeed], 'playEndSeed');
  });

  // Download buttons
  document.getElementById('downloadContinuation').addEventListener('click', () => {
    downloadMIDI(currentContinuation, 'continuation');
  });

  document.getElementById('saveContinuation').addEventListener('click', () => {
    if (!currentContinuation) {
      showNotification('Generate a continuation before saving it.', true);
      return;
    }

    saveFavoriteSequence({
      label: `Continuation - ${formatSeedName(selectedContinuationSeed)}`,
      source: 'MusicRNN continuation',
      sequence: currentContinuation,
    });
  });

  document.getElementById('downloadSeed').addEventListener('click', () => {
    downloadMIDI(SEEDS[selectedContinuationSeed], `seed_${selectedContinuationSeed}`);
  });

  document.getElementById('downloadStartSeed').addEventListener('click', () => {
    downloadMIDI(SEEDS[selectedStartSeed], `start_seed_${selectedStartSeed}`);
  });

  document.getElementById('downloadEndSeed').addEventListener('click', () => {
    downloadMIDI(SEEDS[selectedEndSeed], `end_seed_${selectedEndSeed}`);
  });
}

function initializePlaybackTempo() {
  const storedTempo = parseInt(localStorage.getItem(PLAYBACK_TEMPO_STORAGE_KEY), 10);
  const tempo = Number.isFinite(storedTempo) ? storedTempo : DEFAULT_PLAYBACK_TEMPO;
  const tempoInput = document.getElementById('playbackTempo');
  tempoInput.value = tempo;
  updatePlaybackTempoDisplay(tempo);
}

function updatePlaybackTempoDisplay(tempo) {
  document.getElementById('playbackTempoValue').textContent = `${tempo} BPM`;
}

function getPlaybackTempo() {
  return parseInt(document.getElementById('playbackTempo').value, 10);
}

function cloneSequence(sequence) {
  return JSON.parse(JSON.stringify(sequence));
}

function createPlaybackSequence(sequence) {
  const playbackSequence = cloneSequence(sequence);
  playbackSequence.tempos = [{ time: 0, qpm: getPlaybackTempo() }];
  return playbackSequence;
}

function loadFavorites() {
  try {
    const storedFavorites = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY));
    favoriteSequences = Array.isArray(storedFavorites) ? storedFavorites : [];
  } catch (error) {
    console.error('Error loading favorites:', error);
    favoriteSequences = [];
  }

  renderFavorites();
}

function persistFavorites() {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteSequences));
}

function saveFavoriteSequence({ label, source, sequence }) {
  const favorite = {
    id: `favorite-${Date.now()}`,
    label,
    source,
    createdAt: new Date().toISOString(),
    sequence: cloneSequence(sequence),
  };

  favoriteSequences.unshift(favorite);
  persistFavorites();
  renderFavorites();
  showNotification('Saved to collection.');
}

function removeFavoriteSequence(favoriteId) {
  favoriteSequences = favoriteSequences.filter(favorite => favorite.id !== favoriteId);
  persistFavorites();
  renderFavorites();
  showNotification('Removed from collection.');
}

function renderFavorites() {
  const favoritesContainer = document.getElementById('favoritesContainer');
  favoritesContainer.innerHTML = '';

  if (!favoriteSequences.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'collection-empty';
    emptyState.textContent = 'No saved outputs yet. Generate something and use "Save to Collection".';
    favoritesContainer.appendChild(emptyState);
    return;
  }

  favoriteSequences.forEach((favorite, index) => {
    favoritesContainer.appendChild(createFavoriteItem(favorite, index));
  });
}

function createFavoriteItem(favorite, index) {
  const favoriteItem = document.createElement('div');
  favoriteItem.className = 'sample-item';

  const favoriteHeader = document.createElement('div');
  favoriteHeader.className = 'sample-header';
  favoriteHeader.textContent = favorite.label;

  const favoriteContent = document.createElement('div');
  favoriteContent.className = 'sample-content';

  const meta = document.createElement('div');
  meta.className = 'collection-meta';
  meta.textContent = `${favorite.source} - Saved ${new Date(favorite.createdAt).toLocaleString()}`;
  favoriteContent.appendChild(meta);

  const visualizerContainer = document.createElement('div');
  visualizerContainer.className = 'visualizer-container';
  visualizerContainer.style.height = '100px';
  favoriteContent.appendChild(visualizerContainer);

  createVisualizer(favorite.sequence, visualizerContainer, {
    noteHeight: 4,
    pixelsPerTimeStep: 30,
    noteSpacing: 1,
    noteRGB: '50, 50, 160',
    activeNoteRGB: '235, 70, 70'
  });

  const actions = document.createElement('div');
  actions.className = 'sample-actions';

  const playButton = document.createElement('button');
  playButton.id = `play-favorite-${index}`;
  playButton.textContent = 'Play';
  playButton.addEventListener('click', () => {
    togglePlayback(favorite.sequence, playButton.id);
  });

  const downloadButton = document.createElement('button');
  downloadButton.className = 'secondary';
  downloadButton.textContent = 'Download MIDI';
  downloadButton.addEventListener('click', () => {
    downloadMIDI(favorite.sequence, `favorite_${index + 1}`);
  });

  const removeButton = document.createElement('button');
  removeButton.className = 'danger';
  removeButton.textContent = 'Remove';
  removeButton.addEventListener('click', () => {
    removeFavoriteSequence(favorite.id);
  });

  actions.appendChild(playButton);
  actions.appendChild(downloadButton);
  actions.appendChild(removeButton);
  favoriteContent.appendChild(actions);

  favoriteItem.appendChild(favoriteHeader);
  favoriteItem.appendChild(favoriteContent);

  return favoriteItem;
}

function setupSeedVisualizers() {
  // Create SVG elements for each seed visualizer
  createSeedVisualizer('seedVisualizer', selectedContinuationSeed);
  createSeedVisualizer('startSeedVisualizer', selectedStartSeed);
  createSeedVisualizer('endSeedVisualizer', selectedEndSeed);
}

function createSeedVisualizer(containerId, seedType) {
  const container = document.getElementById(containerId);
  container.innerHTML = ''; // Clear any existing content

  createVisualizer(SEEDS[seedType], container, {
    noteHeight: 4,
    pixelsPerTimeStep: 30,
    noteSpacing: 1,
    noteRGB: '50, 50, 160',
    activeNoteRGB: '235, 70, 70'
  });
}

function createVisualizer(sequence, container, config) {
  // Create SVG element
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  container.appendChild(svg);

  // Create visualizer with the seed
  const visualizer = new core.PianoRollSVGVisualizer(sequence, svg, config);

  // Store the visualizer reference if needed
  if (container.id === 'seedVisualizer') {
    seedVisualizer = visualizer;
  } else if (container.id === 'startSeedVisualizer') {
    startSeedVisualizer = visualizer;
  } else if (container.id === 'endSeedVisualizer') {
    endSeedVisualizer = visualizer;
  }

  return visualizer;
}

function updateSeedVisualizer() {
  createSeedVisualizer('seedVisualizer', selectedContinuationSeed);
}

function updateStartSeedVisualizer() {
  createSeedVisualizer('startSeedVisualizer', selectedStartSeed);
}

function updateEndSeedVisualizer() {
  createSeedVisualizer('endSeedVisualizer', selectedEndSeed);
}

async function generateContinuation() {
  if (!musicRNN) {
    showNotification('MusicRNN model is not loaded yet. Please wait.', true);
    return;
  }

  try {
    // Get parameters
    const steps = parseInt(document.getElementById('continuationSteps').value);
    const temperature = parseFloat(document.getElementById('continuationTemperature').value);
    const seed = SEEDS[selectedContinuationSeed];

    // Show loading state
    document.getElementById('generateContinuation').disabled = true;
    const container = document.getElementById('continuationVisualizer');

    // Add loading overlay
    if (!document.getElementById('continuationLoading')) {
      const loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'continuationLoading';
      loadingOverlay.className = 'loading-overlay';
      loadingOverlay.innerHTML = '<div class="spinner"></div>';
      container.appendChild(loadingOverlay);
    }

    // Clear previous visualizer content
    // Only create the visualizer when we have actual content to display
    const placeholder = container.querySelector('.visualizer-placeholder');
    if (placeholder) {
      placeholder.style.display = 'none';
    }

    // Generate continuation
    console.log(`Generating continuation: seed=${selectedContinuationSeed}, steps=${steps}, temperature=${temperature}`);
    const continuation = await musicRNN.continueSequence(seed, steps, temperature);

    // Remove loading overlay
    const loadingOverlay = document.getElementById('continuationLoading');
    if (loadingOverlay) {
      loadingOverlay.remove();
    }

    // Store the sequence
    currentContinuation = continuation;

    // Create the visualizer with the SVG element
    container.innerHTML = ''; // Clear the container first
    continuationVisualizer = createVisualizer(continuation, container, {
      noteHeight: 6,
      pixelsPerTimeStep: 30,
      noteSpacing: 1,
      noteRGB: '50, 50, 160',
      activeNoteRGB: '235, 70, 70'
    });

    // Show controls
    document.getElementById('continuationActions').style.display = 'flex';

    // Re-enable the button
    document.getElementById('generateContinuation').disabled = false;

    // Show notification
    showNotification('Continuation generated successfully!');
  } catch (error) {
    console.error('Error generating continuation:', error);
    document.getElementById('generateContinuation').disabled = false;

    // Remove loading overlay
    const loadingOverlay = document.getElementById('continuationLoading');
    if (loadingOverlay) {
      loadingOverlay.remove();
    }

    showNotification('Error generating continuation. Please try again.', true);
  }
}

async function generateSamples() {
  if (!musicVAE) {
    showNotification('MusicVAE model is not loaded yet. Please wait.', true);
    return;
  }

  try {
    // Get parameters
    const numSamples = parseInt(document.getElementById('samplesCount').value);
    const temperature = parseFloat(document.getElementById('samplesTemperature').value);

    // Show loading state
    document.getElementById('generateSamples').disabled = true;

    // Clear previous samples
    const samplesContainer = document.getElementById('samplesContainer');
    samplesContainer.innerHTML = '';
    currentSamples = [];

    // Add loading indicator
    const loadingItem = document.createElement('div');
    loadingItem.className = 'loading-overlay';
    loadingItem.innerHTML = '<div class="spinner"></div>';
    samplesContainer.appendChild(loadingItem);

    // Generate samples
    console.log(`Generating ${numSamples} samples with temperature ${temperature}`);
    const samples = await musicVAE.sample(numSamples, temperature);

    // Remove loading indicator
    loadingItem.remove();

    // Store the samples
    currentSamples = samples;

    // Create sample items
    samples.forEach((sample, index) => {
      const sampleItem = createSampleItem(sample, index);
      samplesContainer.appendChild(sampleItem);
    });

    // Re-enable the button
    document.getElementById('generateSamples').disabled = false;

    // Show notification
    showNotification(`Generated ${numSamples} samples successfully!`);
  } catch (error) {
    console.error('Error generating samples:', error);
    document.getElementById('generateSamples').disabled = false;

    // Remove loading indicator
    const loadingItem = document.querySelector('#samplesContainer .loading-overlay');
    if (loadingItem) {
      loadingItem.remove();
    }

    showNotification('Error generating samples. Please try again.', true);
  }
}

function createSampleItem(sample, index) {
  const sampleItem = document.createElement('div');
  sampleItem.className = 'sample-item';

  const sampleHeader = document.createElement('div');
  sampleHeader.className = 'sample-header';
  sampleHeader.textContent = `Sample ${index + 1}`;

  const sampleContent = document.createElement('div');
  sampleContent.className = 'sample-content';

  // Create a mini visualizer container for this sample
  const visualizerContainer = document.createElement('div');
  visualizerContainer.className = 'visualizer-container';
  visualizerContainer.style.height = '100px';
  sampleContent.appendChild(visualizerContainer);

  createVisualizer(sample, visualizerContainer, {
    noteHeight: 4,
    pixelsPerTimeStep: 30,
    noteSpacing: 1,
    noteRGB: '50, 50, 160',
    activeNoteRGB: '235, 70, 70'
  });

  // Create control buttons
  const sampleActions = document.createElement('div');
  sampleActions.className = 'sample-actions';

  const playButton = document.createElement('button');
  playButton.textContent = 'Play';
  playButton.addEventListener('click', () => {
    togglePlayback(sample, `play-sample-${index}`);
  });
  playButton.id = `play-sample-${index}`;

  const downloadButton = document.createElement('button');
  downloadButton.textContent = 'Download MIDI';
  downloadButton.className = 'secondary';
  downloadButton.addEventListener('click', () => {
    downloadMIDI(sample, `sample_${index + 1}`);
  });

  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save to Collection';
  saveButton.className = 'tertiary';
  saveButton.addEventListener('click', () => {
    saveFavoriteSequence({
      label: `Sample ${index + 1}`,
      source: 'MusicVAE sample',
      sequence: sample,
    });
  });

  sampleActions.appendChild(playButton);
  sampleActions.appendChild(downloadButton);
  sampleActions.appendChild(saveButton);
  sampleContent.appendChild(sampleActions);

  sampleItem.appendChild(sampleHeader);
  sampleItem.appendChild(sampleContent);

  return sampleItem;
}

async function generateInterpolation() {
  if (!musicVAE) {
    showNotification('MusicVAE model is not loaded yet. Please wait.', true);
    return;
  }

  try {
    // Get parameters
    const numSteps = parseInt(document.getElementById('numInterpolations').value);
    const startSeed = SEEDS[selectedStartSeed];
    const endSeed = SEEDS[selectedEndSeed];

    // Show loading state
    document.getElementById('generateInterpolation').disabled = true;

    // Clear previous interpolations
    const interpolationContainer = document.getElementById('interpolationContainer');
    interpolationContainer.innerHTML = '';
    currentInterpolations = [];

    // Add seed information
    const seedInfo = document.createElement('div');
    seedInfo.className = 'seed-info';
    seedInfo.textContent = `Interpolating from ${formatSeedName(selectedStartSeed)} to ${formatSeedName(selectedEndSeed)}`;
    seedInfo.style.gridColumn = '1 / -1'; // Make it span all columns
    interpolationContainer.appendChild(seedInfo);

    // Add loading indicator
    const loadingItem = document.createElement('div');
    loadingItem.className = 'loading-overlay';
    loadingItem.innerHTML = '<div class="spinner"></div>';
    loadingItem.style.position = 'relative';
    loadingItem.style.height = '100px';
    loadingItem.style.marginBottom = '20px';
    loadingItem.style.gridColumn = '1 / -1'; // Make it span all columns
    interpolationContainer.appendChild(loadingItem);

    // Generate interpolation
    console.log(`Generating interpolation between ${selectedStartSeed} and ${selectedEndSeed} with ${numSteps} steps`);

    // Linear between two inputs:
    const sequences = await musicVAE.interpolate(
      [startSeed, endSeed],
      numSteps
    );

    // Remove loading indicator
    loadingItem.remove();

    // Store the interpolations
    currentInterpolations = sequences;

    // Create interpolation items
    sequences.forEach((sequence, index) => {
      const t = index / (numSteps - 1);
      const interpolationItem = createInterpolationItem(sequence, index, t);
      interpolationContainer.appendChild(interpolationItem);
    });

    // Re-enable the button
    document.getElementById('generateInterpolation').disabled = false;

    // Show notification
    showNotification(`Generated ${numSteps} interpolations successfully!`);
  } catch (error) {
    console.error('Error generating interpolation:', error);
    document.getElementById('generateInterpolation').disabled = false;

    // Remove loading indicator
    const loadingItems = document.querySelectorAll('#interpolationContainer .loading-overlay');
    loadingItems.forEach(item => item.remove());

    showNotification('Error generating interpolation. Please try again.', true);
  }
}

function formatSeedName(seedKey) {
  switch (seedKey) {
    case 'cmajor': return 'C Major Scale';
    case 'cminor': return 'C Minor Scale';
    case 'cmajorarp': return 'C Major Arpeggio';
    case 'blues': return 'Blues Lick';
    default: return seedKey;
  }
}

function createInterpolationItem(sequence, index, t) {
  const interpolationItem = document.createElement('div');
  interpolationItem.className = 'sample-item';

  const itemHeader = document.createElement('div');
  itemHeader.className = 'sample-header';
  itemHeader.textContent = `Step ${index + 1}`;

  const itemContent = document.createElement('div');
  itemContent.className = 'sample-content';

  // Create a mini visualizer container for this interpolation
  const visualizerContainer = document.createElement('div');
  visualizerContainer.className = 'visualizer-container';
  visualizerContainer.style.height = '100px';
  itemContent.appendChild(visualizerContainer);

  createVisualizer(sequence, visualizerContainer, {
    noteHeight: 4,
    pixelsPerTimeStep: 30,
    noteSpacing: 1,
    noteRGB: `${Math.round(50 + 180 * t)}, 50, ${Math.round(160 - 110 * t)}`,
    activeNoteRGB: '235, 70, 70'
  });

  // Create control buttons
  const itemActions = document.createElement('div');
  itemActions.className = 'sample-actions';

  const playButton = document.createElement('button');
  playButton.textContent = 'Play';
  playButton.addEventListener('click', () => {
    togglePlayback(sequence, `play-interp-${index}`);
  });
  playButton.id = `play-interp-${index}`;

  const downloadButton = document.createElement('button');
  downloadButton.textContent = 'Download MIDI';
  downloadButton.className = 'secondary';
  downloadButton.addEventListener('click', () => {
    downloadMIDI(sequence, `interpolation_${index + 1}`);
  });

  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save to Collection';
  saveButton.className = 'tertiary';
  saveButton.addEventListener('click', () => {
    saveFavoriteSequence({
      label: `Interpolation Step ${index + 1}`,
      source: `MusicVAE interpolation (${formatSeedName(selectedStartSeed)} to ${formatSeedName(selectedEndSeed)})`,
      sequence,
    });
  });

  itemActions.appendChild(playButton);
  itemActions.appendChild(downloadButton);
  itemActions.appendChild(saveButton);
  itemContent.appendChild(itemActions);

  interpolationItem.appendChild(itemHeader);
  interpolationItem.appendChild(itemContent);

  return interpolationItem;
}

function togglePlayback(sequence, buttonId) {
  if (!sequence) {
    showNotification('No sequence available to play yet.', true);
    return;
  }

  if (player.isPlaying()) {
    player.stop();
    updatePlayButtons();
    return;
  }

  updatePlayButtons(buttonId);
  player.start(createPlaybackSequence(sequence)).then(() => {
    updatePlayButtons();
  });
}

function updatePlayButtons(activeId = null) {
  // Update all play buttons
  const playButtons = document.querySelectorAll('button[id^="play"]');
  playButtons.forEach(button => {
    if (button.id === activeId) {
      button.textContent = 'Stop';
    } else {
      button.textContent = button.id === 'playContinuation' ? 'Play' :
        (button.id.includes('sample') || button.id.includes('interp')) ? 'Play' : 'Play';
    }
  });
}

function downloadMIDI(sequence, fileName) {
  // Convert the sequence to MIDI
  const midi = core.sequenceProtoToMidi(sequence);

  // Create a blob from the MIDI data
  const file = new Blob([midi], { type: 'audio/midi' });

  // Use FileSaver.js to save the file
  saveAs(file, `${fileName}_${Date.now()}.mid`);

  // Show notification
  showNotification('MIDI file downloaded successfully!');
}

function showNotification(message, isError = false) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.style.backgroundColor = isError ? '#b00020' : '#323232';
  notification.classList.add('show');

  // Hide the notification after 3 seconds
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Initialize the application when the page loads
window.addEventListener('DOMContentLoaded', initialize);
