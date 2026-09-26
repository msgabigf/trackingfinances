// Every screen: a function (ctx, params) -> { html, mount?(root) }.

import * as D from '../data.js';
import * as C from '../core/calc.js';
import { fmtMoney, fmtPct, parseMoney, parsePct, fmtMoneyPlain, TOTAL_BPS } from '../core/money.js';
import { today, thisMonth, monthOf, addMonths, fmtDate, fmtDateShort, fmtMonth, fmtMonthShort, monthLabel, weekday, daysBetween, dayOf, dateIn } from '../core/dates.js';
import { icon } from './icons.js';
import { esc, money, pct, bar, topbar, notice, $, $$ } from './dom.js';
import { barChart } from './chart.js';
import { monthPicker, catRows, waterfall, aindaDaCard, guardadoExtrasCard, saldoResumo, metaCard, catIcon } from './views.js';
import { quickAdd, imprevistoSheet, pagarFixo, recebiSheet, freelaSheet, acertoSheet, metaForm, fixoForm, catForm } from './forms.js';
import { confirmSheet, toast, openSheet, closeSheet } from './overlay.js';
import { buildSample } from '../sample.js';

const nome = (p) => D.nome(p);

// ================================================================ Início

function avisos(ctx) {
  const ix = D.ix();
  const eu = D.eu();
  const mes = thisMonth();
  const out = [];
  const pend = C.pendentes(ix, eu);
  if (pend.length) out.push(notice(`<b>${pend.length} ${pend.length === 1 ? 'pendente' : 'pendentes'}</b> para classificar`, { ic: 'inbox', act: 'go', data: 'data-to="#/pendentes"' }));
  const freelas = C.rendasDoMes(ix, eu, mes).pendentes;
  for (const r of freelas) out.push(notice(`Freela de ${money(r.valor)}: <b>separar agora?</b>`, { ic: 'sprout', kind: 'good', act: 'freela', data: `data-id="${r.id}"` }));
  const casa = C.planoCasa(ix, mes);
  if (casa.overflow > 0) out.push(notice(`Imprevistos passaram ${money(casa.overflow)}. <b>De onde tirar?</b>`, { ic: 'alert', kind: 'warn', act: 'imprevisto', data: `data-mes="${mes}"` }));
  if (!(ix.base || []).length) out.push(notice('Coloquem a <b>renda base</b> de cada um para o app dividir a casa.', { ic: 'coins', act: 'go', data: 'data-to="#/plano"' }));
  else if (!casa.valorCasa) out.push(notice('Definam o <b>valor da casa</b> para montar o plano do mês.', { ic: 'home', act: 'go', data: 'data-to="#/plano"' }));
  const ult = D.settings().ultimaAtividade;
  if (ult && Date.now() - Date.parse(ult) > 3 * 86400000) out.push(notice('Faz 3 dias que você não lança nada. <b>Lançou tudo?</b>', { ic: 'clock', act: 'add' }));
  const velhos = pend.filter(p => daysBetween(p.data, today()) > 2);
  if (velhos.length) out.push(notice(`${velhos.length} pendente(s) com mais de 2 dias.`, { ic: 'inbox', kind: 'warn', act: 'go', data: 'data-to="#/pendentes"' }));
  const hoje = today();
  const vencendo = [];
  for (const p of [casa, C.planoPessoal(ix, eu, mes, casa)]) {
    for (const it of p.fixos.itens) {
      if (it.pago || it.anual) continue;
      const d = dateIn(mes, it.fixo.diaVenc || 1);
      const falta = daysBetween(hoje, d);
      if (falta >= 0 && falta <= 3) vencendo.push(it.fixo.nome);
    }
  }
  if (vencendo.length) out.push(notice(`Vence em breve: <b>${esc(vencendo.join(', '))}</b>`, { ic: 'calendar', act: 'go', data: 'data-to="#/fixos"' }));
  for (const a of casa.avisos) {
    if (a.tipo === 'fixosDescobertos') out.push(notice(`O valor da casa não cobre as contas fixas. Faltam ${money(a.falta)}.`, { ic: 'alert', kind: 'bad', act: 'go', data: 'data-to="#/plano"' }));
  }
  return out;
}

