from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# Configuração do SQLite
SQLALCHEMY_DATABASE_URL = "sqlite:///./easycovers.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Função para abrir/fechar a conexão com o banco (movida do main.py)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_migrations():
    """Garante que colunas novas existam no SQLite sem quebrar bancos existentes."""
    with engine.connect() as conn:
        # Verifica se a tabela users existe
        result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'"))
        if not result.fetchone():
            return

        # Busca colunas existentes
        columns_info = conn.execute(text("PRAGMA table_info(users)")).fetchall()
        existing_cols = {col[1] for col in columns_info}

        new_columns = [
            ("is_profile_completed", "BOOLEAN DEFAULT 0"),
            ("is_email_verified", "BOOLEAN DEFAULT 0"),
            ("banner_picture_url", "VARCHAR"),
            ("location", "VARCHAR"),
            ("experience_level", "VARCHAR"),
            ("social_instagram", "VARCHAR"),
            ("social_youtube", "VARCHAR"),
            ("social_spotify", "VARCHAR"),
            ("social_x", "VARCHAR"),
            ("created_at", "DATETIME"),
            ("spotify_id", "VARCHAR"),
            ("spotify_display_name", "VARCHAR"),
            ("spotify_email", "VARCHAR"),
            ("spotify_avatar_url", "VARCHAR"),
            ("spotify_profile_url", "VARCHAR"),
            ("spotify_access_token", "VARCHAR"),
            ("spotify_refresh_token", "VARCHAR"),
            ("spotify_token_expires_at", "DATETIME"),
            ("spotify_connected_at", "DATETIME"),
            ("spotify_playlists_json", "TEXT"),
            ("spotify_liked_tracks_json", "TEXT"),
        ]

        added_email_verified = False
        for col_name, col_type in new_columns:
            if col_name not in existing_cols:
                try:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                    print(f"[Migration] Coluna '{col_name}' adicionada com sucesso à tabela users.")
                    if col_name == "is_email_verified":
                        added_email_verified = True
                except Exception as e:
                    print(f"[Migration] Aviso ao adicionar coluna '{col_name}': {e}")

        # Se a coluna de verificação foi recém-adicionada, migra contas pré-existentes como já verificadas
        if added_email_verified:
            try:
                conn.execute(text("UPDATE users SET is_email_verified = 1 WHERE is_email_verified IS NULL OR is_email_verified = 0"))
                conn.commit()
                print("[Migration] Usuários existentes marcados como verificados com sucesso.")
            except Exception as e:
                print(f"[Migration] Aviso ao atualizar is_email_verified para usuários existentes: {e}")

        # Migração da tabela email_verifications
        result_ev = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='email_verifications'"))
        if result_ev.fetchone():
            ev_cols_info = conn.execute(text("PRAGMA table_info(email_verifications)")).fetchall()
            existing_ev_cols = {col[1] for col in ev_cols_info}
            if "pending_password_hash" not in existing_ev_cols:
                try:
                    conn.execute(text("ALTER TABLE email_verifications ADD COLUMN pending_password_hash VARCHAR"))
                    conn.commit()
                    print("[Migration] Coluna 'pending_password_hash' adicionada à tabela email_verifications.")
                except Exception as e:
                    print(f"[Migration] Aviso ao adicionar coluna 'pending_password_hash': {e}")
            if "pending_username" not in existing_ev_cols:
                try:
                    conn.execute(text("ALTER TABLE email_verifications ADD COLUMN pending_username VARCHAR"))
                    conn.commit()
                    print("[Migration] Coluna 'pending_username' adicionada à tabela email_verifications.")
                except Exception as e:
                    print(f"[Migration] Aviso ao adicionar coluna 'pending_username': {e}")

        # Migração da tabela songs
        result_songs = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='songs'"))
        if result_songs.fetchone():
            songs_cols_info = conn.execute(text("PRAGMA table_info(songs)")).fetchall()
            existing_songs_cols = {col[1] for col in songs_cols_info}
            if "cover_image_url" not in existing_songs_cols:
                try:
                    conn.execute(text("ALTER TABLE songs ADD COLUMN cover_image_url VARCHAR"))
                    conn.commit()
                    print("[Migration] Coluna 'cover_image_url' adicionada com sucesso à tabela songs.")
                except Exception as e:
                    print(f"[Migration] Aviso ao adicionar coluna 'cover_image_url': {e}")
            if "practice_markers" not in existing_songs_cols:
                try:
                    conn.execute(text("ALTER TABLE songs ADD COLUMN practice_markers TEXT DEFAULT '[]'"))
                    conn.commit()
                    print("[Migration] Coluna 'practice_markers' adicionada com sucesso à tabela songs.")
                except Exception as e:
                    print(f"[Migration] Aviso ao adicionar coluna 'practice_markers': {e}")

