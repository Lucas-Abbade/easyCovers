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
            ("banner_picture_url", "VARCHAR"),
            ("location", "VARCHAR"),
            ("experience_level", "VARCHAR"),
            ("social_instagram", "VARCHAR"),
            ("social_youtube", "VARCHAR"),
            ("social_spotify", "VARCHAR"),
            ("social_x", "VARCHAR"),
            ("created_at", "DATETIME"),
        ]

        for col_name, col_type in new_columns:
            if col_name not in existing_cols:
                try:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                    print(f"[Migration] Coluna '{col_name}' adicionada com sucesso à tabela users.")
                except Exception as e:
                    print(f"[Migration] Aviso ao adicionar coluna '{col_name}': {e}")
