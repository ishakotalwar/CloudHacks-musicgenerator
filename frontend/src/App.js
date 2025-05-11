import React, { useState } from 'react';

function App() {
  const [mood, setMood] = useState('');
  const [image, setImage] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleImageUpload = (e) => {
    setImage(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

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
    <div style={{ padding: '2rem' }}>
      <h1>Music Moodboard 🎵</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Enter mood: </label>
          <input value={mood} onChange={(e) => setMood(e.target.value)} />
        </div>
        <div>
          <label>Or upload image: </label>
          <input type="file" accept="image/*" onChange={handleImageUpload} />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Generating...' : 'Get Songs'}
        </button>
      </form>

      <ul>
        {songs.map((song, idx) => (
          <li key={idx}>
            <a href={song.url} target="_blank" rel="noreferrer">
              {song.name} by {song.artist}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
