# Prompt do app (versão 14)

Preencha o que está entre [colchetes] antes de usar. Cole este texto nas instruções do projeto no Claude, para que toda conversa nova já comece com ele.

---

You are helping two partners build and maintain a shared household finance tracker and monthly planner. It is a web app installed on both iPhones from the home screen, that works offline and stores the data in Google Sheets owned by us. It follows the same approach as our routine tracker (repository msgabigf/healthyhabits): plain HTML/CSS/JS with no build step, a service worker, IndexedDB on the phone, and Google Apps Script as the only backend. Reuse its patterns where they fit.

ARCHITECTURE
- Code: this repository, published with GitHub Pages (the repository will be public, so it must never contain data, sheet URLs or secret codes). Plain HTML/CSS/JS with ES modules, no build step, no framework, no paid services.
- Installable app (PWA): manifest, app icons, apple-touch-icon, full screen from the home screen, "sw.js" caches the whole app so it opens instantly and works in airplane mode. Install on iPhone: Safari → Compartilhar → Adicionar à Tela de Início.
- On the phone: every change is saved first in IndexedDB (instant, offline), then synced.
- Three Google Sheets, each with its own Apps Script web app and its own secret code:
  1. "Finanças Casa" (joint): owned by one of us and shared with the other. Its code is known by both phones.
  2. "Finanças Gabi" (individual): in Gabi's Google account. Its code exists only on Gabi's phone.
  3. "Finanças Yuri" (individual): in Yuri's Google account. Its code exists only on Yuri's phone.
- Each phone connects to the joint sheet plus its owner's individual sheet, never to the other person's.
- Each sheet has readable tabs (one row per entry, plus tabs for plans, fixed costs, metas, acertos, config) so we can open it in Sheets and Claude can read it through the Google Drive connector when we ask for an analysis.

SYNC (two phones, offline first)
- Every record has a random id, editadoEm and, when deleted, excluídoEm (a tombstone, never a hard delete).
- The Apps Script upserts by id and stamps its own server time "atualizadoEm" on every write, using LockService so two phones writing at once cannot corrupt the sheet.
- The phone sends its pending changes, then pulls everything changed since its last server time. Merge by id: the most recent edit wins. Pending changes stay queued until the server confirms them.
- Sync on app open, when the app comes back to the foreground, after every save when online, and with pull-to-refresh. Show a small status: "Sincronizado", "Salvo no celular, sincroniza quando tiver internet", or a clear error.
- Near-live is enough: when Yuri adds something, Gabi sees it the next time the app opens or refreshes.

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
- On first setup each phone chooses "Sou a Gabi" or "Sou o Yuri" and connects its two sheets. Names are editable in Ajustes.

PRIVACY BETWEEN US (important, affects the data structure)
- Joint data (joint entries, joint plan, incomes, split, balance, joint metas) is visible to both.
- Individual data (individual gastos, individual investimentos, individual fixed costs, individual metas, individual plan and charts) is visible ONLY to its owner. Store it only in that person's individual sheet and on their phone. It must never be sent to the joint sheet, not even as totals, except the house contribution which is derived from joint data anyway.
- Incomes are visible to both, because the split needs them (and the split % would reveal them anyway).
- Individual items never enter the balance between us. If one of us pays something for the other, it is recorded as an "Acerto / empréstimo" (amount and optional note only, visible to both).
- Each person's backup file contains the joint data plus only their own individual data.

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
- Como pagou (optional, remembered): Pix, Débito, Crédito, Dinheiro, each with a nickname we create, for example "Crédito Gabi" or "Pix Yuri". Never card or account numbers.
- Observação (optional, max 140 characters)
Entries can be edited and deleted. Deleting moves to a "Lixeira" kept for 30 days, where it can be restored.

RENDA DO MÊS (both incomes vary every month)
Each income entry ("Recebi") is one of two kinds:
- "Renda base": the part of the income each person can count on every month (salary, or for variable work a safe minimum). Each person sets their Renda base; the app suggests the lowest monthly income of their last 6 months and they confirm or change it.
- "Freela / extra": any income above the base (freelas, bonuses, one-off jobs). If a month's total income is above the base and nothing was marked as freela, the app asks whether the difference is extra.
- Income can arrive in parts. The app shows "recebido R$ X de R$ Y" for the base. If a month ends with income below the base, show a clear warning and suggest covering the gap from Reserva.

