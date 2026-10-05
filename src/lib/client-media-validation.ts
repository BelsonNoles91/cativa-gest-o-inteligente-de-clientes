export const CLIENT_FILE_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export const CLIENT_PHOTO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export const TENANT_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const TENANT_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const CLIENT_FILE_ACCEPT = CLIENT_FILE_MIME_TYPES.join(",");
export const CLIENT_PHOTO_ACCEPT = CLIENT_PHOTO_MIME_TYPES.join(",");

type HeaderReadableFile = Pick<File, "type" | "slice">;
type LogoReadableFile = HeaderReadableFile & Pick<File, "size">;

function normalizedMimeType(file: Pick<File, "type">): string {
  return file.type.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function validateClientFileType(file: Pick<File, "type">): string | null {
  return CLIENT_FILE_MIME_TYPES.includes(
    normalizedMimeType(file) as (typeof CLIENT_FILE_MIME_TYPES)[number],
  )
    ? null
    : "Formato de arquivo não permitido. Use PDF, texto, CSV, Office ou imagem compatível.";
}

export function validateClientPhotoType(file: Pick<File, "type">): string | null {
  return CLIENT_PHOTO_MIME_TYPES.includes(
    normalizedMimeType(file) as (typeof CLIENT_PHOTO_MIME_TYPES)[number],
  )
    ? null
    : "Formato de foto não permitido. Use PNG, JPG, WebP, GIF ou AVIF.";
}

export function validateTenantLogoFile(file: Pick<File, "type" | "size">): string | null {
  if (
    !TENANT_LOGO_MIME_TYPES.includes(
      normalizedMimeType(file) as (typeof TENANT_LOGO_MIME_TYPES)[number],
    )
  ) {
    return "Formato de logo não permitido. Use PNG, JPG ou WebP.";
  }
  if (file.size > TENANT_LOGO_MAX_BYTES) {
    return "Imagem muito grande. O tamanho máximo é 2 MiB.";
  }
  return null;
}

export async function validateClientFileContent(file: HeaderReadableFile): Promise<string | null> {
  const typeError = validateClientFileType(file);
  if (typeError) return typeError;
  return validateDeclaredContent(file);
}

export async function validateClientPhotoContent(file: HeaderReadableFile): Promise<string | null> {
  const typeError = validateClientPhotoType(file);
  if (typeError) return typeError;
  return validateDeclaredContent(file);
}

export async function validateTenantLogoFileContent(file: LogoReadableFile): Promise<string | null> {
  const typeError = validateTenantLogoFile(file);
  if (typeError) return typeError;
  return validateDeclaredContent(file);
}

async function validateDeclaredContent(file: HeaderReadableFile): Promise<string | null> {
  const type = normalizedMimeType(file);
  const header = new Uint8Array(await readBlobBytes(file.slice(0, 4_096)));
  const isValid = (() => {
    switch (type) {
      case "application/pdf":
        return startsWithAscii(header, "%PDF-");
      case "application/msword":
      case "application/vnd.ms-excel":
      case "application/vnd.ms-powerpoint":
        return startsWithBytes(header, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        return startsWithBytes(header, [0x50, 0x4b, 0x03, 0x04]);
      case "image/png":
        return startsWithBytes(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      case "image/jpeg":
        return startsWithBytes(header, [0xff, 0xd8, 0xff]);
      case "image/gif":
        return startsWithAscii(header, "GIF87a") || startsWithAscii(header, "GIF89a");
      case "image/webp":
        return startsWithAscii(header, "RIFF") && startsWithAscii(header.slice(8), "WEBP");
      case "image/avif":
        return header.length >= 12 && startsWithAscii(header.slice(4), "ftyp") &&
          ["avif", "avis"].includes(new TextDecoder().decode(header.slice(8, 12)));
      case "text/plain":
      case "text/csv":
        return looksLikeUtf8Text(header);
      default:
        return false;
    }
  })();

  return isValid ? null : "O conteúdo do arquivo não corresponde ao formato declarado.";
}

function readBlobBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new TypeError("Não foi possível ler o conteúdo do arquivo."));
    };
    reader.onerror = () => reject(reader.error ?? new TypeError("Não foi possível ler o conteúdo do arquivo."));
    reader.readAsArrayBuffer(blob);
  });
}

function startsWithAscii(bytes: Uint8Array, prefix: string): boolean {
  if (bytes.length < prefix.length) return false;
  return [...prefix].every((character, index) => bytes[index] === character.charCodeAt(0));
}

function startsWithBytes(bytes: Uint8Array, prefix: number[]): boolean {
  return bytes.length >= prefix.length && prefix.every((byte, index) => bytes[index] === byte);
}

function looksLikeUtf8Text(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  if (startsWithBytes(bytes, [0xff, 0xfe]) || startsWithBytes(bytes, [0xfe, 0xff])) {
    const encoding = bytes[0] === 0xff ? "utf-16le" : "utf-16be";
    for (let end = bytes.length; end >= bytes.length - 1; end -= 1) {
      try {
        new TextDecoder(encoding, { fatal: true }).decode(bytes.slice(2, end));
        return true;
      } catch {
        // A 4 KiB header may end in the middle of a UTF-16 code unit.
      }
    }
    return false;
  }

  if (bytes.includes(0)) return false;
  for (let end = bytes.length; end >= Math.max(1, bytes.length - 3); end -= 1) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(0, end));
      return true;
    } catch {
      // Ignore only a trailing partial code point at the header boundary.
    }
  }
  return false;
}
