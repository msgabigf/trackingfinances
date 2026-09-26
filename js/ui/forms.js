// Quick-add and the other small forms, all shown as bottom sheets.

import * as D from '../data.js';
import * as C from '../core/calc.js';
import { parseMoney, fmtMoney, fmtMoneyPlain, installments, parsePct, fmtPct } from '../core/money.js';
import { today, addDays, monthOf, addMonths, fmtMonthShort, fmtDate, thisMonth, dateIn } from '../core/dates.js';
import { icon, ICON_NAMES } from './icons.js';
import { esc, money, $, $$ } from './dom.js';
import { openSheet, closeSheet, toast, confirmSheet } from './overlay.js';

const TIPOS = [
  { id: 'gasto', nome: 'Gasto', ic: 'bag' },
  { id: 'fixa', nome: 'Conta fixa', ic: 'receipt' },
  { id: 'invest', nome: 'Investimento', ic: 'sprout' },
  { id: 'aporte', nome: 'Meta', ic: 'target' },
];

const moneyInput = (id, cents, { autofocus = false, big = true } = {}) => big
  ? `<div class="money-in"><span>R$</span><input id="${id}" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${cents ? esc(fmtMoneyPlain(cents)) : ''}" ${autofocus ? 'autofocus' : ''} aria-label="Valor"></div>`
  : `<input class="input num" id="${id}" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${cents != null ? esc(fmtMoneyPlain(cents)) : ''}">`;

function chips(items, selected, name) {
  return items.map(it => `<button type="button" class="chip ${it.id === selected ? 'on' : ''}" data-${name}="${esc(it.id)}">${it.ic ? icon(it.ic) : ''}${esc(it.nome)}</button>`).join('');
}

function pessoaSeg(sel, attr = 'pagopor') {
  return `<div class="seg">${C.PESSOAS.map(p => `<button type="button" class="${p === sel ? 'on' : ''}" data-${attr}="${p}">${esc(D.nome(p))}</button>`).join('')}</div>`;
}

function catOptions(ix, escopo, tipo) {
  if (tipo === 'gasto') {
    const cats = [...C.catsOf(ix, escopo, 'variavel'), ...C.catsOf(ix, escopo, 'imprevisto')]
      .filter(c => c.papel !== 'reserva' && !c.arquivada);
    return cats.map(c => ({ id: c.id, nome: c.nome, ic: c.icone }));
  }
  if (tipo === 'fixa') return C.catsOf(ix, escopo, 'fixo').filter(c => !c.arquivada).map(c => ({ id: c.id, nome: c.nome, ic: c.icone }));
  return [];
}

// ---------------------------------------------------------------- quick add / edit