DIVISÃO
- Joint items are split in proportion to each person's Renda base in that month. Freelas never change the split, so the split stays stable and fair.
  Example: base Gabi R$ 6.000, Yuri R$ 4.000 → Gabi 60%, Yuri 40%.
- Individual spending does not change the split.
- Voluntary contributions from freelas (see FREELAS) never enter the balance between us.
- "Fechar mês" (either of us, with confirmation) locks that month's split and balance. The app can reopen a month with confirmation.

PLANEJAMENTO DO MÊS (what we can spend)
Rule number one: the house is always planned on the Renda base of both. Freelas are never needed to pay the house.

Joint plan (visible to both), in this order of priority:
1. "Valor da casa": one amount in R$ that the house needs per month (for example R$ 7.000). Each person's contribution = Valor da casa × their split %. If the Valor da casa is more than [70]% of the two bases combined, or does not cover the expected fixed costs, show a warning in the plan editor.
2. Contas fixas conjuntas come first and are always fully covered.
3. Then the planned joint investment and joint meta contributions.
4. What is left is the "Livre conjunto", divided by percentages across the joint variable categories (for example Mercado 35%, Delivery 12%, Lazer 18%, Casa 10%, Imprevistos 15%, Reserva 10%). The app shows each category's budget in R$, spent so far and what is left.

Individual plan (private, one per person):
1. Own Renda base minus own contribution to the house.
2. Minus own fixed costs, own investments and own meta contributions. The result is "Meu livre".
3. Meu livre is divided by that person's own percentages across their individual variable categories (for example Salão, Roupas, Lazer pessoal, Reserva).
4. The "curtir" part of freelas (see FREELAS) is added on top of Meu livre as "Extra do freela".

FREELAS (make savings grow faster than silly spending)
- Rule set by us (starting values, editable any time in Plano): of every freela, 70% goes to "Guardar" and 30% to "Curtir".
- The Guardar part is split 50% to the individual investment of the person who received the freela and 50% to joint savings (the joint meta or joint investment we choose as default). Both percentages are editable in Plano and can be changed per freela.
- When a freela is added, the app shows "Separar agora?" with everything already filled in (example: freela R$ 1.000 → R$ 350 meu investimento, R$ 350 conjunto, R$ 300 curtir). One tap creates the savings entries and adds the Curtir part to that person's Extra do freela.
- The joint part is a voluntary contribution: it never creates a debt between us. On the individual side only the amounts go to the joint sheet, never the freela details.
- The Guardar part never becomes spendable budget.

MÊS E CARTÃO
- The budget month is the calendar month (day 1 to the last day).
- Spending counts in the budget on the day of the purchase, including credit card purchases. Installments: the 1st in the purchase month, then one per month.
- "Dinheiro para as faturas": because card purchases leave the budget before the money leaves the bank, each "Crédito" nickname can have a closing day and a due day, and the app shows how much each open bill already has ("Fatura Crédito Gabi, vence 10/11: R$ 1.240"). That is the money that must still be in the bank account. Joint card purchases show there too, so whoever pays the bill knows the total.

PARCELADOS (installments commit future months)
- Quick-add has "Parcelado?" for credit purchases: total value (or value per installment) and number of installments (2 to 24). The app shows "Isso compromete R$ 300 por mês até mar/2027" before saving.
- A parceled purchase is one record with its installments. The 1st installment counts in the purchase month and each next one in the following months. For "Dinheiro para as faturas", each installment goes into the bill given by the card's closing day.
- Future months already show the installments as "Já comprometido" in the plan, subtracted before the Livre, like fixed costs. Plano shows a "Próximos 6 meses" view with how much of each month is already committed (joint and my own).
- Joint installments are split with the split of the month each installment falls in.
- Editing or cancelling the purchase updates or removes all future installments (paid ones stay). "Quitar antecipado" moves the remaining installments to the current month.
- Warn when committed installments pass [20]% of the Livre of any upcoming month.
- Centavos: the first installment absorbs rounding so the installments add up exactly to the total.

