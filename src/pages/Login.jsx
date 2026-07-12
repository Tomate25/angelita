import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, User, Shield, Store, Loader2, ArrowRight } from 'lucide-react';
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

  const handleTestRoleSelect = async (role) => {
    setIsLoading(true);
    try {
      await login(role, 'password');
      toast.success(`Sesión iniciada como ${role.toUpperCase()}`);
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error de login de prueba:', error);
      toast.error(error.message || `No se pudo iniciar sesión como ${role}`);
    } finally {
      setIsLoading(false);
    }
  };

  const roles = [
    { id: 'admin', label: 'Administrador', icon: Shield, desc: 'Acceso total y configuración', color: 'from-amber-500 to-orange-600' },
    { id: 'granada', label: 'Sucursal Granada', icon: Store, desc: 'Gestión local Granada', color: 'from-emerald-500 to-teal-600' },
    { id: 'cofradia', label: 'Sucursal Cofradía', icon: Store, desc: 'Gestión local Cofradía', color: 'from-blue-500 to-indigo-600' },
    { id: 'prefaconsa', label: 'Prefaconsa', icon: Store, desc: 'Gestión Prefaconsa', color: 'from-purple-500 to-pink-600' },
  ];

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 overflow-hidden">
      {/* Decorative background blur shapes */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-5xl px-4 z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        {/* Left Side: Brand presentation */}
        <div className="md:col-span-6 space-y-6 text-left hidden md:block">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Modo Local Offline</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-none">
            Sistema POS <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">Angelitas</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md">
            Punto de venta y control de inventarios unificado para sucursales Granada, Cofradía y Prefaconsa.
          </p>
          <div className="border-t border-slate-800/80 pt-6 mt-4">
            <p className="text-xs text-slate-500">
              Desconectado de la nube de Base44. Utilizando motor de base de datos local y JWT para máxima velocidad y estabilidad.
            </p>
          </div>
        </div>

        {/* Right Side: Login Card */}
        <div className="md:col-span-6 w-full max-w-md mx-auto">
          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md shadow-2xl text-slate-200">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight text-white text-center">
                Iniciar Sesión
              </CardTitle>
              <CardDescription className="text-slate-400 text-center">
                Ingrese sus credenciales de acceso local
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
                    <>
                      Entrar <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-900 px-2 text-slate-500">Acceso Rápido (Pruebas)</span>
                </div>
              </div>

              {/* Quick test logins grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {roles.map((role) => {
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.id}
                      onClick={() => handleTestRoleSelect(role.id)}
                      disabled={isLoading}
                      className="group relative flex flex-col items-start p-3 text-left rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-950/90 hover:border-slate-700 transition-all duration-200"
                    >
                      <div className={`p-1.5 rounded bg-gradient-to-br ${role.color} text-white mb-2`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
                        {role.label}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {role.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
            <CardFooter className="flex justify-center border-t border-slate-800/80 pt-4">
              <span className="text-[10px] text-slate-600 text-center">
                © {new Date().getFullYear()} Angelitas POS • Servidor Local
              </span>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
