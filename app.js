/*
    CineMatch - Movie Recommendation App
    main javascript file
    
    this handles all the movie search stuff and watchlist
    uses OMDB API and Google Gemini for the mood search feature
*/

// api urls and storage keys
const OMDB_URL = 'https://www.omdbapi.com/';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// localstorage keys
const OMDB_KEY = 'cinematch_omdb_key';
const GEMINI_KEY = 'cinematch_gemini_key';
const WATCHLIST_KEY = 'cinematch_watchlist';

// placeholder text for search
const placeholders = {
    title: 'Search for movies by title...',
    actor: 'Search movies by actor name...',
    mood: 'Describe your mood (e.g., "I want something funny and light")...'
};

// app state - stores current data
var searchType = 'title'; // can be title, actor, or mood
var movies = []; // search results go here
var currentMovie = null; // selected movie for modal
var watchlist = []; // user's watchlist
var loading = false;

// grab all the elements we need
var apiModal = document.getElementById('apiConfigModal');
var omdbInput = document.getElementById('omdbApiKey');
var geminiInput = document.getElementById('geminiApiKey');
var saveKeysBtn = document.getElementById('saveApiKeys');
var settingsBtn = document.getElementById('settingsBtn');

var searchTabs = document.querySelectorAll('.search-tab');
var searchInput = document.getElementById('searchInput');
var searchBtn = document.getElementById('searchBtn');
var moodHint = document.getElementById('moodHint');

var resultsSection = document.getElementById('resultsSection');
var resultsGrid = document.getElementById('resultsGrid');
var resultsCount = document.getElementById('resultsCount');
var loader = document.getElementById('resultsLoader');
var noResults = document.getElementById('noResults');

var movieModal = document.getElementById('movieModal');
var closeModalBtn = document.getElementById('closeModal');
var movieDetails = document.getElementById('movieDetailsContent');
var similarSection = document.getElementById('similarMoviesSection');
var similarGrid = document.getElementById('similarMoviesGrid');

var watchlistDiv = document.getElementById('watchlistContainer');
var emptyWatchlist = document.getElementById('emptyWatchlist');
var watchlistUl = document.getElementById('watchlistItems');
var watchlistCountSpan = document.getElementById('watchlistCount');
var runtimeDiv = document.getElementById('runtimeDisplay');
var totalRuntimeSpan = document.getElementById('totalRuntime');

var timeInput = document.getElementById('availableTime');
var optimizeBtn = document.getElementById('optimizeBtn');
var optimizeResults = document.getElementById('optimizationResults');

var toastDiv = document.getElementById('toastContainer');

// helper functions

// get api key from storage
function getKey(name) {
    return localStorage.getItem(name);
}

// save api key
function saveKey(name, val) {
    localStorage.setItem(name, val);
}

// check if api keys exist
function hasApiKeys() {
    var key = getKey(OMDB_KEY);
    return key && key.trim() !== '';
}

// show a toast message
function toast(msg, type) {
    type = type || 'info';

    var icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    var t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.innerHTML = '<span class="toast-icon">' + icons[type] + '</span><span class="toast-message">' + msg + '</span>';

    toastDiv.appendChild(t);

    // remove after 4 sec
    setTimeout(function () {
        t.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(function () { t.remove(); }, 300);
    }, 4000);
}

// format minutes to hours and mins
function formatTime(mins) {
    if (mins < 60) {
        return mins + ' min';
    }
    var hrs = Math.floor(mins / 60);
    var m = mins % 60;
    if (m > 0) {
        return hrs + 'h ' + m + 'm';
    }
    return hrs + 'h';
}

