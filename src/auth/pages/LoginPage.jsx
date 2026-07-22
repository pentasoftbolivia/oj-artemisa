import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { useForm } from "@/hooks/useForm";
import {
  startLoginWithEmailPassword,
  startGoogleSignIn,
} from "@/store/auth/thunks";
import { selectUser } from "@/store/auth/authSlice";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initForm = {
  emailText: "",
  passwordText: "",
};

export const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { errorMessage } = useSelector(selectUser);

  const { emailText, passwordText, onInputChange } = useForm(initForm);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const onGoogleLogin = async () => {
    try {
      await dispatch(startGoogleSignIn());
    } catch (error) {
      console.error("Error with Google sign-in:", error);
    }
  };

  const onLogin = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await dispatch(
        startLoginWithEmailPassword({
          email: emailText,
          password: passwordText,
        }),
      );

      if (result.ok) {
        const lastPath = localStorage.getItem("lastPath") || "/";
        navigate(lastPath, { replace: true });
      } else {
        console.error("Login failed:", result.error);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Unexpected error during activosfijos:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              ÓRGANO JUDICIAL - LA PAZ
            </CardTitle>
            <p className="text-center text-base font-semibold text-muted-foreground uppercase tracking-wide">
              ACTIVOS FIJOS
            </p>
            <CardDescription className="text-center">
              Ingrese su correo electrónico y contraseña para iniciar sesión
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form
              onSubmit={onLogin}
              className="space-y-4"
              aria-label="Formulario de inicio de sesión"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="emailText" className="font-medium">
                    Correo electrónico <span className="text-red-500">*</span>
                  </Label>
                </div>
                <Input
                  id="emailText"
                  name="emailText"
                  type="email"
                  placeholder="Correo electrónico"
                  autoComplete="username"
                  value={emailText}
                  onChange={onInputChange}
                  required
                  aria-required="true"
                  aria-invalid={errorMessage ? "true" : "false"}
                  aria-describedby={
                    errorMessage ? "activosfijos-error" : undefined
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="passwordText" className="font-medium">
                    Contraseña <span className="text-red-500">*</span>
                  </Label>
                </div>
                <div className="relative">
                  <Input
                    id="passwordText"
                    name="passwordText"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={passwordText}
                    onChange={onInputChange}
                    required
                    className="pr-10"
                    aria-required="true"
                    aria-invalid={errorMessage ? "true" : "false"}
                    aria-describedby={
                      errorMessage ? "activosfijos-error" : undefined
                    }
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full disabled:opacity-70 flex items-center justify-center gap-2"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                aria-live="polite"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Iniciando sesión...
                  </>
                ) : (
                  "Iniciar sesión"
                )}
              </Button>
              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm"
                  aria-live="assertive"
                >
                  <p className="font-medium">Error al iniciar sesión</p>
                  <p>{errorMessage}</p>
                </div>
              )}
            </form>

            {/* <div className="mt-4 text-center text-sm text-gray-600">
              ¿Olvido su contraseña?{" "}
              <a 
                href="#" 
                className="text-orange-500 hover:text-orange-600 font-medium hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  // Here you can navigate to the password recovery page when it exists
                  // navigate('/recuperar-contraseña');
                }}
              >
                Recuperar contraseña
              </a>
            </div> */}

            <div className="text-xs text-gray-500 mt-2">
              Los campos marcados con <span className="text-red-500">*</span>{" "}
              son obligatorios
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  ó
                </span>
              </div>
            </div>
            <div className="grid grid-cols-0 gap-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={onGoogleLogin}
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continuar con Google
              </Button>
            </div>

            <div className="text-center text-xs text-muted-foreground pt-2">
              Desarrollado por{" "}
              <a
                href="https://auditores-mj.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-orange-500 hover:text-orange-600 hover:underline"
              >
                Auditores MJ
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
