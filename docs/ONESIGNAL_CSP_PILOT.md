# Piloto OneSignal e CSP no MegaBingo7

Base de comparação `207ec7cd43e756bf7e317bc14fdaa22cc76fa8f0`. Escopo da revisão: MegaBingo7.

## M-2 e política HTTP

O [registro original do M-2](AUDIT_REPORT.md#m-2--headers-de-segurança-e-csp) exige cinco cabeçalhos de segurança e restringe as fontes de script. O Web SDK v16 busca a configuração pública de inicialização inserindo um script JSONP em `https://api.onesignal.com/sync/<app-id>/web?callback=…`. A política original permitia o CDN do SDK em `script-src` e permitia conexões com o provedor em `connect-src`. A carga por elemento `<script>` tem controle próprio.

CSP anterior, também usada nas rotas e representações fora do escopo do piloto:

```text
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; manifest-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.onesignal.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' https://onesignal.com https://*.onesignal.com wss://onesignal.com wss://*.onesignal.com https://*.supabase.co wss://*.supabase.co; worker-src 'self' blob:; frame-src 'self' data: blob:
```

CSP proposta para `/` com `Accept: text/html` e sem marcadores de RSC ou prefetch, ilustrada com o UUID sintético do teste:

```text
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; manifest-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.onesignal.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' https://onesignal.com https://*.onesignal.com wss://onesignal.com wss://*.onesignal.com https://*.supabase.co wss://*.supabase.co; worker-src 'self' blob:; frame-src 'self' data: blob:; script-src-elem 'self' 'unsafe-inline' https://cdn.onesignal.com https://api.onesignal.com/sync/123e4567-e89b-42d3-a456-426614174000/web
```

O Next substitui o valor da CSP global nesse caso e emite um único cabeçalho. O caminho vem de `NEXT_PUBLIC_ONESIGNAL_APP_ID` do build e exige UUID v4 na forma hifenizada. Valor ausente ou inválido mantém as regras anteriores. O cabeçalho `Accept` seleciona a política da representação, sem participar da construção da origem autorizada. Os retornos de `/instalar` abrem um novo documento e recebem a política da raiz.

O Next mantém o próprio `Vary` do App Router. Com App ID válido, os formatos da raiz recebem `Cache-Control: private, no-store` para impedir reutilização de uma resposta com a política destinada a outro formato. Isso reduz o aproveitamento do cache HTTP da raiz durante o piloto. As demais rotas mantêm sua configuração anterior. HSTS, `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy` conservam os valores do M-2.

## Risco residual e limites

- O JSONP autorizado executa JavaScript remoto com os privilégios do documento de origem. A integridade da resposta e dos redirecionamentos do endpoint permanece sob responsabilidade do provedor.
- A CSP compara o caminho inicial e ignora a query string. Ela autoriza o endpoint com os parâmetros de consulta que ele aceitar, sem validar o nome nem o valor de `callback`.
- Após redirecionamento, a CSP deixa de comparar o caminho. Um redirecionamento do endpoint autorizado pode carregar outro caminho da mesma origem permitida. A verificação de origem continua valendo. Esse comportamento foi testado com dois destinos controlados em loopback. [CSP Level 3](https://www.w3.org/TR/CSP3/#paths-and-redirects)
- Os controles do A-5 continuam no servidor. A seleção de tenant, a validação de UUID de inscrição, o rate limiting e as regras de persistência seguem o baseline. A restrição do caminho JSONP complementa esses controles. [Auditoria CETEC](AUDIT_REPORT.md)
- O comportamento do SDK publicado pode mudar na faixa v16. Revalidar a chamada e o escopo antes de reaplicar o piloto ou trocar a configuração do provedor. [Referência do Web SDK v16](https://documentation.onesignal.com/docs/en/web-sdk-reference)

## Evidência local

- Chrome carregou o Web SDK v16 publicado com uma resposta JSONP de teste para o App ID sintético. A aplicação emitiu o evento de conclusão sem inscrição ativa. O teste isolou o tráfego externo e bloqueou a instalação real do worker e as gravações.
- Chrome bloqueou a carga direta de outro App ID, de um caminho vizinho, de uma origem externa e de script `blob:`. Uma chamada a `new Function` feita por um script de teste disparou violação de `script-src`. Uma consulta diferente no mesmo caminho JSONP foi aceita, conforme o padrão CSP.
- A inspeção HTTP do build conferiu uma única CSP por resposta e os cinco cabeçalhos, inclusive em `/instalar`, admin, APIs, manifest e workers. RSC, prefetch e requisições à raiz sem negociação de HTML mantiveram a política original. Query e cabeçalho com um App ID alternativo mantiveram a fonte definida pelo build.
- Chrome em modo Android, WebKit em modo iPhone e Chrome em modo standalone simulado confirmaram o retorno da Central com navegação de documento e a CSP da raiz.
- O launcher navegou uma vez após o evento da integração. Com o JSONP indisponível, o banner Clube VIP apareceu e o temporizador disparou uma única navegação para o destino de teste.
- Os testes M-2 cobrem configuração vazia, UUID malformado, versão e variante inválidas e entradas com sufixo. Dois builds adicionais confirmaram via HTTP a CSP anterior na raiz com a configuração vazia ou inválida. As nove suítes locais da CI passaram com 124 testes, incluindo sete testes A-5. Typecheck, lint e build passaram. O lint mantém o aviso preexistente em `formatDimension`. As auditorias npm completa e de produção retornaram zero vulnerabilidades.

## Revisão pré-versionamento do cache

A comparação usou builds de produção do baseline e do piloto na mesma origem de loopback, Chrome com perfil móvel e standalone simulado, o Service Worker real da aplicação e App ID sintético. A origem local alterou a versão servida e simulou atraso e perda de rede. Nenhum serviço de produção participou do teste de navegador.

| Cenário | Resultado observado |
| --- | --- |
| Reabertura online e offline no baseline | A navegação online atualizou o HTML em Cache Storage. A reabertura offline serviu o documento da última abertura online. |
| Perfil existente, primeira abertura online após atualização para o piloto | A raiz retornou a CSP do piloto com `private, no-store`. O Service Worker manteve o HTML do baseline como fallback. |
| Conexão lenta nesse perfil | O documento do piloto chegou em aproximadamente 1,6 s com 1,45 s de atraso injetado na origem. A navegação continuou priorizando a rede e o fallback permaneceu na versão anterior. |
| Reabertura sem rede após abertura online do piloto | O Service Worker retornou o HTML e a CSP do baseline, mesmo após ter servido o piloto online. |
| Perfil limpo e reabertura sem rede | A instalação do Service Worker inseriu o HTML do piloto via `Cache.addAll`, com `Accept: */*` e a CSP original. A reabertura offline retornou esse documento. O teste comprova a disponibilidade do HTML com cache existente. A disponibilidade de chunks e outros ativos depende do conteúdo do cache. |
| HTML e RSC | O HTML navegável recebeu a exceção JSONP. RSC recebeu a CSP original. Ambos receberam `private, no-store` no build do piloto. A raiz pública do baseline foi consultada em leitura e respondeu com `public, max-age=0, must-revalidate`. |

A proteção existente do worker exclui respostas `private` ou `no-store` da atualização normal do cache de navegação. O precache feito na instalação usa uma operação separada. A suíte de PWA passou com 25 testes, incluindo a proteção contra sobrescrever o fallback com uma resposta privada. [Service Workers, seção sobre Cache Storage](https://www.w3.org/TR/service-workers/#cache-lifetimes)

**Resultado da revisão:** a atualização do fallback a cada navegação online bem-sucedida regrediu em instalações existentes. O piloto ficou local, antes do commit e do Preview. Uma opção para avaliação futura é separar a política de CDN da revalidação HTTP, mantendo os filtros do worker. Antes de aceitar essa opção, conferir HTML e RSC alternados, revalidações HTTP 304, CSP após a CDN e reabertura offline depois de uma atualização. [Cabeçalhos de cache da Vercel](https://vercel.com/docs/caching/cache-control-headers)

## Avaliação da separação entre CDN e revalidação HTTP

Em uma cópia isolada do build, o cabeçalho da raiz foi trocado por `Cache-Control: no-cache, max-age=0, must-revalidate` e `CDN-Cache-Control: no-store`. O primeiro exige revalidação HTTP e permite que a proteção atual do Service Worker aceite a resposta pública em Cache Storage. O segundo instrui a Vercel e CDNs compatíveis a não armazenarem a resposta. O `Vercel-CDN-Cache-Control` tem precedência e é consumido pela Vercel. Como a intenção é bloquear a retenção também em outros intermediários, o teste usou apenas `CDN-Cache-Control`. [Precedência dos cabeçalhos na Vercel](https://vercel.com/docs/caching/cache-control-headers#behavior)

| Cenário | Observação no build isolado |
| --- | --- |
| Instalação nova | O precache pediu `Accept: */*`. O worker guardou o HTML com a CSP original. O perfil limpo reabriu offline. |
| Instalação existente, rede lenta e atualização online | O worker atualizou o fallback após receber o novo HTML navegável, inclusive com atraso de 1,45 s. |
| Perda de conexão | A raiz abriu com o HTML novo. A navegação offline para `/instalar` continuou com esse URL e recebeu o HTML da raiz com a exceção JSONP. |
| Recuperação da conexão | `/instalar` voltou a servir a Central com a CSP original. |
| HTML navegável e `Accept: */*` | O servidor emitiu a CSP esperada para cada requisição `200` e `304`. Os dois HTMLs compartilharam o ETag. O `Vary` gerado pelo Next manteve os marcadores do App Router e não incluiu `Accept`. |
| RSC | Manteve a CSP original. Neste build a resposta RSC não tinha ETag e devolveu `200` quando recebeu o ETag do HTML em `If-None-Match`. |

O problema é a mesma entrada de Cache Storage representar o documento navegável da raiz e a contingência para qualquer navegação pública. O worker armazena o cabeçalho CSP junto com o HTML e devolve a resposta completa. Revalidar o cache HTTP ou impedir armazenamento na CDN não altera esse comportamento. Além disso, o ETag compartilhado exige testar revalidação entre variantes em Preview. Tal validação deve confirmar a CSP entregue e a que efetivamente governa o documento após a revalidação. [RFC 9111, atualização de respostas armazenadas após 304](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.3.4)

## Implementação controlada do fallback

O worker `app-big-v2` usava a resposta de navegação de `/` como contingência para todas as rotas públicas. Com `private, no-store`, essa entrada parou de ser atualizada. A candidata anterior tornou o documento com JSONP elegível para esse mesmo cache, o que estendeu o cabeçalho a outras rotas offline.

| Representação | Política implementada |
| --- | --- |
| HTML navegável de `/` com App ID válido | Mantém a exceção JSONP e `Cache-Control: private, no-store`. |
| Demais respostas de `/` com App ID válido | CSP original. Mantêm `private, no-store`, inclusive RSC. |
| `/pwa-offline` | Rewrite interno para a página pública da raiz, com CSP original. Usa `Cache-Control: no-cache, max-age=0, must-revalidate` e `CDN-Cache-Control: no-store`. HTML e RSC continuam separados pelo `Vary` do Next. |
| Cache Storage | Armazena a representação HTML validada de `/pwa-offline`. O documento navegável de `/` nunca é gravado pelo worker novo como fallback. |

Depois de uma navegação bem-sucedida para `/` sem query, `event.waitUntil` mantém o worker ativo para buscar a contingência enquanto a resposta principal já segue para o navegador. A requisição usa o URL fixo na própria origem, `Accept: */*`, `credentials: omit`, `mode: same-origin`, `redirect: error` e `cache: no-store`. O modo de fetch evita reutilizar o cache HTTP na leitura feita pelo worker. Ele é independente do cabeçalho HTTP que o servidor envia aos outros clientes.

A gravação exige status `200`, URL final exato, tipo `text/html`, CSP idêntica ao baseline e aprovação nos filtros de cache existentes. O precache do manifest também valida status, URL, tipo `application/manifest+json`, CSP e filtros. Uma resposta inválida ou erro de rede mantém o último HTML válido. Admin, APIs e requisições com credenciais explícitas observáveis não recebem fallback. As leituras dos recursos públicos feitas para preenchimento de cache omitem credenciais. O M-2 conserva os cinco cabeçalhos e o escopo JSONP online. B-5 mantém a estratégia network-first e seus filtros. A-5, autenticação, MFA, permissões e isolamento seguem o baseline.

### Migração de app-big-v2

O novo cache é `app-big-v3`. Se o precache falhar durante a atualização, o worker pode assumir o controle usando o HTML de `app-big-v2` apenas se ele passar pelas mesmas verificações de CSP, tipo, cache e URL. Se não houver HTML válido em nenhuma versão, a instalação falha antes de `skipWaiting`. O novo worker prefere a entrada validada de `v3` assim que ela estiver disponível. `v2` e seus ativos versionados são preservados durante o piloto para reabertura de instalações existentes. A ativação remove os caches mais antigos do mesmo prefixo e preserva caches de outras integrações.

### Evidência da implementação

- Chrome com standalone simulado e builds de produção em loopback executou a troca do worker real de `v2` para `v3`. Com falha no precache, a reabertura devolveu o HTML válido de `v2`. Após recuperação, a primeira abertura online chegou em cerca de 1,6 s enquanto a leitura separada do fallback ainda aguardava um atraso de 3,1 s. O cache posteriormente passou a servir o HTML novo.
- Em perfil atualizado e com rede cortada, `/`, `/instalar` e outra rota pública receberam a CSP original. Admin e API ficaram sem fallback. A Central voltou ao conteúdo normal com a recuperação da rede. Uma falha posterior da leitura preservou o HTML válido em `v3`. Um perfil limpo gravou o HTML e o manifest no precache.
- Em `/` e `/pwa-offline`, as requisições condicionais de HTML com ambos os valores de `Accept` devolveram `304` com a CSP correspondente. RSC conservou a CSP original, respondeu `200` e ficou fora do cache de navegação. A suíte automatizada cobre, ainda, a rejeição de `304` como novo documento de contingência. [Revalidação HTTP](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.3.4)
- Os testes de navegador repetiram inicialização do SDK v16 com JSONP isolado, controles negativos de CSP, redirecionamento único, banner Clube VIP e retorno da Central em Chrome Android e WebKit iOS emulados. A matriz CETEC local passou com 141 testes, incluindo 41 de PWA. Typecheck, lint e build passaram. O aviso de lint em `formatDimension` é preexistente. As auditorias npm completa e de produção retornaram zero vulnerabilidades.

O teste local demonstra a regra do Next para o rewrite e as respostas condicionais. Em Preview, confirmar uma única CSP, os cinco cabeçalhos e a política de cache em requisições alternadas de HTML e RSC e em `304`, incluindo a entrega efetiva da Vercel e a ausência de reutilização indevida no browser. Cache Storage guarda a contingência validada. Ativos auxiliares que ainda não passaram pelo cache podem ficar indisponíveis sem rede. O armazenamento de duas versões durante a migração ocupa espaço adicional. O risco residual do JSONP online continua descrito na seção de M-2. [Cabeçalhos de cache da Vercel](https://vercel.com/docs/caching/cache-control-headers)

## Rollback e homologação

Para retirar a exceção em uma publicação futura, restaurar a CSP original em `/` e manter `/pwa-offline` disponível durante a transição dos PWAs instalados. Se o worker também precisar de rollback, publicar uma revisão compatível com versão de cache superior, mantendo os fallbacks válidos de `v2` e `v3` até que o substituto esteja validado. Republicar o worker antigo com a limpeza original de caches pode excluir a contingência de `v3`. Confirmar a ativação, a reabertura offline de perfis instalados e a disponibilidade dos ativos antes de retirar os caches anteriores. O launcher continua usando seu temporizador quando a inicialização do OneSignal está indisponível.

Antes da publicação, valide Chrome no Android e Safari com o PWA adicionado à tela inicial no iOS. Use um aplicativo OneSignal, origem e contas de teste autorizados para verificar registro do worker, opt-in novo, sincronização de inscrição existente, isolamento entre tenants e recebimento de uma notificação de teste. Inclua reinstalação, atualização de uma instalação anterior, retorno de `/instalar`, funcionamento do launcher e indisponibilidade do provedor. Em Preview, confira os cabeçalhos após a CDN, inclusive em HTML e RSC. Encaminhe a ampliação pontual do M-2 e os riscos de JSONP para revalidação formal pela CETEC antes de promover o piloto.
