from django.contrib import admin
from django.urls import path
from game import views
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    # Home
    path('', views.home, name='home'),

    # Jogo
    path('jogar/<int:baralho_id>/', views.tela_do_jogo, name='jogar'),

    # Baralhos — ordem importa: paths fixos antes do int dinâmico
    path('baralhos/', views.baralhos_view, name='baralhos'),
    path('baralhos/criar/', views.criar_baralho_view, name='criar_baralho'),
    path('baralhos/editar/<int:baralho_id>/', views.editar_baralho_view, name='editar_baralho'),
    path('baralhos/deletar/<int:baralho_id>/', views.deletar_baralho_view, name='deletar_baralho'),
    path('baralhos/copiar/<int:baralho_id>/', views.copiar_baralho_view, name='copiar_baralho'),
    path('baralhos/<int:baralho_id>/', views.visualizar_baralho_view, name='visualizar_baralho'),
    path('baralhos/<int:baralho_id>/toggle-publico/', views.toggle_publico_view, name='toggle_publico'),

    # Galeria
    path('galeria/', views.galeria_view, name='galeria'),

    # Partidas / Histórico
    path('api/partida/salvar/', views.salvar_partida_view, name='salvar_partida'),
    path('historico/', views.historico_view, name='historico'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
