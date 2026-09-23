/**
 * PublicLinkShareCard — divulgação do link único do estabelecimento.
 * Copiar, compartilhar (nativo, WhatsApp, Facebook, X, Telegram, e-mail) e
 * QR code gerado localmente, com download em alta resolução para impressão.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Copy,
  Download,
  ExternalLink,
  Facebook,
  Mail,
  MessageCircle,
  QrCode,
  Send,
  Share2,
  Twitter,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export interface PublicLinkShareCardProps {
  link: string;
  slug: string;
  tenantName: string;
  published: boolean;
  onPublishedChange: (value: boolean) => void;
}

export function buildShareText(tenantName: string, link: string): string {
  return `Agende seu horário na ${tenantName}: ${link}`;
}

export function buildShareTargets(tenantName: string, link: string) {
  const text = buildShareText(tenantName, link);
  const encodedText = encodeURIComponent(text);
  const encodedLink = encodeURIComponent(link);
  return [
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, url: `https://wa.me/?text=${encodedText}` },
    {
      key: "facebook",
      label: "Facebook",
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`,
    },
    {
      key: "x",
      label: "X",
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodedText}`,
    },
    {
      key: "telegram",
      label: "Telegram",
      icon: Send,
      url: `https://t.me/share/url?url=${encodedLink}&text=${encodeURIComponent(
        `Agende seu horário na ${tenantName}`,
      )}`,
    },
    {
      key: "email",
      label: "E-mail",
      icon: Mail,
      url: `mailto:?subject=${encodeURIComponent(`Agende na ${tenantName}`)}&body=${encodedText}`,
    },
  ];
}

export function PublicLinkShareCard({
  link,
  slug,
  tenantName,
  published,
  onPublishedChange,
}: PublicLinkShareCardProps) {
  const [showQr, setShowQr] = useState(false);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const downloadRef = useRef<HTMLAnchorElement | null>(null);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const targets = buildShareTargets(tenantName, link);

  useEffect(() => {
    if (!showQr || !link) return;
    let alive = true;
    void QRCode.toDataURL(link, { width: 320, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (alive) setQrPreview(url);
      })
      .catch(() => {
        if (alive) setQrPreview(null);
      });
    return () => {
      alive = false;
    };
  }, [link, showQr]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }, [link]);

  const shareNative = useCallback(async () => {
    try {
      await navigator.share({
        title: tenantName,
        text: `Agende seu horário na ${tenantName}`,
        url: link,
      });
    } catch {
      /* usuário cancelou o compartilhamento */
    }
  }, [link, tenantName]);

  const downloadQr = useCallback(async () => {
    try {
      // 1024px com margem maior: qualidade suficiente para cartaz e cardápio impresso.
      const dataUrl = await QRCode.toDataURL(link, { width: 1024, margin: 2, errorCorrectionLevel: "H" });
      const anchor = downloadRef.current;
      if (!anchor) return;
      anchor.href = dataUrl;
      anchor.download = `qrcode-${slug || "estabelecimento"}.png`;
      anchor.click();
      toast.success("QR code baixado em alta resolução");
    } catch {
      toast.error("Não foi possível gerar o QR code");
    }
  }, [link, slug]);

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Link único de divulgação</h3>
          <p className="text-sm text-muted-foreground">
            Compartilhe nas redes sociais, no perfil do Instagram, em campanhas e em materiais impressos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={published} onCheckedChange={onPublishedChange} aria-label="Publicar página" />
          <span className="text-sm">{published ? "No ar" : "Desligada"}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={link} className="rounded-2xl" aria-label="Endereço do link público" />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-[44px] rounded-2xl" onClick={() => void copyLink()}>
            <Copy className="mr-2 h-4 w-4" /> Copiar
          </Button>
          {canNativeShare ? (
            <Button variant="outline" className="min-h-[44px] rounded-2xl" onClick={() => void shareNative()}>
              <Share2 className="mr-2 h-4 w-4" /> Compartilhar
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="min-h-[44px] rounded-2xl"
            onClick={() => setShowQr((value) => !value)}
            aria-expanded={showQr}
          >
            <QrCode className="mr-2 h-4 w-4" /> QR code
          </Button>
          <Button asChild variant="outline" className="min-h-[44px] rounded-2xl">
            <a href={link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Ver página
            </a>
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Compartilhar em</p>
        <div className="flex flex-wrap gap-2">
          {targets.map((target) => (
            <Button
              key={target.key}
              asChild
              variant="secondary"
              className="min-h-[44px] rounded-2xl"
            >
              <a href={target.url} target="_blank" rel="noopener noreferrer">
                <target.icon className="mr-2 h-4 w-4" /> {target.label}
              </a>
            </Button>
          ))}
        </div>
        {!published ? (
          <p className="text-sm text-muted-foreground">
            A página está desligada: quem abrir o link ainda não verá seus serviços.
          </p>
        ) : null}
      </div>

      {showQr ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-muted/30 p-4">
          {qrPreview ? (
            <img
              src={qrPreview}
              alt={`QR code do link público de ${tenantName}`}
              className="h-[260px] w-[260px] rounded-2xl bg-white p-2"
            />
          ) : (
            <div className="h-[260px] w-[260px] animate-pulse rounded-2xl bg-muted" />
          )}
          <p className="text-center text-sm text-muted-foreground">
            Aponte a câmera do celular para abrir a página de agendamento.
          </p>
          <Button variant="outline" className="min-h-[44px] rounded-2xl" onClick={() => void downloadQr()}>
            <Download className="mr-2 h-4 w-4" /> Baixar para impressão (1024px)
          </Button>
          <a ref={downloadRef} className="hidden" aria-hidden href="#">
            download
          </a>
        </div>
      ) : null}
    </Card>
  );
}
