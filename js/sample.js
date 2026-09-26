// "Carregar exemplo": three fictional months so every screen has something to
// show (split changing with income, a parceled TV, a freela, emergencies...).
// All values are made up. Every record gets exemplo: true and "Apagar exemplo"
// removes exactly those.

import { addMonths, dateIn, dayOf, today, monthOf } from './core/dates.js';
import { separarFreela, outra, index, planoCasa, sugerirImprevisto } from './core/calc.js';

export function buildSample({ eu, newId, cats, pagtos }) {
  const hoje = today();
  const m2 = monthOf(hoje);
  const m1 = addMonths(m2, -1);
  const m0 = addMonths(m2, -2);
  const hojeDia = dayOf(hoje);
  const ele = outra(eu);
  const out = [];
  const add = (r) => { const x = { id: newId(), ...r }; out.push(x); return x; };

  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const around = (v, spread = 0.25) => Math.round((v * (1 - spread + rnd() * 2 * spread)) / 10) * 10;

  const cat = (escopo, nome) => cats.find(c => c.escopo === escopo && c.nome === nome)?.id || null;
  const pgNome = { gabi: pagtos.find(p => p.dono === 'gabi' && p.tipo === 'credito')?.id, yuri: pagtos.find(p => p.dono === 'yuri' && p.tipo === 'credito')?.id };
  const pix = { gabi: pagtos.find(p => p.dono === 'gabi' && p.tipo === 'pix')?.id, yuri: pagtos.find(p => p.dono === 'yuri' && p.tipo === 'pix')?.id };

  // ---- incomes (Renda base) and plan
  add({ kind: 'base', escopo: 'casa', pessoa: 'gabi', mes: m0, valor: 700000 });
  add({ kind: 'base', escopo: 'casa', pessoa: 'yuri', mes: m0, valor: 500000 });
  add({ kind: 'base', escopo: 'casa', pessoa: 'yuri', mes: m2, valor: 550000 });

  const pctsCasa = {};
  for (const [n, v] of [['Mercado', 3800], ['Delivery', 800], ['Restaurantes', 800], ['Lazer', 800], ['Casa', 600], ['Combustível', 1000], ['Estacionamento', 200], ['Transporte', 300], ['Imprevistos', 1000], ['Reserva', 700]]) {
    const id = cat('casa', n); if (id) pctsCasa[id] = v;
  }
  add({ kind: 'plano', escopo: 'casa', mes: m0, valorCasa: 840000, investimento: 50000, pcts: pctsCasa, freelaGuardar: 7000, freelaPessoal: 5000, limiteCasa: 7000, limiteParcelas: 2000 });
  add({ kind: 'plano', escopo: 'casa', mes: m2, valorCasa: 840000, investimento: 50000, pcts: pctsCasa, freelaGuardar: 7000, freelaPessoal: 5000, limiteCasa: 7000, limiteParcelas: 2000 });
  const pctsEu = {};
  for (const [n, v] of [['Beleza e cuidados', 2500], ['Roupas', 2000], ['Lazer pessoal', 2000], ['Presentes', 1000], ['Reserva', 2500]]) {
    const id = cat(eu, n); if (id) pctsEu[id] = v;
  }
  add({ kind: 'plano', escopo: eu, mes: m0, investimento: 40000, pcts: pctsEu });
  add({ kind: 'plano', escopo: eu, mes: m2, investimento: 40000, pcts: pctsEu });

  // ---- fixed costs
  const fixo = (escopo, nome, catNome, valor, dia, extra = {}) =>
    add({ kind: 'fixo', escopo, nome, catId: cat(escopo, catNome), valorPrevisto: valor, diaVenc: dia, desde: m0, ...extra });
  const fx = {
    aluguel: fixo('casa', 'Aluguel', 'Aluguel', 180000, 5),
    cond: fixo('casa', 'Condomínio', 'Condomínio', 65000, 10),
    luz: fixo('casa', 'Luz', 'Luz', 22000, 15),
    gas: fixo('casa', 'Gás', 'Gás', 9000, 20),
    agua: fixo('casa', 'Água', 'Água', 11000, 18),
    net: fixo('casa', 'Internet', 'Internet', 12000, 12),
    stream: fixo('casa', 'Streaming', 'Assinaturas da casa', 5500, 8),
    seguro: fixo('casa', 'Seguro do carro', 'Seguro do carro', 240000, 10, { anual: true, mesVenc: 8 }),
    ipva: fixo('casa', 'IPVA', 'IPVA', 180000, 20, { anual: true, mesVenc: 3 }),
  };
  const meuFx = {
    academia: fixo(eu, 'Academia', 'Academia', 14000, 5),
    celular: fixo(eu, 'Celular', 'Celular', 6000, 12),
  };

  // who usually pays each bill
  const payer = { aluguel: 'yuri', cond: 'yuri', luz: 'gabi', gas: 'yuri', agua: 'yuri', net: 'gabi', stream: 'gabi' };
  const realLuz = { [m0]: 21300, [m1]: 23800, [m2]: 29800 };
  for (const mes of [m0, m1, m2]) {
    for (const [k, f] of Object.entries(fx)) {
      if (f.anual) continue;
      if (mes === m2 && f.diaVenc > hojeDia) continue;
      const valor = k === 'luz' ? realLuz[mes] : k === 'agua' || k === 'gas' ? around(f.valorPrevisto, 0.1) : f.valorPrevisto;
      add({ kind: 'lanc', escopo: 'casa', tipo: 'fixa', fixoId: f.id, catId: f.catId, valor, data: dateIn(mes, f.diaVenc), pagoPor: payer[k], pagto: pix[payer[k]] });
    }
    for (const f of Object.values(meuFx)) {
      if (mes === m2 && f.diaVenc > hojeDia) continue;
      add({ kind: 'lanc', escopo: eu, tipo: 'fixa', fixoId: f.id, catId: f.catId, valor: f.valorPrevisto, data: dateIn(mes, f.diaVenc), pagto: pgNome[eu] });
    }
  }

  // ---- everyday joint spending
  const gasto = (mes, dia, catNome, valor, quem, obs = '') => {
    if (mes === m2 && dia > hojeDia) return null;
    return add({ kind: 'lanc', escopo: 'casa', tipo: 'gasto', catId: cat('casa', catNome), valor, data: dateIn(mes, dia), pagoPor: quem, pagto: rnd() > 0.4 ? pgNome[quem] : pix[quem], obs });
  };
  for (const mes of [m0, m1, m2]) {
    [3, 9, 15, 22, 28].forEach((d, i) => gasto(mes, d, 'Mercado', around(23000), i % 2 ? 'yuri' : 'gabi'));
    [6, 13, 20, 27].forEach((d, i) => gasto(mes, d, 'Delivery', around(6000), i % 2 ? 'gabi' : 'yuri'));
    [11, 25].forEach((d, i) => gasto(mes, d, 'Restaurantes', around(12000), i ? 'yuri' : 'gabi'));
    [7, 21].forEach((d, i) => gasto(mes, d, 'Lazer', around(12000), i ? 'gabi' : 'yuri', i ? 'Cinema' : 'Show'));
    [8, 23].forEach((d, i) => gasto(mes, d, 'Combustível', around(15000, 0.1), i ? 'yuri' : 'gabi'));
    gasto(mes, 17, 'Casa', around(9000), 'gabi', 'Coisas de casa');
    gasto(mes, 19, 'Estacionamento', around(3000), 'yuri');
  }
  // last month: pharmacy over the Imprevistos budget, covered by remanejamento from Delivery/Lazer
  gasto(m1, 14, 'Farmácia', 38000, 'yuri');
  gasto(m1, 26, 'Veterinário', 30000, 'gabi');
  // this month: a car repair bigger than everything (to show "De onde tirar?")
  gasto(m2, Math.min(hojeDia, 2), 'Conserto do carro', 145000, 'gabi', 'Embreagem');

  // ---- a parceled TV on Gabi's card, 6x, started two months ago
  add({ kind: 'parc', escopo: 'casa', tipo: 'gasto', valorTotal: 240000, n: 6, data: dateIn(m0, 16), catId: cat('casa', 'Casa'), pagoPor: 'gabi', pagto: pgNome.gabi, obs: 'TV da sala' });

  // ---- metas
  const viagem = add({ kind: 'meta', escopo: 'casa', nome: 'Viagem 2026', frase: 'Explorar novos lugares, juntos.', icone: 'plane', alvo: 1200000, prazo: `${m2.slice(0, 4)}-12`, aporteMensal: 60000, desde: m0 });
  const emerg = add({ kind: 'meta', escopo: 'casa', nome: 'Reserva de emergência', frase: 'Seis meses de tranquilidade.', icone: 'piggy', alvo: 3000000, aporteMensal: 0, desde: m0 });
  const curso = add({ kind: 'meta', escopo: eu, nome: 'Curso', frase: 'Investir em mim.', icone: 'book', alvo: 300000, prazo: addMonths(m2, 8), aporteMensal: 20000, desde: m0 });
  add({ kind: 'lanc', escopo: 'casa', tipo: 'aporte', metaId: viagem.id, valor: 300000, data: dateIn(m0, 2), pagoPor: 'gabi', obs: 'Começo da viagem' });
  for (const mes of [m0, m1, m2]) {
    add({ kind: 'lanc', escopo: 'casa', tipo: 'aporte', metaId: viagem.id, valor: 60000, data: dateIn(mes, 1), pagoPor: mes === m1 ? 'yuri' : 'gabi' });
    add({ kind: 'lanc', escopo: 'casa', tipo: 'invest', valor: 50000, data: dateIn(mes, 1), pagoPor: mes === m1 ? 'gabi' : 'yuri', obs: 'Tesouro Selic' });
    add({ kind: 'lanc', escopo: eu, tipo: 'aporte', metaId: curso.id, valor: 20000, data: dateIn(mes, 1) });
    add({ kind: 'lanc', escopo: eu, tipo: 'invest', valor: 40000, data: dateIn(mes, 1), obs: 'CDB' });
  }

  // ---- incomes received
  for (const mes of [m0, m1, m2]) {
    add({ kind: 'renda', escopo: 'casa', pessoa: 'gabi', tipo: 'base', valor: 700000, data: dateIn(mes, 1) });
    if (mes !== m2 || hojeDia >= 5) add({ kind: 'renda', escopo: 'casa', pessoa: 'yuri', tipo: 'base', valor: mes === m2 ? 550000 : 500000, data: dateIn(mes, 5) });
  }
  // a freela already separated last month (by the other person: only the joint part shows)
  const freelaEle = separarFreela(150000, { freelaGuardar: 7000, freelaPessoal: 5000 });
  add({ kind: 'renda', escopo: 'casa', pessoa: ele, tipo: 'freela', valor: 150000, data: dateIn(m1, 18), separado: true, curtir: freelaEle.curtir });
  add({ kind: 'lanc', escopo: 'casa', tipo: 'aporte', metaId: emerg.id, valor: freelaEle.conjunto, data: dateIn(m1, 18), pagoPor: ele, voluntario: true, obs: 'Parte do freela' });
  // my freela this month, waiting for "Separar agora?"
  add({ kind: 'renda', escopo: 'casa', pessoa: eu, tipo: 'freela', valor: 80000, data: dateIn(m2, Math.min(hojeDia, 3)), separado: false });

  // ---- an acerto last month
  add({ kind: 'acerto', escopo: 'casa', de: 'yuri', para: 'gabi', valor: 30000, data: dateIn(m1, 28), obs: 'Acerto do mês' });

  // ---- my own spending
  const meu = (mes, dia, catNome, valor, obs = '') => {
    if (mes === m2 && dia > hojeDia) return;
    add({ kind: 'lanc', escopo: eu, tipo: 'gasto', catId: cat(eu, catNome), valor, data: dateIn(mes, dia), pagto: pgNome[eu], obs });
  };
  for (const mes of [m0, m1, m2]) {
    meu(mes, 10, 'Beleza e cuidados', around(eu === 'gabi' ? 22000 : 8000));
    meu(mes, 16, 'Roupas', around(15000, 0.5));
    meu(mes, 24, 'Lazer pessoal', around(9000));
  }
  meu(m1, 20, 'Presentes', 12000, 'Aniversário');

  // ---- pendentes (quick captures waiting for a category)
  add({ kind: 'lanc', escopo: eu, pendente: true, valor: 1850, texto: 'Padaria', data: hoje, origem: 'app' });
  add({ kind: 'lanc', escopo: eu, pendente: true, valor: 4290, texto: 'Drogasil', data: hoje, origem: 'applepay' });

  // last month's emergencies were covered the way the app suggests
  const ixPrev = index([...cats, ...out]);
  const sug = sugerirImprevisto(ixPrev, planoCasa(ixPrev, m1));
  if (sug) {
    for (const r of sug.remanejes) add({ kind: 'remanej', escopo: 'casa', mes: m1, de: r.de, para: sug.para, valor: r.valor, motivo: 'Farmácia e veterinário' });
    if (sug.aporte) for (const p of ['gabi', 'yuri']) if (sug.aporte[p]) add({ kind: 'aporteExtra', escopo: 'casa', mes: m1, pessoa: p, valor: sug.aporte[p], motivo: 'Farmácia e veterinário' });
  }

  return out;
}
