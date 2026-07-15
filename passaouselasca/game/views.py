import json
import os
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.cache import never_cache
from django.db.models import Count
from django.core.paginator import Paginator
from django.core.files import File
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from .models import Baralho, Carta, Partida, CORINGAS_PADRAO


# ── AUTH ──────────────────────────────────────────────────────────────────

@never_cache
def login_view(request):
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'login':
            username = request.POST.get('username', '').strip()
            password = request.POST.get('password', '')
            user = authenticate(request, username=username, password=password)
            if user:
                login(request, user)
                return redirect('home')
            else:
                messages.error(request, 'Usuário ou senha incorretos.')
                return render(request, 'login.html', {'tab': 'login'})

        elif action == 'cadastro':
            username = request.POST.get('username', '').strip()
            password = request.POST.get('password', '')
            password2 = request.POST.get('password2', '')

            if password != password2:
                messages.error(request, 'As senhas não coincidem.')
                return render(request, 'login.html', {'tab': 'cadastro'})
            if User.objects.filter(username=username).exists():
                messages.error(request, 'Esse nome de usuário já está em uso.')
                return render(request, 'login.html', {'tab': 'cadastro'})
            if len(username) < 3:
                messages.error(request, 'O nome de usuário deve ter pelo menos 3 caracteres.')
                return render(request, 'login.html', {'tab': 'cadastro'})

            # Valida força da senha usando os AUTH_PASSWORD_VALIDATORS do settings (#2)
            try:
                validate_password(password)
            except ValidationError as e:
                for err in e.messages:
                    messages.error(request, err)
                return render(request, 'login.html', {'tab': 'cadastro'})

            user = User.objects.create_user(username=username, password=password)
            login(request, user)
            messages.success(request, f'Bem-vindo, {username}!')
            return redirect('home')

    return render(request, 'login.html', {'tab': 'login'})


# Logout exige POST para evitar CSRF via links externos (#1)
@require_POST
def logout_view(request):
    logout(request)
    return redirect('login')


# ── HOME ──────────────────────────────────────────────────────────────────

@login_required(login_url='/login/')
def home(request):
    # annotate elimina N+1: num_cartas é calculado em 1 query via JOIN (#4)
    meus_baralhos = (
        Baralho.objects
        .filter(professor=request.user)
        .annotate(num_cartas=Count('cartas'))
    )
    return render(request, 'home.html', {'meus_baralhos': meus_baralhos})


# ── JOGO ──────────────────────────────────────────────────────────────────

@login_required(login_url='/login/')
def tela_do_jogo(request, baralho_id):
    baralho = get_object_or_404(Baralho, id=baralho_id)
    cartas = baralho.cartas.all()

    # Guard: não deixa iniciar jogo com baralho vazio (#8)
    if not cartas.exists():
        messages.error(
            request,
            f'O baralho "{baralho.titulo}" está vazio. Adicione pelo menos uma carta antes de jogar.',
        )
        return redirect('baralhos')

    cartas_json = json.dumps([{
        'pergunta': c.pergunta,
        'resposta': c.resposta,
        'pontos': c.pontos,
        'imagem': c.imagem.url if c.imagem else '',
    } for c in cartas])

    coringas_json = json.dumps(CORINGAS_PADRAO)

    return render(request, 'jogo.html', {
        'baralho': baralho,
        'cartas_json': cartas_json,
        'coringas_json': coringas_json,
    })


# ── VISUALIZAR BARALHO ────────────────────────────────────────────────────

@login_required(login_url='/login/')
def visualizar_baralho_view(request, baralho_id):
    baralho = get_object_or_404(Baralho, id=baralho_id)
    cartas = baralho.cartas.all()
    return render(request, 'visualizarBaralho.html', {
        'baralho': baralho,
        'cartas': cartas,
        'is_owner': baralho.professor == request.user,
    })


# ── COPIAR BARALHO ────────────────────────────────────────────────────────

