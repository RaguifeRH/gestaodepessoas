// ============================================================================
// Cálculo das pendências (usado no Início, no sino e nos números do menu)
// ============================================================================
import { MARCOS } from './config.js?v=13';
import { hojeISO, somarDias, diasEntre } from './ui.js?v=13';

// Quem está em experiência: ativo, admissão nos últimos 100 dias, tipo Normal.
export function emExperiencia(itens) {
  const hoje = hojeISO();
  return itens.filter(x => (x.g === 'ativo' || x.g === 'afastado') && x.a && x.t !== 'Pessoa Jurídica' && x.t !== 'Sócio' && x.t !== 'Autônomo' && x.t !== 'Estagiário'
    && diasEntre(x.a, hoje) >= 0 && diasEntre(x.a, hoje) <= 100);
}

// Estado de cada marco: ok (registrado), hoje, atr (venceu e não registrado), pend (ainda vai vencer).
export function estadoMarco(item, marco, reg, inicio) {
  if (reg && reg[marco.id] && reg[marco.id].em) return 'ok';
  const data = somarDias(item.a, marco.dia), hoje = hojeISO();
  if (inicio && data < inicio) return 'na'; // antes do início do acompanhamento no sistema
  if (data === hoje) return 'hoje';
  if (data < hoje) return 'atr';
  return 'pend';
}

// Lista de pendências da experiência (hoje e atrasadas).
export function pendenciasExperiencia(itens, exp, inicio) {
  const l = [];
  emExperiencia(itens).forEach(x => {
    MARCOS.forEach(m => {
      const e = estadoMarco(x, m, exp[x.i], inicio);
      if (e === 'hoje' || e === 'atr') l.push({ pessoa: x, marco: m, estado: e, data: somarDias(x.a, m.dia) });
    });
  });
  return l.sort((a, b) => a.data.localeCompare(b.data));
}

export function aniversariantes(itens, dias = 7) {
  const hoje = new Date(); const r = [];
  for (let k = 0; k < dias; k++) {
    const d = new Date(hoje); d.setDate(d.getDate() + k);
    const mmdd = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    itens.filter(x => x.b === mmdd && (x.g === 'ativo' || x.g === 'afastado')).forEach(x => r.push({ pessoa: x, dia: k }));
  }
  return r;
}