export function inicio(ctx) {
  const tab = ctx.state.tab || 'geral';
  const eu = D.eu();
  const ocultar = D.settings().ocultar;
  const head = `
    <div class="row between" style="margin-top:4px">
      <div class="hello">
        <h1 class="h1">Oi, ${esc(nome(eu))}!</h1>
        <div class="sub">Juntos por mais conquistas ${icon('heart')}</div>
      </div>
      <div class="row" style="gap:0">
        <button class="icon-btn" data-act="ocultar" aria-label="${ocultar ? 'Mostrar valores' : 'Esconder valores'}">${icon(ocultar ? 'eyeoff' : 'eye')}</button>
      </div>
    </div>
    <div class="seg" style="margin-bottom:16px">
      ${[['geral', 'Visão geral'], ['casa', 'Casa'], ['meu', 'Meu mês']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${l}</button>`).join('')}
    </div>`;
  if (tab === 'casa') { const v = planoView(ctx, 'casa'); return { html: head + v.html, mount: v.mount }; }
  if (tab === 'meu') { const v = planoView(ctx, eu); return { html: head + v.html, mount: v.mount }; }

  const ix = D.ix();
  const mes = thisMonth();
  const casa = C.planoCasa(ix, mes);
  const meu = C.planoPessoal(ix, eu, mes, casa);
  const metas = (ix.meta || []).filter(m => !m.arquivada && (m.escopo === 'casa' || m.escopo === eu));
  const proxima = metas.map(m => ({ m, p: C.metaProgresso(ix, m, mes) })).filter(x => x.p.falta > 0).sort((a, b) => (a.m.prazo || '9999') < (b.m.prazo || '9999') ? -1 : 1)[0];
  const gastos = [...C.gastoPorCategoria(ix, 'casa', mes).entries()].sort((a, b) => b[1] - a[1]);
  const totalGasto = gastos.reduce((a, [, v]) => a + v, 0);
  const cm = C.catMap(ix);
  const livreCasa = casa.livre + casa.extras.total;
  const html = `${head}
    <div class="stack">
      ${avisos(ctx).join('')}
      <div class="card summary">
        <div class="head"><span>Ainda dá pra gastar na casa</span>${casa.plano.estimativa ? '<span class="tag warn">estimativa</span>' : `<span class="tag">${esc(fmtMonth(mes, { year: false }))}</span>`}</div>
        <div class="big ${casa.aindaDa < 0 ? 'bad' : ''}">${money(casa.aindaDa)}</div>
        ${bar(casa.spentTotal, livreCasa, { lg: true })}
        <div class="flows">
          <button class="flow" data-act="tab" data-tab="meu" style="background:none;border:0;padding:0;text-align:left">
            <span class="good">${icon('up')}</span><div><div class="l">Meu livre</div><div class="n ${meu.aindaDa < 0 ? 'bad' : ''}">${money(meu.aindaDa)}</div></div>
          </button>
          <button class="flow" data-act="tab" data-tab="casa" style="background:none;border:0;padding:0;text-align:left">
            <span class="bad">${icon('downc')}</span><div><div class="l">Gasto da casa</div><div class="n">${money(casa.spentTotal)}</div></div>
          </button>
        </div>
      </div>
      ${proxima ? metaCard(ix, proxima.m, mes, { compact: true }) : ''}
      <div class="shortcuts">
        <button class="shortcut" data-act="go" data-to="#/fixos"><span class="icirc">${icon('receipt')}</span>Contas</button>
        <button class="shortcut" data-act="go" data-to="#/saldo"><span class="icirc">${icon('scale')}</span>Acertos</button>
        <button class="shortcut" data-act="go" data-to="#/metas"><span class="icirc">${icon('heart')}</span>Metas</button>
        <button class="shortcut" data-act="go" data-to="#/renda"><span class="icirc">${icon('coins')}</span>Recebi</button>
      </div>
      <div class="card">
        <div class="card-title"><h3>Gastos do mês</h3><button class="link" data-act="tab" data-tab="casa">Ver tudo ${icon('right')}</button></div>
        ${gastos.length ? `<div class="list">${gastos.slice(0, 6).map(([catId, v]) => {
          const c = cm.get(catId);
          return `<button class="catrow" data-act="cat" data-id="${catId}">
            ${catIcon(c)}
            <div class="name"><span>${esc(c?.nome || 'Sem categoria')}</span></div>
            <div class="val">${pct(Math.round((v * TOTAL_BPS) / (totalGasto || 1)))}</div>
            ${bar(v, totalGasto, { cls: 'x' })}
            <div class="meta"><span>${money(v)}</span></div>
          </button>`;
        }).join('')}</div>` : emptyArt('Nenhum gasto da casa este mês ainda.')}
      </div>
    </div>`;
  return { html };
}

function emptyArt(msg) {
  return `<div class="empty"><img class="art-img" src="assets/art/casal-mini.png" alt="" width="130" height="179"><div>${esc(msg)}</div></div>`;
}

// ================================================================ Casa / Meu mês

export function planoView(ctx, escopo) {
  const ix = D.ix();
  const eu = D.eu();
  const mes = ctx.state.mes || thisMonth();
  const casa = C.planoCasa(ix, mes);
  const plan = escopo === 'casa' ? casa : C.planoPessoal(ix, escopo, mes, casa);
  const fech = C.fechamentoDe(ix, mes);
  const est = C.mesesComDados(ix, escopo) < 3;
  let top = '';
  if (escopo === 'casa') {
    const r = { gabi: C.rendasDoMes(ix, 'gabi', mes), yuri: C.rendasDoMes(ix, 'yuri', mes) };
    top = `<div class="card">
      <div class="card-title"><h3>Quem coloca quanto</h3>${fech ? '<span class="tag">mês fechado</span>' : ''}</div>
      <div class="list">${C.PESSOAS.map(p => `
        <div class="item">
          <div class="icirc sm">${icon('user')}</div>
          <div class="grow"><div class="t">${esc(nome(p))} <span class="muted small">${pct(plan.split[p])}</span></div>
            <div class="s">base ${money(plan.bases[p])} · recebido ${money(r[p].base)}${r[p].freela ? ` + freela ${money(r[p].freela)}` : ''}</div></div>
          <div class="amt">${money(plan.contrib[p] + plan.extras[p])}</div>
        </div>`).join('')}</div>
      ${plan.split.semRenda ? '<div class="hint">Sem renda base ainda: dividindo 50/50.</div>' : ''}
      ${plan.avisos.filter(a => a.tipo === 'limiteCasa').map(a => `<div class="notice warn" style="margin-top:8px">${icon('alert')}<div>A casa pede ${money(a.valor)}, mais que ${fmtPct(plan.plano.limiteCasa)} das duas bases (${money(a.limite)}). Vale conversar.</div></div>`).join('')}
    </div>`;
  } else {
    const rp = plan.rendas;
    top = rp.pendentes.length ? rp.pendentes.map(r => notice(`Freela de ${money(r.valor)}: <b>separar agora?</b>`, { ic: 'sprout', kind: 'good', act: 'freela', data: `data-id="${r.id}"` })).join('') : '';
    if (plan.avisos.some(a => a.tipo === 'rendaAbaixo')) top += notice(`Recebido até agora ${money(rp.base)} de ${money(plan.base)} de base.`, { ic: 'coins', kind: 'warn' });
  }
  const html = `
    ${monthPicker(mes)}
    <div class="stack">
      ${aindaDaCard({ ...plan, plano: { ...plan.plano, estimativa: est } }, escopo === 'casa' ? 'Ainda dá pra gastar na casa' : 'Ainda dá pra gastar (só meu)')}
      ${plan.overflow > 0 ? notice(`Imprevistos passaram ${money(plan.overflow)}. <b>De onde tirar?</b>`, { ic: 'alert', kind: 'warn', act: 'imprevisto', data: `data-mes="${mes}"` }) : ''}
      ${top}
      <div class="card"><div class="card-title"><h3>O plano do mês</h3><button class="link" data-act="go" data-to="#/plano">Editar ${icon('right')}</button></div>${waterfall(plan)}</div>
      <div class="card"><div class="card-title"><h3>Categorias</h3></div>${catRows(plan)}</div>
      ${guardadoExtrasCard(ix, escopo, mes)}
      ${escopo === 'casa' ? `<button class="card tight" data-act="go" data-to="#/saldo" style="width:100%;text-align:left">${saldoResumo(ix, nome)}</button>` : ''}
      ${escopo === 'casa' ? `<div class="btns">
        <button class="btn outline small" data-act="go" data-to="#/real">Planejado x Real</button>
        <button class="btn outline small" data-act="fechar" data-mes="${mes}">${fech ? 'Reabrir mês' : 'Fechar mês'}</button>
      </div>` : '<button class="btn outline small" data-act="go" data-to="#/real?e=meu" style="width:100%">Planejado x Real</button>'}
      ${escopo !== 'casa' ? '<p class="hint center">Só você vê esta aba.</p>' : ''}
    </div>`;
  return { html };
}

// ================================================================ Lançamentos

export function lancamentos(ctx) {
  const ix = D.ix();
  const eu = D.eu();
  const mes = ctx.state.mes || thisMonth();
  const f = ctx.state.filtro || { escopo: 'todos', tipo: '', cat: '', pagto: '', quem: '' };
  const cm = C.catMap(ix);
  let items = [
    ...C.lancsDoMes(ix, 'casa', mes), ...C.lancsDoMes(ix, eu, mes),
  ].map(l => ({ ...l, _k: 'lanc' }));
  const parcs = [...C.parcelasDoMes(ix, 'casa', mes).itens, ...C.parcelasDoMes(ix, eu, mes).itens].map(x => ({ ...x, tipo: 'gasto', _k: 'parc', id: x.parcId }));
  items.push(...parcs);
  if (f.escopo === 'casa') items = items.filter(i => i.escopo === 'casa');
  if (f.escopo === 'meu') items = items.filter(i => i.escopo === eu);
  if (f.tipo) items = items.filter(i => i.tipo === f.tipo);
  if (f.cat) items = items.filter(i => i.catId === f.cat);
  if (f.pagto) items = items.filter(i => i.pagto === f.pagto);
  if (f.quem) items = items.filter(i => i.pagoPor === f.quem);
  items.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : (b.editadoEm || '').localeCompare(a.editadoEm || '')));
  const total = items.reduce((a, i) => a + i.valor, 0);
  const pend = C.pendentes(ix, eu);
  const byDay = new Map();
  for (const i of items) { if (!byDay.has(i.data)) byDay.set(i.data, []); byDay.get(i.data).push(i); }
  const TIPO = { gasto: 'Gasto', fixa: 'Conta fixa', invest: 'Investimento', aporte: 'Meta' };
  const catsAll = [...C.catsOf(ix, 'casa'), ...C.catsOf(ix, eu)];
  const sel = (id, label, opts, val) => `<select class="input" data-filtro="${id}" aria-label="${label}" style="min-height:42px;padding:8px 12px;font-size:14px">
    <option value="">${label}</option>${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const html = `
    <h1 class="h1" style="margin:6px 0 4px">Lançamentos</h1>
    ${monthPicker(mes)}
    <div class="stack">
      ${pend.length ? notice(`<b>${pend.length} ${pend.length === 1 ? 'pendente' : 'pendentes'}</b> para classificar`, { ic: 'inbox', act: 'go', data: 'data-to="#/pendentes"' }) : ''}
      <div class="seg">${[['todos', 'Todos'], ['casa', 'Casa'], ['meu', 'Só meus']].map(([k, l]) => `<button class="${f.escopo === k ? 'on' : ''}" data-act="fesc" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="grid2">
        ${sel('tipo', 'Tipo', Object.entries(TIPO), f.tipo)}
        ${sel('cat', 'Categoria', catsAll.map(c => [c.id, `${c.nome}${c.escopo === 'casa' ? '' : ' (meu)'}`]), f.cat)}
        ${sel('pagto', 'Como pagou', (ix.pagto || []).map(p => [p.id, p.nome]), f.pagto)}
        ${sel('quem', 'Quem pagou', C.PESSOAS.map(p => [p, nome(p)]), f.quem)}
      </div>
      <div class="row between small ink2"><span>${items.length} lançamentos</span><span>Total ${money(total)}</span></div>
      ${items.length ? [...byDay.entries()].map(([d, list]) => `
        <div class="card tight">
          <div class="small muted" style="text-transform:capitalize">${esc(weekday(d))}, ${esc(fmtDateShort(d))}</div>
          <div class="list">${list.map(i => {
            const c = cm.get(i.catId);
            const meta = i.metaId ? D.get(i.metaId) : null;
            const fixo = i.fixoId ? D.get(i.fixoId) : null;
            const titulo = fixo?.nome || meta?.nome || c?.nome || TIPO[i.tipo] || 'Lançamento';
            const sub = [
              i.escopo === 'casa' ? `Casa · ${esc(nome(i.pagoPor))} pagou` : 'Só meu',
              i._k === 'parc' ? `parcela ${i.i}/${i.n}` : '',
              i.voluntario ? 'do freela' : '',
              i.obs ? esc(i.obs) : '',
            ].filter(Boolean).join(' · ');
            return `<button class="item" data-act="edit" data-k="${i._k}" data-id="${i.id}">
              <div class="icirc sm">${i.tipo === 'invest' ? icon('sprout') : i.tipo === 'aporte' ? icon(meta?.icone || 'target') : catIcon(c)}</div>
              <div class="grow"><div class="t ellipsis">${esc(titulo)}</div><div class="s ellipsis">${sub}</div></div>
              <div class="amt ${i.tipo === 'invest' || i.tipo === 'aporte' ? 'good' : ''}">${money(i.valor)}</div>
            </button>`;
          }).join('')}</div>
        </div>`).join('') : emptyArt('Nada por aqui neste mês.')}
    </div>`;
  return {
    html,
    mount(root) {
      root.addEventListener('change', (e) => {
        const k = e.target.dataset.filtro;
        if (!k) return;
        ctx.state.filtro = { ...f, [k]: e.target.value };
        ctx.render();
      });
    },
  };
}

// ================================================================ Pendentes

export function pendentesScreen(ctx) {
  const ix = D.ix();
  const pend = C.pendentes(ix, D.eu()).sort((a, b) => (a.data < b.data ? -1 : 1));
  const html = `${topbar('Pendentes')}
    <div class="stack">
      <p class="ink2 small" style="margin:0">Gastos salvos rápido, pelo atalho do iPhone ou pelo Apple Pay. Só você vê até classificar. Se for da casa, ele vai para a Casa.</p>
      ${pend.length ? pend.map(p => `
        <div class="pend-card row">
          <div class="icirc">${icon(p.origem === 'applepay' ? 'card' : 'inbox')}</div>
          <div class="grow"><div class="mid">${money(p.valor)}</div><div class="small ink2">${esc(p.texto || 'Sem descrição')} · ${esc(fmtDate(p.data))}${p.origem === 'applepay' ? ' · Apple Pay' : p.origem === 'atalho' ? ' · Atalho' : ''}</div></div>
          <button class="btn small" data-act="classificar" data-id="${p.id}">Classificar</button>
        </div>`).join('') : emptyArt('Nenhum pendente. Tudo em dia!')}
    </div>`;
  return { html };
}

// ================================================================ Metas

export function metasScreen(ctx) {
  const ix = D.ix();
  const eu = D.eu();
  const mes = thisMonth();
  const all = (ix.meta || []).filter(m => m.escopo === 'casa' || m.escopo === eu);
  const ativas = all.filter(m => !m.arquivada);
  const arq = all.filter(m => m.arquivada);
  const html = `
    <div class="row between" style="margin:6px 0 12px"><h1 class="h1">Metas</h1><button class="btn small" data-act="novameta">${icon('plus')} Nova</button></div>
    <div class="stack">
      ${ativas.length ? ativas.map(m => metaCard(ix, m, mes)).join('') : emptyArt('Nenhuma meta ainda. Que tal a primeira viagem?')}
      ${arq.length ? `<div class="h3" style="margin-top:22px">Alcançadas</div>${arq.map(m => metaCard(ix, m, mes)).join('')}` : ''}
    </div>`;
  return { html };
}

export function metaScreen(ctx, id) {
  const ix = D.ix();
  const m = D.get(id);
  if (!m || m.excluidoEm) return { html: `${topbar('Meta')}<div class="empty">Meta não encontrada.</div>` };
  const mes = thisMonth();
  const p = C.metaProgresso(ix, m, mes);
  // cumulative saved over the last 12 months
  const pts = [];
  let acc = p.guardado;
  const months = [];
  for (let i = 0; i < 12; i++) months.unshift(addMonths(mes, -i));
  const after = months.map(mm => [...p.porMesHist.entries()].filter(([k]) => k > mm).reduce((a, [, v]) => a + v, 0));
  months.forEach((mm, i) => { pts.push({ label: monthLabel(mm)[0].toUpperCase() + monthLabel(mm).slice(1), value: acc - after[i] }); });
  const html = `
    <div class="cover">${icon(m.icone || 'target')}
      <button class="icon-btn" style="left:10px" data-act="back" aria-label="Voltar">${icon('left')}</button>
      <button class="icon-btn" style="right:10px" data-act="editmeta" data-id="${m.id}" aria-label="Editar">${icon('dots')}</button>
    </div>
    <div class="stack" style="margin-top:14px">
      <div><h1 class="h1">${esc(m.nome)}</h1>${m.frase ? `<div class="ink2" style="margin-top:4px">${esc(m.frase)}</div>` : ''}
        <div class="small muted" style="margin-top:4px">${m.escopo === 'casa' ? 'Meta conjunta' : 'Só minha'}</div></div>
      <div class="card">
        <div class="row between"><div><span class="mid">${money(p.guardado)}</span> <span class="muted">de ${money(m.alvo || 0)}</span></div></div>
        <div class="row" style="margin-top:12px"><div class="grow">${bar(p.guardado, m.alvo || 1, { cls: 'dark', lg: true })}</div><b>${pct(p.pct)}</b></div>
        <div class="tiles" style="margin-top:14px">
          <div class="tile">${icon('calendar')}<div>Meta até<b>${m.prazo ? esc(fmtMonthShort(m.prazo)) : 'sem prazo'}</b></div></div>
          <div class="tile">${icon('coins')}<div>${p.porMes ? 'Precisa por mês' : 'No plano'}<b>${money(p.porMes || m.aporteMensal || 0)}</b></div></div>
        </div>
      </div>
      <div class="card"><div class="card-title"><h3>Evolução</h3></div>
        ${barChart(pts, { height: 150, line: m.alvo || null, lineLabel: fmtMoney(m.alvo || 0, { short: true }), fmt: (v) => fmtMoney(v), hl: 11 })}
      </div>
      ${p.aportes.length ? `<div class="card"><div class="card-title"><h3>Aportes</h3></div><div class="list">${p.aportes.slice().sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 12).map(a => `
        <button class="item" data-act="edit" data-k="lanc" data-id="${a.id}"><div class="grow"><div class="t">${esc(fmtDate(a.data))}</div><div class="s">${a.escopo === 'casa' ? `${esc(nome(a.pagoPor))}${a.voluntario ? ' · do freela' : ''}` : 'Só meu'}${a.obs ? ` · ${esc(a.obs)}` : ''}</div></div><div class="amt">${money(a.valor)}</div></button>`).join('')}</div></div>` : ''}
      <button class="btn" data-act="aportar" data-id="${m.id}">Adicionar valor</button>
      <button class="btn outline" data-act="editmeta" data-id="${m.id}">Editar meta</button>
    </div>`;
  return { html };
}

// ================================================================ Categoria

export function catScreen(ctx, id) {
  const ix = D.ix();
  const c = D.get(id);
  if (!c) return { html: `${topbar('Categoria')}<div class="empty">Categoria não encontrada.</div>` };
  const range = ctx.state.catRange || 1;
  const mes = ctx.state.mes || thisMonth();
  const cm = C.catMap(ix);
  const ids = new Set([id]);
  if (c.papel === 'imprevistos') for (const x of C.catsOf(ix, c.escopo, 'imprevisto')) ids.add(x.id);
  const spentIn = (m) => {
    let v = 0;
    for (const l of C.lancsDoMes(ix, c.escopo, m)) if ((l.tipo === 'gasto' || l.tipo === 'fixa') && ids.has(l.catId)) v += l.valor;
    for (const x of C.parcelasDoMes(ix, c.escopo, m).itens) if (ids.has(x.catId)) v += x.valor;
    return v;
  };
  const months = [];
  for (let i = 11; i >= 0; i--) months.push(addMonths(mes, -i));
  const series = months.map(m => ({ m, v: spentIn(m) }));
  const sel = series.slice(-range);
  const total = sel.reduce((a, s) => a + s.v, 0);
  const allSpent = months.slice(-range).reduce((a, m) => a + [...C.gastoPorCategoria(ix, c.escopo, m).values()].reduce((x, y) => x + y, 0), 0);
  const withData = series.filter(s => s.v > 0);
  const media = withData.length ? Math.round(withData.reduce((a, s) => a + s.v, 0) / withData.length) : 0;
  const entries = [];
  for (const m of months.slice(-range)) {
    for (const l of C.lancsDoMes(ix, c.escopo, m)) if (ids.has(l.catId)) entries.push({ ...l, _k: 'lanc' });
    for (const x of C.parcelasDoMes(ix, c.escopo, m).itens) if (ids.has(x.catId)) entries.push({ ...x, id: x.parcId, _k: 'parc', obs: `parcela ${x.i}/${x.n}${x.obs ? ` · ${x.obs}` : ''}` });
  }
  entries.sort((a, b) => (a.data < b.data ? 1 : -1));
  const sub = new Map();
  for (const e of entries) sub.set(e.catId, (sub.get(e.catId) || 0) + e.valor);
  const grupoNome = { variavel: 'Do dia a dia', fixo: 'Conta fixa', imprevisto: 'Imprevisto' }[c.grupo] || '';
  const html = `${topbar('', { right: `<button class="icon-btn" data-act="editcat" data-id="${c.id}" aria-label="Editar categoria">${icon('dots')}</button>` })}
    <div class="center stack-sm">
      <div class="icirc xl" style="margin:0 auto">${catIcon(c)}</div>
      <h1 class="h2" style="margin-top:10px">${esc(c.nome)}</h1>
      <div class="ink2 small">${esc(grupoNome)}${c.extra ? ' · extra' : ''} · ${c.escopo === 'casa' ? 'Casa' : 'Só meu'}</div>
    </div>
    <div class="stack" style="margin-top:16px">
      <div class="seg">${[[1, 'Mês atual'], [3, 'Últimos 3 meses'], [6, 'Últimos 6 meses']].map(([k, l]) => `<button class="${range === k ? 'on' : ''}" data-act="range" data-v="${k}">${l}</button>`).join('')}</div>
      <div><div class="big">${money(total)}</div><div class="small ink2" style="margin-top:6px"><b>${pct(allSpent ? Math.round((total * TOTAL_BPS) / allSpent) : 0)}</b> do total de gastos</div></div>
      ${barChart(series.map(s => ({ label: monthLabel(s.m), value: s.v })), { height: 160, line: media || null, lineLabel: `Média ${fmtMoney(media, { short: true })}`, fmt: (v) => fmtMoney(v), hl: 11 })}
      ${sub.size > 1 ? `<div class="card"><div class="card-title"><h3>Subcategorias</h3></div><div class="list">${[...sub.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `
        <div class="catrow">${catIcon(cm.get(k))}<div class="name"><span>${esc(cm.get(k)?.nome || '')}</span></div><div class="val">${money(v)} <span class="muted">${pct(Math.round((v * TOTAL_BPS) / (total || 1)))}</span></div>${bar(v, total, { cls: 'x' })}</div>`).join('')}</div></div>` : ''}
      <div class="card"><div class="card-title"><h3>Lançamentos</h3></div>
        ${entries.length ? `<div class="list">${entries.slice(0, 60).map(e => `
          <button class="item" data-act="edit" data-k="${e._k}" data-id="${e.id}"><div class="grow"><div class="t">${esc(fmtDate(e.data))}</div><div class="s ellipsis">${e.escopo === 'casa' ? `${esc(nome(e.pagoPor))} pagou` : 'Só meu'}${e.obs ? ` · ${esc(e.obs)}` : ''}</div></div><div class="amt">${money(e.valor)}</div></button>`).join('')}</div>` : '<div class="muted small">Nada neste período.</div>'}
      </div>
    </div>`;
  return { html };
}

// ================================================================ Mais

export function mais(ctx) {
  const ix = D.ix();
  const pend = C.pendentes(ix, D.eu()).length;
  const it = (to, ic, t, s = '') => `<button class="item" data-act="go" data-to="${to}"><div class="icirc sm">${icon(ic)}</div><div class="grow"><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ''}</div>${icon('right', 'chev')}</button>`;
  const html = `
    <h1 class="h1" style="margin:6px 0 14px">Mais</h1>
    <div class="stack">
      <div class="card tight"><div class="list">
        ${it('#/renda', 'coins', 'Rendas do mês', 'Recebi, renda base e freelas')}
        ${it('#/fixos', 'receipt', 'Contas fixas', 'Checklist do mês')}
        ${it('#/saldo', 'scale', 'Quem deve a quem', 'Saldo e acertos')}
        ${it('#/pendentes', 'inbox', 'Pendentes', pend ? `${pend} para classificar` : 'Nada pendente')}
      </div></div>
      <div class="card tight"><div class="list">
        ${it('#/plano', 'chart', 'Plano', 'Renda base, valor da casa, porcentagens, freela')}
        ${it('#/real', 'swap', 'Planejado x Real', 'E sugestões de ajuste')}
        ${it('#/proximos', 'calendar', 'Próximos 6 meses', 'Parcelas e contas já comprometidas')}
        ${it('#/faturas', 'card', 'Dinheiro para as faturas', 'O que ainda precisa estar na conta')}
      </div></div>
      <div class="card tight"><div class="list">
        ${it('#/lixeira', 'trash', 'Lixeira', 'Apagados nos últimos 30 dias')}
        ${it('#/ajustes', 'gear', 'Ajustes', 'Nomes, formas de pagamento, backup, exemplo')}
      </div></div>
    </div>`;
  return { html };
}

// ================================================================ Rendas

export function rendaScreen(ctx) {
  const ix = D.ix();
  const mes = ctx.state.mes || thisMonth();
  const html = `${topbar('Rendas')}
    ${monthPicker(mes)}
    <div class="stack">
      ${C.PESSOAS.map(p => {
        const r = C.rendasDoMes(ix, p, mes);
        const base = C.baseDe(ix, p, mes);
        return `<div class="card">
          <div class="card-title"><h3>${esc(nome(p))}</h3><span class="small ink2">base ${money(base)}</span></div>
          ${bar(r.base, base, { cls: r.base >= base ? 'good' : '' })}
          <div class="row between small ink2" style="margin:6px 0 8px"><span>Recebido ${money(r.base)} de ${money(base)}</span>${r.freela ? `<span class="good">+ ${money(r.freela)} freela</span>` : ''}</div>
          ${r.items.length ? `<div class="list">${r.items.sort((a, b) => (a.data < b.data ? 1 : -1)).map(x => `
            <button class="item" data-act="editrenda" data-id="${x.id}"><div class="grow"><div class="t">${x.tipo === 'freela' ? 'Freela / extra' : 'Renda base'}</div><div class="s">${esc(fmtDate(x.data))}${x.tipo === 'freela' ? (x.separado ? ` · separado, curtir ${esc(fmtMoney(x.curtir || 0))}` : ' · falta separar') : ''}</div></div><div class="amt">${money(x.valor)}</div></button>`).join('')}</div>` : '<div class="small muted">Nada recebido neste mês ainda.</div>'}
        </div>`;
      }).join('')}
      <button class="btn" data-act="recebi">${icon('plus')} Recebi</button>
      <p class="hint center">A renda base de cada um se ajusta em Plano. Os freelas nunca mudam a divisão da casa.</p>
    </div>`;
  return { html };
}

// ================================================================ Contas fixas

export function fixosScreen(ctx) {
  const ix = D.ix();
  const eu = D.eu();
  const mes = ctx.state.mes || thisMonth();
  const block = (escopo, titulo) => {
    const fx = C.fixosDoMes(ix, escopo, mes);
    const pagos = fx.itens.filter(i => i.pago && !i.anual).length;
    const mensais = fx.itens.filter(i => !i.anual).length;
    return `<div class="card">
      <div class="card-title"><h3>${titulo}</h3><span class="small ink2">${pagos} de ${mensais} pagas</span></div>
      ${fx.itens.length || fx.avulsos.length ? `<div class="list">${fx.itens.sort((a, b) => (a.anual - b.anual) || (a.fixo.diaVenc || 0) - (b.fixo.diaVenc || 0)).map(i => {
        const diff = i.real != null ? i.real - i.previsto : 0;
        const st = i.anual && !i.venceEsteMes
          ? '<span class="tag">anual</span>'
          : i.pago ? `<span class="tag good">${icon('check')} pago</span>` : `<span class="tag ${daysBetween(today(), dateIn(mes, i.fixo.diaVenc || 1)) < 0 && mes <= thisMonth() ? 'bad' : ''}">vence dia ${i.fixo.diaVenc || '?'}</span>`;
        return `<div class="item">
          <button class="icirc sm" data-act="editfixo" data-id="${i.fixo.id}" aria-label="Editar ${esc(i.fixo.nome)}" style="border:0">${catIcon(D.get(i.fixo.catId))}</button>
          <button class="grow" data-act="${i.pago ? 'edit' : 'pagar'}" data-k="lanc" data-id="${i.pago ? i.lancs[0].id : i.fixo.id}" style="border:0;background:none;text-align:left;padding:0">
            <div class="t">${esc(i.fixo.nome)}</div>
            <div class="s">${i.pago ? `veio ${esc(fmtMoney(i.real))}${diff ? ` (${diff > 0 ? '+' : ''}${esc(fmtMoney(diff))})` : ''}` : i.anual ? `${esc(fmtMoney(i.previsto))} por ano · ${esc(fmtMoney(i.provisao))}/mês` : `esperado ${esc(fmtMoney(i.previsto))}`}</div>
          </button>
          ${st}
        </div>`;
      }).join('')}${fx.avulsos.map(l => `<button class="item" data-act="edit" data-k="lanc" data-id="${l.id}"><div class="icirc sm">${icon('receipt')}</div><div class="grow"><div class="t">${esc(D.get(l.catId)?.nome || 'Conta')}</div><div class="s">avulsa · ${esc(fmtDate(l.data))}</div></div><div class="amt">${money(l.valor)}</div></button>`).join('')}</div>` : '<div class="small muted">Nenhuma conta fixa.</div>'}
      <div class="row between small ink2" style="margin-top:10px"><span>Total do mês</span><span>${money(fx.mensal)}${fx.provisao ? ` + provisão ${money(fx.provisao)}` : ''}</span></div>
      <button class="link" data-act="novofixo" data-escopo="${escopo}">${icon('plus')} Nova conta fixa</button>
    </div>`;
  };
  const html = `${topbar('Contas fixas')}
    ${monthPicker(mes)}
    <div class="stack">
      <p class="small ink2" style="margin:0">Toque numa conta para marcar como paga e informar o valor que veio. O plano se recalcula na hora.</p>
      ${block('casa', 'Da casa')}
      ${block(eu, 'Só minhas')}
    </div>`;
  return { html };
}

// ================================================================ Quem deve a quem

export function saldoScreen(ctx) {
  const ix = D.ix();
  const s = C.saldo(ix, thisMonth());
  const cm = C.catMap(ix);
  const desc = (h) => {
    const d = h.desc;
    if (d.kind === 'acerto') return `Acerto: ${nome(d.de)} pagou ${nome(d.para)}`;
    if (d.parcId) return `${cm.get(d.catId)?.nome || 'Parcela'} ${d.i}/${d.n}`;
    return (d.fixoId && D.get(d.fixoId)?.nome) || (d.metaId && D.get(d.metaId)?.nome) || cm.get(d.catId)?.nome || (d.tipo === 'invest' ? 'Investimento' : 'Lançamento');
  };
  const html = `${topbar('Quem deve a quem')}
    <div class="stack">
      <div class="card center">
        <div class="icirc lg" style="margin:0 auto 10px">${icon('scale')}</div>
        ${s.deve ? `<div class="ink2">${esc(nome(s.deve))} deve para ${esc(nome(s.recebe))}</div><div class="big" style="margin-top:6px">${money(s.valor)}</div>` : '<div class="h2">Tudo certo!</div><div class="ink2">Ninguém deve nada.</div>'}
        <p class="small muted" style="margin:12px 0 0">Cada gasto da casa é dividido pela renda base do mês. Quem pagou ganha crédito pelo valor inteiro.</p>
      </div>
      <button class="btn" data-act="acerto">Registrar acerto</button>
      <div class="card"><div class="card-title"><h3>Histórico</h3></div>
        ${s.historico.length ? `<div class="list">${s.historico.slice(0, 50).map(h => `
          <div class="item"><div class="grow"><div class="t ellipsis">${esc(desc(h))}</div><div class="s">${esc(fmtDate(h.data))}</div></div>
          <div class="amt small ${h.delta > 0 ? 'good' : h.delta < 0 ? 'bad' : ''}" title="Efeito para ${esc(nome('gabi'))}">${h.delta > 0 ? '+' : ''}${money(h.delta)}</div></div>`).join('')}</div>
          <p class="hint">Valores do ponto de vista de ${esc(nome('gabi'))}: positivo aumenta o que ${esc(nome('yuri'))} deve.</p>` : '<div class="small muted">Nada ainda.</div>'}
      </div>
    </div>`;
  return { html };
}

// ================================================================ Plano

export function planoScreen(ctx) {
  const ix = D.ix();
  const eu = D.eu();
  const aba = ctx.state.planoAba || 'casa';
  const mes = thisMonth();
  const escopo = aba === 'casa' ? 'casa' : eu;
  const plano = C.planoDe(ix, escopo, mes);
  const plan = escopo === 'casa' ? C.planoCasa(ix, mes) : C.planoPessoal(ix, eu, mes);
  const cats = C.catsOf(ix, escopo, 'variavel').filter(c => !c.arquivada || plano.pcts[c.id]);
  const soma = cats.reduce((a, c) => a + (plano.pcts[c.id] || 0), 0);
  const allCats = C.catsOf(ix, escopo);
  const catList = (grupo, titulo) => {
    const l = allCats.filter(c => c.grupo === grupo);
    if (!l.length) return '';
    return `<div class="small ink2" style="margin-top:10px">${titulo}</div><div class="chips" style="margin-top:6px">${l.map(c => `<button class="chip ${c.arquivada ? '' : 'soft'}" data-act="editcat" data-id="${c.id}" style="${c.arquivada ? 'opacity:.5' : ''}">${catIcon(c)}${esc(c.nome)}${c.extra ? ' ·  extra' : ''}</button>`).join('')}</div>`;
  };
  const html = `${topbar('Plano')}
    <div class="stack">
      <div class="seg"><button class="${aba === 'casa' ? 'on' : ''}" data-act="aba" data-v="casa">Casa</button><button class="${aba === 'meu' ? 'on' : ''}" data-act="aba" data-v="meu">Meu</button></div>
      <p class="small ink2" style="margin:0">Mudanças valem a partir de ${esc(fmtMonth(mes))}. Os meses anteriores ficam como estavam.</p>
      <form id="pl" class="stack">
        ${aba === 'casa' ? `
        <div class="card stack">
          <h3 class="h3">Renda base</h3>
          <p class="small ink2" style="margin:0">O que cada um pode contar todo mês. A casa é planejada só em cima disso.</p>
          <div class="grid2">${C.PESSOAS.map(p => `<div class="field"><label for="pl-base-${p}">${esc(nome(p))}</label><input class="input num" id="pl-base-${p}" inputmode="decimal" value="${esc(fmtMoneyPlain(C.baseDe(ix, p, mes)))}"></div>`).join('')}</div>
          <div class="hint">Divisão: ${esc(nome('gabi'))} ${esc(fmtPct(plan.split.gabi))} · ${esc(nome('yuri'))} ${esc(fmtPct(plan.split.yuri))}</div>
        </div>
        <div class="card stack">
          <h3 class="h3">Valor da casa</h3>
          <p class="small ink2" style="margin:0">Quanto a casa precisa por mês, com contas fixas, investimento, metas e o dia a dia.</p>
          <div class="field"><input class="input num" id="pl-casa" inputmode="decimal" value="${esc(fmtMoneyPlain(plano.valorCasa))}"></div>
          <div class="hint">Contas fixas esperadas: ${esc(fmtMoney(plan.fixos.total))}. Parcelas deste mês: ${esc(fmtMoney(plan.parcelas.total))}.</div>
        </div>` : ''}
        <div class="card stack">
          <h3 class="h3">Investimento por mês</h3>
          <div class="field"><input class="input num" id="pl-inv" inputmode="decimal" value="${esc(fmtMoneyPlain(plano.investimento || 0))}"></div>
          <div class="hint">As metas entram com o valor mensal de cada uma (${esc(fmtMoney(plan.metasPlan))}).</div>
        </div>
        <div class="card stack">
          <div class="row between"><h3 class="h3">Porcentagens</h3><span id="pl-soma" class="tag ${soma === TOTAL_BPS ? 'good' : 'warn'}">${esc(fmtPct(soma))}</span></div>
          <p class="small ink2" style="margin:0">Como dividir o livre de ${esc(fmtMoney(plan.livre))} entre as categorias do dia a dia.</p>
          ${cats.map(c => `<div class="row" style="gap:8px">${catIcon(c)}<span class="grow ellipsis">${esc(c.nome)}</span>
            <input class="input num right" style="width:70px;padding:10px" data-pct="${c.id}" inputmode="decimal" aria-label="${esc(c.nome)} em %" value="${esc(String((plano.pcts[c.id] || 0) / 100).replace('.', ','))}"><span class="muted">%</span>
            <span class="small ink2 right" style="width:74px" data-prev="${c.id}"></span></div>`).join('')}
          <button type="button" class="btn outline small" data-act="completar">Completar na Reserva</button>
        </div>
        ${aba === 'casa' ? `
        <div class="card stack">
          <h3 class="h3">Regra do freela</h3>
          <div class="grid2">
            <div class="field"><label for="pl-fg">Guardar (%)</label><input class="input num" id="pl-fg" inputmode="decimal" value="${esc(String(plano.freelaGuardar / 100).replace('.', ','))}"></div>
            <div class="field"><label for="pl-fp">Do guardado, para quem recebeu (%)</label><input class="input num" id="pl-fp" inputmode="decimal" value="${esc(String(plano.freelaPessoal / 100).replace('.', ','))}"></div>
          </div>
          <div class="hint">O resto do guardado vai para a casa. O que não é guardado é para curtir.</div>
        </div>
        <div class="card stack">
          <h3 class="h3">Avisos</h3>
          <div class="grid2">
            <div class="field"><label for="pl-lc">Casa acima de (% das bases)</label><input class="input num" id="pl-lc" inputmode="decimal" value="${esc(String(plano.limiteCasa / 100).replace('.', ','))}"></div>
            <div class="field"><label for="pl-lp">Parcelas acima de (% do livre)</label><input class="input num" id="pl-lp" inputmode="decimal" value="${esc(String(plano.limiteParcelas / 100).replace('.', ','))}"></div>
          </div>
        </div>` : ''}
        <label class="switch card"><span>Ainda são estimativas</span><input type="checkbox" id="pl-est" ${plano.estimativa ? 'checked' : ''}></label>
        <button class="btn" type="submit">Salvar plano</button>
      </form>
      <div class="card">
        <div class="card-title"><h3>Categorias</h3><button class="link" data-act="novacat" data-escopo="${escopo}">${icon('plus')} Nova</button></div>
        ${catList('variavel', 'Do dia a dia')}${catList('fixo', 'Contas fixas')}${catList('imprevisto', 'Imprevistos (usam o orçamento de Imprevistos)')}
      </div>
    </div>`;
  return {
    html,
    mount(root) {
      const form = $('#pl', root);
      const readPcts = () => Object.fromEntries($$('[data-pct]', form).map(i => [i.dataset.pct, parsePct(i.value) || 0]));
      const upd = () => {
        const p = readPcts();
        const s = Object.values(p).reduce((a, b) => a + b, 0);
        const tag = $('#pl-soma', root);
        tag.textContent = fmtPct(s);
        tag.className = `tag ${s === TOTAL_BPS ? 'good' : 'warn'}`;
        for (const el of $$('[data-prev]', form)) el.textContent = fmtMoney(Math.round((Math.max(0, plan.livre) * (p[el.dataset.prev] || 0)) / TOTAL_BPS), { short: true });
      };
      upd();
      form.addEventListener('input', upd);
      root.querySelector('[data-act="completar"]').addEventListener('click', () => {
        const res = cats.find(c => c.papel === 'reserva');
        if (!res) return toast('Sem categoria Reserva.');
        const p = readPcts();
        const semRes = Object.entries(p).filter(([k]) => k !== res.id).reduce((a, [, v]) => a + v, 0);
        const v = Math.max(0, TOTAL_BPS - semRes);
        form.querySelector(`[data-pct="${res.id}"]`).value = String(v / 100).replace('.', ',');
        upd();
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pcts = readPcts();
        const s = Object.values(pcts).reduce((a, b) => a + b, 0);
        if (s !== TOTAL_BPS) return toast(`As porcentagens somam ${fmtPct(s)}. Precisam dar 100%.`);
        // the plan record this month already uses (latest edit), else a new one from this month on
        const existing = (ix.plano || []).filter(r => r.escopo === escopo && r.mes === mes).sort((a, b) => (a.editadoEm < b.editadoEm ? 1 : -1))[0];
        const rec = { ...(existing || { kind: 'plano', escopo, mes }), pcts, investimento: parseMoney($('#pl-inv', form).value) || 0, estimativa: $('#pl-est', form).checked };
        const recs = [];
        if (escopo === 'casa') {
          Object.assign(rec, {
            valorCasa: parseMoney($('#pl-casa', form).value) || 0,
            freelaGuardar: Math.min(TOTAL_BPS, parsePct($('#pl-fg', form).value) ?? 7000),
            freelaPessoal: Math.min(TOTAL_BPS, parsePct($('#pl-fp', form).value) ?? 5000),
            limiteCasa: parsePct($('#pl-lc', form).value) ?? 7000,
            limiteParcelas: parsePct($('#pl-lp', form).value) ?? 2000,
          });
          for (const p of C.PESSOAS) {
            const v = parseMoney($(`#pl-base-${p}`, form).value) || 0;
            if (v !== C.baseDe(ix, p, mes)) {
              const cur = (ix.base || []).find(b => b.pessoa === p && b.mes === mes);
              recs.push({ ...(cur || { kind: 'base', escopo: 'casa', pessoa: p, mes }), valor: v });
            }
          }
        }
        recs.push(rec);
        await D.saveMany(recs);
        toast('Plano salvo. Tudo recalculado.');
        ctx.back();
      });
    },
  };
}