// parse runtime string like "142 min" to number
function parseTime(str) {
    if (!str || str === 'N/A') return 0;
    var match = str.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

// debounce function - prevents too many api calls
function debounce(fn, delay) {
    var timer;
    return function () {
        var args = arguments;
        var self = this;
        clearTimeout(timer);
        timer = setTimeout(function () {
            fn.apply(self, args);
        }, delay);
    };
}

// API FUNCTIONS

// search for movies
async function searchMovies(query, type) {
    var apiKey = getKey(OMDB_KEY);

    if (!apiKey) {
        toast('Please configure your OMDB API key first', 'error');
        showApiModal();
        return [];
    }

    try {
        var url = OMDB_URL + '?apikey=' + apiKey + '&s=' + encodeURIComponent(query) + '&type=movie';

        var resp = await fetch(url);
        var data = await resp.json();

        if (data.Response === 'True') {
            // if actor search, filter by actor name
            if (type === 'actor') {
                var detailed = await Promise.all(
                    data.Search.slice(0, 10).map(function (m) {
                        return getMovieDetails(m.imdbID);
                    })
                );

                var filtered = detailed.filter(function (m) {
                    return m && m.Actors && m.Actors.toLowerCase().includes(query.toLowerCase());
                });

                return filtered.length > 0 ? filtered : data.Search;
            }
            return data.Search;
        } else {
            console.log('OMDB error:', data.Error);
            return [];
        }
    } catch (err) {
        console.error('search error:', err);
        toast('Failed to search movies', 'error');
        return [];
    }
}

// get movie details by id
async function getMovieDetails(id) {
    var apiKey = getKey(OMDB_KEY);

    if (!apiKey) {
        toast('Please configure your OMDB API key', 'error');
        return null;
    }

    try {
        var url = OMDB_URL + '?apikey=' + apiKey + '&i=' + id + '&plot=full';
        var resp = await fetch(url);
        var data = await resp.json();

        if (data.Response === 'True') {
            return data;
        }
        return null;
    } catch (err) {
        console.error('details error:', err);
        return null;
    }
}

// find similar movies based on genre
async function getSimilarMovies(genre, year, excludeId) {
    var apiKey = getKey(OMDB_KEY);
    if (!apiKey || !genre) return [];

    try {
        // get first genre
        var mainGenre = genre.split(',')[0].trim();

        // map genres to search keywords
        var keywords = {
            'Action': ['action', 'adventure', 'thriller'],
            'Comedy': ['comedy', 'funny', 'humor'],
            'Drama': ['drama', 'emotional', 'story'],
            'Horror': ['horror', 'scary', 'thriller'],
            'Sci-Fi': ['space', 'future', 'robot'],
            'Romance': ['love', 'romance', 'romantic'],
            'Thriller': ['thriller', 'suspense', 'mystery'],
            'Animation': ['animation', 'animated', 'cartoon']
        };

        var searchTerms = keywords[mainGenre] || [mainGenre.toLowerCase()];

        // search for each keyword
        var promises = searchTerms.map(function (kw) {
            return fetch(OMDB_URL + '?apikey=' + apiKey + '&s=' + kw + '&type=movie')
                .then(function (r) { return r.json(); });
        });

        var results = await Promise.all(promises);

        // combine results and remove duplicates
        var allMovies = [];
        var seen = {};
        seen[excludeId] = true;

        for (var i = 0; i < results.length; i++) {
            var r = results[i];
            if (r.Response === 'True' && r.Search) {
                for (var j = 0; j < r.Search.length; j++) {
                    var m = r.Search[j];
                    if (!seen[m.imdbID]) {
                        seen[m.imdbID] = true;
                        allMovies.push(m);
                    }
                }
            }
        }

        return allMovies.slice(0, 6);
    } catch (err) {
        console.error('similar movies error:', err);
        return [];
    }
}

// use gemini to get keywords from mood text
async function getMoodKeywords(text) {
    var apiKey = getKey(GEMINI_KEY);

    if (!apiKey) {
        toast('Gemini API not configured, using basic search', 'warning');
        return basicKeywords(text);
    }

    try {
        var prompt = 'You are a movie recommendation assistant. Based on the following mood description, suggest 2-3 specific movie search terms that would help find relevant movies. Return ONLY the search terms separated by commas, nothing else.\n\nMood: "' + text + '"\n\nYour response:';

        var resp = await fetch(GEMINI_URL + '?key=' + apiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 50 }
            })
        });

        var data = await resp.json();

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text.trim();
        }
        return basicKeywords(text);
    } catch (err) {
        console.error('gemini error:', err);
        toast('AI error, using basic keywords', 'warning');
        return basicKeywords(text);
    }
}

