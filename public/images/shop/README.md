# Cosméticos de perfil

A Loja atual utiliza somente estes arquivos oficiais:

| Pasta | Arquivo | Produto | Preço |
|---|---|---|---:|
| frames | faixa-esportiva.png | Faixa Esportiva | 80 |
| frames | onda-aquatica.png | Onda Aquática | 150 |
| frames | chama-viva.png | Chama Viva | 250 |
| frames | classica.png | Clássica | 450 |
| banners | entardecer.png | Entardecer Relax | 100 |
| banners | floresta.png | Trilha na Floresta | 180 |
| banners | noite.png | Noite Ativa | 300 |
| banners | churrasco.png | Churrasco no Pátio | 250 |

Molduras: PNG RGBA quadrado, fundo e centro transparentes, abertura circular central com diâmetro de 2/3 do arquivo. O posicionamento é ajustado por moldura em `FRAME_LAYOUT`, sem mudar a caixa do avatar. As oito artes oficiais já estão disponíveis; ao substituir uma arte, conferir novamente o encaixe. Sugestão: 600 × 600 px, abertura central de 400 px. Não desenhe outra foto dentro da moldura. Para usar WebP, altere a extensão em `src/cosmetics.ts` e publique novamente.

Banners: recomendado 1200 × 400 px, ponto focal central. Não incluir informações essenciais na arte.

As imagens antigas são mantidas para compatibilidade de caches; não pertencem ao catálogo atual. Não substituir os oito arquivos por exemplos ou ilustrações improvisadas.

## Ativação

1. Adicionar as oito imagens oficiais nos caminhos acima.
2. Executar testes e build; validar encaixe real das molduras antes de publicar.
3. Aplicar `202610190030_profile_cosmetics.sql` com a versão nova do aplicativo pronta para publicação.
4. Publicar a aplicação. Sem imagens, as compras ficam desabilitadas; sem a migração, a nova vitrine informa que aguarda a atualização do catálogo.

A migração desativa os produtos antigos, sem apagar inventários, equipamentos, saldos ou movimentações. Molduras antigas deixam de ser renderizadas. Estilos de compartilhamento, temas e reações adquiridos continuam utilizáveis. A categoria `banner` é independente de `share`. Kits e histórico continuam acessíveis em uma área recolhida da carteira, fora da vitrine.

O catálogo usa versão 3; a versão 2 continua sem a categoria banner para não quebrar PWAs antigas. Atualizar o aplicativo é necessário para a nova vitrine. O estado vem do servidor e continua usando a invalidação e sincronização existentes.