export function quickAdd(ctx, preset = {}) {
  const eu = D.eu();
  const ult = D.settings().ultimo || {};
  const editing = preset.editing || null;
  const isParc = editing?.kind === 'parc';
  const st = {
    escopo: editing?.escopo || preset.escopo || ult.escopo || 'casa',
    tipo: editing?.tipo || preset.tipo || ult.tipo || 'gasto',
    catId: editing?.catId || preset.catId || null,
    fixoId: editing?.fixoId || preset.fixoId || null,
    metaId: editing?.metaId || preset.metaId || null,
    pagoPor: editing?.pagoPor || eu,
    data: editing?.data || today(),
    pagto: editing?.pagto ?? ult.pagto ?? null,
    parcelado: isParc,
    n: editing?.n || 2,
    obs: editing?.obs || editing?.texto || '',
  };
  if (editing?.pendente) { st.escopo = ult.escopo || 'casa'; st.tipo = 'gasto'; }
  if (!st.catId && st.tipo === (ult.tipo || 'gasto') && st.escopo === (ult.escopo || 'casa')) st.catId = ult.catId || null;
  const valor0 = isParc ? editing.valorTotal : editing?.valor;

  const title = editing?.pendente ? 'Classificar' : editing ? 'Editar' : 'Novo lançamento';
  const sheet = openSheet(`
    <div class="sheet-head"><h2 class="h3">${title}</h2><button class="icon-btn" data-x aria-label="Fechar">${icon('x')}</button></div>
    <form id="qa" class="stack" autocomplete="off">
      ${moneyInput('qa-valor', valor0, { autofocus: !editing })}
      <div id="qa-err" class="err center" hidden></div>
      <div id="qa-dyn" class="stack"></div>
      <div class="field"><label for="qa-obs">Observação</label>
        <input class="input" id="qa-obs" maxlength="140" value="${esc(st.obs)}" placeholder="Opcional">
        <span class="hint">Não coloque dados de cartão, conta ou senha aqui.</span></div>
      <div class="stack-sm">
        <button class="btn" type="submit">${editing?.pendente ? 'Pronto' : 'Salvar'}</button>
        ${editing ? '' : '<button class="btn outline" type="button" data-rapido>Salvar rápido (só o valor)</button>'}
        ${isParc ? '<button class="btn ghost" type="button" data-quitar>Quitar antecipado</button>' : ''}
        ${editing ? '<button class="btn danger" type="button" data-del>Apagar</button>' : ''}
      </div>
    </form>`);

  const dyn = $('#qa-dyn', sheet);
  const valorEl = $('#qa-valor', sheet);
  const err = $('#qa-err', sheet);

  function render() {
    const ix = D.ix();
    const opts = catOptions(ix, st.escopo, st.tipo);
    if (st.tipo !== 'invest' && st.tipo !== 'aporte' && st.catId && !opts.some(o => o.id === st.catId)) st.catId = null;
    const fixos = st.tipo === 'fixa' ? (ix.fixo || []).filter(f => f.escopo === st.escopo && !f.arquivado) : [];
    const metas = st.tipo === 'aporte' ? (ix.meta || []).filter(m => m.escopo === st.escopo && !m.arquivada) : [];
    const pagtos = ix.pagto || [];
    const v = parseMoney(valorEl.value) || 0;
    const parcs = st.parcelado && st.n >= 2 && v > 0 ? installments(v, st.n) : null;
    const ontem = addDays(today(), -1);
    dyn.innerHTML = `
      ${isParc ? '' : `<div class="seg" role="tablist" aria-label="De quem">
        <button type="button" class="${st.escopo === 'casa' ? 'on' : ''}" data-escopo="casa">${icon('home')} Casa</button>
        <button type="button" class="${st.escopo === eu ? 'on' : ''}" data-escopo="${eu}">${icon('lock')} Só meu</button>
      </div>`}
      ${isParc ? '' : `<div class="chips">${chips(TIPOS, st.tipo, 'tipo')}</div>`}
      ${st.tipo === 'fixa' && fixos.length ? `<div class="field"><span class="lbl">Qual conta?</span><div class="chips scroll">${chips(fixos.map(f => ({ id: f.id, nome: f.nome })), st.fixoId, 'fixo')}</div></div>` : ''}
      ${opts.length && !(st.tipo === 'fixa' && st.fixoId) ? `<div class="field"><span class="lbl">Categoria</span><div class="chips scroll">${chips(opts, st.catId, 'cat')}</div></div>` : ''}
      ${st.tipo === 'aporte' ? (metas.length ? `<div class="field"><span class="lbl">Para qual meta?</span><div class="chips scroll">${chips(metas.map(m => ({ id: m.id, nome: m.nome, ic: m.icone || 'target' })), st.metaId, 'meta')}</div></div>` : '<div class="hint">Nenhuma meta ainda. Crie uma na aba Metas.</div>') : ''}
      ${st.escopo === 'casa' ? `<div class="field"><span class="lbl">Quem pagou</span>${pessoaSeg(st.pagoPor)}</div>` : ''}
      <div class="field"><span class="lbl">Data</span>
        <div class="row">
          <div class="chips">
            <button type="button" class="chip ${st.data === today() ? 'on' : ''}" data-dia="${today()}">Hoje</button>
            <button type="button" class="chip ${st.data === ontem ? 'on' : ''}" data-dia="${ontem}">Ontem</button>
          </div>
          <input class="input grow" type="date" id="qa-data" value="${st.data}" style="min-width:0">
        </div></div>
      ${pagtos.length ? `<div class="field"><span class="lbl">Como pagou <span class="muted">(opcional)</span></span><div class="chips scroll">${chips(pagtos.map(p => ({ id: p.id, nome: p.nome, ic: p.tipo === 'credito' || p.tipo === 'debito' ? 'card' : p.tipo === 'pix' ? 'bolt' : 'coins' })), st.pagto, 'pagto')}</div></div>` : ''}
      ${st.tipo === 'gasto' && (!editing || isParc) ? `
        <label class="switch"><span>Parcelado?</span><input type="checkbox" id="qa-parc" ${st.parcelado ? 'checked' : ''} ${isParc ? 'disabled' : ''}></label>
        ${st.parcelado ? `<div class="field"><span class="lbl">Número de parcelas (valor acima é o total)</span>
          <input class="input" id="qa-n" inputmode="numeric" value="${st.n}" min="2" max="24"></div>
          ${parcs ? `<div class="notice">${icon('calendar')}<div>Isso compromete <b>${money(parcs[1] ?? parcs[0])} por mês</b> até <b>${esc(fmtMonthShort(addMonths(monthOf(st.data), st.n - 1)))}</b>.</div></div>` : ''}` : ''}` : ''}
    `;
  }
  render();
  if (!editing) setTimeout(() => valorEl.focus(), 280);

  sheet.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if ('x' in ds) return closeSheet();
    if (ds.escopo) { st.escopo = ds.escopo; st.catId = null; st.fixoId = null; st.metaId = null; }
    else if (ds.tipo) { st.tipo = ds.tipo; st.catId = null; st.fixoId = null; st.metaId = null; if (st.tipo !== 'gasto') st.parcelado = false; }
    else if (ds.cat) st.catId = ds.cat;
    else if (ds.fixo) { st.fixoId = st.fixoId === ds.fixo ? null : ds.fixo; const f = D.get(st.fixoId); if (f && !valorEl.value) valorEl.value = fmtMoneyPlain(f.valorPrevisto); }
    else if (ds.meta) st.metaId = ds.meta;
    else if (ds.pagopor) st.pagoPor = ds.pagopor;
    else if (ds.dia) st.data = ds.dia;
    else if (ds.pagto) st.pagto = st.pagto === ds.pagto ? null : ds.pagto;
    else if ('rapido' in ds) return salvarRapido();
    else if ('del' in ds) return apagar();
    else if ('quitar' in ds) return quitar();
    else return;
    render();
  });
  sheet.addEventListener('change', (e) => {
    if (e.target.id === 'qa-data' && e.target.value) { st.data = e.target.value; render(); }
    if (e.target.id === 'qa-parc') { st.parcelado = e.target.checked; render(); }
    if (e.target.id === 'qa-n') { st.n = Math.min(24, Math.max(2, parseInt(e.target.value, 10) || 2)); render(); }
  });
  valorEl.addEventListener('input', () => { if (st.parcelado) render(); err.hidden = true; });

  async function salvarRapido() {
    const v = parseMoney(valorEl.value);
    if (!v || v <= 0) return showErr('Digite o valor.');
    const rec = await D.save({ kind: 'lanc', escopo: eu, pendente: true, valor: v, texto: $('#qa-obs', sheet).value.trim(), data: st.data, origem: 'app' });
    closeSheet();
    toast('Salvo em Pendentes', { action: 'Desfazer', onAction: () => D.remove(rec.id) });
  }

  async function apagar() {
    const ok = await confirmSheet('Apagar este lançamento?', 'Ele vai para a Lixeira por 30 dias e pode ser restaurado.', { ok: 'Apagar', danger: true });
    if (!ok) return;
    await D.remove(editing.id);
    toast('Movido para a Lixeira', { action: 'Desfazer', onAction: () => D.restore(editing.id) });
  }

  async function quitar() {
    const mes = thisMonth();
    const ok = await confirmSheet('Quitar antecipado?', `As parcelas que faltam passam a contar em ${esc(fmtMonthShort(mes))}.`, { ok: 'Quitar' });
    if (!ok) return;
    await D.save({ ...editing, quitadoMes: mes });
    toast('Parcelas quitadas');
  }

  function showErr(msg) { err.textContent = msg; err.hidden = false; valorEl.focus(); }

  $('#qa', sheet).addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = parseMoney(valorEl.value);
    if (!v || v <= 0) return showErr('Digite um valor maior que zero.');
    const obs = $('#qa-obs', sheet).value.trim().slice(0, 140);
    const fixo = st.fixoId ? D.get(st.fixoId) : null;
    const catId = st.tipo === 'fixa' && fixo ? fixo.catId : st.catId;
    if ((st.tipo === 'gasto') && !catId) return showErr('Escolha uma categoria.');
    if (st.tipo === 'aporte' && !st.metaId) return showErr('Escolha a meta.');
    const ixBefore = D.ix();
    const mes = monthOf(st.data);
    const before = st.escopo === 'casa' ? C.planoCasa(ixBefore, mes) : C.planoPessoal(ixBefore, st.escopo, mes);

    let saved;
    if (isParc) {
      saved = await D.save({ ...editing, valorTotal: v, n: st.n, data: st.data, catId, pagoPor: st.escopo === 'casa' ? st.pagoPor : null, pagto: st.pagto, obs });
    } else if (st.parcelado && st.tipo === 'gasto') {
      saved = await D.save({ kind: 'parc', escopo: st.escopo, tipo: 'gasto', valorTotal: v, n: st.n, data: st.data, catId, pagoPor: st.escopo === 'casa' ? st.pagoPor : null, pagto: st.pagto, obs });
    } else {
      const fields = {
        kind: 'lanc', escopo: st.escopo, tipo: st.tipo, valor: v, data: st.data, catId: catId || null,
        fixoId: st.tipo === 'fixa' ? st.fixoId : null, metaId: st.tipo === 'aporte' ? st.metaId : null,
        pagoPor: st.escopo === 'casa' ? st.pagoPor : null, pagto: st.pagto, obs, pendente: false,
      };
      if (editing && editing.escopo === st.escopo) {
        const { texto, origem, ...rest } = editing;
        saved = await D.save({ ...rest, ...fields });
      } else {
        // moving between the house and my private data = a new record (the old one is tombstoned)
        saved = await D.save(fields);
        if (editing) await D.remove(editing.id);
      }
    }
    await D.saveSettings({ ultimo: { escopo: st.escopo, tipo: st.tipo, catId: st.catId, pagto: st.pagto } });
    closeSheet();

    const ix = D.ix();
    const after = st.escopo === 'casa' ? C.planoCasa(ix, mes) : C.planoPessoal(ix, st.escopo, mes);
    let msg = editing ? 'Alterado' : 'Salvo';
    if (st.tipo === 'fixa' && fixo) {
      const diff = v - (fixo.valorPrevisto || 0);
      const big = before.rows.slice().sort((a, b) => b.orcamento - a.orcamento)[0];
      const bigAfter = big && after.rows.find(r => r.cat.id === big.cat.id);
      if (diff > 0 && big && bigAfter && bigAfter.orcamento !== big.orcamento) {
        msg = `${fixo.nome} veio ${fmtMoney(diff)} maior. ${big.cat.nome} foi de ${fmtMoney(big.orcamento)} para ${fmtMoney(bigAfter.orcamento)}.`;
      }
    }
    if (!editing) toast(msg, { action: 'Desfazer', onAction: () => D.remove(saved.id), ms: 6000 });
    else toast(msg);
    if (st.escopo === 'casa' && after.overflow > 0 && after.overflow > (before.overflow || 0)) {
      setTimeout(() => imprevistoSheet(ctx, mes), 350);
    }
  });
}