// backup keyword extraction if gemini fails
function basicKeywords(text) {
    var mapping = {
        'funny': 'comedy', 'laugh': 'comedy', 'humor': 'comedy', 'light': 'comedy', 'happy': 'comedy',
        'scary': 'horror', 'horror': 'horror', 'frightening': 'horror',
        'thriller': 'thriller', 'suspense': 'thriller',
        'exciting': 'action', 'action': 'action', 'adventure': 'adventure', 'thrilling': 'action',
        'romantic': 'romance', 'love': 'romance', 'romance': 'romance',
        'emotional': 'drama', 'drama': 'drama', 'sad': 'drama', 'cry': 'drama',
        'sci-fi': 'sci-fi', 'space': 'sci-fi', 'future': 'sci-fi',
        'animated': 'animation', 'cartoon': 'animation', 'family': 'family', 'kids': 'family',
        'documentary': 'documentary', 'mystery': 'mystery', 'crime': 'crime',
        'war': 'war', 'historical': 'history', 'fantasy': 'fantasy', 'magic': 'fantasy'
    };

    var words = text.toLowerCase().split(/\s+/);
    var genres = [];

    for (var i = 0; i < words.length; i++) {
        var w = words[i];
        for (var key in mapping) {
            if (w.includes(key) && genres.indexOf(mapping[key]) === -1) {
                genres.push(mapping[key]);
            }
        }
    }

    return genres.length > 0 ? genres.join(', ') : 'popular';
}

// SEARCH HANDLING

async function doSearch() {
    var query = searchInput.value.trim();

    if (!query) {
        toast('Please enter something to search', 'warning');
        return;
    }

    showLoader();
    var results = [];

    try {
        if (searchType === 'title') {
            results = await searchMovies(query, 'title');
        }
        else if (searchType === 'actor') {
            results = await searchMovies(query, 'actor');
        }
        else if (searchType === 'mood') {
            toast('Analyzing your mood...', 'info');
            var kws = await getMoodKeywords(query);
            console.log('mood keywords:', kws);

            var kwList = kws.split(',').map(function (k) { return k.trim(); }).filter(function (k) { return k; });
            var allResults = [];
            var seenIds = {};

            for (var i = 0; i < kwList.length; i++) {
                var kwResults = await searchMovies(kwList[i], 'title');
                for (var j = 0; j < kwResults.length; j++) {
                    var m = kwResults[j];
                    if (!seenIds[m.imdbID]) {
                        seenIds[m.imdbID] = true;
                        allResults.push(m);
                    }
                }
            }

            results = allResults.slice(0, 20);
        }

        movies = results;
        showResults(results);
    } catch (err) {
        console.error('search failed:', err);
        toast('Something went wrong', 'error');
        hideLoader();
    }
}

// display search results
function showResults(movieList) {
    hideLoader();

    if (!movieList || movieList.length === 0) {
        resultsGrid.innerHTML = '';
        noResults.classList.remove('hidden');
        resultsSection.classList.remove('hidden');
        resultsCount.textContent = 'No results found';
        return;
    }

    noResults.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    resultsCount.textContent = 'Found ' + movieList.length + ' movie' + (movieList.length !== 1 ? 's' : '');

    // build movie cards
    var html = '';
    for (var i = 0; i < movieList.length; i++) {
        html += makeMovieCard(movieList[i]);
    }
    resultsGrid.innerHTML = html;

    // add click handlers
    var cards = document.querySelectorAll('.movie-card');
    for (var i = 0; i < cards.length; i++) {
        cards[i].addEventListener('click', function (e) {
            if (e.target.closest('.add-watchlist-btn')) return;
            openMovie(this.dataset.imdbId);
        });
    }

    // watchlist button handlers
    var btns = document.querySelectorAll('.add-watchlist-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function (e) {
            e.stopPropagation();
            addToWatchlist(this.dataset.imdbId, this);
        });
    }
}

// create html for movie card
function makeMovieCard(movie) {
    var inList = watchlist.some(function (m) { return m.imdbID === movie.imdbID; });

    var poster = movie.Poster && movie.Poster !== 'N/A'
        ? '<img src="' + movie.Poster + '" alt="' + movie.Title + '">'
        : '<div class="no-poster">🎬</div>';

    var rating = movie.imdbRating || movie.Rating || '';
    var ratingHtml = rating && rating !== 'N/A'
        ? '<span class="movie-card-rating">⭐ ' + rating + '</span>'
        : '';

    return '<div class="movie-card" data-imdb-id="' + movie.imdbID + '">' +
        '<div class="movie-card-poster">' + poster +
        '<div class="movie-card-overlay"></div>' +
        '<div class="movie-card-actions">' +
        '<button class="add-watchlist-btn ' + (inList ? 'added' : '') + '" data-imdb-id="' + movie.imdbID + '">' +
        (inList ? '✓ In Watchlist' : '+ Watchlist') +
        '</button></div></div>' +
        '<div class="movie-card-info">' +
        '<h4 class="movie-card-title">' + movie.Title + '</h4>' +
        '<div class="movie-card-meta">' +
        '<span class="movie-card-year">' + movie.Year + '</span>' +
        ratingHtml +
        '</div></div></div>';
}

