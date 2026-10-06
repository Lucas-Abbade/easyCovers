import os
import re
import secrets
import hashlib
import hmac
import ssl
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger("easycovers.email")

# Regex estrito para validação e prevenção de Email/Header Injection (CWE-93)
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


def sanitize_header_value(val: str) -> str:
    """Remove qualquer tentativa de injeção CRLF em cabeçalhos de e-mail."""
    if not val:
        return ""
    # Remove terminadores de linha e caracteres nulos
    sanitized = re.sub(r"[\r\n\0]", "", str(val)).strip()
    return sanitized


def validate_email_address(email: str) -> str:
    """Valida estritamente o endereço de e-mail contra injeções de cabeçalho."""
    clean = sanitize_header_value(email).lower()
    if not clean or not EMAIL_REGEX.match(clean):
        raise ValueError(f"Endereço de e-mail inválido ou malformado: '{clean}'")
    return clean


def reload_email_config() -> dict:
    """
    Recarrega as configurações do arquivo .env em tempo real.
    Permite alternar entre EMAIL_DEV_MODE=True e False e atualizar credenciais
    sem reiniciar a aplicação.
    """
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    env_file = os.path.join(base_dir, ".env")
    if os.path.exists(env_file):
        try:
            from dotenv import load_dotenv
            load_dotenv(env_file, override=True)
        except Exception as e:
            logger.warning(f"Erro ao carregar .env via dotenv: {e}")

    dev_mode_str = os.environ.get("EMAIL_DEV_MODE", "True").strip().lower()
    dev_mode = dev_mode_str in ("true", "1", "yes")

    smtp_server = sanitize_header_value(os.environ.get("SMTP_SERVER", "smtp.gmail.com").strip())
    smtp_port_raw = os.environ.get("SMTP_PORT", "465").strip()
    try:
        smtp_port = int(smtp_port_raw)
    except ValueError:
        smtp_port = 465

    smtp_user = sanitize_header_value(os.environ.get("SMTP_USERNAME", "").strip())
    raw_password = os.environ.get("SMTP_PASSWORD", "").strip()

    # Senhas de App do Google contêm espaços visuais (ex: 'abcd efgh ijkl mnop')
    # Removemos os espaços automaticamente para evitar falha de autenticação
    if "gmail" in smtp_server.lower() or len(raw_password.replace(" ", "")) == 16:
        clean_password = raw_password.replace(" ", "")
    else:
        clean_password = raw_password

    from_email_raw = os.environ.get("SMTP_FROM_EMAIL", "").strip() or smtp_user or "contato@easycovers.com"
    from_email = sanitize_header_value(from_email_raw)
    from_name = sanitize_header_value(os.environ.get("SMTP_FROM_NAME", "EasyCovers Studio").strip())

    try:
        expire_minutes = int(os.environ.get("VERIFICATION_CODE_EXPIRE_MINUTES", "15").strip())
    except ValueError:
        expire_minutes = 15

    return {
        "dev_mode": dev_mode,
        "smtp_server": smtp_server,
        "smtp_port": smtp_port,
        "smtp_user": smtp_user,
        "smtp_password": clean_password,
        "from_email": from_email,
        "from_name": from_name,
        "expire_minutes": expire_minutes,
    }


def generate_otp_code() -> str:
    """Gera um código OTP de 6 dígitos criptograficamente seguro (CSPRNG NIST SP 800-90A)."""
    return f"{secrets.SystemRandom().randint(100000, 999999)}"


def generate_salt() -> str:
    """Gera um salt criptográfico aleatório de 16 bytes em hexadecimal."""
    return secrets.token_hex(16)


def hash_otp_code(code: str, salt: str) -> str:
    """Gera o hash SHA-256 seguro associando o salt único e o código numérico."""
    combined = f"{salt}:{code.strip()}".encode("utf-8")
    return hashlib.sha256(combined).hexdigest()


def verify_otp_code(candidate_code: str, salt: str, expected_hash: str) -> bool:
    """Compara o código candidato com o hash esperado em tempo constante para neutralizar timing attacks."""
    if not candidate_code or not salt or not expected_hash:
        return False
    candidate_hash = hash_otp_code(candidate_code, salt)
    return hmac.compare_digest(candidate_hash, expected_hash)


