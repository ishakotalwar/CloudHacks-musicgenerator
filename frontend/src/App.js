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

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSongs([]);
    setClaudeMood('');

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
  };

  const handleLike = async (song) => {
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
      ).slice(0, 5); // only take 2 new ones
      setSongs(prev => [...prev, ...newUnique]);
    }
  };

  const handleDislike = async (songIndex) => {
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
  };

  const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
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
        <p>
          <strong>Claude interpreted the mood as:</strong>{' '}
          <em>{claudeMood}</em>
        </p>
      )}

      {loading && <p style={{ fontSize: '1.2rem' }}>🎧 Finding songs for your vibe...</p>}

      {chunkArray(songs, 5).map((row, rowIdx) => (
        <ul
          key={rowIdx}
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            listStyleType: 'none',
            padding: 0,
            marginBottom: '2rem',
            flexWrap: 'nowrap',
          }}
        >
          {row.map((song, idx) => {
            const songIndex = rowIdx * 5 + idx;
            return (
              <li
                key={idx}
                style={{
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  padding: '1rem',
                  width: '200px',
                  textAlign: 'center',
                  boxShadow: '2px 2px 10px rgba(0,0,0,0.1)',
                }}
              >
                <img
                  src={song.image}
                  alt={song.name}
                  style={{ width: '100%', borderRadius: '6px', marginBottom: '0.5rem' }}
                />
                <p><strong>{song.name}</strong></p>
                <p style={{ color: '#555', fontSize: '0.9rem' }}>{song.artist}</p>
                <a href={song.url} target="_blank" rel="noreferrer">
                  <button
                    style={{
                      backgroundColor: '#1DB954',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      marginBottom: '0.5rem'
                    }}
                  >
                    ▶ Listen on Spotify
                  </button>
                </a>
                <div>
                  <button
                    onClick={() => handleLike(song)}
                    style={{
                      marginRight: '0.5rem',
                      padding: '0.3rem 0.6rem',
                      borderRadius: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    👍
                  </button>
                  <button
                    onClick={() => handleDislike(songIndex)}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    👎
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}

export default App;