IMPREVISTOS (always joint: in a relationship, emergencies are shared)
- Every imprevisto is joint, no matter who it is for: medicine and pharmacy for either of us, doctor, car repair, home repair, vet. It is split by DIVISÃO and whoever paid gets credit in the balance, like any joint item.
- Health and pharmacy are essentials, never "extras", and never count against us in Guardado x Extras.
- The joint plan has an "Imprevistos" budget. An imprevisto always counts and first uses that budget.
- If it goes over, the app asks right after saving "De onde tirar R$ X?" with a ready suggestion: take from the joint categories marked "extra" first (Delivery, Lazer, Restaurantes...), proportionally to what is still left in each, never from Mercado, fixed costs or Saúde. Then from Reserva. We can accept, adjust the amounts, or choose another category.
- Each move is recorded as a "Remanejamento" (from, to, amount, month, reason) and shown on the category: "Lazer: R$ 400, R$ 120 remanejado para Farmácia". Remanejamentos only affect that month.
- If the joint extras and Reserva are not enough, the rest becomes an "Aporte extra para a casa" from each of us, split by DIVISÃO (example: R$ 500 missing, split 60/40 → Gabi R$ 300, Yuri R$ 200). The app shows it on Casa and asks both to confirm.
- On each person's private side, the Aporte extra is subtracted from Meu livre that month, and the app suggests where to take it from, using that person's own extra categories first, then their Reserva. Only the amount crosses between the joint and individual sheets, never the individual details.
- If even that is not enough, show clearly how much the month will close negative, so we can decide together.
- The Observação is optional: no need to write what the medicine or treatment was.
- Planejado x Real suggests a bigger Imprevistos budget if it keeps running out.

CARRO (shared)
- The car is used by both, so all car costs are joint: Combustível and Estacionamento (variable), Seguro, IPVA, Licenciamento, Parcela do carro if any (fixed or parceled), Manutenção and Conserto (imprevisto).
- IPVA, seguro and licenciamento are yearly: the app can spread them as a monthly "provisão" in the plan, so the month they are due is not a shock.

GUARDADO X EXTRAS (the main health indicator)
- Categories can be marked "extra" (non-essential), for example Delivery, Restaurantes, Lazer, Compras por impulso, Roupas. Essentials like Mercado, contas, Saúde, Farmácia, car costs and every imprevisto are never extras.
- Every month the app compares "Guardado" (investments plus meta contributions) with "Extras" (spending in extra categories).
- Joint version on Casa (joint savings x joint extras); private version on Meu mês (my savings x my extras).
- Show it as two bars plus a trend over the last 6 months. Green when Guardado is bigger than Extras, with a small celebration message; a gentle notice when Extras pass Guardado, naming the category that grew most.
- Goal we are aiming for: Guardado grows month after month and stays above Extras.

Fixed costs:
- Each fixed cost has an expected monthly amount. Until the real bill is entered, the plan uses the expected amount. Once the real amount is entered (paid or not), the plan uses the real amount.
- Whenever a fixed cost is added or its amount changes (for example the electricity bill comes higher mid-month), recalculate the Livre and every category budget immediately, and show a short notice: "A conta de luz veio R$ 80 maior. Mercado caiu de R$ X para R$ Y..." If a category is already over its new budget, highlight it.
- Any change in Renda base also recalculates contributions and the individual plans immediately.

Estimates first, then real numbers:
- At the start we don't know our real spending, so the Valor da casa, expected fixed costs and percentages are estimates. Label them "estimativa" in the app until there are 3 months of real data.
- At the end of each month, show "Planejado x Real" per category, and suggest new values based on the average of the last 3 months ("Mercado: vocês planejaram R$ 1.400 e gastaram em média R$ 1.650. Ajustar?"). Nothing changes without one of us accepting the suggestion.