// ================================================================ Planejado x Real

export function realScreen(ctx, params) {
  const ix = D.ix();
  const escopo = params.get('e') === 'meu' ? D.eu() : 'casa';
  const mes = thisMonth();
  const pr = C.planejadoReal(ix, escopo, mes, 3);
  const html = `${topbar('Planejado x Real')}
    <div class="stack">
      <div class="seg"><button class="${escopo === 'casa' ? 'on' : ''}" data-act="go" data-to="#/real">Casa</button><button class="${escopo !== 'casa' ? 'on' : ''}" data-act="go" data-to="#/real?e=meu">Meu</button></div>
      <p class="small ink2" style="margin:0">${pr.meses ? `Média dos últimos ${pr.meses} ${pr.meses === 1 ? 'mês' : 'meses'} comparada com o plano de ${esc(fmtMonth(mes))}.` : 'Ainda não há meses anteriores com dados. Volte no mês que vem.'}</p>
      <div class="card"><table class="table">
        <tr><th>Categoria</th><th class="r">Plano</th><th class="r">Média</th><th></th></tr>
        ${pr.rows.map(r => {
          const diff = r.media != null ? r.media - r.planejado : 0;
          const sug = r.media != null && Math.abs(diff) > r.planejado * 0.1 && r.sugestaoPct != null;
          return `<tr><td>${esc(r.cat.nome)}</td><td class="r">${money(r.planejado)}</td><td class="r ${diff > 0 ? 'bad' : ''}">${r.media != null ? money(r.media) : '-'}</td>
            <td class="r">${sug ? `<button class="link" data-act="ajustar" data-id="${r.cat.id}" data-pct="${r.sugestaoPct}">Ajustar</button>` : ''}</td></tr>`;
        }).join('')}
      </table>
      <p class="hint">"Ajustar" muda a porcentagem da categoria para a média e compensa na Reserva. Nada muda sem você tocar.</p></div>
    </div>`;
  return {
    html,
    async mount(root) {
      root.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-act="ajustar"]');
        if (!b) return;
        e.stopPropagation();
        const plano = C.planoDe(D.ix(), escopo, mes);
        const res = C.catsOf(D.ix(), escopo, 'variavel').find(c => c.papel === 'reserva');
        const catId = b.dataset.id;
        const novo = Math.max(0, Number(b.dataset.pct));
        const delta = novo - (plano.pcts[catId] || 0);
        if (!res || (plano.pcts[res.id] || 0) - delta < 0) return toast('A Reserva não tem porcentagem suficiente. Ajuste em Plano.');
        const pcts = { ...plano.pcts, [catId]: novo, [res.id]: (plano.pcts[res.id] || 0) - delta };
        const cur = (D.ix().plano || []).filter(r => r.escopo === escopo && r.mes === mes).sort((a, b2) => (a.editadoEm < b2.editadoEm ? 1 : -1))[0];
        const { id, criadoEm, criadoPor, editadoEm, _pendente, exemplo, ...base } = plano;
        await D.save(cur ? { ...cur, pcts } : { ...base, kind: 'plano', escopo, mes, pcts });
        toast(`Ajustado. ${D.get(catId)?.nome || ''}: ${fmtPct(novo)}.`);
      }, true);
    },
  };
}

