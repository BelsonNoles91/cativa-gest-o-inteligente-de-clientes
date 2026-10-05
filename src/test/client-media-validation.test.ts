import { describe, expect, it } from "vitest";
import {
  CLIENT_FILE_ACCEPT,
  CLIENT_PHOTO_ACCEPT,
  TENANT_LOGO_MAX_BYTES,
  validateClientFileContent,
  validateClientFileType,
  validateClientPhotoContent,
  validateClientPhotoType,
  validateTenantLogoFileContent,
  validateTenantLogoFile,
} from "@/lib/client-media-validation";

function fileWithHeader(type: string, bytes: number[], size = bytes.length) {
  const content = new Uint8Array(bytes);
  return {
    type,
    size,
    slice: (start: number, end: number) => new Blob([content.slice(start, end)]),
  };
}

describe("validação de tipos de mídia do CRM", () => {
  it.each(["application/pdf", "text/plain;charset=utf-8", "image/jpeg", "image/avif"])(
    "aceita tipo permitido %s",
    (type) => {
      expect(validateClientFileType({ type })).toBeNull();
    },
  );

  it.each(["text/html", "image/svg+xml", "application/javascript", "application/octet-stream", ""])(
    "rejeita tipo perigoso ou desconhecido %s",
    (type) => {
      expect(validateClientFileType({ type })).not.toBeNull();
    },
  );

  it("separa formatos de foto dos formatos de documentos", () => {
    expect(validateClientPhotoType({ type: "image/webp" })).toBeNull();
    expect(validateClientPhotoType({ type: "application/pdf" })).toMatch(/foto/i);
    expect(CLIENT_FILE_ACCEPT).toContain("application/pdf");
    expect(CLIENT_PHOTO_ACCEPT).not.toContain("application/pdf");
  });

  it("restringe logos a formatos seguros e tamanho máximo de 2 MiB", () => {
    expect(validateTenantLogoFile({ type: "image/webp", size: TENANT_LOGO_MAX_BYTES })).toBeNull();
    expect(validateTenantLogoFile({ type: "image/svg+xml", size: 1 })).toMatch(/png, jpg ou webp/i);
    expect(validateTenantLogoFile({ type: "image/png", size: TENANT_LOGO_MAX_BYTES + 1 })).toMatch(/2 mib/i);
  });

  it.each([
    ["application/pdf", [...new TextEncoder().encode("%PDF-1.7\n")]],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ["image/jpeg", [0xff, 0xd8, 0xff, 0xd9]],
    ["image/gif", [...new TextEncoder().encode("GIF89a")]],
    ["image/webp", [...new TextEncoder().encode("RIFF0000WEBP")]],
    ["image/avif", [...new TextEncoder().encode("0000ftypavif")]],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", [0x50, 0x4b, 0x03, 0x04]],
    ["application/msword", [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
    ["text/csv", [...new TextEncoder().encode("nome,valor\nAna,10\n")]],
  ])("aceita assinatura compatível com %s", async (type, bytes) => {
    expect(await validateClientFileContent(fileWithHeader(type, bytes))).toBeNull();
  });

  it.each([
    ["application/pdf", [...new TextEncoder().encode("<html>conteúdo falso</html>")]],
    ["image/png", [...new TextEncoder().encode("não é uma imagem")]],
    ["text/plain", [0x00, 0x01, 0x02, 0x03]],
  ])("recusa conteúdo que tenta se passar por %s", async (type, bytes) => {
    expect(await validateClientFileContent(fileWithHeader(type, bytes))).toMatch(/não corresponde/i);
  });

  it("reutiliza a checagem de assinatura em fotos e logos antes do upload", async () => {
    expect(await validateClientPhotoContent(fileWithHeader("image/jpeg", [0x00, 0x01]))).toMatch(/não corresponde/i);
    expect(await validateTenantLogoFileContent(fileWithHeader("image/png", [0x89, 0x50, 0x4e, 0x47]))).toMatch(
      /não corresponde/i,
    );
    expect(
      await validateTenantLogoFileContent(
        fileWithHeader("image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], TENANT_LOGO_MAX_BYTES + 1),
      ),
    ).toMatch(/2 mib/i);
  });
});
