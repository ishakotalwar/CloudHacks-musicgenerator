import React, { useState, useEffect, useRef } from 'react';

const SPOTIFY_CLIENT_ID = '<your-client-id>'; // Replace with your actual Spotify client ID
const REDIRECT_URI = 'http://localhost:3000'; // Update this for your deployment
const SCOPES = ['playlist-modify-public', 'playlist-modify-private'];

function App() {
  const [error, setError] = useState('');
  const [mood, setMood] = useState('');
  const [image, setImage] = useState(null);
  const [songs, setSongs] = useState([]);
  const [claudeMood, setClaudeMood] = useState('');
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState('light');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [loadingIndexes, setLoadingIndexes] = useState([]);
  const resultsRef = useRef(null);
  const [likeLoading, setLikeLoading] = useState('');

  const isDark = theme === 'dark';

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      localStorage.setItem('spotify_access_token', token);
      window.location.hash = '';
    }
  }, []);

  const moodColors = {
    happy: '#fff9c4',
    sad: '#bbdefb',
    calm: '#c8e6c9',
    angry: '#ffcdd2',
    energetic: '#f8bbd0',
    relaxed: '#d1c4e9',
  };

  const fallbackColors = ['#f48fb1', '#b39ddb', '#80cbc4', '#ffecb3', '#c5e1a5', '#ffe082'];

  const handleImageUpload = (e) => {
    setImage(e.target.files[0]);
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isValidMood = /^[A-Za-z ]+$/.test(mood.trim());
    if (!image && (!mood.trim() || !isValidMood)) {
      setError("Please input a valid mood (letters and spaces only)");
      setSongs([]);
      if (!isDark) setBgColor('#ffffff');
      return;
    }

    setError('');
    setClaudeMood('');
    setSongs([]);
    setLoading(true);

    const lowerMood = mood.toLowerCase();
    const color = moodColors[lowerMood] || fallbackColors[Math.floor(Math.random() * fallbackColors.length)];
    if (!isDark) setBgColor(color);

    const formData = {
      ...(image ? { image: await toBase64(image) } : { mood }),
    };

    const res = await fetch('https://p14awkwqt1.execute-api.us-west-2.amazonaws.com/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await res.json();
    setSongs(data.songs || []);
    if (data.claudeMood) setClaudeMood(data.claudeMood);
    setLoading(false);

    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleCreatePlaylist = async () => {
    const token = localStorage.getItem('spotify_access_token');
    if (!token) {
      const authUrl = `https://accounts.spotify.com/authorize?response_type=token&client_id=${SPOTIFY_CLIENT_ID}&scope=${SCOPES.join('%20')}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
      window.location.href = authUrl;
      return;
    }

    const uris = songs.map(song => song.uri);

    const res = await fetch('https://your-api/create-playlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: mood || 'My Mood Playlist',
        uris: uris
      })
    });

    const data = await res.json();
    if (data.url) {
      window.open(data.url, '_blank');
    } else {
      alert('Failed to create playlist');
    }
  };

  const handleLike = async (song) => {
  setLikeLoading(song.name); // Start loading

  const existingTitles = songs.map(s => ({ title: s.name }));
  const res = await fetch('https://p14awkwqt1.execute-api.us-west-2.amazonaws.com/similar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: song.name,
      artist: song.artist,
      existing: existingTitles
    }),
  });

  const data = await res.json();
  if (data.songs) {
    const newUnique = data.songs.filter(newSong =>
      !songs.some(existing => existing.name === newSong.name)
    ).slice(0, 5);
    setSongs(prev => [...prev, ...newUnique]);
  }

  setLikeLoading(''); // End loading
};

  const handleDislike = async (songIndex) => {
  setLoadingIndexes(prev => [...prev, songIndex]);

  const song = songs[songIndex];
  const existingTitles = songs.map(s => ({ title: s.name }));
  const res = await fetch('https://p14awkwqt1.execute-api.us-west-2.amazonaws.com/similar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: song.name,
      artist: song.artist,
      existing: existingTitles
    }),
  });
  const data = await res.json();
  if (data.songs && data.songs.length > 0) {
    const replacement = data.songs.find(newSong =>
      !songs.some(existing => existing.name === newSong.name)
    );
    if (replacement) {
      const updated = [...songs];
      updated[songIndex] = replacement;
      setSongs(updated);
    }
  }

  setLoadingIndexes(prev => prev.filter(index => index !== songIndex));
};

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setTheme(newTheme);
    setBgColor(newTheme === 'dark' ? '#2E2E2E' : '#ffffff');
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      fontFamily: 'Inter, sans-serif',
      backgroundColor: isDark ? '#2E2E2E' : bgColor,
      color: isDark ? '#f1f1f1' : '#111',
      transition: 'background-color 0.3s ease',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column'
    }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spinner {
          width: 16px;
          height: 16px;
          border: 3px solid rgba(0, 0, 0, 0.2); /* Outer border */
          border-top: 3px solid #7e57c2; /* Top border: visible color */
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-left: 8px;
          display: inline-block;
        }
        .image-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(0, 0, 0, 0.2);
          border-top: 4px solid #7e57c2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 1.5rem auto;
        }
          
      `}</style>

      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'none',
          border: 'none',
          fontSize: '1.5rem',
          cursor: 'pointer',
          color: isDark ? '#f1f1f1' : '#333'
        }}
        aria-label="Toggle theme"
      >
        {isDark ? '🌞' : '🌙'}
      </button>

      <h1 style={{ marginBottom: '1rem' }}>🎵 Music Moodboard</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label>Enter mood: </label>
          <input
            value={mood}
            onChange={(e) => {
              const val = e.target.value;
              setMood(val);
              if (/^[A-Za-z ]+$/.test(val.trim())) {
                setError('');
              }
            }}
            style={{ marginLeft: '0.5rem', padding: '0.25rem', borderRadius: '4px', border: `1px solid ${isDark ? '#444' : '#ccc'}`, backgroundColor: isDark ? '#1e1e1e' : '#fff', color: isDark ? '#f1f1f1' : '#111' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>Or upload image: </label>
          <input type="file" accept="image/*" onChange={handleImageUpload} style={{ color: isDark ? '#f1f1f1' : '#111' }} />
        </div>
        <button type="submit" disabled={loading} style={{ backgroundColor: '#7e57c2', color: '#fff', padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          {loading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              Generating <span className="spinner"></span>
            </span>
          ) : 'Get Songs'}
        </button>
      </form>

      {error && <p style={{ color: '#ff4d4d', marginBottom: '1rem' }}>{error}</p>}
      {claudeMood && <p><strong>Claude interpreted the mood as:</strong> <em>{claudeMood}</em></p>}
      
      {songs.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <button onClick={handleCreatePlaylist} style={{ backgroundColor: '#1DB954', color: 'white', padding: '0.6rem 1.4rem', border: 'none', borderRadius: '30px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
            ➕ Create My Playlist
          </button>
        </div>
      )}

      {likeLoading && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999
          }}>
            <div style={{
              backgroundColor: isDark ? '#333' : '#fff',
              padding: '2rem 3rem',
              borderRadius: '12px',
              boxShadow: '0 0 20px rgba(0,0,0,0.3)',
              textAlign: 'center',
              fontSize: '1.2rem',
              maxWidth: '80%',
              color: isDark ? '#f1f1f1' : '#111'
            }}>
              <p style={{ marginBottom: '1rem' }}>
                <strong>Just a moment!</strong>
              </p>
              <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                Finding songs similar to <em>{likeLoading}</em>
                <span className="spinner"></span>
              </p>
            </div>
          </div>
        )}

      <ul style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '1.5rem',
        listStyleType: 'none',
        padding: 0,
        justifyContent: 'center'
      }}>
        {songs.map((song, idx) => (
          <li key={idx} style={{
            border: `1px solid ${isDark ? '#555' : '#ccc'}`,
            borderRadius: '8px',
            padding: '1rem',
            textAlign: 'center',
            backgroundColor: isDark ? '#1e1e1e' : 'white',
            boxShadow: '2px 2px 12px rgba(0,0,0,0.1)',
            transition: 'transform 0.2s',
            cursor: 'pointer'
          }}>
            {loadingIndexes.includes(idx) ? (
                <div className="image-spinner"></div>
              ) : (
                <img src={song.image} alt={song.name} style={{ width: '100%', borderRadius: '6px', marginBottom: '0.75rem' }} />
              )}
            <p style={{ fontWeight: 'bold' }}>{song.name}</p>
            <p style={{ color: isDark ? '#ccc' : '#555', fontSize: '0.9rem' }}>{song.artist}</p>
            <a href={song.url} target="_blank" rel="noreferrer">
              <button style={{
                marginTop: '0.75rem',
                padding: '0.4rem 1rem',
                backgroundColor: '#1DB954',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer'
              }}>
                ▶️ Listen on Spotify
              </button>
            </a>
            <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <button onClick={() => handleLike(song)} style={{
                background: 'none',
                border: 'none',
                fontSize: '1.3rem',
                cursor: 'pointer',
                color: isDark ? '#81c784' : '#2e7d32'
              }}>👍</button>
              <button onClick={() => handleDislike(idx)} style={{
                background: 'none',
                border: 'none',
                fontSize: '1.3rem',
                cursor: 'pointer',
                color: isDark ? '#e57373' : '#c62828'
              }}>👎</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
