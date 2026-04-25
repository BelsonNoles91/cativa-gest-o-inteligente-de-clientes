import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-6 grid h-24 w-24 place-items-center rounded-3xl bg-muted/50 text-muted-foreground">
        <Home className="h-10 w-10" />
      </div>
      
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Página não encontrada</h1>
      <p className="mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
        O endereço que você tentou acessar não existe ou foi movido para um novo local.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button 
          variant="outline" 
          className="h-12 rounded-xl px-8"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <Button 
          className="h-12 rounded-xl bg-gradient-brand px-8"
          onClick={() => navigate("/")}
        >
          Ir para o Início
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
