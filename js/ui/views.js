// Building blocks shared by several screens.

import { icon } from './icons.js';
import { esc, money, pct, bar, ratio } from './dom.js';
import { fmtMonth, addMonths, monthLabel, thisMonth } from '../core/dates.js';
import { fmtMoney } from '../core/money.js';
import * as C from '../core/calc.js';
import { barChart } from './chart.js';

export function monthPicker(mes, { act = 'mes' } = {}) {
  const next = addMonths(mes, 1);
  const canNext = next <= addMonths(thisMonth(), 6);
  return `<div class="monthpick">
    <button class="icon-btn" data-act="${act}" data-mes="${addMonths(mes, -1)}" aria-label="Mês anterior">${icon('left')}</button>
    <div class="m">${esc(fmtMonth(mes, { cap: true }))}</div>
    <button class="icon-btn" data-act="${act}" data-mes="${next}" aria-label="Próximo mês" ${canNext ? '' : 'disabled style="opacity:.3"'}>${icon('right')}</button>
  </div>`;
}

export function catIcon(c) {
  return icon(c?.icone || (c?.grupo === 'imprevisto' ? 'alert' : 'dots'));
}

// Category rows with budget bars
export function catRows(plan, { link = true } = {}) {
  if (!plan.rows.length) return '<div class="empty small">Nenhuma categoria ainda. Crie em Plano.</div>';
  return `<div class="list">${plan.rows.map(r => {
    const over = r.gasto > r.orcamento;
    const extra = r.cat.extra ? '<span class="tag" title="Categoria marcada como extra">extra</span>' : '';
    const mv = r.remanejado ? `<span class="${r.remanejado < 0 ? 'bad' : 'good'}">${r.remanejado < 0 ? '' : '+'}${money(r.remanejado)} remanejado</span>` : `<span>${pct(r.pct)} do livre</span>`;
    return `<button class="catrow" ${link ? `data-act="cat" data-id="${r.cat.id}"` : ''}>
      ${catIcon(r.cat)}
      <div class="name"><span>${esc(r.cat.nome)}</span>${extra}</div>
      <div class="val">${money(r.gasto)} <span class="muted">/ ${money(r.orcamento)}</span></div>
      ${bar(r.gasto, r.orcamento)}
      <div class="meta">${mv}<span class="${over ? 'bad' : ''}">${over ? `passou ${money(r.gasto - r.orcamento)}` : `resta ${money(r.resta)}`}</span></div>
    </button>`;
  }).join('')}</div>`;
}

// The plan as a short waterfall: from income to the Livre
export function waterfall(plan, nome) {
  const w = (l, v, { sign = '-', ic = '', cls = '' } = {}) => v ? `<div class="w ${cls}"><span class="l">${ic ? icon(ic) : ''}${esc(l)}</span><span>${sign === '-' ? '-' : '+'} ${money(v)}</span></div>` : '';
  const head = plan.escopo === 'casa'
    ? `<div class="w"><span class="l">Valor da casa</span><span>${money(plan.valorCasa)}</span></div>`
    : `<div class="w"><span class="l">Minha renda base</span><span>${money(plan.base)}</span></div>
       ${w('Minha parte da casa', plan.contrib)}${w('Aporte extra para a casa', plan.aporteExtra)}`;
  return `<div class="wf">
    ${head}
    ${w('Contas fixas', plan.fixos.mensal)}
    ${w('Provisão anual (IPVA, seguro...)', plan.fixos.provisao)}
    ${w('Investimento', plan.invest)}
    ${w('Metas', plan.metas)}
    ${w('Parcelas já comprometidas', plan.parcelas.total)}
    ${plan.escopo === 'casa' ? w('Aporte extra para imprevistos', plan.extras.total, { sign: '+' }) : w('Curtir dos freelas', plan.curtir, { sign: '+' })}
    <div class="w total"><span>Livre para o mês</span><span class="${plan.livre < 0 ? 'bad' : ''}">${money(plan.livre + (plan.escopo === 'casa' ? plan.extras.total : 0))}</span></div>
  </div>`;
}

