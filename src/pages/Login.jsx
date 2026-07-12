import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, User, Store, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Por favor, ingrese el usuario y la contraseña.');
      return;
    }

    setIsLoading(true);
    try {
      await login(username, password);
      toast.success('Sesión iniciada correctamente');
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error de login:', error);
      toast.error(error.message || 'Usuario o contraseña incorrectos');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 overflow-hidden">
      {/* Decorative background blur shapes */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-5xl px-4 z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">

        {/* Left Side: Brand presentation */}
        <div className="md:col-span-6 space-y-6 text-left hidden md:block">
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-none">
            Sistema POS{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
              Angelitas
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md">
            Punto de venta y control de inventarios unificado para sucursales Granada, Cofradía y Prefaconsa.
          </p>
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Gestión de inventario en tiempo real
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Control de caja y reportes
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Cuentas por cobrar y pagar
            </div>
          </div>
        </div>

        {/* Right Side: Login Card */}
        <div className="md:col-span-6 w-full max-w-md mx-auto">
          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md shadow-2xl text-slate-200">
            <CardHeader className="space-y-1">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Store className="w-6 h-6 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-white text-center">
                Iniciar Sesión
              </CardTitle>
              <CardDescription className="text-slate-400 text-center">
                Ingrese sus credenciales de acceso
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-xs font-semibold text-slate-300">Usuario</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      id="username"
                      placeholder="Nombre de usuario"
                      type="text"
                      autoCapitalize="none"
                      autoComplete="username"
                      autoCorrect="off"
                      disabled={isLoading}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10 bg-slate-950/60 border-slate-800 focus-visible:ring-emerald-500 text-white placeholder-slate-600"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-300">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      id="password"
                      placeholder="••••••••"
                      type="password"
                      autoComplete="current-password"
                      disabled={isLoading}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 bg-slate-950/60 border-slate-800 focus-visible:ring-emerald-500 text-white placeholder-slate-600"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium shadow-lg shadow-emerald-500/10 transition-all duration-200"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <>Entrar <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="flex justify-center border-t border-slate-800/80 pt-4">
              <span className="text-[10px] text-slate-600 text-center">
                © {new Date().getFullYear()} Angelitas POS
              </span>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
