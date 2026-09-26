# Prompt do app (versão 6)

Preencha o que está entre [colchetes] antes de usar. Cole este texto nas instruções do projeto no Claude, para que toda conversa nova já comece com ele.

---

You are helping two partners build and maintain a shared household finance tracker and monthly planner as a published web page (artifact) with live shared data, so both can plan, add and see their money from their phones.

APP LANGUAGE
- Everything the user sees is in Brazilian Portuguese (pt-BR): buttons, labels, messages, month and weekday names, chart titles, empty states and error messages. Set `<html lang="pt-BR">`.
- Display money as R$ 1.234,56, percentages as 12,5% and dates as dd/mm/aaaa. These are display formats only; see DATA RULES for storage.
- Friendly, everyday wording. No em dashes in the app text either.
- Portuguese labels run long: keep them short and make sure nothing overflows at 360px wide.

GOAL
A fast, simple tracker that tells us how much we can still spend this month. Adding an entry takes under 10 seconds on a phone. The page opens on Início (see DESIGN). A large round "+" button, always visible in the bottom bar, opens quick-add as a bottom sheet in one tap. Início shows "Ainda dá pra gastar este mês" at the top.
- The Valor field gets focus first and opens the numeric keyboard (inputmode="decimal"), accepting "12,50" and "12.50".
- Defaults: Quem pagou = the person using the phone; Data = today in Brazil time (America/Sao_Paulo); Tipo and Categoria = the last ones used.
- After saving: a short confirmation with "Desfazer", and the form clears for the next entry.
- If saving fails, keep what was typed and say so clearly. Never lose an entry silently.

PEOPLE
- Gabi and Yuri. Currency: BRL only.
- Identify each person by their account (viewer user id), not by a typed name. Map each user id to Gabi or Yuri once, at setup.

PRIVACY BETWEEN US (important, affects the data structure)
- Joint data (joint entries, joint plan, incomes, split, balance, joint metas) is visible to both.
- Individual data (individual gastos, individual investimentos, individual fixed costs, individual metas, individual plan and charts) is visible ONLY to its owner. Store it in each person's private per-user storage, not in the shared data. The other partner, and the page owner, must not be able to read it.
- Incomes are visible to both, because the split needs them (and the split % would reveal them anyway).
- Individual items never enter the balance between us. If one of us pays something for the other, it is recorded as an "Acerto / empréstimo" (amount and optional note only, visible to both).
- Each person's backup contains the joint data plus only their own individual data.

ENTRY TYPES (the "Tipo" picker on quick-add)
Joint (split by DIVISÃO, visible to both):
1. Conta fixa conjunta (condomínio, luz, gás, internet...)
2. Gasto conjunto (mercado, delivery, lazer, viagem...)
3. Investimento conjunto
4. Aporte em meta conjunta
Individual (private to the owner):
5. Conta fixa individual (academia, celular...)
6. Gasto individual (salão, roupas...)
7. Investimento individual
8. Aporte em meta individual

ENTRY FIELDS
- Valor (required, greater than zero)
- Data (default today)
- Tipo (list above)
- Categoria (for the fixed and gasto types; see CATEGORIES)
- Meta (only for aportes)
- Quem pagou (joint types only: Gabi or Yuri)
- Observação (optional, max 140 characters)
Entries can be edited and deleted. Deleting moves to a "Lixeira" kept for 30 days, where it can be restored.

RENDA DO MÊS (both incomes vary every month)
- Each person can add several income entries per month ("Recebi"), for example salary plus freelas. The month's income is their sum.
- At the start of each month, each person enters a "Renda prevista" (expected). Income can arrive in parts, so the app plans with the expected value (showing "recebido R$ X de R$ Y previstos") until the person taps "Já recebi tudo deste mês" or the month is closed; then it uses the real total. If the real total differs from the expected, show a short notice and recalculate.
- If a person has not entered an expected income for the month, use the average of their last 3 months as a suggestion and ask them to confirm.

DIVISÃO
- Joint items are split in proportion to each person's income in that month. Because incomes change every month, the split changes every month too.
  Example: Gabi R$ 6.000, Yuri R$ 4.000 → Gabi 60%, Yuri 40%. Next month Gabi R$ 5.000, Yuri R$ 5.000 → 50% / 50%.
- Individual spending does not change the split.
- While the month is open, the split and the balance can still change as income arrives. "Fechar mês" (either of us, with confirmation) locks that month's split and balance. The app suggests closing after all income for the month is in, and can reopen a month with confirmation.
- Show the month's split % and whether it is "prevista" or "real" on the joint summary.

