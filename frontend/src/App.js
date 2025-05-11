import React, { useState } from 'react';

function App() {
  const [mood, setMood] = useState('');
  const [image, setImage] = useState(null);
  const [songs, setSongs] = useState([]);
  const [claudeMood, setClaudeMood] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImageUpload = (e) => {
    setImage(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSongs([]);
    setClaudeMood('');

    const formData = {
      ...(image
        ? { image: await toBase64(image) }
        : { mood }),
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
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
    });

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', backgroundColor: '#f9f9f9', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: '1rem' }}>🎵 Music Moodboard</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label>Enter mood: </label>
          <input
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>Or upload image: </label>
          <input type="file" accept="image/*" onChange={handleImageUpload} />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Generating...' : 'Get Songs'}
        </button>
      </form>

      {claudeMood && (
        <p><strong>Claude interpreted the mood as:</strong> <em>{claudeMood}</em></p>
      )}

      {loading && <p style={{ fontSize: '1.2rem' }}>🎧 Finding songs for your vibe...</p>}

      <ul style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.5rem',
        listStyleType: 'none',
        padding: 0,
        justifyContent: 'flex-start'
      }}>
        {songs.map((song, idx) => (
          <li
            key={idx}
            style={{
              border: '1px solid #ccc',
              borderRadius: '8px',
              padding: '1rem',
              width: '200px',
              textAlign: 'center',
              backgroundColor: 'white',
              boxShadow: '2px 2px 12px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
          >
            <img
              src={song.image}
              alt={song.name}
              style={{ width: '100%', borderRadius: '6px', marginBottom: '0.75rem' }}
            />
            <p style={{ fontWeight: 'bold' }}>{song.name}</p>
            <p style={{ color: '#555', fontSize: '0.9rem' }}>{song.artist}</p>
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
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
