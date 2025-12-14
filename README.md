# CineMatch - Movie Recommendation Website

A movie search website I made for the DevCom's developer assignment. It lets you search for movies and create a watchlist.

## What it does

- **Search movies** - you can search by movie title, actor name, or even describe your mood
- **Movie details** - shows all the info like rating, plot, cast etc
- **Watchlist** - add movies to watch later
- **Weekend optimizer** - helps you figure out what to watch based on how much time you have

## Technologies used

- HTML
- CSS
- JavaScript (vanilla, no frameworks)
- OMDB API for movie data
- Google Gemini API for the mood search feature

## How to run

1. Download all the files
2. Open `index.html` in your browser
3. Enter your API keys when prompted

### Getting API keys

**OMDB API (required):**
- Go to https://www.omdbapi.com/apikey.aspx
- Sign up for free key
- Free tier gives 1000 requests/day

**Gemini API (optional, for mood search):**
- Go to https://aistudio.google.com/app/apikey
- Create API key
- Its free to use

## Files

index.html   - main html page <br>
styles.css   - all the css styling <br>
app.js       - javascript code <br>
README.md    - this file <br>

## Features explained

### Search types

**By Title** - just type a movie name and hit search

**By Actor** - type an actor's name to find their movies

**By Mood** - describe how you're feeling (like "I want something funny") and the AI will find matching movies

### Weekend Optimizer

1. Add movies to your watchlist
2. Enter how many hours you have free
3. Click optimize
4. If your watchlist is too long, it tells you which movies to drop

The optimizer uses efficiency = rating / runtime to decide which movies are least worth watching.

## How it works

- Uses OMDB API to get movie info
- Uses Gemini AI to understand mood descriptions
- Saves your watchlist in browser localStorage
- API keys are also saved in localStorage

## Known issues

- Actor search isn't perfect because OMDB doesn't have proper actor search
- Mood search needs Gemini API key to work well
- Some movies don't have runtime info

## Limitations
- Device-specific: If user opens on phone after using desktop, watchlist won't be there
- Browser-specific: Chrome and Firefox have separate localStorage
- No backup: If browser data is cleared, watchlist is gone

---




