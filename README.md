# Gabi & Yuri

Planejamento financeiro do casal. É um app que se instala na tela inicial do iPhone, abre em tela cheia e funciona sem internet.

**Etapa 1 (esta):** o app completo em cada celular, com todas as contas, e dados de exemplo para testar. Ainda não sincroniza entre os dois.
**Etapa 2:** sincronização com as planilhas do Google (uma da Casa e uma individual para cada um).
**Etapa 3:** atalhos do iPhone (Siri, toque duplo, Apple Pay), tela Conferir e guia completo.

Nenhum dado pessoal fica neste repositório. Tudo que vocês lançam fica no celular e, a partir da etapa 2, nas planilhas de vocês.

## 1. Publicar (GitHub Pages, grátis)

1. Junte esta branch na `main` (pelo pull request).
2. O GitHub Pages grátis precisa de repositório público. Em **Settings → General → Danger Zone → Change visibility**, deixe público. Não há dado pessoal no código.
3. Em **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**, salve.
4. Em um minuto o app fica em `https://msgabigf.github.io/trackingfinances/`.

## 2. Instalar no iPhone (cada um no seu)

1. Abra o link no **Safari**.
2. Toque em **Compartilhar → Adicionar à Tela de Início → Adicionar**.
3. Abra sempre pelo ícone do coração.
4. Na primeira vez: **Começar → Sou a Gabi / Sou o Yuri → Carregar exemplo** (ou começar do zero).

> ⚠️ O app instalado guarda os dados separados do Safari. **Apagar o ícone apaga os dados deste celular.** Até a etapa 2, baixe um backup de vez em quando em **Mais → Ajustes → Backup**.

## Como o dinheiro é calculado

- **Renda base:** o que cada um pode contar todo mês. A casa é planejada só em cima dela. Freelas nunca mudam a divisão.
- **Divisão:** cada item da casa é dividido pela proporção das rendas base do mês (ex.: 7.000 e 5.500 viram 56% e 44%).
- **Valor da casa:** quanto a casa precisa por mês. Cada um coloca a sua parte.
- **Livre da casa** = valor da casa − contas fixas − provisão anual (IPVA, seguro) − investimento − metas − parcelas do mês. O livre é dividido pelas porcentagens de cada categoria.
- **Conta fixa mais alta:** ao marcar como paga com o valor real, tudo se recalcula na hora.
- **Imprevistos** (farmácia, saúde, conserto, veterinário) são sempre da casa. Se passarem do orçamento, o app sugere tirar das bobeiras da casa, depois da Reserva, e o resto como aporte extra de cada um, pela divisão.
- **Freela:** 70% para guardar (metade para quem recebeu, metade para a casa) e 30% para curtir. Ajustável em Plano.
- **Parcelados:** a 1ª parcela conta no mês da compra, as outras nos meses seguintes, já comprometendo o orçamento.
- **Quem deve a quem:** quem paga um item da casa ganha crédito do valor inteiro; cada um deve a sua parte.
- **Privacidade:** o que é "Só meu" nunca aparece para o outro.

## Para desenvolver

HTML, CSS e JavaScript puros, sem build. Rodar localmente: `python3 -m http.server` e abrir `http://localhost:8000`.

Testes das contas: `npm test` (Node 20 ou mais novo). Estrutura dos dados: [`DATA.md`](DATA.md). Especificação completa: [`PROMPT.md`](PROMPT.md).

A cada versão publicada, aumente `VERSION` em `sw.js` para os dois celulares receberem a atualização.