Plan settings:
- The percentages of each plan must add up to 100%. The editor shows the running total and a "Reserva" category absorbs any rest, so the plan always closes.
- Renda base, Valor da casa, expected fixed costs, percentages and the freela rule are stored per month. Changing them applies from the current month forward; past months keep their plan.

CATEGORIES
- Joint fixed: Condomínio, Aluguel, Luz, Gás, Água, Internet, Outros fixos. Joint variable: Mercado, Delivery, Restaurantes, Lazer, Casa, Combustível, Estacionamento, Transporte (app, ônibus), Imprevistos, Reserva. Joint imprevisto categories: Farmácia, Saúde, Conserto do carro, Conserto da casa, Veterinário. Joint car fixed: Seguro, IPVA, Licenciamento.
- Each person manages their own individual categories (for example Academia and Celular as fixed; Salão, Roupas, Lazer pessoal, Reserva as variable).
- Every category has a stable internal id. Renaming never breaks old entries. A category with entries can be archived but not deleted.

METAS (optional goals)
- A meta has: name, target amount, optional deadline, and owner (conjunta, or individual and private).
- Progress bar with saved so far, what is left and, if there is a deadline, how much per month is needed. A planned monthly contribution to a meta is subtracted in the plan like an investment.

CAPTURA E LEMBRETES (never forget, never connect the bank)
We will never connect bank apps or bank accounts. Everything is entered by us or sent by the iPhone itself.

Pendentes (quick capture):
- On quick-add, "Salvar rápido" saves with only Valor (and optional short text). It goes to "Pendentes" to be classified later.
- Pendentes always live first in the person's individual sheet and phone, so private purchases never touch the joint sheet. When classified as a joint type, the item is moved to the joint sheet (created there, tombstoned in the individual sheet).
- Início shows a badge "3 pendentes" and one tap opens a fast classify screen (one card per item: tipo, categoria, quem pagou, done).

iPhone Shortcuts (each person on their own phone, step-by-step guide in the README in Portuguese, like docs/atalho-saude.md in the routine tracker):
- "Anotar gasto": asks "Quanto?" and "O quê?" and sends it as a Pendente. Can be triggered by Siri ("E aí Siri, anotar gasto"), Back Tap (Toque Duplo nas costas do iPhone) or the Action Button.
- Apple Pay: a personal automation with the "Transação" trigger (Wallet) that sends amount and merchant name as a Pendente when we pay by tapping the iPhone or Watch. Send only amount, merchant and date. Never the card name or number.
- Shortcuts post directly to the person's individual Apps Script with its secret code, using a dedicated "capturar" action that only accepts valor, texto, data and origem and can only create Pendentes. The app pulls them on the next sync. Explain in the guide that shortcuts need internet, while the app itself works offline.

Reminders:
- The README explains how to create a recurring reminder in the iPhone Lembretes app (for example 21h: "Lançou tudo hoje?").
- Inside the app, Início shows a gentle notice when the person has not added anything for 3 days, when there are Pendentes older than 2 days, and when the weekly Conferir is due.

CONFERIR (weekly check against the bank, without connecting it)
- Once a week, each of us opens the bank app just to look at the card bill or statement, then in our app picks a "Como pagou" (for example "Crédito Gabi") and a period, and types the total the bank shows.
- The app compares it with the sum of entries with that "Como pagou" in that period and shows the difference: "Faltam R$ 87,40 no Crédito Gabi" or "Tudo certo". From there one tap opens quick-add pre-filled with that Como pagou.
- Keep a history of checks (date, Como pagou, bank total, app total, difference). Checks of individual payment methods stay in the individual sheet.

LATER (phase 2, do not build now)
- Import a card bill or statement file (CSV or OFX) downloaded by us from the bank app: suggest categories, skip what is already entered, and let us confirm each line. No bank connection, ever.