// ---------------------------------------------------------------- imprevisto: "De onde tirar?"

export function imprevistoSheet(ctx, mes) {
  const ix = D.ix();
  const plan = C.planoCasa(ix, mes);
  const s = C.sugerirImprevisto(ix, plan);
  if (!s) return toast('Os imprevistos estão cobertos.');
  const sheet = openSheet(`
    <div class="sheet-head"><h2 class="h3">De onde tirar ${money(s.falta)}?</h2><button class="icon-btn" data-x aria-label="Fechar">${icon('x')}</button></div>
    <div class="stack">
      <p class="ink2 small" style="margin:0">O orçamento de Imprevistos acabou. Sugestão: tirar primeiro das bobeiras da casa, depois da Reserva${s.aporte ? ', e o resto como aporte extra de cada um' : ''}. Pode ajustar os valores.</p>
      <div class="list">
        ${s.remanejes.map((r, i) => `<div class="item"><div class="grow"><div class="t">${esc(r.nome)}</div></div><div style="width:130px">${moneyInput(`rm-${i}`, r.valor, { big: false })}</div></div>`).join('')}
        ${s.aporte ? C.PESSOAS.map(p => `<div class="item"><div class="grow"><div class="t">Aporte extra de ${esc(D.nome(p))}</div><div class="s">sai do mês pessoal de ${esc(D.nome(p))}</div></div><div style="width:130px">${moneyInput(`ap-${p}`, s.aporte[p], { big: false })}</div></div>`).join('') : ''}
      </div>
      <div id="im-sum" class="small ink2"></div>
      <button class="btn" data-ok>Combinado</button>
      <button class="btn ghost" data-x>Agora não</button>
    </div>`);
  const read = () => {
    const rem = s.remanejes.map((r, i) => ({ ...r, valor: Math.max(0, parseMoney($(`#rm-${i}`, sheet).value) || 0) }));
    const ap = s.aporte ? Object.fromEntries(C.PESSOAS.map(p => [p, Math.max(0, parseMoney($(`#ap-${p}`, sheet).value) || 0)])) : null;
    const total = rem.reduce((a, r) => a + r.valor, 0) + (ap ? ap.gabi + ap.yuri : 0);
    return { rem, ap, total };
  };
  const upd = () => {
    const { total } = read();
    const falta = s.falta - total;
    $('#im-sum', sheet).innerHTML = falta > 0 ? `<span class="warn">Ainda faltam ${money(falta)}. O mês fecharia no negativo.</span>` : `<span class="good">${icon('check')} Cobre tudo.</span>`;
  };
  upd();
  sheet.addEventListener('input', upd);
  sheet.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('x' in b.dataset) return closeSheet();
    if ('ok' in b.dataset) {
      const { rem, ap } = read();
      const motivo = 'Imprevisto';
      const recs = rem.filter(r => r.valor > 0).map(r => ({ kind: 'remanej', escopo: 'casa', mes, de: r.de, para: s.para, valor: r.valor, motivo }));
      if (ap) for (const p of C.PESSOAS) if (ap[p] > 0) recs.push({ kind: 'aporteExtra', escopo: 'casa', mes, pessoa: p, valor: ap[p], motivo });
      await D.saveMany(recs);
      closeSheet();
      toast('Remanejado. Os orçamentos do mês foram ajustados.');
    }
  });
}

