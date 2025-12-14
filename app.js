/**
 * ============================================
 * CineMatch - Smart Movie Recommendation Tool
 * Main JavaScript Application
 * ============================================
 * 
 * This application provides:
 * - Movie search by title, actor, or mood
 * - Movie details display with similar movie suggestions
 * - Weekend movie optimizer with watchlist management
 * 
 * APIs Used:
 * - OMDB API for movie data
 * - Google Gemini API for mood-based keyword extraction
 */

// ============================================
// Configuration & Constants
// ============================================

/**
 * API Configuration
 * Keys are stored in localStorage for persistence
 */
const CONFIG = {
    OMDB_BASE_URL: 'https://www.omdbapi.com/',
    GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    STORAGE_KEYS: {
        OMDB_API_KEY: 'cinematch_omdb_key',
        GEMINI_API_KEY: 'cinematch_gemini_key',
        WATCHLIST: 'cinematch_watchlist'
    }
};

/**
 * Placeholder messages for different search types
 */
const SEARCH_PLACEHOLDERS = {
    title: 'Search for movies by title...',
    actor: 'Search movies by actor name...',
    mood: 'Describe your mood (e.g., "I want something funny and light")...'
};

// ============================================
// State Management
// ============================================

/**
 * Application State
 * Holds the current state of the application
 */
const state = {
    currentSearchType: 'title',
    searchResults: [],
    selectedMovie: null,
    watchlist: [],
    isLoading: false
};

// ============================================
// DOM Element References
// ============================================

/**
 * Cache DOM element references for better performance
 */