@login_required(login_url='/login/')
def copiar_baralho_view(request, baralho_id):
    baralho_original = get_object_or_404(Baralho, id=baralho_id)
    if request.method == 'POST':
        novo = Baralho.objects.create(
            professor=request.user,
            titulo=f'Cópia — {baralho_original.titulo}',
        )
        for carta in baralho_original.cartas.all():
            nova_carta = Carta(
                baralho=novo,
                pergunta=carta.pergunta,
                resposta=carta.resposta,
                pontos=carta.pontos,
            )
            if carta.imagem:
                # Copia o arquivo fisicamente para evitar dependência do original (#9)
                try:
                    with carta.imagem.open('rb') as f:
                        nova_carta.save()  # salva primeiro para obter ID
                        nova_carta.imagem.save(
                            os.path.basename(carta.imagem.name),
                            File(f),
                            save=True,
                        )
                except Exception:
                    nova_carta.imagem = None
                    nova_carta.save()
            else:
                nova_carta.save()
        messages.success(request, f'Baralho copiado como "Cópia — {baralho_original.titulo}"!')
    return redirect('baralhos')


# ── GERENCIAMENTO DE BARALHOS ─────────────────────────────────────────────

@login_required(login_url='/login/')
def baralhos_view(request):
    # annotate elimina N+1 (#4)
    meus_baralhos = (
        Baralho.objects
        .filter(professor=request.user)
        .annotate(num_cartas=Count('cartas'))
    )
    return render(request, 'baralhos.html', {'meus_baralhos': meus_baralhos})


@login_required(login_url='/login/')
def criar_baralho_view(request):
    if request.method == 'POST':
        titulo = request.POST.get('titulo', '').strip()
        if not titulo:
            messages.error(request, 'O título do baralho é obrigatório.')
            return render(request, 'criarBaralho.html', {'baralho': None})

        baralho = Baralho.objects.create(professor=request.user, titulo=titulo)

        i = 0
        while f'pergunta_{i}' in request.POST:
            pergunta = request.POST.get(f'pergunta_{i}', '').strip()
            resposta = request.POST.get(f'resposta_{i}', '').strip()
            try:
                pontos = int(request.POST.get(f'pontos_{i}', '100'))
            except ValueError:
                pontos = 100
            imagem = request.FILES.get(f'imagem_{i}')
            if pergunta:
                Carta.objects.create(baralho=baralho, pergunta=pergunta,
                                     resposta=resposta, pontos=pontos, imagem=imagem)
            i += 1

        messages.success(request, f'Baralho "{titulo}" criado com sucesso!')
        return redirect('baralhos')

    return render(request, 'criarBaralho.html', {'baralho': None})


@login_required(login_url='/login/')
def editar_baralho_view(request, baralho_id):
    baralho = get_object_or_404(Baralho, id=baralho_id, professor=request.user)

    if request.method == 'POST':
        acao = request.POST.get('acao', '')

        # ── Salvar título do baralho ──────────────────────────────────────
        if acao == 'salvar_baralho':
            titulo = request.POST.get('titulo', '').strip()
            if titulo:
                baralho.titulo = titulo
                baralho.save()
                messages.success(request, f'Baralho "{baralho.titulo}" atualizado!')
            return redirect('baralhos')

        # ── Adicionar uma nova carta ───────────────────────────────────────
        elif acao == 'adicionar_carta':
            pergunta = request.POST.get('pergunta', '').strip()
            resposta = request.POST.get('resposta', '').strip()
            try:
                pontos = int(request.POST.get('pontos', '100'))
            except ValueError:
                pontos = 100
            imagem = request.FILES.get('imagem')

            if pergunta:
                Carta.objects.create(
                    baralho=baralho,
                    pergunta=pergunta,
                    resposta=resposta,
                    pontos=pontos,
                    imagem=imagem,
                )
                messages.success(request, 'Carta adicionada com sucesso!')
            else:
                messages.error(request, 'A pergunta não pode estar vazia.')
            return redirect('editar_baralho', baralho_id=baralho.id)

        # ── Deletar uma carta específica ───────────────────────────────────
        elif acao == 'deletar_carta':
            carta_id = request.POST.get('carta_id', '').strip()
            if carta_id:
                Carta.objects.filter(id=carta_id, baralho=baralho).delete()
                messages.success(request, 'Carta removida.')
            return redirect('editar_baralho', baralho_id=baralho.id)

        # O bloco legado de edição em lote (else) foi removido (#3).
        # Todo o fluxo de adição/remoção de cartas passa pelo AJAX.

    cartas = baralho.cartas.all()
    return render(request, 'criarBaralho.html', {'baralho': baralho, 'cartas': cartas})


