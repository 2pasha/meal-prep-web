import { useState } from 'react';
import { signInWithGoogle } from '../hooks/useSession';

export function LoginScreen() {
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    const { error: err } = await signInWithGoogle();
    if (err) setError('Не вдалося увійти. Спробуйте ще раз.');
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center text-ink">
      <h1 className="font-head text-4xl font-extrabold text-royal mb-3">СМАКОТА</h1>
      <p className="font-serif text-xl mb-10 max-w-sm">Плануйте меню на тиждень і складайте список покупок.</p>
      <button
        onClick={handleLogin}
        className="rounded-full border border-ink bg-sun px-8 py-3 text-sm font-bold hover:brightness-95"
      >
        Увійти через Google
      </button>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </div>
  );
}