function showLoader() {
    loading = true;
    resultsSection.classList.remove('hidden');
    resultsGrid.innerHTML = '';
    noResults.classList.add('hidden');
    loader.classList.remove('hidden');
}

function hideLoader() {
    loading = false;
    loader.classList.add('hidden');
}

// MOVIE DETAILS MODAL

async function openMovie(id) {
    movieModal.classList.add('active');
    movieDetails.innerHTML = '<div class="loader-container"><div class="loader"><div class="loader-spinner"></div><p>Loading...</p></div></div>';
    similarSection.classList.add('hidden');

    var movie = await getMovieDetails(id);

    if (!movie) {
        movieDetails.innerHTML = '<div class="no-results"><span class="no-results-icon">😕</span><h4>Failed to load</h4><p>Try again later</p></div>';
        return;
    }

    currentMovie = movie;
    displayMovie(movie);

    // get similar movies
    var similar = await getSimilarMovies(movie.Genre, movie.Year, movie.imdbID);
    showSimilar(similar);
}

function displayMovie(movie) {
    var poster = movie.Poster && movie.Poster !== 'N/A'
        ? '<img src="' + movie.Poster + '" alt="' + movie.Title + '">'
        : '<div class="no-poster">🎬</div>';

    var genres = '';
    if (movie.Genre) {
        var g = movie.Genre.split(',');
        for (var i = 0; i < g.length; i++) {
            genres += '<span class="genre-tag">' + g[i].trim() + '</span>';
        }
    }

    var inList = watchlist.some(function (m) { return m.imdbID === movie.imdbID; });

    var html = '<div class="movie-poster-large">' + poster + '</div>' +
        '<div class="movie-info">' +
        '<h2 class="movie-title-large">' + movie.Title + '</h2>' +
        '<div class="movie-meta-bar">';

    if (movie.imdbRating && movie.imdbRating !== 'N/A') {
        html += '<span class="movie-rating-large">⭐ ' + movie.imdbRating + '/10</span>';
    }
    html += '<span>' + movie.Year + '</span>';
    if (movie.Runtime && movie.Runtime !== 'N/A') {
        html += '<span>⏱️ ' + movie.Runtime + '</span>';
    }
    if (movie.Rated && movie.Rated !== 'N/A') {
        html += '<span>' + movie.Rated + '</span>';
    }
    html += '</div>';

    if (genres) {
        html += '<div class="movie-genres">' + genres + '</div>';
    }

    html += '<p class="movie-plot">' + (movie.Plot || 'No plot available.') + '</p>';

    if (movie.Director && movie.Director !== 'N/A') {
        html += '<div class="movie-details-section"><h4>Director</h4><p>' + movie.Director + '</p></div>';
    }
    if (movie.Actors && movie.Actors !== 'N/A') {
        html += '<div class="movie-details-section"><h4>Cast</h4><p>' + movie.Actors + '</p></div>';
    }
    if (movie.Awards && movie.Awards !== 'N/A') {
        html += '<div class="movie-details-section"><h4>Awards</h4><p>' + movie.Awards + '</p></div>';
    }

    html += '<div class="movie-actions">' +
        '<button class="btn btn-primary modal-watchlist-btn" data-imdb-id="' + movie.imdbID + '">' +
        (inList ? '✓ In Watchlist' : '+ Add to Watchlist') + '</button>';

    if (movie.Title) {
        html += '<a href="https://www.justwatch.com/in/search?q=' + encodeURIComponent(movie.Title) + '" target="_blank" class="btn btn-primary watch-btn">🎬 Watch Now</a>';
    }
    if (movie.imdbID) {
        html += '<a href="https://www.imdb.com/title/' + movie.imdbID + '/" target="_blank" class="btn btn-secondary">View on IMDB</a>';
    }

    html += '</div></div>';

    movieDetails.innerHTML = html;

    // add watchlist button handler
    var btn = movieDetails.querySelector('.modal-watchlist-btn');
    if (btn) {
        btn.addEventListener('click', function () {
            addToWatchlist(movie.imdbID, btn);
        });
    }
}