// ---------------------------------------------------------------- fixed bill payment

export function pagarFixo(ctx, fixo, mes) {
  const eu = D.eu();
  quickAdd(ctx, { escopo: fixo.escopo, tipo: 'fixa', fixoId: fixo.id, catId: fixo.catId });
  const input = document.getElementById('qa-valor');
  if (input) input.value = fmtMoneyPlain(fixo.valorPrevisto || 0);
  const dataEl = document.getElementById('qa-data');
  if (dataEl && mes !== thisMonth()) {
    dataEl.value = dateIn(mes, fixo.diaVenc || 1);
    dataEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
  void eu;
}

// ---------------------------------------------------------------- income

export function recebiSheet(ctx, { pessoa = D.eu(), editing = null } = {}) {
  const st = { pessoa: editing?.pessoa || pessoa, tipo: editing?.tipo || 'base', data: editing?.data || today() };
  const sheet = openSheet(`
    <div class="sheet-head"><h2 class="h3">${editing ? 'Editar renda' : 'Recebi'}</h2><button class="icon-btn" data-x aria-label="Fechar">${icon('x')}</button></div>
    <form class="stack" id="rc">
      ${moneyInput('rc-valor', editing?.valor, { autofocus: !editing })}
      <div id="rc-err" class="err center" hidden></div>
      <div id="rc-dyn" class="stack"></div>
      <div class="field"><label for="rc-data">Data</label><input class="input" type="date" id="rc-data" value="${st.data}"></div>
      <button class="btn" type="submit">Salvar</button>
      ${editing ? '<button class="btn danger" type="button" data-del>Apagar</button>' : ''}
    </form>`);
  const dyn = $('#rc-dyn', sheet);
  const render = () => {
    dyn.innerHTML = `
      <div class="field"><span class="lbl">De quem</span>${pessoaSeg(st.pessoa, 'pessoa')}</div>
      <div class="field"><span class="lbl">Tipo</span><div class="seg">
        <button type="button" class="${st.tipo === 'base' ? 'on' : ''}" data-tipo="base">Renda base</button>
        <button type="button" class="${st.tipo === 'freela' ? 'on' : ''}" data-tipo="freela">Freela / extra</button></div>
        <span class="hint">${st.tipo === 'base' ? 'Salário ou o que dá para contar todo mês.' : 'Tudo acima da base. 70% vai para guardar.'}</span></div>`;
  };
  render();
  if (!editing) setTimeout(() => $('#rc-valor', sheet).focus(), 280);
  sheet.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('x' in b.dataset) return closeSheet();
    if (b.dataset.pessoa) { st.pessoa = b.dataset.pessoa; render(); }
    if (b.dataset.tipo) { st.tipo = b.dataset.tipo; render(); }
    if ('del' in b.dataset) { await D.remove(editing.id); closeSheet(); toast('Movido para a Lixeira', { action: 'Desfazer', onAction: () => D.restore(editing.id) }); }
  });
  $('#rc', sheet).addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = parseMoney($('#rc-valor', sheet).value);
    if (!v || v <= 0) { const er = $('#rc-err', sheet); er.textContent = 'Digite o valor.'; er.hidden = false; return; }
    const data = $('#rc-data', sheet).value || today();
    const rec = await D.save({ ...(editing || {}), kind: 'renda', escopo: 'casa', pessoa: st.pessoa, tipo: st.tipo, valor: v, data, separado: editing?.separado || false });
    // first income ever: use it as the Renda base suggestion
    const ix = D.ix();
    if (st.tipo === 'base' && !(ix.base || []).some(b => b.pessoa === st.pessoa)) {
      await D.save({ kind: 'base', escopo: 'casa', pessoa: st.pessoa, mes: monthOf(data), valor: v });
    }
    closeSheet();
    if (st.tipo === 'freela' && st.pessoa === D.eu() && !rec.separado) setTimeout(() => freelaSheet(ctx, rec), 300);
    else toast('Renda salva');
  });
}

