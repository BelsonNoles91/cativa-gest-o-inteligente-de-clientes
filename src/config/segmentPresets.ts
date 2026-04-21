/**
 * Presets de catálogo por segmento.
 * Cada segmento traz uma lista enxuta de categorias e serviços padrão
 * para acelerar o setup inicial. Preços são sugestões em centavos (BRL).
 *
 * Política do produto: nada fiscal. Apenas operacional/comercial.
 */
import type { TenantSegment } from "@/domain/tenant";

export interface PresetService {
  name: string;
  durationMinutes: number;
  bufferAfterMinutes?: number;
  processingMinutes?: number;
  basePriceCents: number;
  idealReturnWindowDays?: number;
  description?: string;
}

export interface PresetCategory {
  name: string;
  color?: string;
  icon?: string;
  services: PresetService[];
}

export interface SegmentPreset {
  segment: TenantSegment;
  label: string;
  categories: PresetCategory[];
}

export const segmentPresets: Record<TenantSegment, SegmentPreset> = {
  salao: {
    segment: "salao",
    label: "Salão de Beleza",
    categories: [
      {
        name: "Cabelo",
        color: "#6E3B5D",
        services: [
          { name: "Corte feminino", durationMinutes: 60, basePriceCents: 12000, idealReturnWindowDays: 45 },
          { name: "Corte masculino", durationMinutes: 30, basePriceCents: 7000, idealReturnWindowDays: 30 },
          { name: "Escova", durationMinutes: 45, basePriceCents: 8000 },
          { name: "Coloração", durationMinutes: 90, processingMinutes: 30, basePriceCents: 22000, idealReturnWindowDays: 40 },
          { name: "Hidratação profunda", durationMinutes: 60, basePriceCents: 9000, idealReturnWindowDays: 21 },
        ],
      },
      {
        name: "Manicure & Pedicure",
        color: "#7FAE9B",
        services: [
          { name: "Manicure", durationMinutes: 45, basePriceCents: 5000, idealReturnWindowDays: 15 },
          { name: "Pedicure", durationMinutes: 60, basePriceCents: 6000, idealReturnWindowDays: 21 },
          { name: "Esmaltação em gel", durationMinutes: 75, basePriceCents: 9000, idealReturnWindowDays: 21 },
        ],
      },
    ],
  },
  clinica_estetica: {
    segment: "clinica_estetica",
    label: "Clínica de Estética",
    categories: [
      {
        name: "Facial",
        color: "#6E3B5D",
        services: [
          { name: "Limpeza de pele profunda", durationMinutes: 90, basePriceCents: 18000, idealReturnWindowDays: 30 },
          { name: "Peeling químico", durationMinutes: 60, basePriceCents: 25000, idealReturnWindowDays: 21 },
          { name: "Microagulhamento", durationMinutes: 75, basePriceCents: 35000, idealReturnWindowDays: 30 },
          { name: "Radiofrequência facial", durationMinutes: 50, basePriceCents: 20000, idealReturnWindowDays: 7 },
        ],
      },
      {
        name: "Corporal",
        color: "#7FAE9B",
        services: [
          { name: "Drenagem linfática", durationMinutes: 60, basePriceCents: 15000, idealReturnWindowDays: 7 },
          { name: "Massagem modeladora", durationMinutes: 60, basePriceCents: 18000, idealReturnWindowDays: 7 },
          { name: "Criolipólise", durationMinutes: 90, basePriceCents: 50000, idealReturnWindowDays: 60 },
        ],
      },
    ],
  },
  lash_brow: {
    segment: "lash_brow",
    label: "Lash & Brow",
    categories: [
      {
        name: "Cílios",
        color: "#6E3B5D",
        services: [
          { name: "Extensão de cílios fio a fio", durationMinutes: 120, basePriceCents: 22000, idealReturnWindowDays: 21 },
          { name: "Manutenção de cílios", durationMinutes: 60, basePriceCents: 12000, idealReturnWindowDays: 21 },
          { name: "Lash lifting", durationMinutes: 60, basePriceCents: 14000, idealReturnWindowDays: 60 },
        ],
      },
      {
        name: "Sobrancelhas",
        color: "#7FAE9B",
        services: [
          { name: "Design de sobrancelha", durationMinutes: 30, basePriceCents: 6000, idealReturnWindowDays: 30 },
          { name: "Henna", durationMinutes: 45, basePriceCents: 8000, idealReturnWindowDays: 30 },
          { name: "Brow lamination", durationMinutes: 60, basePriceCents: 15000, idealReturnWindowDays: 45 },
        ],
      },
    ],
  },
  barbearia: {
    segment: "barbearia",
    label: "Barbearia",
    categories: [
      {
        name: "Cortes & Barba",
        color: "#4B243D",
        services: [
          { name: "Corte clássico", durationMinutes: 30, basePriceCents: 5000, idealReturnWindowDays: 21 },
          { name: "Corte degradê", durationMinutes: 45, basePriceCents: 7000, idealReturnWindowDays: 21 },
          { name: "Barba completa", durationMinutes: 30, basePriceCents: 4500, idealReturnWindowDays: 14 },
          { name: "Combo corte + barba", durationMinutes: 60, basePriceCents: 9000, idealReturnWindowDays: 21 },
        ],
      },
      {
        name: "Tratamentos",
        color: "#7FAE9B",
        services: [
          { name: "Hidratação capilar", durationMinutes: 30, basePriceCents: 5000, idealReturnWindowDays: 30 },
          { name: "Pigmentação de barba", durationMinutes: 45, basePriceCents: 8000, idealReturnWindowDays: 30 },
        ],
      },
    ],
  },
  esmalteria: {
    segment: "esmalteria",
    label: "Esmalteria",
    categories: [
      {
        name: "Mãos",
        color: "#6E3B5D",
        services: [
          { name: "Manicure tradicional", durationMinutes: 45, basePriceCents: 4000, idealReturnWindowDays: 15 },
          { name: "Esmaltação em gel — mãos", durationMinutes: 75, basePriceCents: 9000, idealReturnWindowDays: 21 },
          { name: "Alongamento em fibra", durationMinutes: 120, basePriceCents: 18000, idealReturnWindowDays: 30 },
        ],
      },
      {
        name: "Pés",
        color: "#7FAE9B",
        services: [
          { name: "Pedicure tradicional", durationMinutes: 60, basePriceCents: 5000, idealReturnWindowDays: 21 },
          { name: "Esmaltação em gel — pés", durationMinutes: 75, basePriceCents: 10000, idealReturnWindowDays: 30 },
          { name: "Spa dos pés", durationMinutes: 75, basePriceCents: 12000, idealReturnWindowDays: 21 },
        ],
      },
    ],
  },
  wellness: {
    segment: "wellness",
    label: "Massagem & Wellness",
    categories: [
      {
        name: "Massagens",
        color: "#7FAE9B",
        services: [
          { name: "Massagem relaxante", durationMinutes: 60, basePriceCents: 14000, idealReturnWindowDays: 14 },
          { name: "Massagem terapêutica", durationMinutes: 60, basePriceCents: 16000, idealReturnWindowDays: 7 },
          { name: "Pedras quentes", durationMinutes: 75, basePriceCents: 20000, idealReturnWindowDays: 21 },
          { name: "Shiatsu", durationMinutes: 60, basePriceCents: 18000, idealReturnWindowDays: 14 },
        ],
      },
      {
        name: "Bem-estar",
        color: "#6E3B5D",
        services: [
          { name: "Reflexologia podal", durationMinutes: 45, basePriceCents: 12000, idealReturnWindowDays: 14 },
          { name: "Aromaterapia", durationMinutes: 60, basePriceCents: 15000, idealReturnWindowDays: 21 },
        ],
      },
    ],
  },
};
