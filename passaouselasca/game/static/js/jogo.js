// ── Estado global ──────────────────────────────

        let equipes = [];
        let deck = [];
        let cartaAbertaIdx = null;
        let nEquipesSel = null;
        let turnoAtual = 0;

        // Estado do modal coringa
        let corAtualIdx = null;
        let corAlvoIdx = null;

        // ── SETUP ──────────────────────────────────────

        // ── MODO DE JOGO ───────────────────────────────
        let modoJogo = 'caos'; // default

        /**
         * Retorna { nNormal, nJokers, total } para exibição na UI.
         * Sem randomness — apenas contagens.
         */
        function calcDeckCount(n, modo) {
            const nReg = CARTAS_REGULARES.length;
            if (modo === 'normal') {
                const total = Math.floor(nReg / n) * n;
                return { nNormal: total, nJokers: 0, total };
            }
            // Modo Caos: ~70% normal / ~30% coringas
            const targetJokers = Math.round(nReg * 30 / 70);
            const rawTotal = nReg + targetJokers;
            const total = Math.ceil(rawTotal / n) * n;
            const nJokers = total - nReg; // always >= 0 (ceil guarantees total >= rawTotal >= nReg)
            return { nNormal: nReg, nJokers, total };
        }

        /**
         * Constrói e retorna o deck embaralhado para a partida.
         */
        function buildDeck(n, modo) {
            const { nNormal, nJokers } = calcDeckCount(n, modo);
            // Shuffle normal cards first (use all or slice for Normal mode)
            const shuffledReg = [...CARTAS_REGULARES].sort(() => Math.random() - 0.5);
            const built = shuffledReg.slice(0, nNormal).map(c => ({ ...c, isCoringa: false }));
            for (let i = 0; i < nJokers; i++) {
                const c = CORINGAS_POOL[Math.floor(Math.random() * CORINGAS_POOL.length)];
                built.push({ ...c, isCoringa: true });
            }
            // Fisher-Yates shuffle
            for (let i = built.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [built[i], built[j]] = [built[j], built[i]];
            }
            return built;
        }

        /**
         * Atualiza o estado enabled/disabled dos botões de nº de equipes
         * com base no modo atual (garante pelo menos 2 rodadas por equipe).
         */
        function atualizarBotoesEquipe() {
            for (let n = 2; n <= 6; n++) {
                const { total } = calcDeckCount(n, modoJogo);
                const valid = total > 0 && (total / n) >= 2;
                const btn = document.querySelector(`[data-n="${n}"]`);
                if (!btn) continue;
                btn.disabled = !valid;
                btn.classList.toggle('unavail', !valid);
                // Se a seleção atual ficou inválida, limpar
                if (!valid && nEquipesSel === n) {
                    nEquipesSel = null;
                    document.getElementById('btn-iniciar').disabled = true;
                    document.querySelectorAll('.n-btn').forEach(b => b.classList.remove('selected'));
                    document.getElementById('team-inputs').innerHTML = '';
                    document.getElementById('qtd-cartas-info').innerHTML = '';
                }
            }
        }

        function selecionarModo(modo) {
            modoJogo = modo;
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
            document.getElementById('btn-modo-' + modo).classList.add('selected');
            atualizarBotoesEquipe();
            // Atualizar painel de info se já há equipes selecionadas
            if (nEquipesSel) selecionarN(nEquipesSel);
        }

        function selecionarN(n) {
            const btn = document.querySelector(`[data-n="${n}"]`);
            if (!btn || btn.disabled) return;
            nEquipesSel = n;
            document.querySelectorAll('.n-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            // Renderizar inputs de nome
            const container = document.getElementById('team-inputs');
            container.innerHTML = '';
            for (let i = 0; i < n; i++) {
                const row = document.createElement('div');
                row.className = 'team-input-row';
                row.innerHTML = `
            <div class="team-color-dot"></div>
            <input type="text" id="equipe-nome-${i}" placeholder="Nome da Equipe ${i + 1}" value="Equipe ${i + 1}">
        `;
                container.appendChild(row);
            }
            document.getElementById('btn-iniciar').disabled = false;

            // Painel de informações
            const { nNormal, nJokers, total } = calcDeckCount(n, modoJogo);
            const infoEl = document.getElementById('qtd-cartas-info');
            if (modoJogo === 'caos') {
                const pct = total > 0 ? Math.round(nJokers / total * 100) : 0;
                infoEl.innerHTML = `
            <span>ℹ️</span>
            <div>O jogo terá <strong style="color:var(--text)">${total} cartas</strong> — <span style="color:var(--secondary);font-weight:700">${nNormal} normais</span> + <span style="color:var(--gold);font-weight:700">${nJokers} coringas</span> (${pct}%).</div>
        `;
            } else {
                const ignored = CARTAS_REGULARES.length - nNormal;
                infoEl.innerHTML = `
            <span>ℹ️</span>
            <div>O jogo terá <strong style="color:var(--text)">${total} cartas</strong> normais${ignored > 0 ? `, ${ignored} carta${ignored > 1 ? 's' : ''} ignorada${ignored > 1 ? 's' : ''} para divisão igual` : ''}. Sem coringas.</div>
        `;
            }
        }

        // Inicializar: modo Caos por padrão, depois selecionar 2 equipes
        selecionarModo('caos');
        selecionarN(2);

        function iniciarJogo() {
            equipes = [];
            turnoAtual = 0;

            for (let i = 0; i < nEquipesSel; i++) {
                const nome = document.getElementById(`equipe-nome-${i}`).value.trim() || `Equipe ${i + 1}`;
                equipes.push({ nome, pontos: 0 });
            }

            deck = buildDeck(nEquipesSel, modoJogo);

            renderMesa();
            renderTopbar();
            document.getElementById('screen-setup').style.display = 'none';
            document.getElementById('screen-game').style.display = 'flex';
        }

        // ── RENDER JOGO ────────────────────────────────

        function renderTopbar() {
            const tt = document.getElementById('topbar-teams');
            tt.innerHTML = equipes.map((e, i) => `
        <div class="equipe-placar ${i === turnoAtual ? 'ativo' : ''}" id="placar-${i}">
            <div class="equipe-nome">${e.nome}</div>
            <div class="equipe-pontos" id="pontos-${i}">${e.pontos}</div>
        </div>
    `).join('');
        }

        function renderMesa() {
            const mesa = document.getElementById('mesa');

            const n = deck.length;
            if (n > 0) {
                let windowRatio = window.innerWidth / (window.innerHeight - 100); // 100 is approx topbar + padding
                let rows = Math.round(Math.sqrt(n / windowRatio));
                if (rows < 1) rows = 1;
                let cols = Math.ceil(n / rows);

                mesa.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
                mesa.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
            }

            mesa.innerHTML = deck.map((carta, i) => {
                return `
            <div class="carta-numero" id="card-${i}" onclick="clicarCarta(${i})">
                <span>${i + 1}</span>
            </div>`;
            }).join('');
        }

        window.addEventListener('resize', () => {
            if (document.getElementById('screen-game').style.display === 'flex') {
                renderMesa();
            }
        });

        // ── EDITAR EQUIPES ─────────────────────────────

        function abrirModalEditarEquipes() {
            const lista = document.getElementById('editar-equipes-lista');
            lista.innerHTML = equipes.map((e, i) => `
        <div class="edit-row">
            <input type="text" id="edit-nome-${i}" value="${e.nome}" class="edit-nome">
            <input type="number" id="edit-pts-${i}" value="${e.pontos}" class="edit-pts">
            <span style="font-size:13px;color:var(--text-muted);font-weight:700">pts</span>
        </div>
    `).join('');
            document.getElementById('modal-editar').classList.add('open');
        }

        function salvarEdicaoEquipes() {
            equipes.forEach((e, i) => {
                const novoNome = document.getElementById(`edit-nome-${i}`).value.trim();
                const novosPts = parseInt(document.getElementById(`edit-pts-${i}`).value);
                if (novoNome) e.nome = novoNome;
                if (!isNaN(novosPts)) e.pontos = novosPts;
            });
            renderTopbar(); // Atualiza a topbar com novos nomes e pontos mantendo o turno visual intacto
            fecharModais();
        }

        // ── FLUXO DE TURNO ─────────────────────────────

        function avancarTurno() {
            const placarAntigo = document.getElementById(`placar-${turnoAtual}`);
            if (placarAntigo) placarAntigo.classList.remove('ativo');

            turnoAtual = (turnoAtual + 1) % equipes.length;

            const placarNovo = document.getElementById(`placar-${turnoAtual}`);
            if (placarNovo) placarNovo.classList.add('ativo');
        }

        function finalizarCarta() {
            marcarRespondida(cartaAbertaIdx);
            fecharModais();
            
            const respondidas = document.querySelectorAll('.carta-numero.respondida').length;
            if (respondidas === deck.length) {
                setTimeout(mostrarVencedor, 500);
                return;
            }

            avancarTurno();
        }

        function mostrarVencedor() {
            let maxPts = -Infinity;
            let vencedores = [];
            equipes.forEach(e => {
                if (e.pontos > maxPts) {
                    maxPts = e.pontos;
                    vencedores = [e];
                } else if (e.pontos === maxPts) {
                    vencedores.push(e);
                }
            });

            // ── Salvar partida no servidor (silencioso) ─────────────────
            fetch('/api/partida/salvar/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': CSRF_TOKEN,
                },
                body: JSON.stringify({
                    baralho_id: BARALHO_ID,
                    equipes: equipes.map(e => ({ nome: e.nome, pontos: e.pontos })),
                }),
            }).catch(() => {}); // não bloqueia em caso de falha

            let html = '';
            if (vencedores.length === 1) {
                html = `
                    <div style="font-size:80px; margin-bottom:20px;">🏆</div>
                    <div style="font-size:24px; font-weight:800; color:var(--text-muted); margin-bottom:12px;">Fim de Jogo! A equipe vencedora é:</div>
                    <div style="font-size:48px; font-weight:900; color:var(--primary); margin-bottom:8px;">${vencedores[0].nome}</div>
                    <div style="font-size:20px; font-weight:700; color:var(--success); margin-bottom:32px;">Com ${maxPts} pontos!</div>
                `;
            } else {
                html = `
                    <div style="font-size:80px; margin-bottom:20px;">🤝</div>
                    <div style="font-size:24px; font-weight:800; color:var(--text-muted); margin-bottom:12px;">Fim de Jogo! Temos um empate entre:</div>
                    <div style="font-size:36px; font-weight:900; color:var(--primary); margin-bottom:8px;">${vencedores.map(v => v.nome).join(' e ')}</div>
                    <div style="font-size:20px; font-weight:700; color:var(--success); margin-bottom:32px;">Ambas com ${maxPts} pontos!</div>
                `;
            }
            
            const btnTopbar = document.querySelector('.btn-topbar');
            const homeUrl = btnTopbar ? btnTopbar.dataset.url : '/';
            html += `
                <div style="display:flex; gap:12px; justify-content:center; margin-top:24px;">
                    <button class="btn-ninguem" onclick="this.closest('.modal-overlay').remove()">Continuar no Jogo</button>
                    <a href="${homeUrl}" class="btn-revelar" style="margin-bottom:0; text-decoration:none; display:inline-block; padding:14px 24px;">Encerrar Partida</a>
                </div>
            `;

            const div = document.createElement('div');
            div.className = 'modal-overlay open';
            div.innerHTML = `
                <div class="modal-box" style="border-top:8px solid var(--primary); transform:none; animation:none; max-width:600px;">
                    ${html}
                </div>
            `;
            document.body.appendChild(div);
            
            // Lançar um pouco de confete/partículas na tela
            for(let i=0; i<30; i++) {
                setTimeout(() => {
                    const cx = window.innerWidth / 2;
                    const cy = window.innerHeight / 2;
                    const p = document.createElement('div');
                    p.className = 'particle';
                    const ang = Math.random() * Math.PI * 2;
                    const dist = 50 + Math.random() * 200;
                    p.style.setProperty('--tx', Math.cos(ang) * dist + 'px');
                    p.style.setProperty('--ty', Math.sin(ang) * dist + 'px');
                    p.style.left = cx + 'px';
                    p.style.top = cy + 'px';
                    p.style.background = ['#f97316','#22c55e','#f59e0b','#ec4899'][Math.floor(Math.random()*4)];
                    p.style.animationDelay = '0s';
                    p.style.animationDuration = '1.5s';
                    document.body.appendChild(p);
                    setTimeout(() => p.remove(), 1500);
                }, i * 50);
            }
        }

        function tentarEncerrar(btn) {
            const respondidas = document.querySelectorAll('.carta-numero.respondida').length;
            if (respondidas === deck.length && deck.length > 0) {
                mostrarVencedor();
            } else {
                window.location.href = btn.dataset.url;
            }
        }

        // ── CLICK NA CARTA ─────────────────────────────

        function clicarCarta(idx) {
            cartaAbertaIdx = idx;
            const carta = deck[idx];
            carta.isCoringa ? abrirModalCoringa(carta) : abrirModalCarta(carta);
        }

        // ── MODAL CARTA REGULAR ────────────────────────

        function abrirModalCarta(carta) {
            document.getElementById('modal-badge').textContent = `⭐ Valendo ${carta.pontos} pontos!`;
            document.getElementById('modal-pergunta').textContent = carta.pergunta;
            document.getElementById('modal-resposta').textContent = carta.resposta;

            const img = document.getElementById('modal-img');
            if (carta.imagem) { img.src = carta.imagem; img.style.display = 'block'; }
            else { img.style.display = 'none'; }

            document.getElementById('modal-resposta-box').style.display = 'none';
            document.getElementById('botoes-equipes').style.display = 'none';
            document.getElementById('btn-revelar').style.display = 'inline-block';

            document.getElementById('modal-carta').classList.add('open');
        }

        function revelarResposta() {
            document.getElementById('btn-revelar').style.display = 'none';
            document.getElementById('modal-resposta-box').style.display = 'block';

            const box = document.getElementById('botoes-equipes');
            const eAtual = equipes[turnoAtual];

            let html = `
        <div style="display:flex; justify-content:center; gap:16px; margin-top:24px; width:100%;">
            <button class="btn-resposta certo" onclick="pontuar(${turnoAtual})">✔️ Certo</button>
            <button class="btn-resposta errado" onclick="ninguemPontua()">❌ Errado</button>
            <button class="btn-resposta passou" onclick="abrirPainelPassou()">⏭️ Passou</button>
        </div>
    `;

            box.innerHTML = html;
            box.style.display = 'flex';
        }

        function abrirPainelPassou() {
            const box = document.getElementById('botoes-equipes');
            const eAtual = equipes[turnoAtual];
            let html = `
        <div style="background:var(--bg); padding:20px; border-radius:12px; border:1px solid var(--border); margin-top:12px; text-align:left; width:100%;">
            <div style="margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--border);">
                <span style="font-size:14px; color:var(--text-muted); font-weight:700;">Equipe da vez (que passou):</span><br>
                <span style="font-size:20px; font-weight:900; color:var(--primary);">${eAtual.nome}</span>
            </div>
            <div style="font-size:14px; font-weight:800; color:var(--text-muted); margin-bottom:12px; text-transform:uppercase;">Selecione a equipe que respondeu:</div>
            <div style="display:flex; flex-direction:column; gap:12px;">
    `;
            
            equipes.forEach((e, i) => {
                if (i === turnoAtual) return;
                html += `
            <div style="display:flex; align-items:center; justify-content:space-between; background:white; padding:12px; border-radius:8px; border:1px solid var(--border);">
                <strong style="font-size:16px; color:var(--text);">${e.nome}</strong>
                <div style="display:flex; gap:8px;">
                    <button class="btn-pass-action btn-pass-acertou" onclick="passouAcertou(${i})">Acertou</button>
                    <button class="btn-pass-action btn-pass-errou" onclick="passouErrou()">Errou</button>
                </div>
            </div>
        `;
            });

            html += `
            </div>
            <button class="btn-pass-action btn-pass-ninguem" onclick="ninguemPontua()">Ninguém respondeu / Pular</button>
        </div>
    `;
            box.innerHTML = html;
        }

        function passouAcertou(equipeAcertouIdx) {
            const ptsCarta = deck[cartaAbertaIdx].pontos;
            // Equipe que acertou ganha
            equipes[equipeAcertouIdx].pontos += ptsCarta;
            atualizarPlacar(equipeAcertouIdx, true);
            
            // Equipe da vez perde 5
            equipes[turnoAtual].pontos = Math.max(0, equipes[turnoAtual].pontos - 5);
            atualizarPlacar(turnoAtual, false);
            
            finalizarCarta();
        }

        function passouErrou() {
            const ptsCarta = deck[cartaAbertaIdx].pontos;
            // Equipe da vez ganha
            equipes[turnoAtual].pontos += ptsCarta;
            atualizarPlacar(turnoAtual, true);
            
            finalizarCarta();
        }

        function pontuar(equipeIdx) {
            const pontos = deck[cartaAbertaIdx].pontos;
            equipes[equipeIdx].pontos += pontos;
            atualizarPlacar(equipeIdx, true);
            finalizarCarta();
        }

        function ninguemPontua() {
            finalizarCarta();
        }

        // ── MODAL CORINGA ──────────────────────────────

        function abrirModalCoringa(carta) {
            corAtualIdx = turnoAtual;
            corAlvoIdx = null;

            document.getElementById('cor-icone').textContent = carta.icone;
            document.getElementById('cor-desc').textContent = carta.descricao;

            const eAtual = equipes[turnoAtual];
            document.getElementById('cor-step-1').innerHTML = `
        <div class="coringa-step-title">Equipe Sorteada</div>
        <div style="font-size:24px; font-weight:900; color:var(--primary); margin-bottom:24px;">
            ${eAtual.nome}
        </div>
    `;

            if (carta.precisa_alvo) {
                document.getElementById('cor-step-2').style.display = 'block';
                const b2 = document.getElementById('cor-btns-alvo');
                b2.innerHTML = equipes.map((e, i) => {
                    if (i === turnoAtual) return '';
                    return `<button class="btn-team-sel" onclick="selecionarAlvo(${i})">${e.nome}</button>`;
                }).join('');
                document.getElementById('cor-btn-confirmar').disabled = true;
            } else {
                document.getElementById('cor-step-2').style.display = 'none';
                document.getElementById('cor-btn-confirmar').disabled = false;
            }

            document.getElementById('modal-coringa').classList.add('open');
        }

        function selecionarAlvo(idx) {
            corAlvoIdx = idx;
            document.querySelectorAll('#cor-btns-alvo .btn-team-sel').forEach((b, i) => {
                b.classList.toggle('sel', parseInt(b.getAttribute('onclick').match(/\d+/)[0]) === idx);
            });
            document.getElementById('cor-btn-confirmar').disabled = false;
        }

        function confirmarCoringa() {
            const carta = deck[cartaAbertaIdx];
            aplicarCoringa(carta, corAtualIdx, corAlvoIdx);
            finalizarCarta();
        }

        // ── EFEITOS DOS CORINGAS ───────────────────────

        function aplicarCoringa(c, atualIdx, alvoIdx) {
            const atual = equipes[atualIdx];

            switch (c.tipo) {
                case 'roubar_pts': {
                    const val = alvoIdx !== null ? Math.min(c.valor, equipes[alvoIdx].pontos) : 0;
                    if (alvoIdx !== null) equipes[alvoIdx].pontos -= val;
                    atual.pontos += val;
                    atualizarPlacar(atualIdx, true);
                    if (alvoIdx !== null) atualizarPlacar(alvoIdx, false);
                    break;
                }
                case 'ganhar_pts':
                    atual.pontos += c.valor;
                    atualizarPlacar(atualIdx, true);
                    break;
                case 'perder_pts':
                    atual.pontos = Math.max(0, atual.pontos - c.valor);
                    atualizarPlacar(atualIdx, false);
                    break;
                case 'remover_pts':
                    if (alvoIdx !== null) equipes[alvoIdx].pontos = Math.max(0, equipes[alvoIdx].pontos - c.valor);
                    if (alvoIdx !== null) atualizarPlacar(alvoIdx, false);
                    break;
                case 'primeiro_lugar': {
                    const maxPts = Math.max(...equipes.map(e => e.pontos));
                    atual.pontos = maxPts + 5;
                    atualizarPlacar(atualIdx, true);
                    break;
                }
                case 'ultimo_lugar': {
                    const minPts = Math.min(...equipes.map(e => e.pontos));
                    atual.pontos = Math.max(0, minPts - 5);
                    atualizarPlacar(atualIdx, false);
                    break;
                }
                case 'trocar_pts': {
                    if (alvoIdx !== null) {
                        const tmp = atual.pontos;
                        atual.pontos = equipes[alvoIdx].pontos;
                        equipes[alvoIdx].pontos = tmp;
                        atualizarPlacar(atualIdx, true);
                        atualizarPlacar(alvoIdx, false);
                    }
                    break;
                }
                case 'dobrar_pts':
                    atual.pontos *= 2;
                    atualizarPlacar(atualIdx, true);
                    break;
                case 'metade_pts':
                    atual.pontos = Math.floor(atual.pontos / 2);
                    atualizarPlacar(atualIdx, false);
                    break;
            }
        }

        // ── ANIMAÇÕES ──────────────────────────────────

        function atualizarPlacar(idx, ganhou) {
            const el = document.getElementById(`pontos-${idx}`);
            if (!el) return;
            el.textContent = equipes[idx].pontos;
            el.classList.remove('pts-up', 'pts-down');
            void el.offsetWidth;
            el.classList.add(ganhou ? 'pts-up' : 'pts-down');

            if (ganhou) lancarParticulas(el);
        }

        function lancarParticulas(el) {
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            for (let i = 0; i < 8; i++) {
                const p = document.createElement('div');
                p.className = 'particle';
                const ang = (i / 8) * Math.PI * 2;
                const dist = 36 + Math.random() * 48;
                p.style.setProperty('--tx', Math.cos(ang) * dist + 'px');
                p.style.setProperty('--ty', Math.sin(ang) * dist + 'px');
                p.style.left = (cx - 4) + 'px';
                p.style.top = (cy - 4) + 'px';
                p.style.background = '#fff'; // Partículas brancas no fundo laranja
                p.style.animationDelay = (Math.random() * .1) + 's';
                document.body.appendChild(p);
                setTimeout(() => p.remove(), 800);
            }
        }

        function marcarRespondida(idx) {
            const el = document.getElementById(`card-${idx}`);
            if (el) el.classList.add('respondida');
        }

        function fecharModais() {
            document.getElementById('modal-carta').classList.remove('open');
            document.getElementById('modal-coringa').classList.remove('open');
            document.getElementById('modal-editar').classList.remove('open');
            corAtualIdx = null; corAlvoIdx = null;
        }

        ['modal-carta', 'modal-coringa', 'modal-editar'].forEach(id => {
            document.getElementById(id).addEventListener('click', e => {
                if (e.target.id === id) fecharModais();
            });
        });