// ================================================================ Próximos meses

export function proximosScreen(ctx) {
  const ix = D.ix();
  const eu = D.eu();
  const mes = thisMonth();
  const prox = C.proximosMeses(ix, eu, mes, 6);
  const parcs = [...(ix.parc || [])].filter(p => p.escopo === 'casa' || p.escopo === eu);
  const cm = C.catMap(ix);
  const html = `${topbar('Próximos 6 meses')}
    <div class="stack">
      <p class="small ink2" style="margin:0">Quanto de cada mês já está comprometido com parcelas e contas fixas.</p>
      ${barChart(prox.map(p => ({ label: monthLabel(p.mes), value: p.casa.parcelas + p.meu.parcelas })), { height: 120, fmt: (v) => fmtMoney(v), hl: 0 })}
      <div class="legend"><span><i style="background:var(--blue-2)"></i>Parcelas (casa + minhas)</span></div>
      ${prox.map(p => `<div class="card tight">
        <div class="row between"><b style="text-transform:capitalize">${esc(fmtMonth(p.mes))}</b>${p.casa.alerta || p.meu.alerta ? '<span class="tag warn">muitas parcelas</span>' : ''}</div>
        <div class="grid2 small" style="margin-top:8px">
          <div><div class="muted">Casa</div>Parcelas ${money(p.casa.parcelas)}<br>Fixas ${money(p.casa.fixos)}<br><b>Livre ${money(p.casa.livre)}</b></div>
          <div><div class="muted">Meu</div>Parcelas ${money(p.meu.parcelas)}<br>Fixas ${money(p.meu.fixos)}<br><b>Livre ${money(p.meu.livre)}</b></div>
        </div></div>`).join('')}
      <div class="card"><div class="card-title"><h3>Compras parceladas</h3></div>
        ${parcs.length ? `<div class="list">${parcs.map(p => {
          const ps = C.parcelasDe(p);
          const pagas = ps.filter(x => x.mes < mes).length;
          const resta = ps.filter(x => x.mes >= mes).reduce((a, x) => a + x.valor, 0);
          return `<button class="item" data-act="edit" data-k="parc" data-id="${p.id}"><div class="icirc sm">${catIcon(cm.get(p.catId))}</div>
            <div class="grow"><div class="t ellipsis">${esc(p.obs || cm.get(p.catId)?.nome || 'Parcelado')}</div><div class="s">${pagas}/${p.n} pagas · ${p.escopo === 'casa' ? 'Casa' : 'Só meu'}${p.quitadoMes ? ' · quitado' : ''}</div></div>
            <div class="amt">${resta ? `faltam ${money(resta)}` : '<span class="good">quitado</span>'}</div></button>`;
        }).join('')}</div>` : '<div class="small muted">Nenhuma compra parcelada.</div>'}
      </div>
    </div>`;
  return { html };
}