const elements = {
    // API Config Modal
    apiConfigModal: document.getElementById('apiConfigModal'),
    omdbApiKeyInput: document.getElementById('omdbApiKey'),
    geminiApiKeyInput: document.getElementById('geminiApiKey'),
    saveApiKeysBtn: document.getElementById('saveApiKeys'),
    settingsBtn: document.getElementById('settingsBtn'),

    // Search Elements
    searchTabs: document.querySelectorAll('.search-tab'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    moodHint: document.getElementById('moodHint'),

    // Results Section
    resultsSection: document.getElementById('resultsSection'),
    resultsGrid: document.getElementById('resultsGrid'),
    resultsCount: document.getElementById('resultsCount'),
    resultsLoader: document.getElementById('resultsLoader'),
    noResults: document.getElementById('noResults'),

    // Movie Modal
    movieModal: document.getElementById('movieModal'),
    closeModal: document.getElementById('closeModal'),
    movieDetailsContent: document.getElementById('movieDetailsContent'),
    similarMoviesSection: document.getElementById('similarMoviesSection'),
    similarMoviesGrid: document.getElementById('similarMoviesGrid'),

    // Watchlist
    watchlistContainer: document.getElementById('watchlistContainer'),
    emptyWatchlist: document.getElementById('emptyWatchlist'),
    watchlistItems: document.getElementById('watchlistItems'),
    watchlistCount: document.getElementById('watchlistCount'),
    runtimeDisplay: document.getElementById('runtimeDisplay'),
    totalRuntime: document.getElementById('totalRuntime'),

    // Optimizer
    availableTimeInput: document.getElementById('availableTime'),
    optimizeBtn: document.getElementById('optimizeBtn'),
    optimizationResults: document.getElementById('optimizationResults'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer')
};

// ============================================
// Utility Functions
// ============================================

/**
 * Get API key from localStorage
 * @param {string} keyName - The storage key name
 * @returns {string|null} - The API key or null if not found
 */
function getApiKey(keyName) {
    return localStorage.getItem(keyName);
}

/**
 * Set API key in localStorage
 * @param {string} keyName - The storage key name
 * @param {string} value - The API key value
 */
function setApiKey(keyName, value) {
    localStorage.setItem(keyName, value);
}

/**
 * Check if API keys are configured
 * @returns {boolean} - True if both keys are configured
 */
function areApiKeysConfigured() {
    const omdbKey = getApiKey(CONFIG.STORAGE_KEYS.OMDB_API_KEY);
    const geminiKey = getApiKey(CONFIG.STORAGE_KEYS.GEMINI_API_KEY);
    return omdbKey && omdbKey.trim() !== '';
}

/**
 * Show toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (success, error, warning, info)
 */
function showToast(message, type = 'info') {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Format runtime from minutes to hours and minutes
 * @param {number} minutes - Runtime in minutes
 * @returns {string} - Formatted runtime string
 */
function formatRuntime(minutes) {
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Parse runtime string to minutes
 * @param {string} runtimeStr - Runtime string (e.g., "142 min")
 * @returns {number} - Runtime in minutes
 */
function parseRuntime(runtimeStr) {
    if (!runtimeStr || runtimeStr === 'N/A') return 0;
    const match = runtimeStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Debounce function to limit API calls
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce delay in ms
 * @returns {Function} - The debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// API Functions
// ============================================

/**
 * Search movies using OMDB API
 * @param {string} query - The search query
 * @param {string} type - Search type (title or actor)
 * @returns {Promise<Array>} - Array of movie results
 */
async function searchMovies(query, type = 'title') {
    const apiKey = getApiKey(CONFIG.STORAGE_KEYS.OMDB_API_KEY);

    if (!apiKey) {
        showToast('Please configure your OMDB API key first', 'error');
        showApiConfigModal();
        return [];
    }

    try {
        let url;

        if (type === 'actor') {
            // For actor search, we search by title containing actor name
            // OMDB doesn't have direct actor search, so we use a workaround
            url = `${CONFIG.OMDB_BASE_URL}?apikey=${apiKey}&s=${encodeURIComponent(query)}&type=movie`;
        } else {
            url = `${CONFIG.OMDB_BASE_URL}?apikey=${apiKey}&s=${encodeURIComponent(query)}&type=movie`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.Response === 'True') {
            // If searching by actor, filter results by checking movie details
            if (type === 'actor') {
                const detailedMovies = await Promise.all(
                    data.Search.slice(0, 10).map(movie => fetchMovieDetails(movie.imdbID))
                );

                // Filter movies that have the actor in the cast
                const filteredMovies = detailedMovies.filter(movie =>
                    movie && movie.Actors &&
                    movie.Actors.toLowerCase().includes(query.toLowerCase())
                );

                return filteredMovies.length > 0 ? filteredMovies : data.Search;
            }
            return data.Search;
        } else {
            console.log('OMDB API returned:', data.Error);
            return [];
        }
    } catch (error) {
        console.error('Error searching movies:', error);
        showToast('Failed to search movies. Please try again.', 'error');
        return [];
    }
}

/**
 * Fetch detailed movie information
 * @param {string} imdbId - The IMDB ID of the movie
 * @returns {Promise<Object|null>} - Movie details object or null
 */
async function fetchMovieDetails(imdbId) {
    const apiKey = getApiKey(CONFIG.STORAGE_KEYS.OMDB_API_KEY);

    if (!apiKey) {
        showToast('Please configure your OMDB API key first', 'error');
        return null;
    }

    try {
        const url = `${CONFIG.OMDB_BASE_URL}?apikey=${apiKey}&i=${imdbId}&plot=full`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.Response === 'True') {
            return data;
        } else {
            console.log('OMDB API returned:', data.Error);
            return null;
        }
    } catch (error) {
        console.error('Error fetching movie details:', error);
        return null;
    }
}

/**
 * Search for similar movies based on genre and year
 * @param {string} genre - The genre to search for
 * @param {string} year - The year of the original movie
 * @param {string} excludeId - The IMDB ID to exclude
 * @returns {Promise<Array>} - Array of similar movies
 */
async function fetchSimilarMovies(genre, year, excludeId) {
    const apiKey = getApiKey(CONFIG.STORAGE_KEYS.OMDB_API_KEY);

    if (!apiKey || !genre) return [];

    try {
        // Get the primary genre
        const primaryGenre = genre.split(',')[0].trim();

        // Search for movies with similar genre keywords
        const genreKeywords = {
            'Action': ['action', 'adventure', 'thriller'],
            'Comedy': ['comedy', 'funny', 'humor'],
            'Drama': ['drama', 'emotional', 'story'],
            'Horror': ['horror', 'scary', 'thriller'],
            'Sci-Fi': ['space', 'future', 'robot'],
            'Romance': ['love', 'romance', 'romantic'],
            'Thriller': ['thriller', 'suspense', 'mystery'],
            'Animation': ['animation', 'animated', 'cartoon']
        };

        const keywords = genreKeywords[primaryGenre] || [primaryGenre.toLowerCase()];

        // Search for movies using genre-related keywords
        const searchPromises = keywords.map(keyword =>
            fetch(`${CONFIG.OMDB_BASE_URL}?apikey=${apiKey}&s=${keyword}&type=movie`)
                .then(res => res.json())
        );

        const results = await Promise.all(searchPromises);

        // Combine and deduplicate results
        const allMovies = [];
        const seenIds = new Set([excludeId]);

        for (const result of results) {
            if (result.Response === 'True' && result.Search) {
                for (const movie of result.Search) {
                    if (!seenIds.has(movie.imdbID)) {
                        seenIds.add(movie.imdbID);
                        allMovies.push(movie);
                    }
                }
            }
        }

        // Return up to 6 similar movies
        return allMovies.slice(0, 6);
    } catch (error) {
        console.error('Error fetching similar movies:', error);
        return [];
    }
}

/**
 * Use Gemini API to extract movie search keywords from mood description
 * @param {string} moodText - The user's mood description
 * @returns {Promise<string>} - Extracted keywords for movie search
 */
async function extractMoodKeywords(moodText) {
    const apiKey = getApiKey(CONFIG.STORAGE_KEYS.GEMINI_API_KEY);

    if (!apiKey) {
        // If no Gemini key, do a simple keyword extraction
        showToast('Gemini API not configured. Using basic keyword extraction.', 'warning');
        return extractBasicKeywords(moodText);
    }

    try {
        const prompt = `You are a movie recommendation assistant. Based on the following mood description, suggest 2-3 specific movie search terms that would help find relevant movies. Return ONLY the search terms separated by commas, nothing else. Be specific and use actual movie genres or popular movie titles/themes.

Mood: "${moodText}"

Examples:
- "I want something funny and light" → "comedy, romantic comedy, feel good"
- "Looking for thrilling adventure" → "action adventure, thriller, heist"
- "Something to cry about" → "drama, emotional, tearjerker"

Your response (just the keywords):`;

        const response = await fetch(`${CONFIG.GEMINI_BASE_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 50
                }
            })
        });

        const data = await response.json();

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const keywords = data.candidates[0].content.parts[0].text;
            return keywords.trim();
        } else {
            console.log('Gemini API response:', data);
            return extractBasicKeywords(moodText);
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        showToast('Gemini API error. Using basic keyword extraction.', 'warning');
        return extractBasicKeywords(moodText);
    }
}

/**
 * Basic keyword extraction fallback when Gemini is not available
 * @param {string} moodText - The user's mood description
 * @returns {string} - Extracted keywords
 */
function extractBasicKeywords(moodText) {
    const moodToGenre = {
        'funny': 'comedy',
        'laugh': 'comedy',
        'humor': 'comedy',
        'light': 'comedy',
        'happy': 'comedy',
        'scary': 'horror',
        'horror': 'horror',
        'frightening': 'horror',
        'thriller': 'thriller',
        'suspense': 'thriller',
        'exciting': 'action',
        'action': 'action',
        'adventure': 'adventure',
        'thrilling': 'action',
        'romantic': 'romance',
        'love': 'romance',
        'romance': 'romance',
        'emotional': 'drama',
        'drama': 'drama',
        'sad': 'drama',
        'cry': 'drama',
        'sci-fi': 'sci-fi',
        'space': 'sci-fi',
        'future': 'sci-fi',
        'animated': 'animation',
        'cartoon': 'animation',
        'family': 'family',
        'kids': 'family',
        'documentary': 'documentary',
        'mystery': 'mystery',
        'crime': 'crime',
        'war': 'war',
        'historical': 'history',
        'fantasy': 'fantasy',
        'magic': 'fantasy'
    };

    const words = moodText.toLowerCase().split(/\s+/);
    const genres = new Set();

    for (const word of words) {
        for (const [keyword, genre] of Object.entries(moodToGenre)) {
            if (word.includes(keyword)) {
                genres.add(genre);
            }
        }
    }

    return genres.size > 0 ? Array.from(genres).join(', ') : 'popular';
}

// ============================================
// Search Functions
// ============================================

/**
 * Handle search based on current search type
 */
async function handleSearch() {
    const query = elements.searchInput.value.trim();

    if (!query) {
        showToast('Please enter a search term', 'warning');
        return;
    }

    // Show loading state
    showLoadingState();

    let results = [];

    try {
        switch (state.currentSearchType) {
            case 'title':
                results = await searchMovies(query, 'title');
                break;

            case 'actor':
                results = await searchMovies(query, 'actor');
                break;

            case 'mood':
                // First, extract keywords from mood using Gemini
                showToast('Analyzing your mood...', 'info');
                const keywords = await extractMoodKeywords(query);
                console.log('Extracted keywords:', keywords);

                // Search for each keyword and combine results
                const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k);
                const allResults = [];
                const seenIds = new Set();

                for (const keyword of keywordList) {
                    const keywordResults = await searchMovies(keyword, 'title');
                    for (const movie of keywordResults) {
                        if (!seenIds.has(movie.imdbID)) {
                            seenIds.add(movie.imdbID);
                            allResults.push(movie);
                        }
                    }
                }

                results = allResults.slice(0, 20); // Limit to 20 results
                break;
        }

        state.searchResults = results;
        displaySearchResults(results);

    } catch (error) {
        console.error('Search error:', error);
        showToast('An error occurred during search', 'error');
        hideLoadingState();
    }
}

/**
 * Display search results in the grid
 * @param {Array} movies - Array of movie objects
 */
function displaySearchResults(movies) {
    hideLoadingState();

    if (!movies || movies.length === 0) {
        elements.resultsGrid.innerHTML = '';
        elements.noResults.classList.remove('hidden');
        elements.resultsSection.classList.remove('hidden');
        elements.resultsCount.textContent = 'No results found';
        return;
    }

    elements.noResults.classList.add('hidden');
    elements.resultsSection.classList.remove('hidden');
    elements.resultsCount.textContent = `Found ${movies.length} movie${movies.length !== 1 ? 's' : ''}`;

    // Generate movie cards HTML
    const cardsHTML = movies.map(movie => createMovieCard(movie)).join('');
    elements.resultsGrid.innerHTML = cardsHTML;

    // Add click event listeners to movie cards
    document.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't open modal if clicking the watchlist button
            if (e.target.closest('.add-watchlist-btn')) return;

            const imdbId = card.dataset.imdbId;
            openMovieDetails(imdbId);
        });
    });

    // Add click event listeners to watchlist buttons
    document.querySelectorAll('.add-watchlist-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const imdbId = btn.dataset.imdbId;
            handleAddToWatchlist(imdbId, btn);
        });
    });
}

/**
 * Create HTML for a movie card
 * @param {Object} movie - Movie object
 * @returns {string} - HTML string for the movie card
 */
function createMovieCard(movie) {
    const isInWatchlist = state.watchlist.some(m => m.imdbID === movie.imdbID);
    const posterHtml = movie.Poster && movie.Poster !== 'N/A'
        ? `<img src="${movie.Poster}" alt="${movie.Title}">`
        : `<div class="no-poster">🎬</div>`;

    // Handle rating - might be in different formats
    const rating = movie.imdbRating || movie.Rating || '';
    const ratingHtml = rating && rating !== 'N/A'
        ? `<span class="movie-card-rating">⭐ ${rating}</span>`
        : '';

    return `
        <div class="movie-card" data-imdb-id="${movie.imdbID}">
            <div class="movie-card-poster">
                ${posterHtml}
                <div class="movie-card-overlay"></div>
                <div class="movie-card-actions">
                    <button class="add-watchlist-btn ${isInWatchlist ? 'added' : ''}" 
                            data-imdb-id="${movie.imdbID}">
                        ${isInWatchlist ? '✓ In Watchlist' : '+ Watchlist'}
                    </button>
                </div>
            </div>
            <div class="movie-card-info">
                <h4 class="movie-card-title">${movie.Title}</h4>
                <div class="movie-card-meta">
                    <span class="movie-card-year">${movie.Year}</span>
                    ${ratingHtml}
                </div>
            </div>
        </div>
    `;
}

/**
 * Show loading state
 */
function showLoadingState() {
    state.isLoading = true;
    elements.resultsSection.classList.remove('hidden');
    elements.resultsGrid.innerHTML = '';
    elements.noResults.classList.add('hidden');
    elements.resultsLoader.classList.remove('hidden');
}

/**
 * Hide loading state
 */
function hideLoadingState() {
    state.isLoading = false;
    elements.resultsLoader.classList.add('hidden');
}

// ============================================
// Movie Details Modal Functions
// ============================================

/**
 * Open movie details modal
 * @param {string} imdbId - The IMDB ID of the movie
 */
async function openMovieDetails(imdbId) {
    // Show modal with loading state
    elements.movieModal.classList.add('active');
    elements.movieDetailsContent.innerHTML = `
        <div class="loader-container">
            <div class="loader">
                <div class="loader-spinner"></div>
                <p>Loading movie details...</p>
            </div>
        </div>
    `;
    elements.similarMoviesSection.classList.add('hidden');

    // Fetch movie details
    const movie = await fetchMovieDetails(imdbId);

    if (!movie) {
        elements.movieDetailsContent.innerHTML = `
            <div class="no-results">
                <span class="no-results-icon">😕</span>
                <h4>Failed to load movie details</h4>
                <p>Please try again later</p>
            </div>
        `;
        return;
    }

    state.selectedMovie = movie;

    // Display movie details
    displayMovieDetails(movie);

    // Fetch and display similar movies
    const similarMovies = await fetchSimilarMovies(movie.Genre, movie.Year, movie.imdbID);
    displaySimilarMovies(similarMovies);
}

/**
 * Display movie details in the modal
 * @param {Object} movie - Movie details object
 */
function displayMovieDetails(movie) {
    const posterHtml = movie.Poster && movie.Poster !== 'N/A'
        ? `<img src="${movie.Poster}" alt="${movie.Title}">`
        : `<div class="no-poster">🎬</div>`;

    const genres = movie.Genre ? movie.Genre.split(',').map(g =>
        `<span class="genre-tag">${g.trim()}</span>`
    ).join('') : '';

    const isInWatchlist = state.watchlist.some(m => m.imdbID === movie.imdbID);

    elements.movieDetailsContent.innerHTML = `
        <div class="movie-poster-large">
            ${posterHtml}
        </div>
        <div class="movie-info">
            <h2 class="movie-title-large">${movie.Title}</h2>
            
            <div class="movie-meta-bar">
                ${movie.imdbRating && movie.imdbRating !== 'N/A' ?
            `<span class="movie-rating-large">⭐ ${movie.imdbRating}/10</span>` : ''}
                <span>${movie.Year}</span>
                ${movie.Runtime && movie.Runtime !== 'N/A' ? `<span>⏱️ ${movie.Runtime}</span>` : ''}
                ${movie.Rated && movie.Rated !== 'N/A' ? `<span>${movie.Rated}</span>` : ''}
            </div>
            
            ${genres ? `<div class="movie-genres">${genres}</div>` : ''}
            
            <p class="movie-plot">${movie.Plot || 'No plot available.'}</p>
            
            ${movie.Director && movie.Director !== 'N/A' ? `
                <div class="movie-details-section">
                    <h4>Director</h4>
                    <p>${movie.Director}</p>
                </div>
            ` : ''}
            
            ${movie.Actors && movie.Actors !== 'N/A' ? `
                <div class="movie-details-section">
                    <h4>Cast</h4>
                    <p>${movie.Actors}</p>
                </div>
            ` : ''}
            
            ${movie.Awards && movie.Awards !== 'N/A' ? `
                <div class="movie-details-section">
                    <h4>Awards</h4>
                    <p>${movie.Awards}</p>
                </div>
            ` : ''}
            
            <div class="movie-actions">
                <button class="btn btn-primary modal-watchlist-btn" data-imdb-id="${movie.imdbID}">
                    ${isInWatchlist ? '✓ In Watchlist' : '+ Add to Watchlist'}
                </button>
                ${movie.Title ? `
                    <a href="https://www.justwatch.com/in/search?q=${encodeURIComponent(movie.Title)}" 
                       target="_blank" 
                       class="btn btn-primary watch-btn">
                        🎬 Watch Now
                    </a>
                ` : ''}
                ${movie.imdbID ? `
                    <a href="https://www.imdb.com/title/${movie.imdbID}/" 
                       target="_blank" 
                       class="btn btn-secondary">
                        View on IMDB
                    </a>
                ` : ''}
            </div>
        </div>
    `;

    // Add event listener to watchlist button
    const watchlistBtn = elements.movieDetailsContent.querySelector('.modal-watchlist-btn');
    if (watchlistBtn) {
        watchlistBtn.addEventListener('click', () => {
            handleAddToWatchlist(movie.imdbID, watchlistBtn);
        });
    }
}

/**
 * Display similar movies in the modal
 * @param {Array} movies - Array of similar movie objects
 */
function displaySimilarMovies(movies) {
    if (!movies || movies.length === 0) {
        elements.similarMoviesSection.classList.add('hidden');
        return;
    }

    elements.similarMoviesSection.classList.remove('hidden');

    const cardsHTML = movies.map(movie => {
        const posterHtml = movie.Poster && movie.Poster !== 'N/A'
            ? `<img src="${movie.Poster}" alt="${movie.Title}">`
            : `<div class="no-poster">🎬</div>`;

        return `
            <div class="similar-movie-card" data-imdb-id="${movie.imdbID}">
                <div class="similar-movie-poster">
                    ${posterHtml}
                </div>
                <p class="similar-movie-title">${movie.Title}</p>
            </div>
        `;
    }).join('');

    elements.similarMoviesGrid.innerHTML = cardsHTML;

    // Add click listeners to similar movie cards
    elements.similarMoviesGrid.querySelectorAll('.similar-movie-card').forEach(card => {
        card.addEventListener('click', () => {
            const imdbId = card.dataset.imdbId;
            openMovieDetails(imdbId);
        });
    });
}

/**
 * Close movie details modal
 */
function closeMovieModal() {
    elements.movieModal.classList.remove('active');
    state.selectedMovie = null;
}

// ============================================
// Watchlist Management Functions
// ============================================

/**
 * Load watchlist from localStorage
 */
function loadWatchlist() {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.WATCHLIST);
    if (saved) {
        try {
            state.watchlist = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading watchlist:', e);
            state.watchlist = [];
        }
    }
    updateWatchlistDisplay();
}

/**
 * Save watchlist to localStorage
 */
function saveWatchlist() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.WATCHLIST, JSON.stringify(state.watchlist));
}

/**
 * Handle add to watchlist button click
 * @param {string} imdbId - The IMDB ID of the movie
 * @param {HTMLElement} button - The button element clicked
 */
async function handleAddToWatchlist(imdbId, button) {
    // Check if already in watchlist
    const existingIndex = state.watchlist.findIndex(m => m.imdbID === imdbId);

    if (existingIndex !== -1) {
        // Remove from watchlist
        state.watchlist.splice(existingIndex, 1);
        saveWatchlist();
        updateWatchlistDisplay();
        updateWatchlistButtons(imdbId, false);
        showToast('Movie removed from watchlist', 'success');
        return;
    }

    // Fetch movie details if not available
    let movie = state.searchResults.find(m => m.imdbID === imdbId);

    if (!movie || !movie.Runtime) {
        // Fetch full details
        const fullMovie = await fetchMovieDetails(imdbId);
        if (fullMovie) {
            movie = fullMovie;
        } else {
            showToast('Failed to add movie to watchlist', 'error');
            return;
        }
    }

    // Add to watchlist
    state.watchlist.push({
        imdbID: movie.imdbID,
        Title: movie.Title,
        Year: movie.Year,
        Poster: movie.Poster,
        Runtime: movie.Runtime || 'N/A',
        imdbRating: movie.imdbRating || 'N/A'
    });

    saveWatchlist();
    updateWatchlistDisplay();
    updateWatchlistButtons(imdbId, true);
    showToast(`"${movie.Title}" added to watchlist`, 'success');
}

/**
 * Update all watchlist buttons for a specific movie
 * @param {string} imdbId - The IMDB ID of the movie
 * @param {boolean} isInWatchlist - Whether the movie is in the watchlist
 */
function updateWatchlistButtons(imdbId, isInWatchlist) {
    // Update buttons in search results
    document.querySelectorAll(`.add-watchlist-btn[data-imdb-id="${imdbId}"]`).forEach(btn => {
        btn.classList.toggle('added', isInWatchlist);
        btn.textContent = isInWatchlist ? '✓ In Watchlist' : '+ Watchlist';
    });

    // Update button in modal if same movie
    const modalBtn = elements.movieDetailsContent.querySelector(`.modal-watchlist-btn[data-imdb-id="${imdbId}"]`);
    if (modalBtn) {
        modalBtn.textContent = isInWatchlist ? '✓ In Watchlist' : '+ Add to Watchlist';
    }
}

/**
 * Remove movie from watchlist by IMDB ID
 * @param {string} imdbId - The IMDB ID of the movie
 */
function removeFromWatchlist(imdbId) {
    const index = state.watchlist.findIndex(m => m.imdbID === imdbId);
    if (index !== -1) {
        const movie = state.watchlist[index];
        state.watchlist.splice(index, 1);
        saveWatchlist();
        updateWatchlistDisplay();
        updateWatchlistButtons(imdbId, false);
        showToast(`"${movie.Title}" removed from watchlist`, 'success');
    }
}

/**
 * Update the watchlist display
 */
function updateWatchlistDisplay() {
    const count = state.watchlist.length;
    elements.watchlistCount.textContent = `${count} movie${count !== 1 ? 's' : ''}`;

    if (count === 0) {
        elements.emptyWatchlist.classList.remove('hidden');
        elements.watchlistItems.classList.add('hidden');
        elements.runtimeDisplay.classList.add('hidden');
        return;
    }

    elements.emptyWatchlist.classList.add('hidden');
    elements.watchlistItems.classList.remove('hidden');
    elements.runtimeDisplay.classList.remove('hidden');

    // Calculate total runtime
    const totalMinutes = calculateTotalRuntime();
    elements.totalRuntime.textContent = formatRuntime(totalMinutes);

    // Generate watchlist items HTML
    const itemsHTML = state.watchlist.map(movie => {
        const posterHtml = movie.Poster && movie.Poster !== 'N/A'
            ? `<img src="${movie.Poster}" alt="${movie.Title}">`
            : `<div class="no-poster">🎬</div>`;

        const runtime = parseRuntime(movie.Runtime);
        const rating = movie.imdbRating && movie.imdbRating !== 'N/A' ? movie.imdbRating : '-';

        return `
            <li class="watchlist-item" data-imdb-id="${movie.imdbID}">
                <div class="watchlist-item-poster">
                    ${posterHtml}
                </div>
                <div class="watchlist-item-info">
                    <h5 class="watchlist-item-title">${movie.Title}</h5>
                    <div class="watchlist-item-meta">
                        <span class="watchlist-item-runtime">⏱️ ${runtime > 0 ? runtime + ' min' : 'N/A'}</span>
                        <span class="watchlist-item-rating">⭐ ${rating}</span>
                    </div>
                </div>
                <button class="watchlist-item-remove" data-imdb-id="${movie.imdbID}" title="Remove from watchlist">
                    ×
                </button>
            </li>
        `;
    }).join('');

    elements.watchlistItems.innerHTML = itemsHTML;

    // Add click listeners to remove buttons
    elements.watchlistItems.querySelectorAll('.watchlist-item-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            removeFromWatchlist(btn.dataset.imdbId);
        });
    });
}

/**
 * Calculate total runtime of watchlist in minutes
 * @returns {number} - Total runtime in minutes
 */
function calculateTotalRuntime() {
    return state.watchlist.reduce((total, movie) => {
        return total + parseRuntime(movie.Runtime);
    }, 0);
}

// ============================================
// Weekend Optimizer Functions
// ============================================

/**
 * Run the weekend optimizer
 */
function runOptimizer() {
    const availableHours = parseFloat(elements.availableTimeInput.value);

    if (isNaN(availableHours) || availableHours <= 0) {
        showToast('Please enter a valid available time in hours', 'warning');
        return;
    }

    if (state.watchlist.length === 0) {
        showToast('Your watchlist is empty. Add some movies first!', 'warning');
        return;
    }

    const availableMinutes = availableHours * 60;
    const totalRuntime = calculateTotalRuntime();

    elements.optimizationResults.classList.remove('hidden');

    if (totalRuntime <= availableMinutes) {
        // Success - all movies fit!
        elements.optimizationResults.innerHTML = `
            <div class="optimization-success">
                <span class="result-icon">🎉</span>
                <h4>Perfect! You can watch everything!</h4>
                <p>Your watchlist runtime (${formatRuntime(totalRuntime)}) fits within your available time (${formatRuntime(availableMinutes)}).</p>
                <p style="margin-top: 1rem; color: var(--color-text-muted);">
                    You'll even have ${formatRuntime(availableMinutes - totalRuntime)} to spare!
                </p>
            </div>
        `;
    } else {
        // Need to suggest movies to drop
        const suggestions = suggestMoviesToDrop(availableMinutes, totalRuntime);
        displayOptimizationSuggestions(suggestions, totalRuntime, availableMinutes);
    }
}

/**
 * Calculate efficiency score for a movie
 * Efficiency = rating / runtime (higher is better)
 * @param {Object} movie - Movie object
 * @returns {number} - Efficiency score
 */
function calculateEfficiency(movie) {
    const runtime = parseRuntime(movie.Runtime);
    const rating = parseFloat(movie.imdbRating) || 5; // Default to 5 if no rating

    if (runtime <= 0) return 0;

    // Efficiency formula: rating / runtime
    // Higher rating = more valuable
    // Higher runtime = less efficient (takes more time)
    return rating / runtime;
}

/**
 * Suggest movies to drop based on least efficiency
 * @param {number} availableMinutes - Available time in minutes
 * @param {number} totalRuntime - Current total runtime
 * @returns {Array} - Array of movies to suggest dropping
 */
function suggestMoviesToDrop(availableMinutes, totalRuntime) {
    // Calculate efficiency for each movie
    const moviesWithEfficiency = state.watchlist.map(movie => ({
        ...movie,
        runtime: parseRuntime(movie.Runtime),
        efficiency: calculateEfficiency(movie)
    }));

    // Sort by efficiency (lowest first - these should be dropped)
    moviesWithEfficiency.sort((a, b) => a.efficiency - b.efficiency);

    // Find movies to drop
    const moviesToDrop = [];
    let currentRuntime = totalRuntime;

    for (const movie of moviesWithEfficiency) {
        if (currentRuntime <= availableMinutes) break;

        moviesToDrop.push(movie);
        currentRuntime -= movie.runtime;
    }

    return {
        moviesToDrop,
        newRuntime: currentRuntime
    };
}

/**
 * Display optimization suggestions
 * @param {Object} suggestions - Suggestions object with movies to drop
 * @param {number} totalRuntime - Current total runtime
 * @param {number} availableMinutes - Available time in minutes
 */
function displayOptimizationSuggestions(suggestions, totalRuntime, availableMinutes) {
    const { moviesToDrop, newRuntime } = suggestions;
    const excessTime = totalRuntime - availableMinutes;

    const suggestionsHTML = moviesToDrop.map(movie => `
        <div class="suggestion-item">
            <div class="suggestion-info">
                <span class="suggestion-title">${movie.Title}</span>
                <span class="suggestion-meta">
                    ⏱️ ${movie.runtime} min | ⭐ ${movie.imdbRating || 'N/A'} | 
                    Efficiency: ${movie.efficiency.toFixed(4)}
                </span>
            </div>
            <div class="suggestion-action">
                <button class="btn btn-danger btn-sm drop-movie-btn" data-imdb-id="${movie.imdbID}">
                    Drop
                </button>
            </div>
        </div>
    `).join('');

    elements.optimizationResults.innerHTML = `
        <div class="optimization-warning">
            <div class="result-header">
                <span class="result-icon">⚠️</span>
                <div class="result-message">
                    <h4>Watchlist Exceeds Available Time</h4>
                    <p>
                        Your total watchlist runtime is <strong>${formatRuntime(totalRuntime)}</strong>.<br>
                        Your available time is <strong>${formatRuntime(availableMinutes)}</strong>.<br>
                        You need to free up <strong>${formatRuntime(excessTime)}</strong>.
                    </p>
                </div>
            </div>
            
            <h5 style="margin-bottom: 0.5rem; color: var(--color-text-secondary);">
                Suggested movies to drop (lowest efficiency first):
            </h5>
            
            <div class="suggestions-list">
                ${suggestionsHTML}
            </div>
            
            <div class="new-runtime">
                <p>After dropping suggested movies:</p>
                <p><strong>New runtime: ${formatRuntime(newRuntime)}</strong> 
                   (${newRuntime <= availableMinutes ? '✅ Fits!' : '❌ Still exceeds'})</p>
            </div>
        </div>
    `;

    // Add click listeners to drop buttons
    elements.optimizationResults.querySelectorAll('.drop-movie-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            removeFromWatchlist(btn.dataset.imdbId);
            // Re-run optimizer with updated watchlist
            runOptimizer();
        });
    });
}

// ============================================
// API Configuration Modal Functions
// ============================================

/**
 * Show API configuration modal
 */
function showApiConfigModal() {
    elements.apiConfigModal.classList.add('active');

    // Pre-fill existing keys if available
    const omdbKey = getApiKey(CONFIG.STORAGE_KEYS.OMDB_API_KEY);
    const geminiKey = getApiKey(CONFIG.STORAGE_KEYS.GEMINI_API_KEY);

    if (omdbKey) elements.omdbApiKeyInput.value = omdbKey;
    if (geminiKey) elements.geminiApiKeyInput.value = geminiKey;
}

/**
 * Hide API configuration modal
 */
function hideApiConfigModal() {
    elements.apiConfigModal.classList.remove('active');
}

/**
 * Save API keys from the configuration modal
 */
function saveApiKeysFromModal() {
    const omdbKey = elements.omdbApiKeyInput.value.trim();
    const geminiKey = elements.geminiApiKeyInput.value.trim();

    if (!omdbKey) {
        showToast('OMDB API key is required for movie search', 'error');
        return;
    }

    setApiKey(CONFIG.STORAGE_KEYS.OMDB_API_KEY, omdbKey);

    if (geminiKey) {
        setApiKey(CONFIG.STORAGE_KEYS.GEMINI_API_KEY, geminiKey);
    }

    hideApiConfigModal();
    showToast('API keys saved successfully!', 'success');
}

// ============================================
// Event Listeners Setup
// ============================================

/**
 * Initialize all event listeners
 */
function initEventListeners() {
    // Search tabs
    elements.searchTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            elements.searchTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update search type
            state.currentSearchType = tab.dataset.type;

            // Update placeholder
            elements.searchInput.placeholder = SEARCH_PLACEHOLDERS[state.currentSearchType];

            // Show/hide mood hint
            elements.moodHint.classList.toggle('hidden', state.currentSearchType !== 'mood');
        });
    });

    // Search button
    elements.searchBtn.addEventListener('click', handleSearch);

    // Search input enter key
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // Close modal button
    elements.closeModal.addEventListener('click', closeMovieModal);

    // Close modal on backdrop click
    elements.movieModal.addEventListener('click', (e) => {
        if (e.target === elements.movieModal) {
            closeMovieModal();
        }
    });

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.movieModal.classList.contains('active')) {
                closeMovieModal();
            }
            if (elements.apiConfigModal.classList.contains('active')) {
                hideApiConfigModal();
            }
        }
    });

    // Settings button
    elements.settingsBtn.addEventListener('click', showApiConfigModal);

    // Save API keys button
    elements.saveApiKeysBtn.addEventListener('click', saveApiKeysFromModal);

    // Close API modal on backdrop click
    elements.apiConfigModal.addEventListener('click', (e) => {
        if (e.target === elements.apiConfigModal) {
            // Only close if keys are configured
            if (areApiKeysConfigured()) {
                hideApiConfigModal();
            }
        }
    });

    // Optimize button
    elements.optimizeBtn.addEventListener('click', runOptimizer);

    // Available time input enter key
    elements.availableTimeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            runOptimizer();
        }
    });
}

// ============================================
// Application Initialization
// ============================================

/**
 * Initialize the application
 */
function init() {
    console.log('🎬 CineMatch - Smart Movie Recommendation Tool');
    console.log('Initializing application...');

    // Initialize event listeners
    initEventListeners();

    // Load watchlist from localStorage
    loadWatchlist();

    // Check if API keys are configured
    if (!areApiKeysConfigured()) {
        // Show API configuration modal on first visit
        showApiConfigModal();
    }

    console.log('Application initialized successfully!');
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', init);
