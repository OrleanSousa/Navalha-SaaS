import { useState } from 'react';
import { Scissors, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { Link } from 'react-router-dom';
export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@barbeariamodelo.com');
  const [password, setPassword] = useState('Admin@123');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
    } catch {
      toast.error('E-mail ou senha inválidos');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <section className="login-hero">
        <div className="hero-brand">
          <span>
            <Scissors />
          </span>
          NAVALHA
        </div>
        <div>
          <p>GESTÃO QUE AFIA RESULTADOS</p>
          <h1>
            Sua barbearia,
            <br />
            no controle.
          </h1>
          <p className="lead">
            Agenda, clientes, estoque e financeiro em uma plataforma simples, rápida e feita para
            crescer.
          </p>
          <div className="stat-row">
            <div>
              <b>+32%</b>
              <small>produtividade</small>
            </div>
            <div>
              <b>24h</b>
              <small>agenda online</small>
            </div>
            <div>
              <b>100%</b>
              <small>na nuvem</small>
            </div>
          </div>
        </div>
        <small>© 2026 Navalha Gestão</small>
      </section>
      <section className="login-form">
        <form onSubmit={submit}>
          <span className="eyebrow">BEM-VINDO DE VOLTA</span>
          <h2>Acesse sua conta</h2>
          <p>Entre com seus dados para continuar.</p>
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Senha
            <div className="password">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShow(!show)}>
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          <button className="login-btn" disabled={busy}>
            {busy ? 'Entrando...' : 'Entrar na plataforma'}
            <ArrowRight />
          </button>
          <Link className="auth-back" to="/recuperar-senha">
            Esqueci minha senha
          </Link>
        </form>
      </section>
    </div>
  );
}