function showSimilar(movieList) {
    if (!movieList || movieList.length === 0) {
        similarSection.classList.add('hidden');
        return;
    }

    similarSection.classList.remove('hidden');

    var html = '';
    for (var i = 0; i < movieList.length; i++) {
        var m = movieList[i];
        var poster = m.Poster && m.Poster !== 'N/A'
            ? '<img src="' + m.Poster + '" alt="' + m.Title + '">'
            : '<div class="no-poster">🎬</div>';

        html += '<div class="similar-movie-card" data-imdb-id="' + m.imdbID + '">' +
            '<div class="similar-movie-poster">' + poster + '</div>' +
            '<p class="similar-movie-title">' + m.Title + '</p></div>';
    }

    similarGrid.innerHTML = html;

    // click handlers
    var cards = similarGrid.querySelectorAll('.similar-movie-card');
    for (var i = 0; i < cards.length; i++) {
        cards[i].addEventListener('click', function () {
            openMovie(this.dataset.imdbId);
        });
    }
}

function closeMovie() {
    movieModal.classList.remove('active');
    currentMovie = null;
}

// WATCHLIST STUFF

function loadWatchlist() {
    var saved = localStorage.getItem(WATCHLIST_KEY);
    if (saved) {
        try {
            watchlist = JSON.parse(saved);
        } catch (e) {
            console.error('watchlist load error:', e);
            watchlist = [];
        }
    }
    updateWatchlistUI();
}

function saveWatchlist() {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
}

async function addToWatchlist(id, btn) {
    // check if already in list
    var idx = -1;
    for (var i = 0; i < watchlist.length; i++) {
        if (watchlist[i].imdbID === id) {
            idx = i;
            break;
        }
    }

    if (idx !== -1) {
        // remove from list
        watchlist.splice(idx, 1);
        saveWatchlist();
        updateWatchlistUI();
        updateButtons(id, false);
        toast('Removed from watchlist', 'success');
        return;
    }

    // find movie in results or fetch it
    var movie = null;
    for (var i = 0; i < movies.length; i++) {
        if (movies[i].imdbID === id) {
            movie = movies[i];
            break;
        }
    }

    if (!movie || !movie.Runtime) {
        movie = await getMovieDetails(id);
        if (!movie) {
            toast('Failed to add movie', 'error');
            return;
        }
    }

    // add to list
    watchlist.push({
        imdbID: movie.imdbID,
        Title: movie.Title,
        Year: movie.Year,
        Poster: movie.Poster,
        Runtime: movie.Runtime || 'N/A',
        imdbRating: movie.imdbRating || 'N/A'
    });

    saveWatchlist();
    updateWatchlistUI();
    updateButtons(id, true);
    toast('"' + movie.Title + '" added to watchlist', 'success');
}

// update all buttons for a movie
function updateButtons(id, inList) {
    var btns = document.querySelectorAll('.add-watchlist-btn[data-imdb-id="' + id + '"]');
    for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (inList) {
            b.classList.add('added');
            b.textContent = '✓ In Watchlist';
        } else {
            b.classList.remove('added');
            b.textContent = '+ Watchlist';
        }
    }

    // modal button
    var modalBtn = movieDetails.querySelector('.modal-watchlist-btn[data-imdb-id="' + id + '"]');
    if (modalBtn) {
        modalBtn.textContent = inList ? '✓ In Watchlist' : '+ Add to Watchlist';
    }
}

function removeFromList(id) {
    for (var i = 0; i < watchlist.length; i++) {
        if (watchlist[i].imdbID === id) {
            var movie = watchlist[i];
            watchlist.splice(i, 1);
            saveWatchlist();
            updateWatchlistUI();
            updateButtons(id, false);
            toast('"' + movie.Title + '" removed', 'success');
            break;
        }
    }
}