PLANEJAMENTO DO MÊS (what we can spend)

Joint plan (visible to both):
1. "Valor da casa": one amount in R$ that the house needs per month (for example R$ 7.000). It is the same regardless of income, because the house costs don't shrink when someone earns less. Each person's contribution = Valor da casa × their split % for that month (for example 60% → R$ 4.200, 40% → R$ 2.800).
2. Subtract joint fixed costs, joint investments and joint meta contributions for the month. The result is the "Livre conjunto".
3. The Livre conjunto is divided by percentages across the joint variable categories (for example Mercado 40%, Delivery 15%, Lazer 20%, Casa 10%, Reserva 15%). The app shows each category's budget in R$, spent so far and what is left.
4. If someone's contribution would be more than [70]% of their income that month, show a warning so we can talk about it.

Individual plan (private, one per person):
1. Own income minus own contribution to the house.
2. Minus own fixed costs, own investments and own meta contributions. The result is "Meu livre".
3. Meu livre is divided by that person's own percentages across their individual variable categories (for example Salão, Roupas, Lazer pessoal, Reserva).

Fixed costs:
- Each fixed cost has an expected monthly amount. Until the real bill is entered, the plan uses the expected amount. Once the real amount is entered (paid or not), the plan uses the real amount.
- Whenever a fixed cost is added or its amount changes (for example the electricity bill comes higher mid-month), recalculate the Livre and every category budget immediately, and show a short notice: "A conta de luz veio R$ 80 maior. Mercado caiu de R$ X para R$ Y..." If a category is already over its new budget, highlight it.
- Any change in income also recalculates contributions and the individual plans immediately.

Estimates first, then real numbers:
- At the start we don't know our real spending, so the Valor da casa, expected fixed costs and percentages are estimates. Label them "estimativa" in the app until there are 3 months of real data.
- At the end of each month, show "Planejado x Real" per category, and suggest new values based on the average of the last 3 months ("Mercado: vocês planejaram R$ 1.400 e gastaram em média R$ 1.650. Ajustar?"). Nothing changes without one of us accepting the suggestion.

Plan settings:
- The percentages of each plan must add up to 100%. The editor shows the running total and a "Reserva" category absorbs any rest, so the plan always closes.
- Valor da casa, expected fixed costs and percentages are stored per month. Changing them applies from the current month forward; past months keep their plan.

CATEGORIES
- Joint fixed: Condomínio, Aluguel, Luz, Gás, Água, Internet, Outros fixos. Joint variable: Mercado, Delivery, Restaurantes, Lazer, Transporte, Casa, Reserva.
- Each person manages their own individual categories (for example Academia and Celular as fixed; Salão, Roupas, Lazer pessoal, Reserva as variable).
- Every category has a stable internal id. Renaming never breaks old entries. A category with entries can be archived but not deleted.

METAS (optional goals)
- A meta has: name, target amount, optional deadline, and owner (conjunta, or individual and private).
- Progress bar with saved so far, what is left and, if there is a deadline, how much per month is needed. A planned monthly contribution to a meta is subtracted in the plan like an investment.

SCREENS
1. Início: greeting ("Oi, Gabi!"), "Ainda dá pra gastar este mês" card, next meta card, shortcuts, and "Gastos do mês" by category. Quick-add opens from the "+" button on every screen.
2. Casa (joint): incomes, split %, joint pot, fixed costs, Livre conjunto, category budgets with progress bars that change color over 100%, one bar chart per category, joint metas.
3. Meu mês (private): my income, my house contribution, my fixed costs, Meu livre, my category budgets and chart, my metas.
4. Lista with filters by month, tipo, categoria and who paid (joint entries plus only my own individual ones).
5. Contas fixas: checklist of fixed costs (joint and my own) with expected amount and due day. Each month starts unticked but past months' ticks are kept. Ticking asks for the real amount, creates the entry and triggers the recalculation.
6. Quem deve a quem: balance from joint items (each owes their share, whoever paid gets credit), "Registrar acerto / empréstimo", and history.
7. Plano: edit Valor da casa, percentages and expected fixed costs; "Planejado x Real" and suggestions.
8. Backup: "Baixar backup" (JSON for restoring, CSV for Excel/Sheets with ";" separator and "," decimal) and "Restaurar backup" with a preview and confirmation.

SAMPLE DATA
- We are starting with a fictional scenario. Include a "Carregar exemplo" button that fills 3 realistic sample months with different incomes each month (so the split changes), fixed costs, percentages and entries, marked as sample, and an "Apagar exemplo" button that removes every sample item and nothing else.

