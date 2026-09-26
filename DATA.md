# Estrutura dos dados

Tudo é um registro com `id`, `kind`, `escopo` e datas de edição. O escopo diz onde o registro mora:

- `casa`: visível para os dois (vai para a planilha da Casa na etapa 2)
- `gabi` / `yuri`: só daquela pessoa (vai só para a planilha individual dela)

Campos comuns: `id`, `kind`, `escopo`, `criadoEm`, `criadoPor`, `editadoEm`, `excluidoEm` (Lixeira, nunca apagado de verdade), `exemplo` (dados de exemplo), `_pendente` (ainda não sincronizado).

Dinheiro é sempre inteiro em centavos (R$ 12,50 = `1250`). Porcentagens em pontos-base (12,5% = `1250`, 100% = `10000`). Datas `aaaa-mm-dd` no horário de Brasília, meses `aaaa-mm`.

| kind | escopo | campos |
|---|---|---|
| `lanc` | casa ou pessoa | `tipo` (`gasto`, `fixa`, `invest`, `aporte`), `valor`, `data`, `catId`, `fixoId`, `metaId`, `pagoPor` (só casa), `pagto`, `obs`, `voluntario` (parte de freela, não gera dívida), `pendente` + `texto` + `origem` (captura rápida) |
| `parc` | casa ou pessoa | compra parcelada: `valorTotal`, `n`, `data`, `catId`, `pagoPor`, `pagto`, `obs`, `quitadoMes` |
| `renda` | casa | `pessoa`, `tipo` (`base`, `freela`), `valor`, `data`, `separado`, `curtir` |
| `base` | casa | renda base: `pessoa`, `mes`, `valor` (vale deste mês em diante) |
| `plano` | casa ou pessoa | `mes`, `valorCasa`, `investimento`, `pcts` {catId: bps}, `freelaGuardar`, `freelaPessoal`, `limiteCasa`, `limiteParcelas`, `estimativa` |
| `cat` | casa ou pessoa | `nome`, `grupo` (`fixo`, `variavel`, `imprevisto`), `icone`, `ordem`, `extra`, `papel` (`imprevistos`, `reserva`), `arquivada` |
| `fixo` | casa ou pessoa | conta fixa: `nome`, `catId`, `valorPrevisto`, `diaVenc`, `anual`, `mesVenc`, `desde`, `ate` |
| `meta` | casa ou pessoa | `nome`, `frase`, `icone`, `alvo`, `prazo`, `aporteMensal`, `desde`, `arquivada` |
| `acerto` | casa | `de`, `para`, `valor`, `data`, `obs` |
| `remanej` | casa ou pessoa | `mes`, `de`, `para` (catIds), `valor`, `motivo` |
| `aporteExtra` | casa | `mes`, `pessoa`, `valor`, `motivo` (imprevisto que passou da Reserva) |
| `fechamento` | casa | `mes`, `fechado`, `splitGabi` (divisão travada) |
| `pagto` | casa | "Como pagou": `nome` (apelido), `tipo` (`credito`, `debito`, `pix`, `dinheiro`), `dono`, `fechamento`, `vencimento` |

Versão da estrutura: `SCHEMA_VERSION` em `js/store.js`. Qualquer mudança aqui precisa de aviso antes e de backup.
