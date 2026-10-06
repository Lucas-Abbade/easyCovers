import unittest
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import User, Song
from app.routers.songs import get_user_songs, get_song_markers, update_song_markers

class TestPracticeMarkersSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

    def setUp(self):
        self.db = self.TestingSessionLocal()
        self.db.query(Song).delete()
        self.db.query(User).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_practice_markers_lifecycle(self):
        # 1. Cria usuário e música
        user = User(email="guitarrista@easycovers.app", username="Slash", hashed_password="hashed_pwd")
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        song = Song(
            name="Sweet Child O' Mine",
            artist="Guns N' Roses",
            genre="Rock",
            instrument="Guitarra",
            user_id=user.id
        )
        self.db.add(song)
        self.db.commit()
        self.db.refresh(song)

        # 2. Testa get_song_markers inicial (deve ser vazio)
        res_get_init = get_song_markers(song_id=song.id, db=self.db)
        self.assertEqual(res_get_init["status"], "sucesso")
        self.assertEqual(res_get_init["markers"], [])

        # 3. Testa update_song_markers com marcadores de treino (Solo e Riff)
        novos_marcadores = [
            {"id": "m1", "name": "Intro Riff", "start": 0.0, "end": 14.5, "color": "#f59e0b"},
            {"id": "m2", "name": "Solo de Guitarra", "start": 124.0, "end": 165.5, "color": "#ec4899"}
        ]
        res_update = update_song_markers(song_id=song.id, data={"markers": novos_marcadores}, db=self.db)
        self.assertEqual(res_update["status"], "sucesso")
        self.assertEqual(len(res_update["markers"]), 2)

        # 4. Testa get_song_markers após persistência
        res_get_saved = get_song_markers(song_id=song.id, db=self.db)
        self.assertEqual(len(res_get_saved["markers"]), 2)
        self.assertEqual(res_get_saved["markers"][0]["name"], "Intro Riff")
        self.assertEqual(res_get_saved["markers"][1]["name"], "Solo de Guitarra")
        self.assertEqual(res_get_saved["markers"][1]["start"], 124.0)
        self.assertEqual(res_get_saved["markers"][1]["end"], 165.5)

        # 5. Testa listagem em get_user_songs
        songs_list = get_user_songs(user_id=user.id, db=self.db)
        self.assertEqual(len(songs_list), 1)
        parsed = json.loads(songs_list[0].practice_markers)
        self.assertEqual(len(parsed), 2)
        self.assertEqual(parsed[0]["name"], "Intro Riff")

if __name__ == '__main__':
    unittest.main()