export function freelaSheet(ctx, renda) {
  const ix = D.ix();
  const plano = C.planoDe(ix, 'casa', monthOf(renda.data));
  const s = C.separarFreela(renda.valor, plano);
  const metas = (ix.meta || []).filter(m => m.escopo === 'casa' && !m.arquivada);
  const minhasMetas = (ix.meta || []).filter(m => m.escopo === D.eu() && !m.arquivada);
  let destino = metas[0]?.id || 'invest';
  let destinoMeu = 'invest';
  const sheet = openSheet(`
    <div class="sheet-head"><h2 class="h3">Separar agora?</h2><button class="icon-btn" data-x aria-label="Fechar">${icon('x')}</button></div>
    <div class="stack">
      <p class="ink2 small" style="margin:0">Freela de ${money(renda.valor)}. Regra: ${esc(fmtPct(plano.freelaGuardar))} para guardar (metade sua, metade da casa) e o resto para curtir.</p>
      <div class="field"><span class="lbl">Guardar para mim</span>${moneyInput('fr-meu', s.pessoal, { big: false })}
        <div class="chips scroll" id="fr-dm">${chips([{ id: 'invest', nome: 'Meu investimento', ic: 'sprout' }, ...minhasMetas.map(m => ({ id: m.id, nome: m.nome, ic: m.icone || 'target' }))], destinoMeu, 'dm')}</div></div>
      <div class="field"><span class="lbl">Guardar para a casa</span>${moneyInput('fr-casa', s.conjunto, { big: false })}
        <div class="chips scroll" id="fr-dc">${chips([...metas.map(m => ({ id: m.id, nome: m.nome, ic: m.icone || 'target' })), { id: 'invest', nome: 'Investimento da casa', ic: 'sprout' }], destino, 'dc')}</div>
        <span class="hint">É voluntário: não vira dívida entre vocês.</span></div>
      <div class="field"><span class="lbl">Para curtir</span>${moneyInput('fr-curtir', s.curtir, { big: false })}</div>
      <div id="fr-err" class="err" hidden></div>
      <button class="btn" data-ok>Separar</button>
      <button class="btn ghost" data-x>Depois</button>
    </div>`);
  sheet.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('x' in b.dataset) return closeSheet();
    if (b.dataset.dc) { destino = b.dataset.dc; $$('[data-dc]', sheet).forEach(x => x.classList.toggle('on', x.dataset.dc === destino)); return; }
    if (b.dataset.dm) { destinoMeu = b.dataset.dm; $$('[data-dm]', sheet).forEach(x => x.classList.toggle('on', x.dataset.dm === destinoMeu)); return; }
    if ('ok' in b.dataset) {
      const meu = parseMoney($('#fr-meu', sheet).value) || 0;
      const casa = parseMoney($('#fr-casa', sheet).value) || 0;
      const curtir = parseMoney($('#fr-curtir', sheet).value) || 0;
      if (meu + casa + curtir !== renda.valor) {
        const er = $('#fr-err', sheet);
        er.textContent = `A soma precisa dar ${fmtMoney(renda.valor)} (está ${fmtMoney(meu + casa + curtir)}).`;
        er.hidden = false;
        return;
      }
      const eu = D.eu();
      const recs = [];
      if (meu > 0) recs.push({ kind: 'lanc', escopo: eu, tipo: destinoMeu === 'invest' ? 'invest' : 'aporte', metaId: destinoMeu === 'invest' ? null : destinoMeu, valor: meu, data: renda.data, voluntario: true, obs: 'Parte do freela' });
      if (casa > 0) recs.push({ kind: 'lanc', escopo: 'casa', tipo: destino === 'invest' ? 'invest' : 'aporte', metaId: destino === 'invest' ? null : destino, valor: casa, data: renda.data, pagoPor: eu, voluntario: true, obs: 'Parte do freela' });
      recs.push({ ...renda, separado: true, curtir });
      await D.saveMany(recs);
      closeSheet();
      toast(`Separado. ${fmtMoney(curtir)} livres para curtir.`);
    }
  });
}

