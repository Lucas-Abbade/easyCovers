import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ViewProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      const user = JSON.parse(localStorage.getItem('user'));
      if (!user || !user.id) {
        navigate('/');
        return;
      }

      try {
        const response = await fetch(`http://localhost:8000/profile/${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
        }
      } catch (error) {
        console.error("Erro ao carregar perfil:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  if (loading) return <p>Carregando perfil...</p>;
  if (!profile) return <p>Perfil não encontrado.</p>;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <img 
            src={profile.profile_picture_url || 'https://via.placeholder.com/150'} 
            alt="Foto de Perfil" 
            style={styles.avatar} 
          />
          <h2>{profile.full_name || "Nome não definido"}</h2>
          <p style={styles.username}>@{profile.username}</p>
        </div>

        <div style={styles.infoSection}>
          <div style={styles.infoItem}>
            <strong>Bio:</strong>
            <p>{profile.bio || "Nenhuma bio adicionada."}</p>
          </div>

          <div style={styles.infoItem}>
            <strong>Instrumento:</strong>
            <p>{profile.instrument || "Não informado"}</p>
          </div>

          <div style={styles.infoItem}>
            <strong>Gêneros Favoritos:</strong>
            <p>{profile.favorite_genres || "Não informado"}</p>
          </div>

          <div style={styles.infoItem}>
            <strong>Artistas Favoritos:</strong>
            <p>{profile.favorite_artists || "Não informado"}</p>
          </div>
        </div>

        <button 
          onClick={() => navigate('/edit-profile')} 
          style={styles.editButton}
        >
          Editar Perfil
        </button>
      </div>
    </div>
  );
};

// Estilos básicos para você visualizar melhor
const styles = {
  container: { display: 'flex', justifyContent: 'center', padding: '20px', fontFamily: 'Arial' },
  card: { width: '100%', maxWidth: '500px', background: '#fff', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', textAlign: 'center' },
  avatar: { width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #6200ee', marginBottom: '15px' },
  username: { color: '#666', marginTop: '-10px', marginBottom: '20px' },
  infoSection: { textAlign: 'left', borderTop: '1px solid #eee', paddingTop: '20px' },
  infoItem: { marginBottom: '15px' },
  editButton: { width: '100%', padding: '12px', backgroundColor: '#6200ee', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', marginTop: '20px' }
};

export default ViewProfile;