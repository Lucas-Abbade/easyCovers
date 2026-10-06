import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock
from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import User, EmailVerification
from app.schemas import (
    UserCredentials,
    VerifyEmailRequest,
    ResendVerificationRequest,
)
from app.services import email_service
from app.routers.auth import register_user, verify_email, resend_verification, login_user


class TestEmailVerificationSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Banco SQLite isolado em memória para os testes
        cls.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

    def setUp(self):
        # Cria uma nova sessão para cada teste
        self.db = self.TestingSessionLocal()
        # Limpa as tabelas entre testes
        self.db.query(EmailVerification).delete()
        self.db.query(User).delete()
        self.db.commit()
        self.bg_tasks = BackgroundTasks()

    def tearDown(self):
        self.db.close()

    # -------------------------------------------------------------
    # 1. Testes de Unidade de Criptografia e Segurança do OTP
    # -------------------------------------------------------------
    def test_otp_generation_and_hashing(self):
        """Valida que o OTP tem exatamente 6 dígitos numéricos e validação constante."""
        code = email_service.generate_otp_code()
        self.assertEqual(len(code), 6)
        self.assertTrue(code.isdigit())

        salt = email_service.generate_salt()
        self.assertTrue(len(salt) >= 16)

        code_hash = email_service.hash_otp_code(code, salt)
        self.assertTrue(len(code_hash) == 64)  # SHA-256 produz 64 caracteres hex

        # Validação positiva
        self.assertTrue(email_service.verify_otp_code(code, salt, code_hash))
        # Validação negativa com código incorreto
        self.assertFalse(email_service.verify_otp_code("000000", salt, code_hash))
        # Validação com salt incorreto
        self.assertFalse(email_service.verify_otp_code(code, "salt_invalido", code_hash))

    # -------------------------------------------------------------
    # 2. Teste de Cadastro (Registro Inicial Pendente de Validação)
    # -------------------------------------------------------------
    def test_register_creates_unverified_user_and_otp_record(self):
        """Valida que register_user cria usuário com is_email_verified=False e gera registro de OTP."""
        creds = UserCredentials(
            username="guitarrista_pro",
            email="guitarrista@easycovers.com",
            password="SenhaForte123"
        )
        resp = register_user(creds, self.bg_tasks, self.db)

        self.assertEqual(resp["status"], "pending_verification")
        self.assertEqual(resp["email"], "guitarrista@easycovers.com")
        self.assertEqual(resp["resend_cooldown"], 60)

        # Checa usuário no banco
        user = self.db.query(User).filter(User.email == "guitarrista@easycovers.com").first()
        self.assertIsNotNone(user)
        self.assertFalse(user.is_email_verified)

        # Checa registro de verificação
        verification = self.db.query(EmailVerification).filter(EmailVerification.email == user.email).first()
        self.assertIsNotNone(verification)
        self.assertFalse(verification.is_used)
        self.assertEqual(verification.attempts, 0)
        self.assertEqual(verification.max_attempts, 5)

    # -------------------------------------------------------------
    # 3. Teste de Verificação com Sucesso (Happy Path)
    # -------------------------------------------------------------
    def test_verify_email_success(self):
        """Valida que ao enviar o código correto, a conta é ativada e o payload de auth é retornado."""
        # 1. Cadastra
        creds = UserCredentials(username="baterista", email="batera@easycovers.com", password="SenhaSegura123")
        register_user(creds, self.bg_tasks, self.db)

        # 2. Emula o código gerado
        verification = self.db.query(EmailVerification).filter(EmailVerification.email == creds.email).first()
        test_code = "789123"
        salt = email_service.generate_salt()
        verification.salt = salt
        verification.code_hash = email_service.hash_otp_code(test_code, salt)
        self.db.commit()

        # 3. Valida
        verify_req = VerifyEmailRequest(email=creds.email, code=test_code)
        resp = verify_email(verify_req, self.db)

        self.assertEqual(resp["status"], "sucesso")
        self.assertTrue(resp["is_email_verified"])
        self.assertEqual(resp["email"], creds.email)

        # Confirma no banco
        user = self.db.query(User).filter(User.email == creds.email).first()
        self.assertTrue(user.is_email_verified)
        self.db.refresh(verification)
        self.assertTrue(verification.is_used)

    # -------------------------------------------------------------
    # 4. Teste de Proteção Anti-Força Bruta (Tentativas Incorretas)
    # -------------------------------------------------------------
    def test_anti_brute_force_attempts_and_lockout(self):
        """Valida que tentativas erradas são contabilizadas e bloqueiam após 5 falhas."""
        creds = UserCredentials(username="baixista", email="baixo@easycovers.com", password="SenhaForte123")
        register_user(creds, self.bg_tasks, self.db)

        verification = self.db.query(EmailVerification).filter(EmailVerification.email == creds.email).first()
        correct_code = "654321"
        salt = email_service.generate_salt()
        verification.salt = salt
        verification.code_hash = email_service.hash_otp_code(correct_code, salt)
        self.db.commit()

        # 4 tentativas incorretas
        for attempt_num in range(1, 5):
            with self.assertRaises(HTTPException) as ctx:
                verify_email(VerifyEmailRequest(email=creds.email, code="000000"), self.db)
            self.assertEqual(ctx.exception.status_code, 400)
            self.assertIn("tentativa(s)", ctx.exception.detail)

        self.db.refresh(verification)
        self.assertEqual(verification.attempts, 4)

        # 5ª tentativa incorreta deve bloquear o código
        with self.assertRaises(HTTPException) as ctx:
            verify_email(VerifyEmailRequest(email=creds.email, code="000000"), self.db)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Limite de tentativas atingido", ctx.exception.detail)

        self.db.refresh(verification)
        self.assertTrue(verification.is_used)

    # -------------------------------------------------------------
    # 5. Teste de Código Expirado
    # -------------------------------------------------------------
    def test_expired_code_rejection(self):
        """Valida que códigos com validade expirada são rejeitados."""
        creds = UserCredentials(username="tecladista", email="teclado@easycovers.com", password="SenhaForte123")
        register_user(creds, self.bg_tasks, self.db)

        verification = self.db.query(EmailVerification).filter(EmailVerification.email == creds.email).first()
        # Força expiração no passado (20 minutos atrás)
        verification.expires_at = datetime.utcnow() - timedelta(minutes=20)
        self.db.commit()

        with self.assertRaises(HTTPException) as ctx:
            verify_email(VerifyEmailRequest(email=creds.email, code="123456"), self.db)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("expirou", ctx.exception.detail)

    # -------------------------------------------------------------
    # 6. Teste de Cooldown e Invalidação no Reenvio
    # -------------------------------------------------------------
    def test_resend_cooldown_and_invalidation(self):
        """Valida bloqueio por cooldown (HTTP 429) e invalidação de código antigo ao reenviar."""
        creds = UserCredentials(username="vocalista", email="voz@easycovers.com", password="SenhaForte123")
        register_user(creds, self.bg_tasks, self.db)

        # 1. Tentar reenviar imediatamente (deve falhar com 429 Too Many Requests)
        with self.assertRaises(HTTPException) as ctx:
            resend_verification(ResendVerificationRequest(email=creds.email), self.bg_tasks, self.db)
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIn("Aguarde", ctx.exception.detail)

        # 2. Simula passagem de 61 segundos
        old_verification = self.db.query(EmailVerification).filter(EmailVerification.email == creds.email).first()
        old_verification.created_at = datetime.utcnow() - timedelta(seconds=65)
        old_code = "111111"
        salt = email_service.generate_salt()
        old_verification.salt = salt
        old_verification.code_hash = email_service.hash_otp_code(old_code, salt)
        self.db.commit()

        # 3. Agora reenvio deve funcionar com sucesso
        resend_resp = resend_verification(ResendVerificationRequest(email=creds.email), self.bg_tasks, self.db)
        self.assertEqual(resend_resp["status"], "code_sent")

        # 4. Confirma que o código anterior foi invalidado
        self.db.refresh(old_verification)
        self.assertTrue(old_verification.is_used)

        # Tentar validar o código antigo deve falhar
        with self.assertRaises(HTTPException):
            verify_email(VerifyEmailRequest(email=creds.email, code=old_code), self.db)

    # -------------------------------------------------------------
    # 7. Teste de Bloqueio de Login para E-mail Não Verificado
    # -------------------------------------------------------------
    def test_login_blocked_when_email_unverified(self):
        """Valida que login_user bloqueia com HTTP 403 e aviso explicativo caso e-mail não esteja verificado."""
        creds = UserCredentials(username="produtor", email="produtor@easycovers.com", password="SenhaForte123")
        register_user(creds, self.bg_tasks, self.db)

        # Tenta login com senha correta
        with self.assertRaises(HTTPException) as ctx:
            login_user(creds, self.bg_tasks, self.db)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("não foi verificado", ctx.exception.detail)

        # Agora marca usuário como verificado e testa login novamente
        user = self.db.query(User).filter(User.email == creds.email).first()
        user.is_email_verified = True
        self.db.commit()

        login_resp = login_user(creds, self.bg_tasks, self.db)
        self.assertEqual(login_resp["status"], "sucesso")
        self.assertTrue(login_resp["is_email_verified"])

    # -------------------------------------------------------------
    # 8. Teste de Recadastro de Conta Não Verificada e Proteção Pre-Account Takeover
    # -------------------------------------------------------------
    def test_re_register_unverified_account_updates_credentials_and_issues_new_code(self):
        """Valida que um usuário que não confirmou o código pode refazer o cadastro e ter seus dados ativados ao validar o OTP."""
        from app.routers.auth import verify_password

        creds_1 = UserCredentials(username="guitarra_old", email="teste_retry@easycovers.com", password="SenhaAntiga123")
        resp_1 = register_user(creds_1, self.bg_tasks, self.db)
        self.assertEqual(resp_1["status"], "pending_verification")

        # Usuário tenta se cadastrar de novo com nova senha/username
        creds_2 = UserCredentials(username="guitarra_new", email="teste_retry@easycovers.com", password="NovaSenhaSegura456")
        resp_2 = register_user(creds_2, self.bg_tasks, self.db)
        self.assertEqual(resp_2["status"], "pending_verification")

        # Antes de validar o OTP, o usuário original no banco não teve sua senha sobrescrita (prevenção Pre-Account Takeover CWE-287)
        user = self.db.query(User).filter(User.email == "teste_retry@easycovers.com").first()
        self.assertFalse(user.is_email_verified)

        # Usuário valida o código gerado no segundo cadastro
        verification_2 = (
            self.db.query(EmailVerification)
            .filter(EmailVerification.email == creds_2.email, EmailVerification.is_used == False)
            .first()
        )
        code_2 = "999888"
        salt = email_service.generate_salt()
        verification_2.salt = salt
        verification_2.code_hash = email_service.hash_otp_code(code_2, salt)
        self.db.commit()

        verify_resp = verify_email(VerifyEmailRequest(email=creds_2.email, code=code_2), self.db)
        self.assertEqual(verify_resp["status"], "sucesso")

        # Após comprovar a posse do e-mail com OTP, as credenciais e status de verificação são confirmados
        self.db.refresh(user)
        self.assertEqual(user.username, "guitarra_new")
        self.assertTrue(user.is_email_verified)
        self.assertTrue(verify_password("NovaSenhaSegura456", user.hashed_password))

    # -------------------------------------------------------------
    # 9. Teste de Proteção contra Enumeração de Usuários (CWE-208)
    # -------------------------------------------------------------
    def test_resend_anti_enumeration_protection(self):
        """Valida que e-mails inexistentes ou já verificados recebem resposta genérica de sucesso para evitar vazamento."""
        # 1. E-mail inexistente
        resp_non_existent = resend_verification(
            ResendVerificationRequest(email="fantasma@inexistente.com"),
            self.bg_tasks,
            self.db
        )
        self.assertEqual(resp_non_existent["status"], "code_sent")
        self.assertIn("Se este e-mail estiver cadastrado", resp_non_existent["message"])

        # 2. E-mail já verificado
        creds = UserCredentials(username="ja_verificado", email="confirmado@easycovers.com", password="SenhaForte123")
        register_user(creds, self.bg_tasks, self.db)
        user = self.db.query(User).filter(User.email == creds.email).first()
        user.is_email_verified = True
        self.db.commit()

        resp_verified = resend_verification(
            ResendVerificationRequest(email=creds.email),
            self.bg_tasks,
            self.db
        )
        self.assertEqual(resp_verified["status"], "code_sent")
        self.assertIn("Se este e-mail estiver cadastrado", resp_verified["message"])

    # -------------------------------------------------------------
    # 10. Teste de Rate Limit Horário contra Exaustão de Recursos
    # -------------------------------------------------------------
    def test_hourly_rate_limiting_blocks_abuse(self):
        """Valida que mais de 5 solicitações de código por hora para o mesmo e-mail disparam HTTP 429."""
        email = "vitima_spam@easycovers.com"
        creds = UserCredentials(username="vitima_spam", email=email, password="SenhaForte123")
        register_user(creds, self.bg_tasks, self.db)

        # Insere 4 registros simulando requisições anteriores nos últimos minutos
        for i in range(4):
            v = EmailVerification(
                email=email,
                code_hash="fake_hash",
                salt="fake_salt",
                created_at=datetime.utcnow() - timedelta(minutes=10 + i * 5),
                expires_at=datetime.utcnow() + timedelta(minutes=10),
                is_used=True,
                purpose="test"
            )
            self.db.add(v)
        self.db.commit()

        # A 6ª tentativa na mesma hora deve ser bloqueada com 429
        with self.assertRaises(HTTPException) as ctx:
            resend_verification(ResendVerificationRequest(email=email), self.bg_tasks, self.db)
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIn("Limite de solicitações de código excedido", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()

