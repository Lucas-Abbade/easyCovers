from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    # ---> ADICIONE ESTAS NOVAS LINHAS AQUI <---
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
    instrument = Column(String)
    folder_path = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    owner = relationship("User", back_populates="songs")