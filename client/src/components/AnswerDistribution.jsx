import { formatPercent } from '../utils/grades';

// Estatística das respostas de uma questão (T74), calculada pelo servidor em
// GET /relatorios/aplicacoes/:id (questoes[].distribuicao). As letras são as da ordem
// cadastrada da questão: cada versão impressa pode ter mostrado a alternativa com outra letra.

// Resumo para a tabela: a alternativa mais marcada, em verde se for a correta.
export function MostMarked({ distribuicao }) {
  if (!distribuicao || distribuicao.maisMarcadas.length === 0) {
    return <span style={{ color: 'var(--muted-3)' }}>—</span>;
  }
  const maisMarcadas = distribuicao.alternativas.filter((a) => distribuicao.maisMarcadas.includes(a.letra));
  const acertou = maisMarcadas.some((a) => a.correta);
  return (
    <span style={{ fontWeight: 700, color: acertou ? 'var(--green-text)' : 'var(--red-text-strong)', whiteSpace: 'nowrap' }}>
      {distribuicao.maisMarcadas.join(' e ')} · {formatPercent(maisMarcadas[0].percentual)}
    </span>
  );
}

function Bar({ letter, text, count, percent, correct, highlighted }) {
  const color = correct ? 'var(--green-text)' : highlighted ? 'var(--red-text-strong)' : 'var(--muted-3)';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '26px minmax(0, 1fr) 120px 84px', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          color: correct ? 'white' : 'var(--ink)',
          background: correct ? 'var(--green-text)' : 'var(--border-light)',
        }}
      >
        {letter}
      </span>
      <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: highlighted ? 700 : 400 }} title={text}>
        {text}
        {correct && <span style={{ color: 'var(--green-text)', fontWeight: 600 }}> · correta</span>}
        {highlighted && <span style={{ color, fontWeight: 600 }}> · mais marcada</span>}
      </span>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--border-light)', overflow: 'hidden' }}>
        <div style={{ width: `${percent ?? 0}%`, height: '100%', background: color }} />
      </div>
      <span style={{ fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {count} · {formatPercent(percent)}
      </span>
    </div>
  );
}

// Detalhe: uma barra por alternativa e uma para quem deixou em branco ou anulou.
export default function AnswerDistribution({ distribuicao }) {
  if (!distribuicao || distribuicao.respostas === 0) {
    return <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>Ainda não há respostas corrigidas para esta questão.</div>;
  }
  return (
    <div>
      {distribuicao.alternativas.map((a) => (
        <Bar
          key={a.letra}
          letter={a.letra}
          text={a.texto}
          count={a.quantidade}
          percent={a.percentual}
          correct={a.correta}
          highlighted={distribuicao.maisMarcadas.includes(a.letra)}
        />
      ))}
      <Bar letter="–" text="Em branco ou anulada (mais de uma marcada)" count={distribuicao.emBranco.quantidade} percent={distribuicao.emBranco.percentual} />
      <div style={{ fontSize: 12, color: 'var(--muted-3)', marginTop: 6 }}>
        {distribuicao.respostas} {distribuicao.respostas === 1 ? 'resposta corrigida' : 'respostas corrigidas'}. Letras na ordem cadastrada da
        questão; nas versões embaralhadas a mesma alternativa pode ter saído com outra letra.
      </div>
    </div>
  );
}
