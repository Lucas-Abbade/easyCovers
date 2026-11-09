import os
import sys
import asyncio
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import User, Song, Playlist
from app.routers.playlists import (
    get_user_playlists,
    create_playlist,
    update_playlist,
    delete_playlist,
    add_songs_to_playlist,
    remove_song_from_playlist,
)


class TestPlaylistsSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        self.db = self.TestingSessionLocal()
        self.db.query(Playlist).delete()
        self.db.query(Song).delete()
        self.db.query(User).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_playlist_lifecycle_and_songs_association(self):
        # 1. Cria usuário e duas músicas
        user = User(email="baterista@easycovers.app", username="Bonham", hashed_password="pwd")
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        song1 = Song(
            name="Kashmir",
            artist="Led Zeppelin",
            genre="Rock",
            instrument="Bateria",
            user_id=user.id,
        )
        song2 = Song(
            name="Superstition",
            artist="Stevie Wonder",
            genre="Pop",
            instrument="Teclado",
            user_id=user.id,
        )
        self.db.add_all([song1, song2])
        self.db.commit()
        self.db.refresh(song1)
        self.db.refresh(song2)

        # 2. Cria uma playlist sem foto
        res_create = asyncio.run(
            create_playlist(
                user_id=user.id,
                db=self.db,
                name="Repertório Show de Sexta",
                description="Setlist principal da banda",
                cover_image=None,
            )
        )
        self.assertEqual(res_create["status"], "sucesso")
        playlist_id = res_create["playlist"]["id"]
        self.assertEqual(res_create["playlist"]["name"], "Repertório Show de Sexta")
        self.assertEqual(res_create["playlist"]["description"], "Setlist principal da banda")
        self.assertEqual(res_create["playlist"]["songs"], [])

        # 3. Adiciona as duas músicas à playlist
        res_add = add_songs_to_playlist(
            playlist_id=playlist_id,
            data={"song_ids": [song1.id, song2.id]},
            db=self.db,
        )
        self.assertEqual(res_add["status"], "sucesso")
        self.assertEqual(len(res_add["playlist"]["songs"]), 2)

        # 4. Evita duplicatas ao adicionar novamente a mesma música
        res_add_dup = add_songs_to_playlist(
            playlist_id=playlist_id,
            data={"song_ids": [song1.id]},
            db=self.db,
        )
        self.assertEqual(len(res_add_dup["playlist"]["songs"]), 2)

        # 5. Atualiza nome e descrição da playlist
        res_update = asyncio.run(
            update_playlist(
                playlist_id=playlist_id,
                db=self.db,
                name="Setlist Acústico",
                description="Versão atualizada",
                remove_cover=False,
                cover_image=None,
            )
        )
        self.assertEqual(res_update["playlist"]["name"], "Setlist Acústico")
        self.assertEqual(res_update["playlist"]["description"], "Versão atualizada")

        # 6. Remove uma música da playlist
        res_remove = remove_song_from_playlist(
            playlist_id=playlist_id,
            song_id=song1.id,
            db=self.db,
        )
        self.assertEqual(len(res_remove["playlist"]["songs"]), 1)
        self.assertEqual(res_remove["playlist"]["songs"][0]["id"], song2.id)

        # 7. Lista playlists do usuário
        user_playlists = get_user_playlists(user_id=user.id, db=self.db)
        self.assertEqual(len(user_playlists), 1)
        self.assertEqual(len(user_playlists[0]["songs"]), 1)

        # 8. Exclui a playlist e garante que as músicas originais continuam no banco
        res_del = delete_playlist(playlist_id=playlist_id, db=self.db)
        self.assertEqual(res_del["status"], "sucesso")
        self.assertEqual(len(get_user_playlists(user_id=user.id, db=self.db)), 0)
        remaining_songs = self.db.query(Song).filter(Song.user_id == user.id).all()
        self.assertEqual(len(remaining_songs), 2)


if __name__ == "__main__":
    unittest.main()
