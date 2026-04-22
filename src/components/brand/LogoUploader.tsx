/**
 * LogoUploader — componente reutilizável para upload do logo do tenant.
 *
 * - Aceita PNG/JPG/SVG/WEBP até 2MB.
 * - Sobe para o bucket público `tenant-logos` em `<tenantId>/<timestamp>.<ext>`.
 * - Devolve a URL pública via `onChange`.
 * - Mostra preview e permite remover.
 *
 * Importante: o tenantId é necessário tanto para a RLS do bucket quanto para
 * organizar os arquivos. Em fluxos pré-criação (onboarding), use um id provisório
 * (ver `useDeferredTenantLogo` para uploads adiados).
 */
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

interface LogoUploaderProps {
  /** Pasta de destino (geralmente o tenantId). */
  folder: string;
  /** URL atual (vem do backend). */
  value: string | null;
  onChange: (url: string | null) => void;
  /** Quando true, apenas mostra o preview (sem upload). Útil para etapas pré-tenant. */
  readOnly?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function LogoUploader({
  folder,
  value,
  onChange,
  readOnly = false,
  className,
  size = "md",
}: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const dim =
    size === "sm" ? "h-16 w-16" : size === "lg" ? "h-28 w-28" : "h-20 w-20";

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Imagem muito grande", { description: "Máximo de 2 MB." });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${folder}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("tenant-logos")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("tenant-logos").getPublicUrl(path);
      onChange(pub.publicUrl);
      toast.success("Logo atualizado");
    } catch (err) {
      console.error("[LogoUploader] upload falhou", err);
      toast.error("Não foi possível enviar o logo", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      className={cn("flex items-center gap-3", className)}
      data-testid="logo-uploader"
    >
      <div
        className={cn(
          "relative grid place-items-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted/40",
          dim,
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Logo do estabelecimento"
            className="h-full w-full object-contain"
          />
        ) : (
          <ImagePlus className="h-6 w-6 text-muted-foreground" />
        )}
        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-background/70">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePick}
          disabled={uploading || readOnly}
          data-testid="logo-uploader-pick"
        >
          <UploadCloud className="mr-1.5 h-4 w-4" />
          {value ? "Trocar logo" : "Enviar logo"}
        </Button>
        {value && !readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            className="text-destructive hover:text-destructive"
            data-testid="logo-uploader-remove"
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Remover
          </Button>
        )}
        <p className="text-[11px] text-muted-foreground">
          PNG, JPG, SVG ou WebP. Máx 2 MB.
        </p>
      </div>
    </div>
  );
}