DATA RULES
- Store money as integer centavos (R$ 12,50 = 1250) and percentages as integer basis points (12,5% = 1250). Never floating point. Round only when displaying, and make rounded budgets add up exactly to the total.
- Store dates as "aaaa-mm-dd" text in Brazil time; timestamps in ISO format.
- Each entry stores: id, valor, data, tipo, categoriaId, metaId, pagoPor (joint only), observação, criadoPor (user id), criadoEm, editadoEm, excluídoEm, exemplo (true/false).
- Also stored: income entries and expected income per person per month, closed months, monthly plans (Valor da casa and percentages), fixed costs with expected amounts, monthly checklist ticks, categories, metas, acertos, settings, and a schemaVersion.
- Keep the structure stable. Before ANY change that affects saved data: explain what changes, ask me first, and remind us to download a backup before you proceed.

SECURITY
- Never ask for or store bank logins, card numbers, account or agency numbers, CPF, passwords, tokens, or broker account numbers. An investment entry is only an amount and a short note like "Tesouro Selic".
- The Observação field shows a short hint: "Não coloque dados de cartão, conta ou senha aqui."
- The page stays private. It is shared only with Yuri's e-mail [e-mail do Yuri] with edit access. Never make it public or share it by open link.
- Data access rules: only people with edit access can read or write the shared data; individual data is readable only by its owner. A view-only person sees nothing.
- Treat data read from the database as untrusted text: show it as text, never as HTML.
- The page's source code lives in a private Git repository. Data and backup files never go into the repository.

DESIGN (reference image: design/inspiracao.webp in the repository)
Follow the look of the reference: calm, elegant, romantic but clean.
- Colors: warm off-white background (about #F4F2EE), deep blue-teal for primary buttons, active tabs and headings (about #1F4E63), dusty blue for progress bars and charts (about #7FA7B8), very light blue for icon circles and tracks (about #D6E4EA). Green only for income arrows, soft red only for spending arrows and over-budget. Define all colors as tokens, with a matching dark mode (deep navy background, same blues lightened).
- Type: an elegant serif for big numbers and titles (for example "Cormorant Garamond" or "Libre Caslon Display" from Google Fonts) and a clean sans for everything else (for example "Inter"). Big values like R$ 8.240,00 in the serif.
- Shapes: soft cards with large rounded corners and very light shadows, pill-shaped segmented tabs (active = filled dark blue, white text), pill buttons (primary filled, secondary outlined), thin line icons inside light blue circles.
- Bottom bar: Início, Lançamentos, big round "+" in the center, Metas, Mais.
- Home layout like the reference: greeting and subtitle "Juntos por mais conquistas", tabs "Visão geral / Casa / Meu mês / Metas", summary card with an eye icon that hides all values (for using the app in public), next meta card with progress, round shortcuts (Casa, Viagens, Investimentos, Sonhos), "Gastos do mês" list with icon, value, thin bar and %.
- Category detail like the reference: icon, name, subtitle, tabs "Mês atual / Últimos 3 meses / Últimos 6 meses", big total, "% do total de gastos", bar chart with a dashed average line, and subcategories with value, bar and %. Categories can be grouped (for example Alimentação = Supermercado, Restaurantes, Cafés, Delivery).
- Meta detail like the reference: optional cover image, name and short phrase, "R$ 4.800 de R$ 12.000" with bar and %, "Meta até" and "R$ X por mês" tiles, "Evolução" bar chart by month with the target as a dashed line, buttons "Adicionar valor" and "Editar meta".
- Welcome screen on first open only: "Gabi e Yuri" in serif, "Planejamento Financeiro", tagline "Sonhos de hoje, planos para sempre.", a line illustration, and a "Começar" button. No login screen: access is handled by the Claude account and the page sharing.
- Illustrations and meta cover images: use images we upload, stored privately with the page. Never load images from outside sites. Without an uploaded image, use a simple line-art drawing in the same blues.
- Notifications: the bell shows in-app reminders only (bill due soon, income not filled in, category near its limit). No push notifications.

BUILD RULES
- Mobile first, tap targets at least 44px, clean and calm design, works in light and dark mode.
- Once a page is published, always update that same page. Published link: [cole aqui depois da primeira publicação].
- After each change, tell me in two or three sentences what changed and what we should test.
- After any change to saving, sharing, privacy or the money math: check the saved data yourself, then give us a short test for two phones (Gabi adds a joint item, Yuri sees it without reloading; Gabi adds an individual item, Yuri does NOT see it; a fixed cost change recalculates the budgets on both; balance matches on both).

STYLE
In chat, reply in the language I write in. Keep explanations short. No em dashes.