def _build_html_email(code: str, expire_minutes: int) -> str:
    """Gera o template HTML responsivo estilizado com a identidade visual do EasyCovers."""
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Verificação EasyCovers</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B132B; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E2E8F0;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0B132B; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #111E3E; border: 1px solid #1E293B; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #1E293B;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #FFFFFF; letter-spacing: -0.5px;">
                EasyCovers <span style="font-size: 13px; color: #3B82F6; background: rgba(59,130,246,0.15); padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(59,130,246,0.3); vertical-align: middle;">STUDIO</span>
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #94A3B8;">Inteligência Artificial para Músicos</p>
            </td>
          </tr>

          <!-- Conteúdo -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #F1F5F9;">Confirmação de Cadastro</h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #CBD5E1;">
                Falta apenas um passo para você começar a criar suas backing tracks e separar faixas no EasyCovers.
                Utilize o código de verificação abaixo para confirmar seu e-mail:
              </p>

              <!-- Caixa do Código -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, rgba(30,58,138,0.4), rgba(59,130,246,0.2)); border: 1px solid #2563EB; border-radius: 14px; padding: 20px;">
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #60A5FA; text-shadow: 0 2px 8px rgba(37,99,235,0.4);">
                      {code}
                    </div>
                    <div style="margin-top: 8px; font-size: 12px; color: #94A3B8; font-weight: 600;">
                      Válido por {expire_minutes} minutos
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Aviso de Segurança -->
              <div style="background-color: rgba(245, 158, 11, 0.1); border-left: 3px solid #F59E0B; padding: 12px 14px; border-radius: 6px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #FCD34D;">
                  <strong>Importante:</strong> Nunca compartilhe este código com ninguém. Se você não solicitou este cadastro no EasyCovers, ignore este e-mail.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; color: #64748B; line-height: 1.5;">
                Obrigado,<br>
                <strong style="color: #94A3B8;">Equipe EasyCovers</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 18px 32px; background-color: #0E172E; text-align: center; border-top: 1px solid #1E293B;">
              <p style="margin: 0; font-size: 11px; color: #64748B;">
                © 2026 EasyCovers. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def _send_smtp_with_failover(
    smtp_server: str,
    primary_port: int,
    smtp_user: str,
    smtp_password: str,
    msg: MIMEMultipart
) -> tuple[bool, str]:
    """
    Realiza o envio SMTP com auto-failover inteligente entre Portas 465 (SSL) e 587 (STARTTLS).
    Garante máxima resiliência contra bloqueios de provedores e timeouts de rede.
    """
    ssl_context = ssl.create_default_context()

    # Prioriza a porta configurada no .env e usa a alternativa como fallback
    ports_order = [primary_port]
    fallback_port = 587 if primary_port == 465 else 465
    if fallback_port not in ports_order:
        ports_order.append(fallback_port)

    last_error = ""

    for port in ports_order:
        try:
            print(f"[EmailService] Conectando ao servidor SMTP {smtp_server}:{port}...")

            if port == 465:
                # SSL Direto (SMTPS) - mais rápido e imune a DPI de roteadores/ISPs
                with smtplib.SMTP_SSL(smtp_server, port, context=ssl_context, timeout=12) as server:
                    server.login(smtp_user, smtp_password)
                    server.send_message(msg)
                    return True, f"Enviado com sucesso via porta {port} (SSL Direto)"
            else:
                # STARTTLS (Porta 587 / 25)
                with smtplib.SMTP(smtp_server, port, timeout=12) as server:
                    server.ehlo()
                    server.starttls(context=ssl_context)
                    server.ehlo()
                    server.login(smtp_user, smtp_password)
                    server.send_message(msg)
                    return True, f"Enviado com sucesso via porta {port} (STARTTLS)"

        except smtplib.SMTPAuthenticationError as auth_err:
            # Erro de autenticação não é falha de rede; parar imediatamente para diagnóstico
            return False, f"Credenciais rejeitadas pelo provedor: {auth_err}"

        except Exception as conn_err:
            last_error = str(conn_err)
            print(f"[EmailService] Aviso: Conexão na porta {port} falhou ({conn_err}). Tentando porta alternativa...")
            continue

    return False, f"Falha de conexão em todas as portas ({ports_order}): {last_error}"


