# Ícones oficiais da economia

- `capiwhey.png`: moeda virtual CapiWhey.
- `capi-kit-medico.png`: Kit Médico consumível.

As artes originais enviadas ao projeto são preservadas. Os caminhos ficam
centralizados em `src/EconomyIcon.tsx`. `CapiWheyToken` e `MedicalKitIcon`
reservam uma caixa com tamanho explícito; o CSS usa `object-fit: contain`,
sem cortar, deformar ou acrescentar fundo à imagem.

Para valores de moeda, utilizar `CapiWheyAmount`: ícone e número visíveis,
nome completo somente no rótulo acessível. O cabeçalho mantém seu rótulo
acessível próprio. `ProteinToken` é um alias de compatibilidade da mesma arte.

Recompensas confirmadas utilizam o valor recebido do histórico do servidor.
Compras, preços, inventário, saldos e registros financeiros não são modificados
por estes componentes. O histórico financeiro continua preservado, sem
reintroduzir a interface de extrato que foi removida anteriormente.

Não substituir os ícones por emojis, pela logo do aplicativo ou por desenhos
genéricos. Ao substituir um arquivo oficial, executar os testes e o build para
atualizar também a versão do cache da PWA.