function updateWatchlistUI() {
    var count = watchlist.length;
    watchlistCountSpan.textContent = count + ' movie' + (count !== 1 ? 's' : '');

    if (count === 0) {
        emptyWatchlist.classList.remove('hidden');
        watchlistUl.classList.add('hidden');
        runtimeDiv.classList.add('hidden');
        return;
    }

    emptyWatchlist.classList.add('hidden');
    watchlistUl.classList.remove('hidden');
    runtimeDiv.classList.remove('hidden');

    // calc total runtime
    var totalMins = getTotalRuntime();
    totalRuntimeSpan.textContent = formatTime(totalMins);

    // build list html
    var html = '';
    for (var i = 0; i < watchlist.length; i++) {
        var m = watchlist[i];
        var poster = m.Poster && m.Poster !== 'N/A'
            ? '<img src="' + m.Poster + '" alt="' + m.Title + '">'
            : '<div class="no-poster">🎬</div>';

        var runtime = parseTime(m.Runtime);
        var rating = m.imdbRating && m.imdbRating !== 'N/A' ? m.imdbRating : '-';

        html += '<li class="watchlist-item" data-imdb-id="' + m.imdbID + '">' +
            '<div class="watchlist-item-poster">' + poster + '</div>' +
            '<div class="watchlist-item-info">' +
            '<h5 class="watchlist-item-title">' + m.Title + '</h5>' +
            '<div class="watchlist-item-meta">' +
            '<span class="watchlist-item-runtime">⏱️ ' + (runtime > 0 ? runtime + ' min' : 'N/A') + '</span>' +
            '<span class="watchlist-item-rating">⭐ ' + rating + '</span>' +
            '</div></div>' +
            '<button class="watchlist-item-remove" data-imdb-id="' + m.imdbID + '" title="Remove">×</button>' +
            '</li>';
    }

    watchlistUl.innerHTML = html;

    // remove button handlers
    var removeBtns = watchlistUl.querySelectorAll('.watchlist-item-remove');
    for (var i = 0; i < removeBtns.length; i++) {
        removeBtns[i].addEventListener('click', function () {
            removeFromList(this.dataset.imdbId);
        });
    }
}

function getTotalRuntime() {
    var total = 0;
    for (var i = 0; i < watchlist.length; i++) {
        total += parseTime(watchlist[i].Runtime);
    }
    return total;
}

// OPTIMIZER

function optimize() {
    var hrs = parseFloat(timeInput.value);

    if (isNaN(hrs) || hrs <= 0) {
        toast('Enter a valid time in hours', 'warning');
        return;
    }

    if (watchlist.length === 0) {
        toast('Your watchlist is empty!', 'warning');
        return;
    }

    var availMins = hrs * 60;
    var totalMins = getTotalRuntime();

    optimizeResults.classList.remove('hidden');

    if (totalMins <= availMins) {
        // everything fits!
        optimizeResults.innerHTML = '<div class="optimization-success">' +
            '<span class="result-icon">🎉</span>' +
            '<h4>Perfect! You can watch everything!</h4>' +
            '<p>Your watchlist (' + formatTime(totalMins) + ') fits in your available time (' + formatTime(availMins) + ').</p>' +
            '<p style="margin-top: 1rem; color: var(--text-muted);">You have ' + formatTime(availMins - totalMins) + ' to spare!</p>' +
            '</div>';
    } else {
        // need to drop some movies
        var suggestions = findMoviesToDrop(availMins, totalMins);
        showOptimizeSuggestions(suggestions, totalMins, availMins);
    }
}

// calc efficiency = rating / runtime
function calcEfficiency(movie) {
    var runtime = parseTime(movie.Runtime);
    var rating = parseFloat(movie.imdbRating) || 5; // default to 5

    if (runtime <= 0) return 0;
    return rating / runtime;
}

function findMoviesToDrop(availMins, totalMins) {
    // add efficiency to each movie
    var moviesWithEff = [];
    for (var i = 0; i < watchlist.length; i++) {
        var m = watchlist[i];
        moviesWithEff.push({
            imdbID: m.imdbID,
            Title: m.Title,
            Runtime: m.Runtime,
            imdbRating: m.imdbRating,
            runtime: parseTime(m.Runtime),
            efficiency: calcEfficiency(m)
        });
    }

    // sort by efficiency (lowest first)
    moviesWithEff.sort(function (a, b) {
        return a.efficiency - b.efficiency;
    });

    // find which to drop
    var toDrop = [];
    var current = totalMins;

    for (var i = 0; i < moviesWithEff.length; i++) {
        if (current <= availMins) break;
        toDrop.push(moviesWithEff[i]);
        current -= moviesWithEff[i].runtime;
    }

    return { moviesToDrop: toDrop, newRuntime: current };
}