export function aindaDaCard(plan, titulo) {
  const livre = plan.livre + (plan.escopo === 'casa' ? plan.extras.total : 0);
  const gasto = plan.spentTotal;
  return `<div class="card summary">
    <div class="head"><span>${esc(titulo)}</span>${plan.plano.estimativa ? '<span class="tag warn">estimativa</span>' : ''}</div>
    <div class="big ${plan.aindaDa < 0 ? 'bad' : ''}">${money(plan.aindaDa)}</div>
    ${bar(gasto, livre, { lg: true })}
    <div class="row between small ink2" style="margin-top:8px"><span>Gasto ${money(gasto)}</span><span>de ${money(livre)}</span></div>
  </div>`;
}

export function guardadoExtrasCard(ix, escopo, mes) {
  const ge = C.guardadoExtras(ix, escopo, mes);
  const max = Math.max(ge.guardado, ge.extras, 1);
  const hist = [];
  for (let i = 5; i >= 0; i--) {
    const m = addMonths(mes, -i);
    const g = C.guardadoExtras(ix, escopo, m);
    hist.push({ m, ...g });
  }
  const diffPoints = hist.map(h => ({ label: monthLabel(h.m), value: Math.max(0, h.guardado) }));
  const msg = ge.guardado === 0 && ge.extras === 0
    ? '<span class="muted">Ainda nada este mês.</span>'
    : ge.ganhando
      ? `<span class="good">${icon('check')} O guardado está ganhando das bobeiras. Boa!</span>`
      : `<span class="warn">Os extras passaram o guardado${ge.maiorExtra ? `, principalmente ${esc(ge.maiorExtra.cat?.nome || '')}` : ''}.</span>`;
  const streak = hist.filter(h => h.ganhando).length;
  return `<div class="card">
    <div class="card-title"><h3>Guardado x Extras</h3><span class="tag ${ge.ganhando ? 'good' : ''}">${streak} de 6 meses</span></div>
    <div class="pair">
      <div class="p"><span>Guardado</span>${bar(ge.guardado, max, { cls: 'g' })}<span class="right">${money(ge.guardado)}</span></div>
      <div class="p"><span>Extras</span>${bar(ge.extras, max, { cls: 'e' })}<span class="right">${money(ge.extras)}</span></div>
    </div>
    <p class="small" style="margin:12px 0 4px;display:flex;gap:6px;align-items:center">${msg}</p>
    <div class="hint" style="margin-top:10px">Guardado nos últimos 6 meses</div>
    ${barChart(diffPoints, { height: 110, fmt: (v) => fmtMoney(v), hl: 5 })}
  </div>`;
}

export function saldoResumo(ix, nome) {
  const s = C.saldo(ix, thisMonth());
  if (!s.deve) return `<div class="row"><div class="icirc">${icon('scale')}</div><div class="grow"><b>Tudo certo entre vocês</b><div class="small muted">Ninguém deve nada.</div></div></div>`;
  return `<div class="row"><div class="icirc">${icon('scale')}</div><div class="grow"><b>${esc(nome(s.deve))} deve ${money(s.valor)}</b><div class="small muted">para ${esc(nome(s.recebe))}</div></div>${icon('right', 'chev')}</div>`;
}

export function metaCard(ix, meta, hojeMes, { compact = false } = {}) {
  const p = C.metaProgresso(ix, meta, hojeMes);
  return `<button class="card tight" data-act="meta" data-id="${meta.id}" style="width:100%;text-align:left">
    <div class="row">
      <div class="icirc ${compact ? '' : 'lg'}">${icon(meta.icone || 'target')}</div>
      <div class="grow">
        ${compact ? '<div class="small muted">Próxima meta</div>' : `<div class="small muted">${meta.escopo === 'casa' ? 'Conjunta' : 'Só minha'}</div>`}
        <div class="row between"><b class="ellipsis">${esc(meta.nome)}</b>${icon('right', 'chev')}</div>
        <div style="margin:8px 0 6px">${bar(p.guardado, meta.alvo || 1, { cls: 'dark' })}</div>
        <div class="row between small"><span>${money(p.guardado)} de ${money(meta.alvo || 0)}</span><span>${pct(p.pct)}</span></div>
      </div>
    </div>
  </button>`;
}

export { ratio };
