# ADR-001 — Adoção de Clean Architecture (Hexagonal)

**Status:** Aceito  
**Data:** 2026-07-15  
**Autor:** Yara Laurito (RM373819)

## Contexto

Precisávamos de uma arquitetura que permitisse testar a lógica de negócio de forma isolada, trocar o banco de dados sem afetar os use cases e manter o código organizado à medida que o sistema crescia.

## Decisão

Adotar **Clean Architecture** com três camadas:

```
domain → application → infrastructure
```

- **domain:** entidades, interfaces de repositório, enums — zero dependências externas
- **application:** use cases, DTOs — depende apenas do domain
- **infrastructure:** TypeORM, Express, Swagger, banco — implementa as interfaces do domain

## Consequências positivas

- Use cases testáveis com mocks de repositório (62 testes sem banco real)
- Troca de ORM ou banco sem tocar em regras de negócio
- Swagger e HTTP são detalhes de infraestrutura — não contaminam o domínio

## Consequências negativas

- Mais arquivos e interfaces do que uma arquitetura MVC simples
- Curva de aprendizado para novos desenvolvedores