// ================================================================ Faturas

export function faturasScreen(ctx) {
  const ix = D.ix();
  const f = C.faturasAbertas(ix, today());
  const semDias = (ix.pagto || []).filter(p => p.tipo === 'credito' && (!p.fechamento || !p.vencimento));
  const html = `${topbar('Dinheiro para as faturas')}
    <div class="stack">
      <p class="small ink2" style="margin:0">Gastos no cartão saem do orçamento no dia da compra, mas o dinheiro só sai do banco quando a fatura vence. Isto é o que ainda precisa estar na conta.</p>
      ${semDias.length ? notice(`Informe o dia de fechamento e de vencimento de <b>${esc(semDias.map(p => p.nome).join(', '))}</b> em Ajustes.`, { ic: 'card', kind: 'warn', act: 'go', data: 'data-to="#/ajustes"' }) : ''}
      ${f.length ? f.map(x => `<div class="card tight row">
        <div class="icirc">${icon('card')}</div>
        <div class="grow"><b>${esc(x.cartao.nome)}</b><div class="small ink2">vence ${esc(fmtDate(x.vence))}</div></div>
        <div class="mid">${money(x.total)}</div></div>`).join('') : '<div class="empty">Nenhuma fatura aberta com dias configurados.</div>'}
      ${f.length ? `<div class="row between"><b>Total a reservar</b><b>${money(f.reduce((a, x) => a + x.total, 0))}</b></div>` : ''}
    </div>`;
  return { html };
}