def send_verification_email(email: str, code: str, purpose: str = "register") -> bool:
    """
    Envia o e-mail com o código de verificação com controles de cibersegurança:
    - Prevenção de injeção CRLF em e-mails
    - Modo Simulado seguro no terminal (zero chamadas externas)
    - Modo Real com auto-failover 465 SSL / 587 STARTTLS
    - Sanitização de logs de produção (sem vazamento de dados confidenciais)
    """
    try:
        clean_target_email = validate_email_address(email)
    except ValueError as val_err:
        logger.error(f"[EmailService] Tentativa de envio rejeitada por validação de segurança: {val_err}")
        return False

    cfg = reload_email_config()

    dev_mode = cfg["dev_mode"]
    smtp_server = cfg["smtp_server"]
    smtp_port = cfg["smtp_port"]
    smtp_user = cfg["smtp_user"]
    smtp_password = cfg["smtp_password"]
    from_email = cfg["from_email"]
    from_name = cfg["from_name"]
    expire_minutes = cfg["expire_minutes"]

    # -------------------------------------------------------------
    # 1. MODO SIMULADO / DEV ATIVO (EMAIL_DEV_MODE=True)
    # -------------------------------------------------------------
    if dev_mode:
        banner = (
            "\n" + "=" * 68 + "\n"
            " [EASYCOVERS: MODO SIMULADO ATIVO (EMAIL_DEV_MODE=True)]\n"
            f" Destinatário : {clean_target_email}\n"
            f" Código OTP   : >>> {code} <<<\n"
            f" Finalidade   : {purpose}\n"
            f" Validade     : {expire_minutes} minutos\n"
            " (Para enviar e-mail real, defina EMAIL_DEV_MODE=False no arquivo back/.env)\n"
            + "=" * 68 + "\n"
        )
        print(banner, flush=True)
        logger.info(f"[EmailService Dev] Código gerado para {clean_target_email}")
        return True

    # -------------------------------------------------------------
    # 2. MODO REAL ATIVADO, MAS SEM CREDENCIAIS
    # -------------------------------------------------------------
    if not smtp_user or not smtp_password:
        print("\n" + "!" * 68)
        print(" [EASYCOVERS: MODO REAL ATIVADO - CREDENCIAIS SMTP AUSENTES]")
        print(" Definiu EMAIL_DEV_MODE=False, porém SMTP_USERNAME ou SMTP_PASSWORD")
        print(" estão vazios no arquivo 'back/.env'.")
        print(f" Destinatário: {clean_target_email}")
        print("!" * 68 + "\n", flush=True)
        return False

    # -------------------------------------------------------------
    # 3. MODO REAL ATIVADO: CONEXÃO COM AUTO-FAILOVER
    # -------------------------------------------------------------
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Seu código de verificação EasyCovers: {code}"
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = clean_target_email

        text_content = (
            f"Olá!\n\n"
            f"Seu código de verificação para o EasyCovers é: {code}\n"
            f"Este código expira em {expire_minutes} minutos.\n\n"
            f"Se você não solicitou este código, por favor ignore este e-mail.\n\n"
            f"Equipe EasyCovers Studio\n"
        )
        html_content = _build_html_email(code, expire_minutes)

        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        success, detail = _send_smtp_with_failover(
            smtp_server=smtp_server,
            primary_port=smtp_port,
            smtp_user=smtp_user,
            smtp_password=smtp_password,
            msg=msg
        )

        if success:
            banner = (
                "\n" + "*" * 68 + "\n"
                " [EASYCOVERS: E-MAIL REAL ENVIADO COM SUCESSO!]\n"
                f" Destinatário : {clean_target_email}\n"
                f" Remetente    : {from_name} <{from_email}>\n"
                f" Conexão      : {detail}\n"
                " Mensagem entregue com sucesso à caixa de entrada!\n"
                + "*" * 68 + "\n"
            )
            print(banner, flush=True)
            logger.info(f"[EmailService] E-mail real entregue a {clean_target_email} ({detail})")
            return True
        else:
            print("\n" + "!" * 68)
            print(f" [EASYCOVERS: FALHA NO ENVIO REAL VIA SMTP]")
            print(f" Detalhe: {detail}")
            if "gmail" in smtp_server.lower() and "credenciais" in detail.lower():
                print("\n Dica para Gmail: Gere uma Senha de App de 16 caracteres em:")
                print(" https://myaccount.google.com/apppasswords")
            print("!" * 68 + "\n", flush=True)
            return False

    except Exception as e:
        logger.error(f"[EmailService] Erro inesperado ao montar ou despachar e-mail: {e}")
        return False
