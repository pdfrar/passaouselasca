import json
import os
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_delete
from django.dispatch import receiver


class Baralho(models.Model):
    professor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='baralhos')
    titulo = models.CharField(max_length=200)
    publico = models.BooleanField(default=False)

    def __str__(self):
        return self.titulo


class Partida(models.Model):
    baralho = models.ForeignKey(Baralho, on_delete=models.SET_NULL, null=True, related_name='partidas')
    professor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='partidas')
    data = models.DateTimeField(auto_now_add=True)
    # JSON: [{"nome": "Equipe A", "pontos": 300}, ...]
    equipes_json = models.TextField()
    vencedor = models.CharField(max_length=200)  # nome da equipe ou "Empate"

    class Meta:
        ordering = ['-data']

    @property
    def equipes(self):
        """Retorna a lista de equipes desserializada do JSON."""
        return json.loads(self.equipes_json)

    def __str__(self):
        return f"{self.vencedor} — {self.baralho} ({self.data:%d/%m/%Y})"


class Carta(models.Model):
    baralho = models.ForeignKey(Baralho, on_delete=models.CASCADE, related_name='cartas')
    pergunta = models.CharField(max_length=500)
    resposta = models.CharField(max_length=500)
    pontos = models.IntegerField(default=100)
    imagem = models.ImageField(upload_to='cartas_img/', null=True, blank=True)

    def __str__(self):
        return f"{self.pergunta}"


@receiver(post_delete, sender=Carta)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    """
    Deletes file from filesystem
    when corresponding `Carta` object is deleted.
    """
    if instance.imagem:
        if os.path.isfile(instance.imagem.path):
            os.remove(instance.imagem.path)


# ── Cartas Coringa ─────────────────────────────────────────────────────────
# Tipos predefinidos de coringas. Não são armazenados no banco de dados —
# são randomizados no frontend para completar as rodadas do jogo.

CORINGAS_PADRAO = [
    # Roubar pontos de outra equipe
    {'tipo': 'roubar_pts',     'valor': 5,    'descricao': 'Roube 5 pontos de uma equipe adversária',          'icone': '🥷', 'precisa_alvo': True},
    {'tipo': 'roubar_pts',     'valor': 10,   'descricao': 'Roube 10 pontos de uma equipe adversária',         'icone': '🥷', 'precisa_alvo': True},
    {'tipo': 'roubar_pts',     'valor': 15,   'descricao': 'Roube 15 pontos de uma equipe adversária',         'icone': '🥷', 'precisa_alvo': True},
    {'tipo': 'roubar_pts',     'valor': 20,   'descricao': 'Roube 20 pontos de uma equipe adversária',         'icone': '🥷', 'precisa_alvo': True},
    {'tipo': 'roubar_pts',     'valor': 25,   'descricao': 'Roube 25 pontos de uma equipe adversária',         'icone': '🥷', 'precisa_alvo': True},
    # Ganhar pontos
    {'tipo': 'ganhar_pts',     'valor': 25,   'descricao': 'Ganhe 25 pontos!',                                 'icone': '⬆️',  'precisa_alvo': False},
    {'tipo': 'ganhar_pts',     'valor': 50,   'descricao': 'Ganhe 50 pontos!',                                 'icone': '🎉', 'precisa_alvo': False},
    {'tipo': 'ganhar_pts',     'valor': 100,  'descricao': 'Ganhe 100 pontos!',                                'icone': '💰', 'precisa_alvo': False},
    # Perder pontos
    {'tipo': 'perder_pts',     'valor': 25,   'descricao': 'Perca 25 pontos',                                  'icone': '⬇️',  'precisa_alvo': False},
    {'tipo': 'perder_pts',     'valor': 50,   'descricao': 'Perca 50 pontos',                                  'icone': '💸', 'precisa_alvo': False},
    # Remover pontos de outra equipe
    {'tipo': 'remover_pts',    'valor': 5,    'descricao': 'Remova 5 pontos de uma equipe adversária',         'icone': '✂️',  'precisa_alvo': True},
    {'tipo': 'remover_pts',    'valor': 10,   'descricao': 'Remova 10 pontos de uma equipe adversária',        'icone': '✂️',  'precisa_alvo': True},
    {'tipo': 'remover_pts',    'valor': 15,   'descricao': 'Remova 15 pontos de uma equipe adversária',        'icone': '✂️',  'precisa_alvo': True},
    {'tipo': 'remover_pts',    'valor': 20,   'descricao': 'Remova 20 pontos de uma equipe adversária',        'icone': '✂️',  'precisa_alvo': True},
    {'tipo': 'remover_pts',    'valor': 25,   'descricao': 'Remova 25 pontos de uma equipe adversária',        'icone': '✂️',  'precisa_alvo': True},
    # Especiais de posição
    {'tipo': 'primeiro_lugar', 'valor': 5,    'descricao': 'Vá para o 1º lugar! (pontos do líder + 5)',        'icone': '🥇', 'precisa_alvo': False},
    {'tipo': 'ultimo_lugar',   'valor': 5,    'descricao': 'Vá para o último lugar… (pontos do último − 5)',   'icone': '😬', 'precisa_alvo': False},
    # Especiais de operação
    {'tipo': 'trocar_pts',     'valor': None, 'descricao': 'Troque sua pontuação com outra equipe!',           'icone': '🔄', 'precisa_alvo': True},
    {'tipo': 'dobrar_pts',     'valor': None, 'descricao': 'Dobre seus pontos!',                               'icone': '✨', 'precisa_alvo': False},
    {'tipo': 'metade_pts',     'valor': None, 'descricao': 'Perca metade dos seus pontos',                     'icone': '📉', 'precisa_alvo': False},
]