// ================================================================ Lixeira

export function lixeiraScreen(ctx) {
  const items = D.lixeira();
  const cm = C.catMap(D.ix());
  const label = (r) => {
    if (r.kind === 'meta') return `Meta: ${r.nome}`;
    if (r.kind === 'renda') return `Renda de ${nome(r.pessoa)}`;
    if (r.kind === 'acerto') return 'Acerto';
    if (r.kind === 'fixo') return `Conta fixa: ${r.nome}`;
    if (r.pendente) return `Pendente: ${r.texto || ''}`;
    return cm.get(r.catId)?.nome || 'Lançamento';
  };
  const html = `${topbar('Lixeira')}
    <div class="stack">
      <p class="small ink2" style="margin:0">Fica aqui por 30 dias.</p>
      ${items.length ? `<div class="card tight"><div class="list">${items.map(r => `
        <div class="item"><div class="grow"><div class="t ellipsis">${esc(label(r))}</div><div class="s">${r.data ? esc(fmtDate(r.data)) : ''} · apagado ${esc(fmtDate(r.excluidoEm.slice(0, 10)))}</div></div>
        ${r.valor || r.valorTotal ? `<div class="amt">${money(r.valor || r.valorTotal)}</div>` : ''}
        <button class="btn small outline" data-act="restaurar" data-id="${r.id}">Restaurar</button></div>`).join('')}</div></div>` : emptyArt('A lixeira está vazia.')}
    </div>`;
  return { html };
}

