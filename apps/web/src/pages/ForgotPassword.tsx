import { FormEvent, useState } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [developmentToken, setDevelopmentToken] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setDevelopmentToken(data.resetToken);
      setSent(true);
    } catch {
      toast.error('Não foi possível solicitar a recuperação. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login standalone">
      <section className="login-form">
        <form onSubmit={submit}>
          <span className="eyebrow">RECUPERAÇÃO DE CONTA</span>
          <h2>Esqueceu sua senha?</h2>
          {sent ? (
            <>
              <p>Se o e-mail estiver cadastrado, as instruções de recuperação foram geradas.</p>
              {developmentToken && (
                <Link className="login-btn" to={`/redefinir-senha?token=${developmentToken}`}>
                  Redefinir senha no ambiente local
                </Link>
              )}
            </>
          ) : (
            <>
              <p>Informe seu e-mail para receber as instruções de redefinição.</p>
              <label>
                E-mail
                <div className="password">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                  <Mail />
                </div>
              </label>
              <button className="login-btn" disabled={busy}>
                {busy ? 'Enviando...' : 'Enviar instruções'}
              </button>
            </>
          )}
          <Link className="auth-back" to="/login">
            <ArrowLeft /> Voltar ao login
          </Link>
        </form>
      </section>
    </main>
  );
}