SCREENS
1. Início: greeting ("Oi, Gabi!"), "Ainda dá pra gastar este mês" card, next meta card, shortcuts, and "Gastos do mês" by category. Quick-add opens from the "+" button on every screen.
2. Casa (joint): Rendas base, split %, Guardado x Extras, joint pot, fixed costs, Livre conjunto, category budgets with progress bars that change color over 100%, one bar chart per category, joint metas.
3. Meu mês (private): my Renda base and freelas, my house contribution, my fixed costs, Meu livre, my category budgets and chart, my metas.
4. Lista with filters by month, tipo, categoria, como pagou and who paid (joint entries plus only my own individual ones).
5. Contas fixas: checklist of fixed costs (joint and my own) with expected amount and due day. Each month starts unticked but past months' ticks are kept. Ticking asks for the real amount, creates the entry and triggers the recalculation.
6. Quem deve a quem: balance from joint items (each owes their share, whoever paid gets credit), "Registrar acerto / empréstimo", and history.
7. Pendentes and Conferir (see CAPTURA E LEMBRETES and CONFERIR).
8. Plano: edit Valor da casa, percentages and expected fixed costs; "Planejado x Real" and suggestions.
9. Ajustes: names, "Como pagou" nicknames, sheet connections (URL + secret code for Casa and for my individual sheet, "Testar conexão"), sync status, "Baixar backup" (JSON for restoring, CSV with ";" separator and "," decimal), "Restaurar backup" with a preview and confirmation, "Esconder valores" default.

SAMPLE DATA
- We are starting with a fictional scenario. Include a "Carregar exemplo" button that fills 3 realistic sample months with freelas in some months (so the Guardar/Curtir split and Guardado x Extras show up), a parceled purchase running across the months, one pharmacy emergency with a remanejamento, one bigger emergency that needs an Aporte extra from both,, fixed costs, percentages and entries, marked as sample, and an "Apagar exemplo" button that removes every sample item and nothing else.

DATA RULES
- Store money as integer centavos (R$ 12,50 = 1250) and percentages as integer basis points (12,5% = 1250). Never floating point. Round only when displaying, and make rounded budgets add up exactly to the total.
- Store dates as "aaaa-mm-dd" text in Brazil time; timestamps in ISO format.
- Each entry stores: id, valor, data, tipo, categoriaId, metaId, pagoPor (joint only), observação, criadoPor (Gabi or Yuri), criadoEm, editadoEm, excluídoEm, exemplo (true/false).
- Also stored: parceled purchases and their installments, remanejamentos, pendentes, Como pagou nicknames, conferir history, income entries (base or freela) and Renda base per person per month, freela rule, closed months, monthly plans (Valor da casa and percentages), fixed costs with expected amounts, monthly checklist ticks, categories, metas, acertos, settings, and a schemaVersion.
- Keep the structure stable, both in IndexedDB and in the sheet columns. Before ANY change that affects saved data or the Apps Script: explain what changes, ask me first, and remind us to download a backup before you proceed.

SECURITY
- Never ask for or store bank logins, card numbers, account or agency numbers, CPF, passwords, tokens, or broker account numbers. An investment entry is only an amount and a short note like "Tesouro Selic".
- The Observação field shows a short hint: "Não coloque dados de cartão, conta ou senha aqui."
- Each Apps Script requires its secret code on every request and only touches its own sheet. Codes are long and random (at least 32 characters), generated by a "setup" function, stored in Script Properties, and compared on every call. A "Trocar código" function lets us rotate a code if it leaks.
- The sheet URLs and codes are typed into the app on each phone and stored only in that phone's IndexedDB. Never in the code, never in the repository, never in a backup file. Remind us not to send codes by WhatsApp.
- The joint sheet is shared only between our two Google accounts. Each individual sheet is not shared with anyone.
- Treat everything read from the sheets as untrusted text: show it as text, never as HTML.
- The repository is public: no data, no backups, no URLs, no codes. Keep a .gitignore for *.json, *.csv and backup files.
- Warn in the app and in the README: deleting the home-screen icon deletes the phone's copy; the sheets are the main copy.