// ---------------------------------------------------------------- acerto

export function acertoSheet(ctx) {
  const s = C.saldo(D.ix(), thisMonth());
  const st = { de: s.deve || D.eu() };
  const sheet = openSheet(`
    <div class="sheet-head"><h2 class="h3">Registrar acerto</h2><button class="icon-btn" data-x aria-label="Fechar">${icon('x')}</button></div>
    <form class="stack" id="ac">
      ${moneyInput('ac-valor', s.valor || null, { autofocus: !s.valor })}
      <div class="field"><span class="lbl">Quem pagou para o outro</span><div id="ac-de">${pessoaSeg(st.de, 'de')}</div>
        <span class="hint">Também serve para empréstimo: quando um paga algo só do outro.</span></div>
      <div class="field"><label for="ac-data">Data</label><input class="input" type="date" id="ac-data" value="${today()}"></div>
      <div class="field"><label for="ac-obs">Observação</label><input class="input" id="ac-obs" maxlength="140" placeholder="Opcional"></div>
      <button class="btn" type="submit">Salvar acerto</button>
    </form>`);
  sheet.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('x' in b.dataset) return closeSheet();
    if (b.dataset.de) { st.de = b.dataset.de; $('#ac-de', sheet).innerHTML = pessoaSeg(st.de, 'de'); }
  });
  $('#ac', sheet).addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = parseMoney($('#ac-valor', sheet).value);
    if (!v || v <= 0) return;
    const rec = await D.save({ kind: 'acerto', escopo: 'casa', de: st.de, para: C.outra(st.de), valor: v, data: $('#ac-data', sheet).value || today(), obs: $('#ac-obs', sheet).value.trim() });
    closeSheet();
    toast('Acerto registrado', { action: 'Desfazer', onAction: () => D.remove(rec.id) });
  });
}

// ---------------------------------------------------------------- meta

const META_ICONS = ['plane', 'home', 'car', 'heart', 'piggy', 'book', 'gift', 'star', 'sprout', 'target', 'paw', 'sparkle'];