// ================================================================ Ajustes

export function ajustesScreen(ctx) {
  const s = D.settings();
  const ix = D.ix();
  const pagtos = ix.pagto || [];
  const tema = s.tema || 'auto';
  const html = `${topbar('Ajustes')}
    <div class="stack">
      <div class="card stack">
        <h3 class="h3">Nomes</h3>
        <div class="grid2">${C.PESSOAS.map(p => `<div class="field"><label for="aj-${p}">${p === s.eu ? 'Você' : 'Parceiro(a)'}</label><input class="input" id="aj-${p}" maxlength="20" value="${esc(s.nomes[p])}"></div>`).join('')}</div>
        <button class="btn outline small" data-act="salvarnomes">Salvar nomes</button>
        <div class="hint">Este celular é de ${esc(nome(s.eu))}.</div>
      </div>
      <div class="card stack">
        <div class="row between"><h3 class="h3">Como pagou</h3><button class="link" data-act="novopagto">${icon('plus')} Novo</button></div>
        <p class="small ink2" style="margin:0">Só apelidos. Nunca número de cartão ou conta.</p>
        <div class="list">${pagtos.map(p => `<button class="item" data-act="editpagto" data-id="${p.id}"><div class="icirc sm">${icon(p.tipo === 'pix' ? 'bolt' : p.tipo === 'dinheiro' ? 'coins' : 'card')}</div>
          <div class="grow"><div class="t">${esc(p.nome)}</div><div class="s">${esc({ credito: 'Crédito', debito: 'Débito', pix: 'Pix', dinheiro: 'Dinheiro' }[p.tipo] || '')}${p.tipo === 'credito' ? (p.fechamento ? ` · fecha dia ${p.fechamento}, vence dia ${p.vencimento}` : ' · sem dias de fatura') : ''}</div></div>${icon('right', 'chev')}</button>`).join('')}</div>
      </div>
      <div class="card stack">
        <h3 class="h3">Aparência</h3>
        <label class="switch"><span>Abrir com valores escondidos</span><input type="checkbox" id="aj-ocultar" ${s.ocultarPadrao ? 'checked' : ''}></label>
        <div class="seg">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([k, l]) => `<button class="${tema === k ? 'on' : ''}" data-act="tema" data-v="${k}">${l}</button>`).join('')}</div>
      </div>
      <div class="card stack">
        <h3 class="h3">Dados de exemplo</h3>
        <p class="small ink2" style="margin:0">Três meses fictícios para testar. Apagar o exemplo remove só ele.</p>
        <div class="btns"><button class="btn outline small" data-act="exemplo">Carregar exemplo</button><button class="btn outline small" data-act="apagarexemplo" ${D.hasSample() ? '' : 'disabled'}>Apagar exemplo</button></div>
      </div>
      <div class="card stack">
        <h3 class="h3">Backup</h3>
        <p class="small ink2" style="margin:0">O arquivo tem os dados da casa e só os seus individuais. Guarde num lugar privado e não mande em grupos.</p>
        <div class="btns"><button class="btn outline small" data-act="backup">${icon('download')} JSON</button><button class="btn outline small" data-act="csv">${icon('download')} CSV</button></div>
        <label class="btn outline small" style="width:100%">${icon('upload')} Restaurar backup<input type="file" id="aj-file" accept="application/json,.json" hidden></label>
      </div>
      <div class="card stack">
        <h3 class="h3">Planilhas Google</h3>
        <p class="small ink2" style="margin:0">A sincronização entre os dois celulares chega na etapa 2. Por enquanto tudo fica salvo neste celular.</p>
      </div>
      <button class="btn danger" data-act="apagartudo">Apagar tudo deste celular</button>
      <p class="hint center">Gabi &amp; Yuri · versão ${esc(ctx.version)}</p>
    </div>`;
  return {
    html,
    mount(root) {
      $('#aj-ocultar', root).addEventListener('change', (e) => D.saveSettings({ ocultarPadrao: e.target.checked }));
      $('#aj-file', root).addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const obj = JSON.parse(await file.text());
          const pv = D.previewBackup(obj);
          const ok = await confirmSheet('Restaurar backup?', `Backup de ${esc(fmtDate((pv.exportadoEm || '').slice(0, 10)))}: <b>${pv.novos}</b> novos, <b>${pv.atualizados}</b> mais recentes que os do celular, ${pv.iguais} iguais${pv.ignorados ? `, ${pv.ignorados} ignorados` : ''}. Nada será apagado.`, { ok: 'Restaurar' });
          if (ok) { const n = await D.restoreBackup(obj); toast(`${n} registros restaurados`); }
        } catch (err) {
          toast(err.message || 'Não consegui ler esse arquivo.');
        }
        e.target.value = '';
      });
    },
  };
}

