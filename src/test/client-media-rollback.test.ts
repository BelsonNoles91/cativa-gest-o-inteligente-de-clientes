import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { dbFromMock, storageFromMock, uploadMock, removeMock, insertMock, selectMock, singleMock } =
  vi.hoisted(() => ({
    dbFromMock: vi.fn(),
    storageFromMock: vi.fn(),
    uploadMock: vi.fn(),
    removeMock: vi.fn(),
    insertMock: vi.fn(),
    selectMock: vi.fn(),
    singleMock: vi.fn(),
  }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: dbFromMock,
    storage: { from: storageFromMock },
  },
}));

import { uploadClientFile, uploadClientPhoto } from "@/repositories/clients";

describe("uploadClientFile compensação de falhas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "00000000-0000-4000-8000-000000000001") });

    dbFromMock.mockReturnValue({ insert: insertMock });
    insertMock.mockReturnValue({ select: selectMock });
    selectMock.mockReturnValue({ single: singleMock });
    storageFromMock.mockReturnValue({ upload: uploadMock, remove: removeMock });
    uploadMock.mockResolvedValue({ error: null });
    removeMock.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const makeInput = () => ({
    tenantId: "tenant-a",
    clientId: "client-a",
    uploadedBy: "staff-a",
    file: new File(["conteúdo sintético"], "anamnese.txt", { type: "text/plain" }),
    description: "Fixture local",
  });

  it("remove do Storage o objeto quando o registro do anexo não é salvo", async () => {
    const databaseError = { message: "insert recusado" };
    singleMock.mockResolvedValue({ data: null, error: databaseError });

    await expect(uploadClientFile(makeInput())).rejects.toBe(databaseError);

    expect(dbFromMock).toHaveBeenCalledWith("client_files");
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledWith([
      "tenant-a/client-a/00000000-0000-4000-8000-000000000001-anamnese.txt",
    ]);
  });

  it("preserva os dois erros quando a gravação e a limpeza falham", async () => {
    const databaseError = new Error("insert recusado");
    const storageCleanupError = new Error("remoção indisponível");
    singleMock.mockResolvedValue({ data: null, error: databaseError });
    removeMock.mockResolvedValue({ data: null, error: storageCleanupError });

    const upload = uploadClientFile(makeInput());
    await expect(upload).rejects.toMatchObject({
      name: "ClientFileUploadRollbackError",
      errors: [databaseError, storageCleanupError],
    });
    await expect(upload).rejects.toThrow(/limpeza automática também falhou/i);
    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it("preserva a falha de rede durante a limpeza como segunda causa", async () => {
    const databaseError = new Error("insert recusado");
    const networkError = new Error("rede interrompida ao remover");
    singleMock.mockResolvedValue({ data: null, error: databaseError });
    removeMock.mockRejectedValue(networkError);

    await expect(uploadClientFile(makeInput())).rejects.toMatchObject({
      name: "ClientFileUploadRollbackError",
      errors: [databaseError, networkError],
    });
    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it("não tenta apagar nem gravar metadados se o upload inicial falhar", async () => {
    const storageUploadError = new Error("upload recusado");
    uploadMock.mockResolvedValue({ error: storageUploadError });

    await expect(uploadClientFile(makeInput())).rejects.toBe(storageUploadError);

    expect(dbFromMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("bloqueia anexos HTML antes de tocar no Storage ou no banco", async () => {
    await expect(
      uploadClientFile({
        ...makeInput(),
        file: new File(["<script>alert(1)</script>"], "anexo.html", { type: "text/html" }),
      }),
    ).rejects.toThrow(/formato de arquivo não permitido/i);

    expect(uploadMock).not.toHaveBeenCalled();
    expect(dbFromMock).not.toHaveBeenCalled();
  });

  it("bloqueia foto SVG ativa antes do upload", async () => {
    await expect(
      uploadClientPhoto({
        tenantId: "tenant-a",
        clientId: "client-a",
        uploadedBy: "staff-a",
        file: new File(["<svg><script>alert(1)</script></svg>"], "foto.svg", { type: "image/svg+xml" }),
      }),
    ).rejects.toThrow(/formato de foto não permitido/i);

    expect(uploadMock).not.toHaveBeenCalled();
    expect(dbFromMock).not.toHaveBeenCalled();
  });
});