export function metaForm(ctx, editing = null) {
  const eu = D.eu();
  const st = { escopo: editing?.escopo || 'casa', icone: editing?.icone || 'target' };
  const sheet = openSheet(`
    <div class="sheet-head"><h2 class="h3">${editing ? 'Editar meta' : 'Nova meta'}</h2><button class="icon-btn" data-x aria-label="Fechar">${icon('x')}</button></div>
    <form class="stack" id="mf">
      ${editing ? '' : `<div class="seg" id="mf-esc">
        <button type="button" class="on" data-escopo="casa">${icon('home')} Conjunta</button>
        <button type="button" data-escopo="${eu}">${icon('lock')} Só minha</button></div>`}
      <div class="field"><label for="mf-nome">Nome</label><input class="input" id="mf-nome" required maxlength="40" value="${esc(editing?.nome || '')}" placeholder="Viagem 2026"></div>
      <div class="field"><label for="mf-frase">Frase</label><input class="input" id="mf-frase" maxlength="60" value="${esc(editing?.frase || '')}" placeholder="Explorar novos lugares, juntos."></div>
      <div class="field"><label for="mf-alvo">Quanto queremos juntar</label>${moneyInput('mf-alvo', editing?.alvo, { big: false })}</div>
      <div class="grid2">
        <div class="field"><label for="mf-prazo">Até quando</label><input class="input" type="month" id="mf-prazo" value="${esc(editing?.prazo || '')}"></div>
        <div class="field"><label for="mf-mensal">Por mês no plano</label>${moneyInput('mf-mensal', editing?.aporteMensal ?? null, { big: false })}</div>
      </div>
      <div class="field"><span class="lbl">Ícone</span><div class="chips">${META_ICONS.map(i => `<button type="button" class="chip ${i === st.icone ? 'on' : ''}" data-ic="${i}" aria-label="${i}">${icon(i)}</button>`).join('')}</div></div>
      <button class="btn" type="submit">Salvar</button>
      ${editing ? `<button class="btn outline" type="button" data-arq>${editing.arquivada ? 'Desarquivar' : 'Arquivar (meta alcançada)'}</button><button class="btn danger" type="button" data-del>Apagar</button>` : ''}
    </form>`);
  sheet.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('x' in b.dataset) return closeSheet();
    if (b.dataset.escopo) { st.escopo = b.dataset.escopo; $$('[data-escopo]', sheet).forEach(x => x.classList.toggle('on', x === b)); }
    if (b.dataset.ic) { st.icone = b.dataset.ic; $$('[data-ic]', sheet).forEach(x => x.classList.toggle('on', x === b)); }
    if ('arq' in b.dataset) { await D.save({ ...editing, arquivada: !editing.arquivada }); closeSheet(); }
    if ('del' in b.dataset) {
      if (await confirmSheet('Apagar esta meta?', 'Os valores já guardados continuam nos lançamentos.', { ok: 'Apagar', danger: true })) { await D.remove(editing.id); ctx.go('#/metas'); }
    }
  });
  $('#mf', sheet).addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = $('#mf-nome', sheet).value.trim();
    if (!nome) return;
    await D.save({
      ...(editing || { kind: 'meta', escopo: st.escopo, desde: thisMonth() }),
      nome, frase: $('#mf-frase', sheet).value.trim(), icone: st.icone,
      alvo: parseMoney($('#mf-alvo', sheet).value) || 0,
      prazo: $('#mf-prazo', sheet).value || null,
      aporteMensal: parseMoney($('#mf-mensal', sheet).value) || 0,
    });
    closeSheet();
    toast('Meta salva');
  });
}

// ---------------------------------------------------------------- fixed cost definition

export function fixoForm(ctx, editing = null, escopo0 = 'casa') {
  const eu = D.eu();
  const st = { escopo: editing?.escopo || escopo0, catId: editing?.catId || null, anual: !!editing?.anual };
  const sheet = openSheet(`
    <div class="sheet-head"><h2 class="h3">${editing ? 'Editar conta fixa' : 'Nova conta fixa'}</h2><button class="icon-btn" data-x aria-label="Fechar">${icon('x')}</button></div>
    <form class="stack" id="ff">
      ${editing ? '' : `<div class="seg"><button type="button" class="${st.escopo === 'casa' ? 'on' : ''}" data-escopo="casa">${icon('home')} Casa</button><button type="button" class="${st.escopo === eu ? 'on' : ''}" data-escopo="${eu}">${icon('lock')} Só minha</button></div>`}
      <div class="field"><label for="ff-nome">Nome</label><input class="input" id="ff-nome" required maxlength="40" value="${esc(editing?.nome || '')}" placeholder="Luz"></div>
      <div class="field"><span class="lbl">Categoria</span><div class="chips scroll" id="ff-cats"></div></div>
      <div class="grid2">
        <div class="field"><label for="ff-valor">Valor esperado</label>${moneyInput('ff-valor', editing?.valorPrevisto, { big: false })}</div>
        <div class="field"><label for="ff-dia">Dia do vencimento</label><input class="input" id="ff-dia" inputmode="numeric" value="${editing?.diaVenc || ''}" placeholder="10"></div>
      </div>
      <label class="switch"><span>Anual (IPVA, seguro...)<br><span class="hint">Vira uma provisão de 1/12 por mês</span></span><input type="checkbox" id="ff-anual" ${st.anual ? 'checked' : ''}></label>
      <div class="field" id="ff-mv" ${st.anual ? '' : 'hidden'}><label for="ff-mes">Mês do vencimento (1 a 12)</label><input class="input" id="ff-mes" inputmode="numeric" value="${editing?.mesVenc || ''}"></div>
      <button class="btn" type="submit">Salvar</button>
      ${editing ? '<button class="btn danger" type="button" data-del>Encerrar esta conta</button>' : ''}
    </form>`);
  const renderCats = () => {
    const cats = C.catsOf(D.ix(), st.escopo, 'fixo').filter(c => !c.arquivada);
    if (!st.catId || !cats.some(c => c.id === st.catId)) st.catId = cats[0]?.id || null;
    $('#ff-cats', sheet).innerHTML = chips(cats.map(c => ({ id: c.id, nome: c.nome, ic: c.icone })), st.catId, 'cat');
  };
  renderCats();
  sheet.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('x' in b.dataset) return closeSheet();
    if (b.dataset.escopo) { st.escopo = b.dataset.escopo; $$('[data-escopo]', sheet).forEach(x => x.classList.toggle('on', x === b)); st.catId = null; renderCats(); }
    if (b.dataset.cat) { st.catId = b.dataset.cat; renderCats(); }
    if ('del' in b.dataset) {
      if (await confirmSheet('Encerrar esta conta fixa?', 'Ela sai do plano a partir deste mês. Os pagamentos antigos continuam.', { ok: 'Encerrar', danger: true })) {
        await D.save({ ...editing, ate: addMonths(thisMonth(), -1) });
        closeSheet();
      }
    }
  });
  $('#ff-anual', sheet).addEventListener('change', (e) => { st.anual = e.target.checked; $('#ff-mv', sheet).hidden = !st.anual; });
  $('#ff', sheet).addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = $('#ff-nome', sheet).value.trim();
    if (!nome) return;
    await D.save({
      ...(editing || { kind: 'fixo', escopo: st.escopo, desde: thisMonth() }),
      nome, catId: st.catId, valorPrevisto: parseMoney($('#ff-valor', sheet).value) || 0,
      diaVenc: Math.min(31, Math.max(1, parseInt($('#ff-dia', sheet).value, 10) || 1)),
      anual: st.anual, mesVenc: st.anual ? Math.min(12, Math.max(1, parseInt($('#ff-mes', sheet).value, 10) || 1)) : null,
    });
    closeSheet();
    toast('Conta fixa salva. O plano foi recalculado.');
  });
}