export function pagtoForm(ctx, editing = null) {
  const st = { tipo: editing?.tipo || 'credito', dono: editing?.dono || D.eu() };
  const sheet = openSheet(`
    <div class="sheet-head"><h2 class="h3">${editing ? 'Editar' : 'Nova forma de pagamento'}</h2><button class="icon-btn" data-x aria-label="Fechar">${icon('x')}</button></div>
    <form class="stack" id="pf">
      <div class="field"><label for="pf-nome">Apelido</label><input class="input" id="pf-nome" maxlength="30" required value="${esc(editing?.nome || '')}" placeholder="Crédito ${esc(nome(D.eu()))}"></div>
      <div class="chips" id="pf-tipo">${[['credito', 'Crédito'], ['debito', 'Débito'], ['pix', 'Pix'], ['dinheiro', 'Dinheiro']].map(([k, l]) => `<button type="button" class="chip ${st.tipo === k ? 'on' : ''}" data-tipo="${k}">${l}</button>`).join('')}</div>
      <div class="field"><span class="lbl">De quem</span><div class="seg" id="pf-dono">${C.PESSOAS.map(p => `<button type="button" class="${st.dono === p ? 'on' : ''}" data-dono="${p}">${esc(nome(p))}</button>`).join('')}</div></div>
      <div class="grid2" id="pf-dias" ${st.tipo === 'credito' ? '' : 'hidden'}>
        <div class="field"><label for="pf-f">Dia que fecha</label><input class="input" id="pf-f" inputmode="numeric" value="${editing?.fechamento || ''}"></div>
        <div class="field"><label for="pf-v">Dia que vence</label><input class="input" id="pf-v" inputmode="numeric" value="${editing?.vencimento || ''}"></div>
      </div>
      <span class="hint">Nunca coloque número de cartão ou conta.</span>
      <button class="btn" type="submit">Salvar</button>
      ${editing ? '<button class="btn danger" type="button" data-del>Apagar</button>' : ''}
    </form>`);
  sheet.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('x' in b.dataset) return closeSheet();
    if (b.dataset.tipo) { st.tipo = b.dataset.tipo; $$('[data-tipo]', sheet).forEach(x => x.classList.toggle('on', x === b)); $('#pf-dias', sheet).hidden = st.tipo !== 'credito'; }
    if (b.dataset.dono) { st.dono = b.dataset.dono; $$('[data-dono]', sheet).forEach(x => x.classList.toggle('on', x === b)); }
    if ('del' in b.dataset) { await D.remove(editing.id); closeSheet(); }
  });
  $('#pf', sheet).addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = $('#pf-nome', sheet).value.trim();
    if (!n) return;
    if (/\d{6,}/.test(n)) return toast('Parece um número de cartão ou conta. Use só um apelido.');
    const dia = (id) => { const v = parseInt($(id, sheet).value, 10); return v >= 1 && v <= 31 ? v : null; };
    await D.save({ ...(editing || { kind: 'pagto', escopo: 'casa' }), nome: n, tipo: st.tipo, dono: st.dono, fechamento: st.tipo === 'credito' ? dia('#pf-f') : null, vencimento: st.tipo === 'credito' ? dia('#pf-v') : null });
    closeSheet();
  });
}

// ================================================================ Welcome / setup

export function welcome(ctx) {
  const step = ctx.state.setup || 'intro';
  if (step === 'intro') {
    return {
      nav: false,
      html: `<div class="welcome" style="margin:calc(-1 * (env(safe-area-inset-top) + 14px)) -16px 0">
        ${icon('heart', 'heart')}
        <h1>Gabi e Yuri<em>Planejamento Financeiro</em></h1>
        <div class="tag-line">Sonhos de hoje,<br>planos para sempre.</div>
        <div class="art"><div class="blob"></div><img class="art-img" src="assets/art/casal.png" alt="Ilustração do casal" width="654" height="900"></div>
        <div class="actions"><button class="btn" data-act="setup" data-v="quem">Começar ${icon('right')}</button></div>
      </div>`,
    };
  }
  if (step === 'quem') {
    return {
      nav: false,
      html: `<div class="stack" style="padding-top:40px">
        <h1 class="h1">Quem está usando este celular?</h1>
        <p class="ink2">Cada um instala no próprio iPhone. Os gastos individuais ficam só no seu.</p>
        ${C.PESSOAS.map(p => `<button class="btn outline" data-act="souEu" data-v="${p}">${p === 'gabi' ? 'Sou a' : 'Sou o'} ${esc(nome(p))}</button>`).join('')}
      </div>`,
    };
  }
  return {
    nav: false,
    html: `<div class="stack" style="padding-top:40px">
      <h1 class="h1">Quer ver com dados de exemplo?</h1>
      <p class="ink2">Três meses fictícios: rendas diferentes, uma TV parcelada, um freela, uma ida à farmácia e um conserto do carro. Dá para apagar tudo depois em Ajustes.</p>
      <button class="btn" data-act="comecar" data-v="exemplo">Carregar exemplo</button>
      <button class="btn outline" data-act="comecar" data-v="zero">Começar do zero</button>
      <p class="hint">A conexão com as planilhas do Google vem na etapa 2. Até lá, tudo fica salvo neste celular.</p>
    </div>`,
  };
}

export async function loadSampleData() {
  const ix = D.ix();
  await D.loadSample(({ eu, newId }) => buildSample({ eu, newId, cats: ix.cat || [], pagtos: ix.pagto || [] }));
}

export { quickAdd, imprevistoSheet, pagarFixo, recebiSheet, freelaSheet, acertoSheet, metaForm, fixoForm, catForm };
