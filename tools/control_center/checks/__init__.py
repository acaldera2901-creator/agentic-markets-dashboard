"""Registro dei check attivi.

Le fasi 2 e 3 aggiungono moduli qui e non toccano il collector. Se una fase
costringe a modificare il collector, il contratto del check era sbagliato.
"""

from . import daemons, platform


def all_checks() -> list:
    return [*platform.checks(), *daemons.checks()]
