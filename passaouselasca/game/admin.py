from django.contrib import admin
from .models import Baralho, Carta

class CartaInline(admin.TabularInline):
    model = Carta
    extra = 1

class  BaralhoAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'professor')
    inlines = [CartaInline]

admin.site.register(Baralho, BaralhoAdmin)
admin.site.register(Carta)