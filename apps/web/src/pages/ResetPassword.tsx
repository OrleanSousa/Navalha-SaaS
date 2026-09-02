import { FormEvent, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const token = params.get('token') || '';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      toast.error('As senhas não coincidem.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      toast.success('Senha redefinida. Entre com sua nova senha.');
      navigate('/login', { replace: true });
    } catch {
      toast.error('O link é inválido ou expirou. Solicite uma nova recuperação.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login standalone">
      <section className="login-form">
        <form onSubmit={submit}>
          <span className="eyebrow">NOVA SENHA</span>
          <h2>Redefina sua senha</h2>
          <p>Use ao menos oito caracteres, com maiúscula, minúscula, número e símbolo.</p>
          {!token && <div className="empty">Link de recuperação inválido.</div>}
          <label>
            Nova senha
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
          </label>
          <label>
            Confirmar nova senha
            <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} required />
          </label>
          <button className="login-btn" disabled={busy || !token}>
            {busy ? 'Salvando...' : 'Redefinir senha'}
          </button>
          <Link className="auth-back" to="/login">
            <ArrowLeft /> Voltar ao login
          </Link>
        </form>
      </section>
    </main>
  );
}