# ── CARTA AJAX ───────────────────────────────────────────────────────────

@login_required(login_url='/login/')
@require_POST
def adicionar_carta_ajax(request, baralho_id):
    baralho = get_object_or_404(Baralho, id=baralho_id, professor=request.user)
    pergunta = request.POST.get('pergunta', '').strip()
    resposta = request.POST.get('resposta', '').strip()
    try:
        pontos = int(request.POST.get('pontos', '100'))
    except ValueError:
        pontos = 100
    imagem = request.FILES.get('imagem')

    if not pergunta:
        return JsonResponse({'ok': False, 'erro': 'A pergunta não pode estar vazia.'}, status=400)

    carta = Carta.objects.create(
        baralho=baralho,
        pergunta=pergunta,
        resposta=resposta,
        pontos=pontos,
        imagem=imagem,
    )
    return JsonResponse({
        'ok': True,
        'carta': {
            'id': carta.id,
            'pergunta': carta.pergunta,
            'resposta': carta.resposta,
            'pontos': carta.pontos,
            'imagem_url': carta.imagem.url if carta.imagem else '',
        }
    })


@login_required(login_url='/login/')
@require_POST
def deletar_carta_ajax(request, baralho_id, carta_id):
    baralho = get_object_or_404(Baralho, id=baralho_id, professor=request.user)
    carta = get_object_or_404(Carta, id=carta_id, baralho=baralho)
    carta.delete()
    return JsonResponse({'ok': True})


@login_required(login_url='/login/')
def deletar_baralho_view(request, baralho_id):
    baralho = get_object_or_404(Baralho, id=baralho_id, professor=request.user)
    if request.method == 'POST':
        nome = baralho.titulo
        baralho.delete()
        messages.success(request, f'Baralho "{nome}" excluído.')
    return redirect('baralhos')


# ── GALERIA ───────────────────────────────────────────────────────────────

@login_required(login_url='/login/')
def galeria_view(request):
    baralhos = (
        Baralho.objects
        .filter(publico=True)
        .select_related('professor')
        .annotate(num_cartas=Count('cartas'))
        .order_by('titulo')
    )
    return render(request, 'galeria.html', {'baralhos': baralhos})


@login_required(login_url='/login/')
@require_POST
def toggle_publico_view(request, baralho_id):
    baralho = get_object_or_404(Baralho, id=baralho_id, professor=request.user)
    baralho.publico = not baralho.publico
    baralho.save()
    return JsonResponse({'publico': baralho.publico})


# ── PARTIDAS ──────────────────────────────────────────────────────────────

@login_required(login_url='/login/')
@require_POST
def salvar_partida_view(request):
    try:
        data = json.loads(request.body)
        baralho_id = data.get('baralho_id')
        equipes = data.get('equipes', [])  # [{nome, pontos}, ...]

        if not equipes:
            return JsonResponse({'ok': False, 'erro': 'Sem equipes'}, status=400)

        # Determinar vencedor
        max_pts = max(e['pontos'] for e in equipes)
        vencedores = [e['nome'] for e in equipes if e['pontos'] == max_pts]
        vencedor = ' e '.join(vencedores) if len(vencedores) > 1 else vencedores[0]

        baralho = Baralho.objects.filter(id=baralho_id).first()

        Partida.objects.create(
            baralho=baralho,
            professor=request.user,
            equipes_json=json.dumps(equipes),
            vencedor=vencedor,
        )
        return JsonResponse({'ok': True, 'vencedor': vencedor})
    except Exception as e:
        return JsonResponse({'ok': False, 'erro': str(e)}, status=500)


@login_required(login_url='/login/')
def historico_view(request):
    partidas_qs = (
        Partida.objects
        .filter(professor=request.user)
        .select_related('baralho')
    )
    meus_baralhos = Baralho.objects.filter(professor=request.user).order_by('titulo')

    # Paginação: 50 partidas por página (#6)
    paginator = Paginator(partidas_qs, 50)
    page_num = request.GET.get('page', 1)
    partidas = paginator.get_page(page_num)

    # O loop json.loads foi removido — usa-se a property Partida.equipes (#7)

    return render(request, 'historico.html', {
        'partidas': partidas,
        'meus_baralhos': meus_baralhos,
    })