function showOptimizeSuggestions(suggestions, totalMins, availMins) {
    var toDrop = suggestions.moviesToDrop;
    var newRuntime = suggestions.newRuntime;
    var excess = totalMins - availMins;

    var suggestHtml = '';
    for (var i = 0; i < toDrop.length; i++) {
        var m = toDrop[i];
        suggestHtml += '<div class="suggestion-item">' +
            '<div class="suggestion-info">' +
            '<span class="suggestion-title">' + m.Title + '</span>' +
            '<span class="suggestion-meta">⏱️ ' + m.runtime + ' min | ⭐ ' + (m.imdbRating || 'N/A') + ' | Efficiency: ' + m.efficiency.toFixed(4) + '</span>' +
            '</div>' +
            '<div class="suggestion-action">' +
            '<button class="btn btn-danger btn-sm drop-btn" data-imdb-id="' + m.imdbID + '">Drop</button>' +
            '</div></div>';
    }

    optimizeResults.innerHTML = '<div class="optimization-warning">' +
        '<div class="result-header">' +
        '<span class="result-icon">⚠️</span>' +
        '<div class="result-message">' +
        '<h4>Watchlist Exceeds Available Time</h4>' +
        '<p>Total: <strong>' + formatTime(totalMins) + '</strong><br>' +
        'Available: <strong>' + formatTime(availMins) + '</strong><br>' +
        'Need to free up: <strong>' + formatTime(excess) + '</strong></p>' +
        '</div></div>' +
        '<h5 style="margin-bottom: 0.5rem; color: var(--text-gray);">Suggested movies to drop (lowest efficiency first):</h5>' +
        '<div class="suggestions-list">' + suggestHtml + '</div>' +
        '<div class="new-runtime">' +
        '<p>After dropping these:</p>' +
        '<p><strong>New runtime: ' + formatTime(newRuntime) + '</strong> (' + (newRuntime <= availMins ? '✅ Fits!' : '❌ Still exceeds') + ')</p>' +
        '</div></div>';

    // drop button handlers
    var dropBtns = optimizeResults.querySelectorAll('.drop-btn');
    for (var i = 0; i < dropBtns.length; i++) {
        dropBtns[i].addEventListener('click', function () {
            removeFromList(this.dataset.imdbId);
            optimize(); // re-run
        });
    }
}

// API CONFIG MODAL

function showApiModal() {
    apiModal.classList.add('active');

    // fill in existing keys
    var omdb = getKey(OMDB_KEY);
    var gemini = getKey(GEMINI_KEY);

    if (omdb) omdbInput.value = omdb;
    if (gemini) geminiInput.value = gemini;
}

function hideApiModal() {
    apiModal.classList.remove('active');
}

function saveKeys() {
    var omdb = omdbInput.value.trim();
    var gemini = geminiInput.value.trim();

    if (!omdb) {
        toast('OMDB API key is required', 'error');
        return;
    }

    saveKey(OMDB_KEY, omdb);
    if (gemini) {
        saveKey(GEMINI_KEY, gemini);
    }

    hideApiModal();
    toast('API keys saved!', 'success');
}

// SET UP EVENT LISTENERS

function setupEvents() {
    // search tabs
    for (var i = 0; i < searchTabs.length; i++) {
        searchTabs[i].addEventListener('click', function () {
            for (var j = 0; j < searchTabs.length; j++) {
                searchTabs[j].classList.remove('active');
            }
            this.classList.add('active');
            searchType = this.dataset.type;
            searchInput.placeholder = placeholders[searchType];

            if (searchType === 'mood') {
                moodHint.classList.remove('hidden');
            } else {
                moodHint.classList.add('hidden');
            }
        });
    }

    // search button and enter key
    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') doSearch();
    });

    // modal close
    closeModalBtn.addEventListener('click', closeMovie);
    movieModal.addEventListener('click', function (e) {
        if (e.target === movieModal) closeMovie();
    });

    // escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (movieModal.classList.contains('active')) closeMovie();
            if (apiModal.classList.contains('active')) hideApiModal();
        }
    });

    // settings
    settingsBtn.addEventListener('click', showApiModal);
    saveKeysBtn.addEventListener('click', saveKeys);

    apiModal.addEventListener('click', function (e) {
        if (e.target === apiModal && hasApiKeys()) {
            hideApiModal();
        }
    });

    // optimizer
    optimizeBtn.addEventListener('click', optimize);
    timeInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') optimize();
    });
}

// START THE APP

function init() {
    console.log('CineMatch starting up...');

    setupEvents();
    loadWatchlist();

    // show api modal if no keys
    if (!hasApiKeys()) {
        showApiModal();
    }

    console.log('App ready!');
}

// run when page loads
document.addEventListener('DOMContentLoaded', init);


