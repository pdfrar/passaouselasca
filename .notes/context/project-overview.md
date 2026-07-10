# Passa ou Se Lasca — Project Overview

> Jogo de perguntas e respostas estilo quiz para uso em sala de aula, com baralhos customizáveis e cartas coringa.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python · Django 6.0.6 |
| Banco de dados | SQLite (dev) |
| Frontend | HTML + CSS + JavaScript (vanilla) |
| Auth | Django built-in (`django.contrib.auth`) |
| Mídia | Django `ImageField` → `cartas_img/` |

## Repositório

- **GitHub:** https://github.com/pdfrar/passaouselasca
- **Branch principal:** `main`

## Estrutura de Pastas

```
Passa ou Se lasca/
├── .notes/                  ← vault Obsidian
│   └── context/
│       └── project-overview.md
├── .gitignore
└── passaouselasca/          ← raiz Django
    ├── manage.py
    ├── passaouselasca/      ← settings, urls, wsgi, asgi
    │   ├── settings.py
    │   └── urls.py
    └── game/                ← app principal
        ├── models.py
        ├── views.py
        ├── admin.py
        ├── migrations/
        └── templates/
            ├── login.html
            ├── home.html
            ├── baralhos.html
            ├── criarBaralho.html
            ├── visualizarBaralho.html
            └── jogo.html
```

## Models

### `Baralho`
Representa um baralho de cartas pertencente a um professor (usuário).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `professor` | FK → `User` | Dono do baralho |
| `titulo` | CharField(200) | Nome do baralho |

### `Carta`
Uma carta dentro de um baralho.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `baralho` | FK → `Baralho` | Baralho pai |
| `pergunta` | CharField(500) | Texto da pergunta |
| `resposta` | CharField(500) | Resposta esperada |
| `pontos` | IntegerField | Valor em pontos (default: 100) |
| `imagem` | ImageField | Imagem opcional da carta |

### `CORINGAS_PADRAO`
Lista de dicts definida em `models.py` — **não persiste no banco**, é randomizada no frontend durante o jogo.

| `tipo` | Descrição |
|--------|-----------|
| `roubar_pts` | Rouba pontos de uma equipe adversária (5–25 pts) |
| `remover_pts` | Remove pontos de adversário sem adicionar ao próprio (5–25 pts) |
| `ganhar_pts` | Ganha pontos diretamente (25, 50 ou 100 pts) |
| `perder_pts` | Perde pontos (25 ou 50 pts) |
| `primeiro_lugar` | Vai para o 1º lugar (pontos do líder + 5) |
| `ultimo_lugar` | Vai para o último lugar (pontos do último − 5) |
| `trocar_pts` | Troca pontuação com outra equipe |
| `dobrar_pts` | Dobra os próprios pontos |
| `metade_pts` | Perde metade dos pontos |

## Rotas (URLs)

| Método | URL | View | Nome |
|--------|-----|------|------|
| GET/POST | `/login/` | `login_view` | `login` |
| GET | `/logout/` | `logout_view` | `logout` |
| GET | `/` | `home` | `home` |
| GET | `/jogar/<id>/` | `tela_do_jogo` | `jogar` |
| GET | `/baralhos/` | `baralhos_view` | `baralhos` |
| GET/POST | `/baralhos/criar/` | `criar_baralho_view` | `criar_baralho` |
| GET/POST | `/baralhos/editar/<id>/` | `editar_baralho_view` | `editar_baralho` |
| POST | `/baralhos/deletar/<id>/` | `deletar_baralho_view` | `deletar_baralho` |
| POST | `/baralhos/copiar/<id>/` | `copiar_baralho_view` | `copiar_baralho` |
| GET | `/baralhos/<id>/` | `visualizar_baralho_view` | `visualizar_baralho` |

> Todas as rotas (exceto `/login/`) requerem autenticação via `@login_required`.

## Fluxo Principal

```
Login/Cadastro
    ↓
Home (lista baralhos do usuário)
    ↓
Baralhos → Criar / Editar / Deletar / Copiar / Visualizar
    ↓
Jogar (tela_do_jogo)
    - Cartas e coringas enviados como JSON ao template
    - Lógica do jogo (equipes, pontuação, coringas) roda 100% no frontend (JS)
```

## Como Rodar Localmente

```bash
cd passaouselasca
python manage.py migrate
python manage.py createsuperuser   # opcional
python manage.py runserver
```

Acesse: http://127.0.0.1:8000

## Decisões de Design

- **Jogo stateless no servidor:** toda a lógica de pontuação, rodadas e coringas é gerenciada pelo JavaScript no cliente — o servidor apenas fornece os dados via JSON no contexto do template.
- **Coringas não persistem:** `CORINGAS_PADRAO` é uma lista em memória, randomizada por sessão de jogo, sem necessidade de tabela no banco.
- **Cópia de baralho:** ao copiar, um novo `Baralho` é criado com todas as `Carta`s duplicadas, preservando o original intacto.
- **Permissão por ownership:** editar/deletar baralhos é restrito ao `professor` que os criou (filtro `professor=request.user`).