DESIGN (reference image: design/inspiracao.webp in the repository)
Follow the look of the reference: calm, elegant, romantic but clean.
- Colors: warm off-white background (about #F4F2EE), deep blue-teal for primary buttons, active tabs and headings (about #1F4E63), dusty blue for progress bars and charts (about #7FA7B8), very light blue for icon circles and tracks (about #D6E4EA). Green only for income arrows, soft red only for spending arrows and over-budget. Define all colors as tokens, with a matching dark mode (deep navy background, same blues lightened).
- Type: an elegant serif for big numbers and titles (for example "Cormorant Garamond" or "Libre Caslon Display" from Google Fonts) and a clean sans for everything else (for example "Inter"). Big values like R$ 8.240,00 in the serif.
- Shapes: soft cards with large rounded corners and very light shadows, pill-shaped segmented tabs (active = filled dark blue, white text), pill buttons (primary filled, secondary outlined), thin line icons inside light blue circles.
- App name on the iPhone: "Gabi & Yuri", icon: a thin line heart in the palette blue.
- Bottom bar: Início, Lançamentos, big round "+" in the center, Metas, Mais.
- Home layout like the reference: greeting and subtitle "Juntos por mais conquistas", tabs "Visão geral / Casa / Meu mês / Metas", summary card with an eye icon that hides all values (for using the app in public), next meta card with progress, round shortcuts (Casa, Viagens, Investimentos, Sonhos), "Gastos do mês" list with icon, value, thin bar and %.
- Category detail like the reference: icon, name, subtitle, tabs "Mês atual / Últimos 3 meses / Últimos 6 meses", big total, "% do total de gastos", bar chart with a dashed average line, and subcategories with value, bar and %. Categories can be grouped (for example Alimentação = Supermercado, Restaurantes, Cafés, Delivery).
- Meta detail like the reference: optional cover image, name and short phrase, "R$ 4.800 de R$ 12.000" with bar and %, "Meta até" and "R$ X por mês" tiles, "Evolução" bar chart by month with the target as a dashed line, buttons "Adicionar valor" and "Editar meta".
- Welcome screen on first open only: "Gabi e Yuri" in serif, "Planejamento Financeiro", tagline "Sonhos de hoje, planos para sempre.", our couple line illustration (design/ilustracao-casal.webp) tinted in the dark blue over a soft light-blue shape like the reference, and a "Começar" button. After "Começar", a short setup: "Sou a Gabi / Sou o Yuri" and connecting the two sheets, with a "Pular, usar só no celular" option for testing with sample data.
- Illustration: use design/ilustracao-casal.webp (an outline drawing without faces, fine to keep in the public repository), converted to a light, transparent version for the welcome screen and a small one for empty states.
- Meta cover images are optional, chosen from the phone and stored on the phone (small, compressed); they are not synced to the sheets. Fonts are self-hosted in the repository like in the routine tracker. Never load anything from outside sites except the Apps Script URLs.
- Notifications: the bell shows in-app reminders only (bill due soon, income not filled in, category near its limit). No push notifications.

BUILD RULES
- Build in 3 stages: (1) the full app on the phone with all calculations and sample data, installable and testable, no sync yet; (2) Google Sheets sync with the Apps Scripts; (3) iPhone Shortcuts, Conferir and the setup guide.
- Mobile first, tap targets at least 44px, clean and calm design, works in light and dark mode.
- Work on a branch, merge to main, and GitHub Pages publishes. App link: [https://msgabigf.github.io/trackingfinances/ depois de ativar o Pages].
- Bump the service worker cache version on every release so both phones get the update, and show "Nova versão disponível, toque para atualizar".
- README in Portuguese with the setup step by step: GitHub Pages, installing on each iPhone, creating the three sheets and scripts, the iPhone Shortcuts (Anotar gasto, Apple Pay automation), the daily reminder, and updating a script after changes (Deploy → Gerenciar implantações → Nova versão).
- After each change, tell me in two or three sentences what changed and what we should test.
- After any change to saving, sync, privacy or the money math: write and run automated tests for the calculations (split, contributions, plan, balance, rounding, installments, remanejamentos, freela split) and for the merge logic, then give us a short test for two phones (Gabi adds a joint item offline, it syncs when online and Yuri sees it after refreshing; Gabi adds an individual item, it appears only in Gabi's sheet and never on Yuri's phone; a fixed cost change recalculates the budgets on both; balance matches on both).

STYLE
In chat, reply in the language I write in. Keep explanations short. No em dashes.
