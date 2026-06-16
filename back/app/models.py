import os
import enum
import shutil
from sqlalchemy import Enum, Column, Integer, String, ForeignKey, event
from sqlalchemy.orm import relationship
from .database import Base

#enumerador para tons das faixas

class MusicalKey(str, enum.Enum):
    C_MAJ = "C"
    C_MIN = "Cm"
    C_SHARP_MAJ = "C#"
    C_SHARP_MIN = "C#m"
    D_MAJ = "D"
    D_MIN = "Dm"
    D_SHARP_MAJ = "D#"
    D_SHARP_MIN = "D#m"
    E_MAJ = "E"
    E_MIN = "Em"
    F_MAJ = "F"
    F_MIN = "Fm"
    F_SHARP_MAJ = "F#"
    F_SHARP_MIN = "F#m"
    G_MAJ = "G"
    G_MIN = "Gm"
    G_SHARP_MAJ = "G#"
    G_SHARP_MIN = "G#m"
    A_MAJ = "A"
    A_MIN = "Am"
    A_SHARP_MAJ = "A#"
    A_SHARP_MIN = "A#m"
    B_MAJ = "B"
    B_MIN = "Bm"
    UNKNOWN = "Unknown"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    full_name = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    instrument = Column(String, nullable=True)
    favorite_genres = Column(String, nullable=True)
    favorite_artists = Column(String, nullable=True)
    profile_picture_url = Column(String, nullable=True)
    songs = relationship("Song", back_populates="owner")
    
class Song(Base):
    __tablename__ = "songs"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    artist = Column(String) 
    genre = Column(String)  
    original_key = Column(Enum(MusicalKey), default=MusicalKey.UNKNOWN, nullable=False)
    instrument = Column(String)
    folder_path = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    owner = relationship("User", back_populates="songs")

#gatilho para limpeza de arquivos físicos quando uma música é deletada do banco de dados
@event.listens_for(Song, 'after_delete')
def deletar_pasta_fisica_apos_banco(mapper, connection, target):

    if target.folder_path and os.path.exists(target.folder_path):
        try:
            print(f"limpeza do arquivo de som no disco: {target.folder_path}")
            shutil.rmtree(target.folder_path) # Apaga a pasta inteira e tudo dentro dela
        except Exception as e:
            print(f"Erro ao deletar pasta física {target.folder_path}: {e}")