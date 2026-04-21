/**
 * Camada de REPOSITORIES.
 *
 * Acesso a dados (CRUD) abstraído. Cada repository expõe uma interface
 * (ex.: ClientsRepository) com implementações trocáveis (Supabase,
 * REST, mock para testes). Services consomem a interface, nunca a
 * implementação concreta. Isso garante portabilidade do código quando
 * o backend mudar (Lovable Cloud → VPS, por exemplo).
 */
export {};
