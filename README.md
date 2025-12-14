# 🎬 CineMatch - Smart Movie Recommendation Tool

A modern, intuitive movie search and recommendation website with mood-based search capabilities and a weekend movie optimizer feature.

![CineMatch Preview](https://img.shields.io/badge/Status-Ready%20to%20Use-brightgreen)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

## ✨ Features

### 🔍 Movie Search
- **Search by Title**: Find movies by their name
- **Search by Actor**: Discover movies featuring your favorite actors
- **Search by Mood**: Describe how you feel, and our AI will find matching movies using Google Gemini

### 🎥 Movie Details
- View comprehensive movie information including:
  - High-quality movie posters
  - IMDb ratings
  - Genre tags
  - Plot summary
  - Director and cast information
  - Awards and accolades
- Explore similar movie recommendations
- Direct links to IMDb pages

### 📅 Weekend Movie Optimizer
- Add movies to your personal watchlist
- View total runtime of your watchlist
- Input your available weekend viewing time
- Get intelligent suggestions on which movies to drop if time is limited
- **Optimization Strategy**: Uses the "Least Efficient" algorithm (efficiency = rating ÷ runtime) to suggest movies that provide the least value per minute of viewing time

## 🛠️ Technologies Used

| Technology | Purpose |
|------------|---------|
| **HTML5** | Semantic page structure |
| **CSS3** | Modern styling with custom properties, flexbox, and grid |
| **Vanilla JavaScript** | Application logic and API interactions |
| **Google Fonts** | Typography (Inter, Outfit) |
| **OMDB API** | Movie database for search and details |
| **Google Gemini API** | AI-powered mood analysis for search keywords |

### Design Features
- 🌙 Dark theme with purple/cyan accent gradients
- ✨ Glassmorphism effects on cards and modals
- 🎭 Smooth animations and micro-interactions
- 📱 Fully responsive design for all screen sizes
- 🎨 Modern UI with attention to detail

## 🚀 Getting Started

### Prerequisites
1. **OMDB API Key** (Required)
   - Visit [omdbapi.com](https://www.omdbapi.com/apikey.aspx)
   - Sign up for a free API key
   - The free tier allows 1,000 requests per day

2. **Google Gemini API Key** (Optional, for mood-based search)
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create a free API key
   - The free tier provides generous usage limits

### Installation

1. **Download/Clone the project**
   ```
   git clone <repository-url>
   ```
   Or simply download the files to your computer.

2. **Open the application**
   - Simply open `index.html` in your web browser
   - No server or build process required!

3. **Configure API Keys**
   - On first launch, you'll see a configuration modal
   - Enter your OMDB API key (required)
   - Enter your Gemini API key (optional, but enables mood search)
   - Click "Save & Continue"

### File Structure
```
smart movie recommendor/
├── index.html      # Main HTML structure
├── styles.css      # All CSS styling
├── app.js          # JavaScript application logic
└── README.md       # This documentation file
```

## 📖 How to Use

### Searching for Movies

1. **By Title**: 
   - Select the "By Title" tab
   - Type a movie name (e.g., "Inception")
   - Click Search or press Enter

2. **By Actor**:
   - Select the "By Actor" tab
   - Type an actor's name (e.g., "Leonardo DiCaprio")
   - The app will show movies featuring that actor

3. **By Mood**:
   - Select the "By Mood" tab
   - Describe how you're feeling (e.g., "I want something funny and light")
   - The AI will extract keywords and find matching movies

### Viewing Movie Details

- Click on any movie card to see full details
- View the poster, rating, plot, cast, and more
- Browse similar movie suggestions at the bottom
- Click "View on IMDB" for the official page

### Using the Weekend Optimizer

1. **Build Your Watchlist**:
   - Search for movies you want to watch
   - Click the "+ Watchlist" button on movie cards
   - Your watchlist appears in the optimizer section

2. **Set Available Time**:
   - Enter how many hours you have available for the weekend
   - Click "Optimize My Watchlist"

3. **Review Suggestions**:
   - If your watchlist fits, you'll see a success message
   - If not, the app suggests which movies to drop
   - Movies are ranked by efficiency (rating per minute)
   - Lower efficiency movies are suggested first

4. **Manage Your List**:
   - Click the × button to remove movies from watchlist
   - Click "Drop" next to suggestions to quickly remove them
   - The optimizer updates in real-time

## 🔧 Configuration

### Changing API Keys
- Click the ⚙️ Settings button in the header
- Update your API keys
- Click "Save & Continue"

### LocalStorage
The app uses browser localStorage to persist:
- API keys (for convenience)
- Your watchlist (survives browser refresh)

To clear all data, open browser developer tools and run:
```javascript
localStorage.clear();
```

## 🎯 Optimization Algorithm Explained

The Weekend Movie Optimizer uses the **Least Efficient First** strategy:

```
Efficiency = IMDb Rating / Runtime (in minutes)
```

**Example:**
| Movie | Rating | Runtime | Efficiency |
|-------|--------|---------|------------|
| Movie A | 8.5 | 120 min | 0.071 |
| Movie B | 7.0 | 180 min | 0.039 |
| Movie C | 9.0 | 90 min | 0.100 |

When time is limited, **Movie B** would be suggested to drop first because it has the lowest efficiency (provides the least entertainment value per minute).

## 🤝 Credits & Acknowledgments

- **Movie Data**: [OMDB API](https://www.omdbapi.com/) - The Open Movie Database
- **AI Processing**: [Google Gemini](https://ai.google.dev/) - For mood-based keyword extraction
- **Fonts**: [Google Fonts](https://fonts.google.com/) - Inter and Outfit typefaces
- **Icons**: Native emoji icons for universal compatibility

## 📝 License

This project is created for educational purposes. Feel free to use and modify as needed.

---

**Made with ❤️ for movie lovers**
