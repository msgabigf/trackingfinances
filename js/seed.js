// Default categories and plan created on first use. Everything here is
// editable later in Plano; ids are random, so renaming never breaks entries.

import { thisMonth } from './core/dates.js';

export function defaultCats(escopo) {
  if (escopo === 'casa') {
    return [
      // fixed (the monthly bills)
      ['Aluguel', 'fixo', 'home'], ['Condomínio', 'fixo', 'home'], ['Luz', 'fixo', 'bolt'], ['Gás', 'fixo', 'flame'],
      ['Água', 'fixo', 'drop'], ['Internet', 'fixo', 'wifi'], ['Assinaturas da casa', 'fixo', 'play'],
      ['Seguro do carro', 'fixo', 'car'], ['IPVA', 'fixo', 'car'], ['Licenciamento', 'fixo', 'car'], ['Outros fixos', 'fixo', 'dots'],
      // variable (divided by percentages)
      ['Mercado', 'variavel', 'cart', 3800], ['Delivery', 'variavel', 'bag', 800, true], ['Restaurantes', 'variavel', 'fork', 800, true],
      ['Lazer', 'variavel', 'ticket', 800, true], ['Casa', 'variavel', 'sofa', 600], ['Combustível', 'variavel', 'fuel', 1000],
      ['Estacionamento', 'variavel', 'parking', 200], ['Transporte', 'variavel', 'bus', 300],
      ['Imprevistos', 'variavel', 'alert', 1000, false, 'imprevistos'], ['Reserva', 'variavel', 'piggy', 700, false, 'reserva'],
      // imprevistos (draw from the Imprevistos budget, always joint)
      ['Farmácia', 'imprevisto', 'pill'], ['Saúde', 'imprevisto', 'pulse'], ['Conserto do carro', 'imprevisto', 'wrench'],
      ['Conserto da casa', 'imprevisto', 'wrench'], ['Veterinário', 'imprevisto', 'paw'],
    ].map(toCat('casa'));
  }
  return [
    ['Academia', 'fixo', 'dumbbell'], ['Celular', 'fixo', 'phone'], ['Assinaturas', 'fixo', 'play'],
    ['Beleza e cuidados', 'variavel', 'sparkle', 2500, true], ['Roupas', 'variavel', 'shirt', 2000, true],
    ['Lazer pessoal', 'variavel', 'ticket', 2000, true], ['Presentes', 'variavel', 'gift', 1000],
    ['Reserva', 'variavel', 'piggy', 2500, false, 'reserva'],
  ].map(toCat(escopo));
}

function toCat(escopo) {
  return ([nome, grupo, icone, pct, extra, papel], i) => ({
    kind: 'cat', escopo, nome, grupo, icone, ordem: i + 1, extra: !!extra, papel: papel || null, _pct: pct || 0,
  });
}

// cats must already have ids
export function defaultPlano(escopo, cats, mes = thisMonth()) {
  const pcts = {};
  for (const c of cats) if (c._pct) pcts[c.id] = c._pct;
  if (escopo === 'casa') {
    return { kind: 'plano', escopo, mes, valorCasa: 0, investimento: 0, pcts, freelaGuardar: 7000, freelaPessoal: 5000, limiteCasa: 7000, limiteParcelas: 2000, estimativa: true };
  }
  return { kind: 'plano', escopo, mes, investimento: 0, pcts, estimativa: true };
}

export const DEFAULT_PAGTOS = (eu, nomes) => [
  { kind: 'pagto', escopo: 'casa', nome: `Crédito ${nomes.gabi}`, tipo: 'credito', dono: 'gabi' },
  { kind: 'pagto', escopo: 'casa', nome: `Crédito ${nomes.yuri}`, tipo: 'credito', dono: 'yuri' },
  { kind: 'pagto', escopo: 'casa', nome: `Pix ${nomes.gabi}`, tipo: 'pix', dono: 'gabi' },
  { kind: 'pagto', escopo: 'casa', nome: `Pix ${nomes.yuri}`, tipo: 'pix', dono: 'yuri' },
  { kind: 'pagto', escopo: 'casa', nome: 'Débito', tipo: 'debito', dono: eu },
  { kind: 'pagto', escopo: 'casa', nome: 'Dinheiro', tipo: 'dinheiro', dono: eu },
];