// ---------------------------------------------------------------- categories

export function catForm(ctx, escopo, editing = null) {
  const st = { grupo: editing?.grupo || 'variavel', icone: editing?.icone || 'dots', extra: !!editing?.extra };
  const grupos = escopo === 'casa'
    ? [{ id: 'variavel', nome: 'Do dia a dia' }, { id: 'fixo', nome: 'Conta fixa' }, { id: 'imprevisto', nome: 'Imprevisto' }]
    : [{ id: 'variavel', nome: 'Do dia a dia' }, { id: 'fixo', nome: 'Conta fixa' }];
  const ICS = ['cart', 'bag', 'fork', 'coffee', 'ticket', 'sofa', 'fuel', 'parking', 'bus', 'car', 'pill', 'pulse', 'wrench', 'paw', 'home', 'bolt', 'flame', 'drop', 'wifi', 'play', 'dumbbell', 'phone', 'sparkle', 'shirt', 'gift', 'book', 'heart', 'star', 'dots'];
  const sheet = openSheet(`
    <div class="sheet-head"><h2 class="h3">${editing ? 'Editar categoria' : 'Nova categoria'}</h2><button class="icon-btn" data-x aria-label="Fechar">${icon('x')}</button></div>
    <form class="stack" id="cf">
      <div class="field"><label for="cf-nome">Nome</label><input class="input" id="cf-nome" required maxlength="30" value="${esc(editing?.nome || '')}"></div>
      ${editing?.papel ? '' : `<div class="field"><span class="lbl">Tipo</span><div class="chips">${chips(grupos, st.grupo, 'grupo')}</div></div>`}
      ${editing?.papel ? '' : `<label class="switch"><span>É bobeira (extra)?<br><span class="hint">Conta no Guardado x Extras e é a primeira a ceder num imprevisto</span></span><input type="checkbox" id="cf-extra" ${st.extra ? 'checked' : ''}></label>`}
      <div class="field"><span class="lbl">Ícone</span><div class="chips">${ICS.map(i => `<button type="button" class="chip ${i === st.icone ? 'on' : ''}" data-ic="${i}" aria-label="${i}">${icon(i)}</button>`).join('')}</div></div>
      <button class="btn" type="submit">Salvar</button>
      ${editing && !editing.papel ? `<button class="btn danger" type="button" data-arq>${editing.arquivada ? 'Desarquivar' : 'Arquivar'}</button>` : ''}
    </form>`);
  sheet.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('x' in b.dataset) return closeSheet();
    if (b.dataset.grupo) { st.grupo = b.dataset.grupo; $$('[data-grupo]', sheet).forEach(x => x.classList.toggle('on', x === b)); }
    if (b.dataset.ic) { st.icone = b.dataset.ic; $$('[data-ic]', sheet).forEach(x => x.classList.toggle('on', x === b)); }
    if ('arq' in b.dataset) { await D.save({ ...editing, arquivada: !editing.arquivada }); closeSheet(); }
  });
  $('#cf', sheet).addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = $('#cf-nome', sheet).value.trim();
    if (!nome) return;
    const extra = $('#cf-extra', sheet)?.checked ?? false;
    const ordem = editing?.ordem ?? 100;
    await D.save({ ...(editing || { kind: 'cat', escopo, ordem }), nome, grupo: editing?.papel ? editing.grupo : st.grupo, icone: st.icone, extra: st.grupo === 'imprevisto' ? false : extra });
    closeSheet();
    toast('Categoria salva');
  });
}

export { ICON_NAMES, fmtDate, parsePct };
