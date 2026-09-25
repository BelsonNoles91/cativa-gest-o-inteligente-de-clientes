/**
 * UserMenu — perfil + signOut real + Notificações.
 */
import { LogOut, Settings, User, Bell, BellOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { roleLabels } from "@/domain/roles";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { usePushNotifications } from "@/features/notifications/usePushNotifications";
import { useIsMobile } from "@/hooks/use-mobile";


export function UserMenu() {
  const navigate = useNavigate();
  const { currentRole, isSuperAdmin, currentTenant } = useTenant();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const {
    state: pushStatus,
    busy: pushBusy,
    enable: enablePush,
  } = usePushNotifications(currentTenant?.id);

  const requestPush = async () => {
    const result = await enablePush();
    if (result.ok) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const initials = (user?.user_metadata?.full_name as string | undefined)
    ?.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()
    ?? user?.email?.[0]?.toUpperCase()
    ?? "C";

  // Super admin sempre é exibido como tal, mesmo que tenha membership como owner.
  const role = isSuperAdmin ? "super_admin" : currentRole;


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
          <Avatar className="h-9 w-9 border border-border/60">
            <AvatarFallback className="bg-gradient-brand text-primary-foreground text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium truncate">{user?.email ?? "Minha conta"}</span>
          {role && <span className="text-xs text-muted-foreground">{roleLabels[role]}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {pushStatus === "off" && (
          <DropdownMenuItem
            disabled={pushBusy}
            onSelect={() => void requestPush()}
            className="gap-2"
          >
            <Bell className="h-4 w-4" /> Ativar notificações push
          </DropdownMenuItem>
        )}
        {pushStatus === "on" && (
          <DropdownMenuItem disabled className="gap-2 opacity-50">
            <Bell className="h-4 w-4" /> Notificações ativas
          </DropdownMenuItem>
        )}
        {pushStatus === "denied" && (
          <DropdownMenuItem disabled className="gap-2 opacity-50">
            <BellOff className="h-4 w-4" /> Notificações bloqueadas
          </DropdownMenuItem>
        )}
        {pushStatus === "open-in-new-tab" && (
          <DropdownMenuItem disabled className="gap-2 opacity-50">
            <BellOff className="h-4 w-4" /> Abra em uma aba para ativar
          </DropdownMenuItem>
        )}
        {pushStatus === "unsupported" && isMobile && (
          <DropdownMenuItem disabled className="gap-2 opacity-50">
            <BellOff className="h-4 w-4" /> Push não suportado
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => navigate("/app/perfil")} className="gap-2">
          <User className="h-4 w-4" /> Perfil
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/app/configuracoes")} className="gap-2">
          <Settings className="h-4 w-4" /> Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            toast.success("Sessão encerrada");
            navigate("/auth/login");
          }}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
