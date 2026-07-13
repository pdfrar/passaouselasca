from django.contrib import admin
from .models import Baralho, Carta, Partida


class CartaInline(admin.TabularInline):
    model = Carta
    extra = 0
    fields = ('pergunta', 'resposta', 'pontos', 'imagem')


@admin.register(Baralho)
class BaralhoAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'professor', 'publico', 'num_cartas')
    list_filter = ('publico', 'professor')
    search_fields = ('titulo', 'professor__username')
    inlines = [CartaInline]

    @admin.display(description='Nº de Cartas')
    def num_cartas(self, obj):
        return obj.cartas.count()


@admin.register(Carta)
class CartaAdmin(admin.ModelAdmin):
    list_display = ('pergunta', 'baralho', 'pontos')
    list_filter = ('baralho',)
    search_fields = ('pergunta', 'resposta')


@admin.register(Partida)
class PartidaAdmin(admin.ModelAdmin):
    list_display = ('vencedor', 'baralho', 'professor', 'data')
    list_filter = ('professor',)
    search_fields = ('vencedor', 'baralho__titulo', 'professor__username')
    date_hierarchy = 'data'
    readonly_fields = ('data', 'equipes_json', 'vencedor')