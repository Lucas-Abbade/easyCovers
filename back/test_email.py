import sys
import os

# Adiciona o diretório atual ao sys.path para importar app.services
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services import email_service

def main():
    print("=" * 68)
    print("   EASYCOVERS - DIAGNÓSTICO E TESTE DE ENVIO DE E-MAIL")
    print("=" * 68)

    cfg = email_service.reload_email_config()
    print(f"\n[1] Configuração Carregada do back/.env:")
    print(f"  • EMAIL_DEV_MODE : {cfg['dev_mode']} ({'SIMULADO (Terminal)' if cfg['dev_mode'] else 'REAL (SMTP Inbox)'})")
    print(f"  • SMTP_SERVER    : {cfg['smtp_server'] or '(Não definido)'}")
    print(f"  • SMTP_PORT      : {cfg['smtp_port']}")
    print(f"  • SMTP_USERNAME  : {cfg['smtp_user'] or '(Não preenchido)'}")
    print(f"  • SMTP_PASSWORD  : {'********' if cfg['smtp_password'] else '(Não preenchido)'}")
    print(f"  • REMETENTE      : {cfg['from_name']} <{cfg['from_email']}>")

    # Obtém o e-mail de destino
    if len(sys.argv) > 1:
        target_email = sys.argv[1].strip()
    elif cfg['smtp_user']:
        target_email = cfg['smtp_user']
    else:
        target_email = input("\nDigite o e-mail de destino para o teste: ").strip()

    if not target_email or "@" not in target_email:
        print("\n[ERRO] Por favor, informe um endereço de e-mail válido para o teste.")
        sys.exit(1)

    print(f"\n[2] Disparando envio de teste para: {target_email}")
    test_code = email_service.generate_otp_code()

    success = email_service.send_verification_email(
        email=target_email,
        code=test_code,
        purpose="diagnostico_teste"
    )

    print("\n" + "=" * 68)
    if success:
        if cfg['dev_mode']:
            print(" [RESULTADO]: Teste em MODO SIMULADO executado com sucesso!")
            print(" Para testar o envio REAL na sua caixa de entrada:")
            print(" 1. Abra o arquivo 'back/.env'")
            print(" 2. Mude para: EMAIL_DEV_MODE=False")
            print(" 3. Preencha SMTP_USERNAME e SMTP_PASSWORD")
        else:
            print(" [RESULTADO]: E-mail REAL entregue com sucesso!")
            print(f" Verifique a caixa de entrada de {target_email}!")
    else:
        print(" [RESULTADO]: O envio falhou. Veja as instruções acima para corrigir.")
    print("=" * 68 + "\n")


if __name__ == "__main__":
    main()
